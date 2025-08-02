export interface ChargebackPayload {
  id: number;
  order_id: number;
  type: string;
  amount: string;
  currency: string;
  reason: string;
  network_reason_code: string;
  status: string;
  evidence_due_by: string;
  finalized_on: string | null;
  created_at: string;
}

export interface WebhookRequest {
  body: ChargebackPayload;
  headers: Record<string, string>;
  method: string;
  url: string;
} 