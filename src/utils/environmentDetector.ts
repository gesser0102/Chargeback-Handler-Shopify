import type { HttpRequest } from "../types/azure";

/**
 * Detecta o ambiente baseado no endereço de chamada
 * @param request - Requisição HTTP
 * @returns Ambiente detectado ('development' ou 'production')
 */
export function detectEnvironment(request: HttpRequest): string {
    // Obter o host da requisição
    const host = request.headers.get('host') || '';
    
    // Lista de hosts locais/desenvolvimento
    const localHosts = [
        'localhost',
        '127.0.0.1',
        '0.0.0.0',
        '::1',
        'localhost:7071',
        '127.0.0.1:7071',
        '0.0.0.0:7071'
    ];
    
    // Verificar se é um host local
    const isLocalHost = localHosts.some(localHost => 
        host.toLowerCase().includes(localHost.toLowerCase())
    );
    
    // Verificar se o host contém indicadores de desenvolvimento
    const isDevelopmentHost = host.includes('localhost') || 
                            host.includes('127.0.0.1') || 
                            host.includes('dev.azurewebsites.net') ||
                            host.includes('test.azurewebsites.net');
    
    // Se for local ou desenvolvimento, retorna 'development'
    if (isLocalHost || isDevelopmentHost) {
        return 'development';
    }
    
    // Caso contrário, é produção
    return 'production';
}

/**
 * Obtém o ambiente usando apenas detecção automática
 * @param request - Requisição HTTP
 * @returns Ambiente final
 */
export function getEnvironment(request: HttpRequest): string {
    return detectEnvironment(request);
}

/**
 * Detecta o ambiente automaticamente sem precisar de request (para uso em serviços)
 * @returns Ambiente detectado ('development' ou 'production')
 */
export function getEnvironmentWithoutRequest(): string {
    // Verificar se está rodando no Azure Functions (produção)
    const isAzureFunctions = process.env['FUNCTIONS_WORKER_RUNTIME'] !== undefined;
    
    // Verificar se está rodando localmente
    const isLocalExecution = process.env['AZURE_FUNCTIONS_ENVIRONMENT'] === 'Development' ||
                            process.env['AZURE_FUNCTIONS_ENVIRONMENT'] === 'Local';
    
    // Verificar se está usando Azure Storage local
    const isLocalStorage = process.env['AzureWebJobsStorage'] === 'UseDevelopmentStorage=true';
    
    // Se estiver usando Azure Functions local ou storage local, é desenvolvimento
    if (isLocalExecution || isLocalStorage) {
        return 'development';
    }
    
    // Se estiver no Azure Functions mas não for local, é produção
    if (isAzureFunctions) {
        return 'production';
    }
    
    // Verificar se está rodando com func start (desenvolvimento local)
    const isFuncStart = process.argv.some(arg => arg.includes('func') || arg.includes('start'));
    
    if (isFuncStart) {
        return 'development';
    }
    
    // Por padrão, assumir produção
    return 'production';
}

/**
 * Log do ambiente detectado para debugging
 * @param request - Requisição HTTP
 * @param context - Contexto da função
 */
export function logEnvironmentInfo(request: HttpRequest, context: any): void {
    const host = request.headers.get('host') || 'unknown';
    const detectedEnv = detectEnvironment(request);
    
    context.log(`🌍 Environment Info:`);
    context.log(`   Host: ${host}`);
    context.log(`   Detected: ${detectedEnv}`);
    context.log(`   Final: ${detectedEnv}`);
} 