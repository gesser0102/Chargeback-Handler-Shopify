import { ShopifyService } from './shopifyService';
import { DatabaseService, WebhookRecord } from './databaseService';
import { SlackService } from './slackService';
import { ShopifyDispute } from '../types/shopify';
import type { HttpRequest } from '../types/azure';
import { getEnvironment } from '../utils/environmentDetector';
import { Logger } from '../utils/logger';

export class ChargebackService {
  private shopifyService: ShopifyService;
  private databaseService: DatabaseService;
  private slackService: SlackService;
  private dbAvailable: boolean = false;

  constructor() {
    this.shopifyService = new ShopifyService();
    this.databaseService = new DatabaseService();
    this.slackService = new SlackService();
  }

  /**
   * Processa um chargeback e registra no banco de dados (se disponível)
   * @returns {Promise<{success: boolean, statusCode?: number, message?: string}>}
   */
  async processChargeback(dispute: ShopifyDispute, request?: HttpRequest): Promise<{success: boolean, statusCode?: number, message?: string}> {
    try {
      Logger.process(`Processando chargeback ID: ${dispute.id}`);
      Logger.process(`Order ID: ${dispute.order_id}`);
      Logger.process(`Valor: ${dispute.amount} ${dispute.currency}`);
      Logger.process(`Motivo: ${dispute.reason}`);
      Logger.process(`Status: ${dispute.status}`);

      // Testar conexão com banco (apenas uma vez)
              if (!this.dbAvailable) {
          this.dbAvailable = await this.databaseService.testConnection();
          if (!this.dbAvailable) {
            Logger.warn('Banco de dados não disponível - continuando sem persistência');
          }
        }

      // Obter dados da order
      const order = await this.shopifyService.getOrder(dispute.order_id);
      if (!order) {
        Logger.error(`Order ${dispute.order_id} não encontrada`);
        
        // Registrar erro no banco (se disponível)
        if (this.dbAvailable) {
          await this.databaseService.insertErrorRecord({
            http_code: 404,
            error_message: `Order ${dispute.order_id} not found`,
            error_type: 'OrderNotFound',
            function_name: 'ChargebackService.processChargeback',
            order_id: dispute.order_id,
            dispute_id: dispute.id,
            customer_email: 'email@not.identified.com', // Order não encontrada, não temos email
            environment: request ? getEnvironment(request) : 'development'
          });
        }

        // NÃO enviar notificação para o Slack quando order não for encontrada
        // (apenas registrar no banco)
        
        return {
          success: false,
          statusCode: 404,
          message: `Order ${dispute.order_id} not found`
        };
      }

      // Obter dados do customer
      const customerName = order.customer ? 
        `${order.customer.first_name || ''} ${order.customer.last_name || ''}`.trim() : 
        'Customer not identified';
      
      const customerEmail = order.customer?.email || 'email@not.identified.com';
      const customerTags = order.customer?.tags || '';
      const orderName = order.name || `#${dispute.order_id}`; // Usar o name da order ou fallback

      Logger.customer(`Customer: ${customerName}`);
      Logger.customer(`Email: ${customerEmail}`);
      Logger.customer(`Tags atuais: ${customerTags}`);
      Logger.customer(`Order Name: ${orderName}`);

      // Aplicar lógica de tags
      const tagResult = this.applyTagLogic(customerTags);
      
      // Atualizar tags se necessário
      let finalTags = customerTags;
      if (tagResult.shouldUpdate) {
        if (order.customer) {
          const updateSuccess = await this.shopifyService.updateCustomerTags(
            order.customer.id, 
            tagResult.newTags
          );
          
          if (updateSuccess) {
            finalTags = tagResult.newTags;
            Logger.success(`Tags atualizadas para: ${finalTags}`);
          } else {
            Logger.error(`Falha ao atualizar tags`);
          }
        } else {
          Logger.error(`Customer não encontrado na order`);
        }
      } else {
        Logger.info(`Nenhuma mudança necessária nas tags`);
      }

      // Registrar webhook no banco (se disponível)
      if (this.dbAvailable) {
        const webhookRecord: WebhookRecord = {
          customer_name: customerName,
          customer_email: customerEmail,
          order_id: dispute.order_id,
          webhook_json: JSON.stringify(dispute),
          action: tagResult.action,
          customer_tags_before: customerTags,
          customer_tags_after: finalTags,
          dispute_id: dispute.id,
          dispute_amount: parseFloat(dispute.amount),
          dispute_currency: dispute.currency,
          dispute_reason: dispute.reason,
          dispute_status: dispute.status,
          processed_at: new Date()
        };

        const dbSuccess = await this.databaseService.insertWebhookRecord(webhookRecord);
        
        if (dbSuccess) {
          Logger.success(`Webhook registrado no banco`);
        } else {
          Logger.warn(`Falha ao registrar no banco`);
        }
      } else {
        Logger.webhook(`Log do webhook (sem persistência):`);
        Logger.webhook(`   Customer: ${customerName}`);
        Logger.webhook(`   Email: ${customerEmail}`);
        Logger.webhook(`   Order Name: ${orderName}`);
        Logger.webhook(`   Action: ${tagResult.action}`);
        Logger.webhook(`   Tags antes: ${customerTags}`);
        Logger.webhook(`   Tags depois: ${finalTags}`);
      }

      // Enviar notificação de sucesso para o Slack com dados do customer
      await this.slackService.sendWebhookNotification(
        dispute, 
        tagResult.action,
        customerName,
        customerEmail,
        orderName
      );
      
      Logger.success(`Chargeback ${dispute.id} processado com sucesso`);
      return {
        success: true,
        statusCode: 200,
        message: 'Chargeback processed successfully'
      };

    } catch (error: any) {
      Logger.error(`Erro ao processar chargeback ${dispute.id}: ${error.message}`);
      
      // Registrar erro no banco (se disponível)
      if (this.dbAvailable) {
        // Tentar obter o email do customer mesmo em caso de erro
        let customerEmail = 'email@not.identified.com';
        try {
          const order = await this.shopifyService.getOrder(dispute.order_id);
          if (order?.customer?.email) {
            customerEmail = order.customer.email;
          }
        } catch (orderError) {
          Logger.warn('Não foi possível obter dados da order para o email do customer');
        }

        await this.databaseService.insertErrorRecord({
          http_code: 500,
          error_message: error.message,
          error_type: error.constructor.name,
          function_name: 'ChargebackService.processChargeback',
          order_id: dispute.order_id,
          dispute_id: dispute.id,
          customer_email: customerEmail,
          stack_trace: error.stack,
          request_data: JSON.stringify(dispute),
          environment: request ? getEnvironment(request) : 'development'
        });
      }

      // Enviar notificação de erro para o Slack
      await this.slackService.sendWebhookNotification(
        dispute,
        'Failed to process chargeback'
      );
      
      return {
        success: false,
        statusCode: 500,
        message: 'Internal server error'
      };
    }
  }

  /**
   * Aplica a lógica de tags conforme especificado
   */
  private applyTagLogic(currentTags: string): {
    shouldUpdate: boolean;
    newTags: string;
    action: string;
  } {
    const hasChargebackFlag1 = currentTags.includes('chargeback_flag1');
    const hasChargebackRisk = currentTags.includes('chargeback_risk');

    if (hasChargebackRisk) {
      return {
        shouldUpdate: false,
        newTags: currentTags,
        action: 'Customer already has chargeback_risk, no need to add chargeback_flag1'
      };
    } else if (!hasChargebackFlag1) {
      const newTags = currentTags ? `${currentTags}, chargeback_flag1` : 'chargeback_flag1';
      return {
        shouldUpdate: true,
        newTags,
        action: 'Added tag: chargeback_flag1'
      };
    } else {
      const newTags = currentTags ? `${currentTags}, chargeback_risk` : 'chargeback_risk';
      return {
        shouldUpdate: true,
        newTags,
        action: 'Added tag: chargeback_risk (customer already has chargeback_flag1)'
      };
    }
  }

  /**
   * Fecha as conexões
   */
  async close(): Promise<void> {
    if (this.dbAvailable) {
      await this.databaseService.close();
    }
  }
} 