/**
 * Interfaces locais para tipos do Azure Functions
 * Usado para evitar problemas de importação com @azure/functions
 */

export interface HttpRequest {
  headers: {
    get(name: string): string | null;
  };
  text(): Promise<string>;
}

export interface HttpResponseInit {
  status?: number;
  body?: any;
  headers?: Record<string, string>;
}

export interface InvocationContext {
  log(message: string, ...args: any[]): void;
  error(message: string, error?: any): void;
} 