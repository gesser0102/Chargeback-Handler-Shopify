import { getEnvironmentWithoutRequest } from './environmentDetector';

/**
 * Sistema de logging configurável para otimizar performance em produção
 */
export class Logger {
  private static isDevelopment = getEnvironmentWithoutRequest() === 'development';

  /**
   * Log de debug - apenas em desenvolvimento
   */
  static debug(message: string, ...args: any[]): void {
    if (this.isDevelopment) {
      console.log(`🔍 DEBUG: ${message}`, ...args);
    }
  }

  /**
   * Log de informação - sempre exibido
   */
  static info(message: string, ...args: any[]): void {
    console.log(`ℹ️ INFO: ${message}`, ...args);
  }

  /**
   * Log de sucesso - sempre exibido
   */
  static success(message: string, ...args: any[]): void {
    console.log(`✅ SUCCESS: ${message}`, ...args);
  }

  /**
   * Log de aviso - sempre exibido
   */
  static warn(message: string, ...args: any[]): void {
    console.log(`⚠️ WARN: ${message}`, ...args);
  }

  /**
   * Log de erro - sempre exibido
   */
  static error(message: string, ...args: any[]): void {
    console.error(`❌ ERROR: ${message}`, ...args);
  }

  /**
   * Log de processamento - apenas em desenvolvimento
   */
  static process(message: string, ...args: any[]): void {
    if (this.isDevelopment) {
      console.log(`🔄 PROCESS: ${message}`, ...args);
    }
  }

  /**
   * Log de dados do customer - apenas em desenvolvimento
   */
  static customer(message: string, ...args: any[]): void {
    if (this.isDevelopment) {
      console.log(`👤 CUSTOMER: ${message}`, ...args);
    }
  }

  /**
   * Log de webhook - apenas em desenvolvimento
   */
  static webhook(message: string, ...args: any[]): void {
    if (this.isDevelopment) {
      console.log(`📝 WEBHOOK: ${message}`, ...args);
    }
  }
} 