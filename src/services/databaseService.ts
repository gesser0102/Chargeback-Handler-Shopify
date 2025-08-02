import mysql from 'mysql2/promise';
import { Logger } from '../utils/logger';

export interface WebhookRecord {
  customer_name: string;
  customer_email: string;
  order_id: number;
  webhook_json: string;
  action: string;
  customer_tags_before: string;
  customer_tags_after: string;
  dispute_id: number;
  dispute_amount: number;
  dispute_currency: string;
  dispute_reason: string;
  dispute_status: string;
  processed_at?: Date;
}

export interface ErrorRecord {
  http_code: number;
  error_message: string;
  error_type: string;
  function_name: string;
  order_id?: number;
  dispute_id?: number;
  customer_email?: string;
  stack_trace?: string;
  request_data?: string;
  environment: string;
}

export class DatabaseService {
  private pool: mysql.Pool;

  constructor() {
    this.pool = mysql.createPool({
      host: process.env['DB_HOST'] || 'localhost',
      port: parseInt(process.env['DB_PORT'] || '3306'),
      user: process.env['DB_USER'] || 'root',
      password: process.env['DB_PASSWORD'] || '',
      database: process.env['DB_NAME'] || 'chargeback_webhooks',
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0
    });
  }

  /**
   * Testa a conexão com o banco de dados
   */
  async testConnection(): Promise<boolean> {
    try {
      const connection = await this.pool.getConnection();
      await connection.ping();
      connection.release();
      return true;
    } catch (error) {
      Logger.error('Erro ao conectar com banco:', error);
      return false;
    }
  }

  /**
   * Insere um registro de webhook
   */
  async insertWebhookRecord(record: WebhookRecord): Promise<boolean> {
    try {
      const query = `
        INSERT INTO tab_wbk_itm (
          customer_name, customer_email, order_id, webhook_json, action,
          customer_tags_before, customer_tags_after, dispute_id,
          dispute_amount, dispute_currency, dispute_reason, dispute_status,
          processed_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;

      const values = [
        record.customer_name,
        record.customer_email,
        record.order_id,
        record.webhook_json,
        record.action,
        record.customer_tags_before,
        record.customer_tags_after,
        record.dispute_id,
        record.dispute_amount,
        record.dispute_currency,
        record.dispute_reason,
        record.dispute_status,
        record.processed_at || new Date()
      ];

      await this.pool.execute(query, values);
      return true;
    } catch (error) {
      Logger.error('Erro ao inserir webhook:', error);
      return false;
    }
  }

  /**
   * Insere um registro de erro
   */
  async insertErrorRecord(record: ErrorRecord): Promise<boolean> {
    try {
      const query = `
        INSERT INTO tab_sis_err (
          http_code, error_message, error_type, function_name,
          order_id, dispute_id, customer_email, stack_trace,
          request_data, environment
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;

      const values = [
        record.http_code,
        record.error_message,
        record.error_type,
        record.function_name,
        record.order_id || null,
        record.dispute_id || null,
        record.customer_email || null,
        record.stack_trace || null,
        record.request_data || null,
        record.environment
      ];

      await this.pool.execute(query, values);
      return true;
    } catch (error) {
      Logger.error('Erro ao inserir erro:', error);
      return false;
    }
  }

  /**
   * Busca registros de webhook por order_id
   */
  async getWebhookRecordsByOrderId(orderId: number): Promise<any[]> {
    try {
      const query = `
        SELECT * FROM tab_wbk_itm 
        WHERE order_id = ? 
        ORDER BY data DESC
      `;

      const [rows] = await this.pool.execute(query, [orderId]);
      return rows as any[];
    } catch (error) {
      Logger.error('Erro ao buscar webhooks por order_id:', error);
      return [];
    }
  }

  /**
   * Busca erros por período
   */
  async getErrorRecordsByPeriod(days: number = 7): Promise<any[]> {
    try {
      const query = `
        SELECT * FROM tab_sis_err 
        WHERE data >= DATE_SUB(NOW(), INTERVAL ? DAY)
        ORDER BY data DESC
      `;

      const [rows] = await this.pool.execute(query, [days]);
      return rows as any[];
    } catch (error) {
      Logger.error('Erro ao buscar erros por período:', error);
      return [];
    }
  }

  /**
   * Executa uma query genérica
   */
  async query(sql: string, params?: any[]): Promise<any[]> {
    try {
      const [rows] = await this.pool.execute(sql, params || []);
      return rows as any[];
    } catch (error) {
      Logger.error('Erro ao executar query:', error);
      throw error;
    }
  }

  /**
   * Fecha a conexão com o banco
   */
  async close(): Promise<void> {
    await this.pool.end();
  }
} 