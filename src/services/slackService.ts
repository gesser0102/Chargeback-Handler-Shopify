import { WebClient } from '@slack/web-api';
import { ShopifyDispute } from '../types/shopify';

export class SlackService {
  private client: WebClient;
  private channelId: string;

  constructor() {
    this.client = new WebClient(process.env['SLACK_BOT_TOKEN']);
    this.channelId = process.env['SLACK_CHANNEL_ID'] || '';
  }

  /**
   * Envia notificação de nova requisição recebida
   */
  async sendWebhookNotification(
    dispute: ShopifyDispute, 
    action?: string,
    customerName?: string,
    customerEmail?: string,
    orderName?: string
  ): Promise<boolean> {
    try {
      if (!this.channelId) {
        console.log('⚠️ SLACK_CHANNEL_ID não configurado');
        return false;
      }

      const message = this.buildWebhookMessage(dispute, action, customerName, customerEmail, orderName);
      
      const result = await this.client.chat.postMessage({
        channel: this.channelId,
        text: message.text,
        attachments: message.attachments
      });

      if (result.ok) {
        console.log('✅ Notificação enviada para o Slack');
        return true;
      } else {
        console.log('❌ Falha ao enviar notificação para o Slack:', result.error);
        return false;
      }

    } catch (error: any) {
      console.error('❌ Erro ao enviar notificação para o Slack:', error.message);
      return false;
    }
  }

  /**
   * Constrói mensagem de webhook centralizada
   */
  private buildWebhookMessage(
    dispute: ShopifyDispute,  
    action?: string,
    customerName?: string,
    customerEmail?: string,
    orderName?: string
  ) {
    
    // Usar dados reais do customer ou fallbacks
    const customerEmailFinal = customerEmail || 'customer@email.com';
    const customerNameFinal = customerName || 'Customer Name';
    const orderNameFinal = orderName || `#${dispute.order_id}`;
    
    // Título com informações do customer
    const text = `🚨 *New Chargeback Request | ${customerNameFinal} | ${dispute.amount} ${dispute.currency}*`;

         // Construir 3 attachments separados
     const attachments = [
       {
         color: '#36a64f', // Verde
         text: `\`\`\`
 Order: <https://${process.env['SHOPIFY_SHOP_DOMAIN']}/admin/orders/${dispute.order_id}|*${orderNameFinal}*>
 Customer: ${customerNameFinal}
 Email: ${customerEmailFinal}
 Amount: ${dispute.amount} ${dispute.currency}\`\`\``
       },
      {
        color: '#36a64f', // Verde
        text: `\`\`\`
Dispute ID: ${dispute.id}
Type: ${dispute.type}
Status: ${dispute.status}
\`\`\``
      }
    ];

    // Adicionar action se existir
    if (action) {
      attachments.push({
        color: '#36a64f', // Verde
        text: `\`\`\`
Action: ${this.translateActionToEnglish(action)}
\`\`\``
      });
    }

    // Adicionar footer apenas no último attachment
    if (attachments.length > 0) {
      (attachments[attachments.length - 1] as any).footer = `${new Date().toLocaleString('en-US')}`;
    }

    return { text, attachments };
  }

  /**
   * Traduz as ações para inglês
   */
  private translateActionToEnglish(action: string): string {
    const translations: { [key: string]: string } = {
      'Adicionada tag: chargeback_flag1': 'Added tag: chargeback_flag1',
      'Adicionada tag: chargeback_risk (customer já tem chargeback_flag1)': 'Added tag: chargeback_risk (customer already has chargeback_flag1)',
      'Customer já tem chargeback_risk, não é necessário adicionar chargeback_flag1': 'Customer already has chargeback_risk, no need to add chargeback_flag1',
      'Falha ao processar chargeback': 'Failed to process chargeback',
      'Order not found': 'Order not found',
      'Failed to update customer tags': 'Failed to update customer tags'
    };

    return translations[action] || action;
  }
}