export interface ShopifyCustomer {
  id: number;
  first_name?: string;
  last_name?: string;
  email?: string;
  tags?: string;
}

export interface ShopifyOrder {
  id: number;
  name: string; // Order name (ex: "#SP22774")
  customer?: ShopifyCustomer;
}

export interface ShopifyDispute {
  id: number;
  order_id: number;
  amount: string;
  currency: string;
  reason: string;
  status: string;
  type: string;
  created_at: string;
  network_reason_code: string;
  evidence_due_by: string;
} 