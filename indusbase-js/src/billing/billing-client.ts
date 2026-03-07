import type { FetchClient } from '../lib/fetch.js';
import type { BillingUsageSummary, CreateSubscriptionOptions, InvoicePreview } from './types.js';

export class BillingClient {
  constructor(private fetch: FetchClient) {}

  async listPlans() {
    return this.fetch.request('/billing/plans', { method: 'GET' });
  }

  async usage(projectId?: string) {
    const query = projectId ? `?project_id=${encodeURIComponent(projectId)}` : '';
    return this.fetch.request(`/billing/usage${query}`, { method: 'GET' });
  }

  async usageSummary(projectId?: string) {
    const query = projectId ? `?project_id=${encodeURIComponent(projectId)}` : '';
    return this.fetch.request<BillingUsageSummary>(`/billing/usage/summary${query}`, { method: 'GET' });
  }

  async listInvoices(projectId?: string) {
    const query = projectId ? `?project_id=${encodeURIComponent(projectId)}` : '';
    return this.fetch.request(`/billing/invoices${query}`, { method: 'GET' });
  }

  async invoicePreview(projectId?: string) {
    const query = projectId ? `?project_id=${encodeURIComponent(projectId)}` : '';
    return this.fetch.request<InvoicePreview>(`/billing/invoices/preview${query}`, { method: 'GET' });
  }

  async createSubscription(options: CreateSubscriptionOptions) {
    return this.fetch.request('/billing/subscriptions', {
      method: 'POST',
      body: JSON.stringify({
        project_id: options.projectId,
        plan_key: options.planKey,
        business_name: options.businessName,
        gstin: options.gstin,
        billing_address: options.billingAddress,
        state_code: options.stateCode,
        country_code: options.countryCode ?? 'IN',
      }),
    });
  }
}
