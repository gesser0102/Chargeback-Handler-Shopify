import axios from 'axios';
import { ShopifyOrder } from "../types/shopify";
import { Logger } from '../utils/logger';

export class ShopifyService {
  private shopDomain: string;
  private accessToken: string;
  private apiVersion: string;

  constructor() {
    this.shopDomain = process.env['SHOPIFY_SHOP_DOMAIN'] || '';
    this.accessToken = process.env['SHOPIFY_ACCESS_TOKEN'] || '';
    this.apiVersion = process.env['SHOPIFY_API_VERSION'] || '2025-07';
  }

  /**
   * Obtém dados de uma order do Shopify
   */
  async getOrder(orderId: number): Promise<ShopifyOrder | null> {
    try {
      const url = `https://${this.shopDomain}/admin/api/${this.apiVersion}/orders/${orderId}.json`;
      
      const response = await axios.get(url, {
        headers: {
          'X-Shopify-Access-Token': this.accessToken,
          'Content-Type': 'application/json'
        }
      });

      if (response.data && response.data.order) {
        return response.data.order;
      }
      
      return null;
    } catch (error: any) {
      if (error.response?.status === 404) {
        Logger.error(`Order ${orderId} not found`);
      } else {
        Logger.error(`Error fetching order ${orderId}: ${error.message}`);
      }
      return null;
    }
  }

  /**
   * Atualiza as tags de um customer
   */
  async updateCustomerTags(customerId: number, tags: string): Promise<boolean> {
    try {
      const url = `https://${this.shopDomain}/admin/api/${this.apiVersion}/customers/${customerId}.json`;
      
      await axios.put(url, {
        customer: {
          id: customerId,
          tags: tags
        }
      }, {
        headers: {
          'X-Shopify-Access-Token': this.accessToken,
          'Content-Type': 'application/json'
        }
      });

      return true;
    } catch (error: any) {
      Logger.error(`Error updating customer ${customerId} tags: ${error.message}`);
      return false;
    }
  }
} 