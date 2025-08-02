import { app } from "@azure/functions";
import type { HttpRequest, HttpResponseInit, InvocationContext } from "../types/azure";
import { validateShopifyWebhook } from "../utils/webhookValidator";
import { ChargebackService } from "../services/chargebackService";
import { DatabaseService } from "../services/databaseService";
import { SlackService } from "../services/slackService";
import { ShopifyDispute } from "../types/shopify";
import { getEnvironment, logEnvironmentInfo } from "../utils/environmentDetector";
import 'dotenv/config';

// Variável global para armazenar o tempo de início
const START_TIME = new Date();

app.http('chargeback', {
    methods: ['POST'],
    authLevel: 'anonymous',
    handler: async (request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> => {
        const chargebackService = new ChargebackService();
        const databaseService = new DatabaseService();
        const slackService = new SlackService();
        
        try {
            context.log('🔔 Webhook de chargeback recebido');

            // Log das informações de ambiente
            logEnvironmentInfo(request, context);

            // Ler o corpo da requisição uma única vez
            const body = await request.text();



            // Validar assinatura do webhook
            const isValid = await validateShopifyWebhook(request, body);
            if (!isValid) {
                context.log('❌ Assinatura do webhook inválida');
                
                // Persistir erro de assinatura inválida
                await persistError(databaseService, {
                    http_code: 401,
                    error_message: 'Assinatura do webhook inválida',
                    error_type: 'InvalidSignature',
                    function_name: 'ChargebackWebhook.handler',
                    environment: getEnvironment(request)
                });

                // Enviar notificação de erro para o Slack
                await slackService.sendWebhookNotification(
                    {} as ShopifyDispute,
                    'Invalid webhook signature'
                );
                
                return { status: 401, body: 'Unauthorized' };
            }

            // Parse do JSON usando o corpo já lido
            let dispute: ShopifyDispute;
            try {
                dispute = JSON.parse(body);
            } catch (parseError: any) {
                context.log('❌ Erro ao fazer parse do JSON:', parseError.message);
                
                // Persistir erro de parsing com dados sanitizados
                await persistError(databaseService, {
                    http_code: 400,
                    error_message: `Erro ao fazer parse do JSON: ${parseError.message}`,
                    error_type: 'JSONParseError',
                    function_name: 'ChargebackWebhook.handler',
                    request_data: sanitizeRequestData(body),
                    environment: getEnvironment(request)
                });

                // Enviar notificação de erro para o Slack
                await slackService.sendWebhookNotification(
                    {} as ShopifyDispute,
                    `JSON parse error: ${parseError.message}`
                );
                
                return { status: 400, body: 'Invalid JSON' };
            }

            context.log(`📦 Dispute ID: ${dispute.id}`);
            context.log(`📦 Order ID: ${dispute.order_id}`);
            context.log(`💰 Valor: ${dispute.amount} ${dispute.currency}`);
            context.log(`📋 Motivo: ${dispute.reason}`);
            context.log(`📊 Status: ${dispute.status}`);
            context.log(`🏷️ Tipo: ${dispute.type}`);
            context.log(`📅 Criado em: ${dispute.created_at}`);
            context.log(`🔢 Código da rede: ${dispute.network_reason_code}`);
            context.log(`⏰ Evidência deve ser enviada até: ${dispute.evidence_due_by}`);

            // Verificar se é um chargeback
            if (dispute.type !== 'chargeback') {
                context.log(`⚠️ Tipo não suportado: ${dispute.type}`);
                
                // Persistir erro de tipo não suportado
                await persistError(databaseService, {
                    http_code: 400,
                    error_message: `Tipo de dispute não suportado: ${dispute.type}`,
                    error_type: 'UnsupportedDisputeType',
                    function_name: 'ChargebackWebhook.handler',
                    dispute_id: dispute.id,
                    request_data: sanitizeRequestData(JSON.stringify(dispute)),
                    environment: getEnvironment(request)
                });

                // Enviar notificação de erro para o Slack
                await slackService.sendWebhookNotification(
                    dispute,
                    `Unsupported dispute type: ${dispute.type}`
                );
                
                return { status: 400, body: 'Tipo de dispute não suportado' };
            }

            // Processar chargeback com persistência no banco
            const result = await chargebackService.processChargeback(dispute, request);

            if (result.success) {
                context.log('✅ Chargeback processado com sucesso');
                return { status: 200, body: 'Webhook processado com sucesso' };
            } else {
                context.log(`❌ Falha ao processar chargeback: ${result.message}`);
                
                // Se for erro 404 (order não encontrada), não enviar para o Slack
                if (result.statusCode === 404) {
                    return { status: 404, body: result.message };
                }
                
                // Para outros erros, persistir e enviar para o Slack
                await persistError(databaseService, {
                    http_code: result.statusCode || 500,
                    error_message: result.message || 'Falha ao processar chargeback',
                    error_type: 'ProcessingError',
                    function_name: 'ChargebackWebhook.handler',
                    dispute_id: dispute.id,
                    order_id: dispute.order_id,
                    environment: getEnvironment(request)
                });

                // Enviar notificação de erro para o Slack
                await slackService.sendWebhookNotification(
                    dispute,
                    'Failed to process chargeback'
                );
                
                return { status: result.statusCode || 500, body: result.message || 'Erro interno do servidor' };
            }

        } catch (error: any) {
            context.error('❌ Erro ao processar webhook:', error);
            
            // Persistir erro geral
            await persistError(databaseService, {
                http_code: 500,
                error_message: error.message,
                error_type: error.constructor.name,
                function_name: 'ChargebackWebhook.handler',
                customer_email: 'email@not.identified.com', // Erro geral, não temos dados do customer
                stack_trace: error.stack,
                environment: getEnvironment(request)
            });

            // Enviar notificação de erro para o Slack
            await slackService.sendWebhookNotification(
                {} as ShopifyDispute,
                `General error: ${error.message}`
            );
            
            // Tentar fechar conexões
            try {
                await chargebackService.close();
            } catch (dbError) {
                context.error('❌ Erro ao fechar conexão com banco:', dbError);
            }
            
            return { status: 500, body: 'Erro interno do servidor' };
        }
    }
});

/**
 * Função auxiliar para persistir erros no banco
 */
async function persistError(databaseService: DatabaseService, errorData: any): Promise<void> {
    try {
        const dbAvailable = await databaseService.testConnection();
        if (dbAvailable) {
            await databaseService.insertErrorRecord(errorData);
            console.log('✅ Erro persistido no banco');
        } else {
            console.log('⚠️ Banco não disponível - erro não persistido');
        }
    } catch (dbError) {
        console.error('❌ Erro ao persistir erro no banco:', dbError);
    }
}

/**
 * Função para sanitizar dados antes de inserir no banco JSON
 */
function sanitizeRequestData(data: string): string {
    try {
        // Se já é um JSON válido, retorna como está
        JSON.parse(data);
        return data;
    } catch {
        // Se não é JSON válido, limpa caracteres de controle e cria um objeto
        const sanitized = data
            .replace(/[\x00-\x1F\x7F-\x9F]/g, '') // Remove caracteres de controle
            .replace(/\n/g, '\\n') // Escapa quebras de linha
            .replace(/\r/g, '\\r') // Escapa retornos de carro
            .replace(/\t/g, '\\t'); // Escapa tabs
        
        return JSON.stringify({
            original_data: sanitized,
            length: data.length,
            error: 'Invalid JSON data'
        });
    }
}

// Função de status da aplicação
app.http('status', {
    methods: ['GET'],
    authLevel: 'anonymous',
    handler: async (request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> => {
        const databaseService = new DatabaseService();
        
        try {
            context.log('📊 Status check iniciado');

            // Log das informações de ambiente
            logEnvironmentInfo(request, context);

            const statusResponse: any = {
                status: 'running',
                timestamp: new Date().toISOString(),
                version: '1.0.0',
                environment: getEnvironment(request),
                services: {
                    database: { status: 'disconnected' },
                    shopify: { status: 'not_configured' },
                    slack: { status: 'not_configured' }
                },
                metrics: {
                    total_chargebacks: 0,
                    chargebacks_today: 0,
                    chargebacks_this_month: 0,
                    errors_today: 0,
                    errors_this_month: 0
                },
                uptime: {
                    start_time: START_TIME.toISOString(),
                    uptime_seconds: Math.floor((Date.now() - START_TIME.getTime()) / 1000)
                }
            };

            // Verificar configuração do Shopify
            if (process.env['SHOPIFY_SHOP_DOMAIN'] && process.env['SHOPIFY_ACCESS_TOKEN']) {
                statusResponse.services.shopify = {
                    status: 'configured',
                    domain: process.env['SHOPIFY_SHOP_DOMAIN']
                };
            }

            // Verificar configuração do Slack
            if (process.env['SLACK_BOT_TOKEN'] ) {
                statusResponse.services.slack = {
                    status: 'configured'
                };
            }

            // Verificar conexão com banco de dados
            try {
                await databaseService.testConnection();
                statusResponse.services.database = { status: 'connected' };
                
                // Buscar métricas básicas
                const metrics = await getMetrics(databaseService);
                statusResponse.metrics = metrics;
                
            } catch (dbError: any) {
                context.log('❌ Erro na conexão com banco:', dbError.message);
                statusResponse.services.database = {
                    status: 'error',
                    message: dbError.message
                };
                statusResponse.status = 'degraded';
            }

            context.log('✅ Status check concluído');
            
            return {
                status: 200,
                headers: {
                    'Content-Type': 'application/json',
                    'Cache-Control': 'no-cache'
                },
                body: JSON.stringify(statusResponse, null, 2)
            };

        } catch (error: any) {
            context.error('❌ Erro no status check:', error);
            
            return {
                status: 500,
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    status: 'unhealthy',
                    error: error.message
                }, null, 2)
            };
        }
    }
});

