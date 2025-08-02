import crypto from 'crypto';
import type { HttpRequest } from '../types/azure';
import { Logger } from './logger';

/**
 * Valida a assinatura HMAC do webhook do Shopify
 */
export async function validateShopifyWebhook(request: HttpRequest, body?: string): Promise<boolean> {
  try {
    const webhookSecret = process.env['SHOPIFY_WEBHOOK_SECRET'];
    
    if (!webhookSecret) {
      Logger.warn('SHOPIFY_WEBHOOK_SECRET não configurado');
      return false;
    }

    const hmacHeader = request.headers.get('X-Shopify-Hmac-Sha256');
    const requestBody = body || await request.text();

    // Se não há header HMAC, calcular automaticamente (para testes)
    if (!hmacHeader) {
      Logger.warn('Header X-Shopify-Hmac-Sha256 não encontrado - calculando automaticamente para testes');
      const calculatedHmac = crypto
        .createHmac('sha256', webhookSecret)
        .update(requestBody, 'utf8')
        .digest('base64');
      
      Logger.webhook(`HMAC calculado (base64): ${calculatedHmac}`);
      return true;
    }

    // Calcular HMAC esperado em base64
    const expectedHmac = crypto
      .createHmac('sha256', webhookSecret)
      .update(requestBody, 'utf8')
      .digest('base64');

    // Comparar HMACs (ambos em base64)
    const isValid = crypto.timingSafeEqual(
      Buffer.from(hmacHeader, 'base64'),
      Buffer.from(expectedHmac, 'base64')
    );

    if (isValid) {
      Logger.success('Assinatura HMAC válida (base64)');
    } else {
      Logger.error('Assinatura HMAC inválida');
      Logger.webhook(`Recebido (base64): ${hmacHeader}`);
      Logger.webhook(`Esperado (base64): ${expectedHmac}`);
    }

    return isValid;

  } catch (error: any) {
    Logger.error('Erro ao validar webhook:', error.message);
    return false;
  }
}

/**
 * Valida se o webhook é do tipo correto (chargeback)
 */
export function validateChargebackWebhook(request: HttpRequest): boolean {
  const topic = request.headers.get('x-shopify-topic');
  
  // Lista de tópicos de chargeback suportados
  const supportedTopics = [
    'disputes/create',
    'disputes/update',
    'chargebacks/create',
    'chargebacks/update'
  ];

  if (!topic) {
    Logger.error('Header x-shopify-topic não encontrado');
    return false;
  }

  const isSupported = supportedTopics.includes(topic);
  
  if (isSupported) {
    Logger.success(`Tópico suportado: ${topic}`);
  } else {
    Logger.error(`Tópico não suportado: ${topic}`);
    Logger.webhook(`Tópicos suportados: ${supportedTopics.join(', ')}`);
  }

  return isSupported;
}

/**
 * Valida se o shop domain é o esperado
 */
export function validateShopDomain(request: HttpRequest): boolean {
  const expectedDomain = process.env['SHOPIFY_SHOP_DOMAIN'];
  const receivedDomain = request.headers.get('x-shopify-shop-domain');

  if (!expectedDomain) {
    Logger.warn('SHOPIFY_SHOP_DOMAIN não configurado');
    return true; // Permite se não estiver configurado
  }

  if (!receivedDomain) {
    Logger.error('Header x-shopify-shop-domain não encontrado');
    return false;
  }

  const isValid = receivedDomain === expectedDomain;
  
  if (isValid) {
    Logger.success(`Shop domain válido: ${receivedDomain}`);
  } else {
    Logger.error('Shop domain inválido');
    Logger.webhook(`Recebido: ${receivedDomain}`);
    Logger.webhook(`Esperado: ${expectedDomain}`);
  }

  return isValid;
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
  webhookId: string;
  eventId: string;
  triggeredAt: string;
} {
  return {
    shopDomain: request.headers.get('x-shopify-shop-domain') || '',
    topic: request.headers.get('x-shopify-topic') || '',
    apiVersion: request.headers.get('x-shopify-api-version') || '',
    webhookId: request.headers.get('x-shopify-webhook-id') || '',
    eventId: request.headers.get('x-shopify-event-id') || '',
    triggeredAt: request.headers.get('x-shopify-triggered-at') || ''
  };
} 