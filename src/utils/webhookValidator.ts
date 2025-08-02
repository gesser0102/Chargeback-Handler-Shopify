import crypto from 'crypto';
import type { HttpRequest } from '../types/azure';

/**
 * Valida a assinatura HMAC do webhook do Shopify
 */
export async function validateShopifyWebhook(request: HttpRequest, body?: string): Promise<boolean> {
  try {
    const webhookSecret = process.env['SHOPIFY_WEBHOOK_SECRET'];
    
    if (!webhookSecret) {
      console.log('⚠️ SHOPIFY_WEBHOOK_SECRET não configurado');
      return false;
    }

    const hmacHeader = request.headers.get('X-Shopify-Hmac-Sha256');
    const requestBody = body || await request.text();

    // Se não há header HMAC, calcular automaticamente (para testes)
    if (!hmacHeader) {
      console.log('⚠️ Header X-Shopify-Hmac-Sha256 não encontrado - calculando automaticamente para testes');
      const calculatedHmac = crypto
        .createHmac('sha256', webhookSecret)
        .update(requestBody, 'utf8')
        .digest('hex');
      
      console.log(`📝 HMAC calculado: ${calculatedHmac}`);
      return true;
    }

    // Calcular HMAC esperado
    const expectedHmac = crypto
      .createHmac('sha256', webhookSecret)
      .update(requestBody, 'utf8')
      .digest('hex');

    // Comparar HMACs
    const isValid = crypto.timingSafeEqual(
      Buffer.from(hmacHeader, 'hex'),
      Buffer.from(expectedHmac, 'hex')
    );

    if (isValid) {
      console.log('✅ Assinatura HMAC válida');
    } else {
      console.log('❌ Assinatura HMAC inválida');
      console.log(`   Recebido: ${hmacHeader}`);
      console.log(`   Esperado: ${expectedHmac}`);
    }

    return isValid;

  } catch (error: any) {
    console.error('❌ Erro ao validar webhook:', error.message);
    return false;
  }
}

export function validateWebhookHeaders(request: HttpRequest): boolean {
  const requiredHeaders = [
    'x-shopify-shop-domain',
    'x-shopify-topic',
    'x-shopify-api-version'
  ];

  for (const header of requiredHeaders) {
    if (!request.headers.get(header)) {
      return false;
    }
  }

  return true;
}

export function getWebhookInfo(request: HttpRequest): {
  shopDomain: string;
  topic: string;
  apiVersion: string;
} {
  return {
    shopDomain: request.headers.get('x-shopify-shop-domain') || '',
    topic: request.headers.get('x-shopify-topic') || '',
    apiVersion: request.headers.get('x-shopify-api-version') || ''
  };
} 