async function getMetrics(databaseService: DatabaseService) {
    try {
        // Buscar métricas de chargebacks da tabela tab_wbk_itm
        const totalChargebacksQuery = `
            SELECT COUNT(*) as total 
            FROM tab_wbk_itm 
            WHERE dispute_id IS NOT NULL
        `;
        
        const chargebacksTodayQuery = `
            SELECT COUNT(*) as total 
            FROM tab_wbk_itm 
            WHERE dispute_id IS NOT NULL 
            AND DATE(data) = CURDATE()
        `;
        
        const chargebacksThisMonthQuery = `
            SELECT COUNT(*) as total 
            FROM tab_wbk_itm 
            WHERE dispute_id IS NOT NULL 
            AND YEAR(data) = YEAR(CURDATE()) 
            AND MONTH(data) = MONTH(CURDATE())
        `;
        
        // Buscar métricas de erros da tabela tab_sis_err
        const errorsTodayQuery = `
            SELECT COUNT(*) as total 
            FROM tab_sis_err 
            WHERE DATE(data) = CURDATE()
        `;
        
        const errorsThisMonthQuery = `
            SELECT COUNT(*) as total 
            FROM tab_sis_err 
            WHERE YEAR(data) = YEAR(CURDATE()) 
            AND MONTH(data) = MONTH(CURDATE())
        `;

        const [
            totalChargebacks,
            chargebacksToday,
            chargebacksThisMonth,
            errorsToday,
            errorsThisMonth
        ] = await Promise.all([
            databaseService.query(totalChargebacksQuery),
            databaseService.query(chargebacksTodayQuery),
            databaseService.query(chargebacksThisMonthQuery),
            databaseService.query(errorsTodayQuery),
            databaseService.query(errorsThisMonthQuery)
        ]);

        return {
            total_chargebacks: totalChargebacks[0]?.total || 0,
            chargebacks_today: chargebacksToday[0]?.total || 0,
            chargebacks_this_month: chargebacksThisMonth[0]?.total || 0,
            errors_today: errorsToday[0]?.total || 0,
            errors_this_month: errorsThisMonth[0]?.total || 0
        };

    } catch (error: any) {
        console.error('Erro ao buscar métricas:', error.message);
        return {
            total_chargebacks: 0,
            chargebacks_today: 0,
            chargebacks_this_month: 0,
            errors_today: 0,
            errors_this_month: 0
        };
    }
} 