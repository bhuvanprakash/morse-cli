export interface BillingUsageSummary {
  subscription?: Record<string, unknown>;
  metrics?: Record<string, { used: number; limit: number }>;
  billing_profile?: Record<string, unknown>;
}

export interface InvoicePreview {
  period?: string;
  currency?: string;
  subtotal_inr?: number;
  tax_inr?: number;
  total_inr?: number;
  line_items?: Array<Record<string, unknown>>;
}

export interface CreateSubscriptionOptions {
  projectId: string;
  planKey: 'free' | 'pro' | 'growth' | 'enterprise';
  businessName?: string;
  gstin?: string;
  billingAddress?: string;
  stateCode?: string;
  countryCode?: string;
}
