import { apiClient } from '$api/client';
import { buildQuery } from '$lib/utils/query';

export interface DashboardSnapshot {
  usageSummary: Record<string, unknown> | null;
  incidents: Array<Record<string, unknown>>;
  components: Array<Record<string, unknown>>;
  auditSummary: Record<string, unknown> | null;
  notifyStats: Record<string, unknown> | null;
  collections: Array<Record<string, unknown>>;
  jobs: Array<Record<string, unknown>>;
  flagsCount: number;
}

export interface QueueFilters {
  queue_name?: string;
  status?: string;
  limit?: number;
  offset?: number;
}

export interface AdminUserFilters {
  offset?: number;
  limit?: number;
  q?: string;
}

export interface AuditFilters {
  project_id?: string;
  actor?: string;
  action?: string;
  resource_type?: string;
  severity?: string;
  from?: string;
  to?: string;
  limit?: number;
  offset?: number;
}

async function getPayload<T>(path: string): Promise<T> {
  return apiClient.get<T>(path);
}

async function postPayload<T>(path: string, body: unknown): Promise<T> {
  return apiClient.post<T>(path, body);
}

async function patchPayload<T>(path: string, body: unknown): Promise<T> {
  return apiClient.patch<T>(path, body);
}

async function deletePayload<T>(path: string): Promise<T> {
  return apiClient.delete<T>(path);
}

async function getWithFallback<T>(paths: string[]): Promise<T> {
  let lastError: unknown;
  for (const path of paths) {
    try {
      return await getPayload<T>(path);
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError ?? new Error('Request failed');
}

async function postWithFallback<T>(paths: string[], body: unknown): Promise<T> {
  let lastError: unknown;
  for (const path of paths) {
    try {
      return await postPayload<T>(path, body);
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError ?? new Error('Request failed');
}

async function deleteWithFallback<T>(paths: string[]): Promise<T> {
  let lastError: unknown;
  for (const path of paths) {
    try {
      return await deletePayload<T>(path);
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError ?? new Error('Request failed');
}

function encodeObjectPath(path: string): string {
  return path
    .split('/')
    .filter((segment) => segment.length > 0)
    .map((segment) => encodeURIComponent(segment))
    .join('/');
}

export const studioApi = {
  // Platform context
  listOrganizations: () => getPayload<Array<Record<string, unknown>> | Record<string, unknown>>('/meta/organizations'),
  createOrganization: (body: Record<string, unknown>) => postPayload<Record<string, unknown>>('/meta/organizations', body),
  listProjects: (orgId?: string) =>
    getPayload<Array<Record<string, unknown>>>(`/meta/projects${buildQuery({ org_id: orgId })}`),
  createProject: (body: Record<string, unknown>) => postPayload<Record<string, unknown>>('/meta/projects', body),
  getProject: (id: string) => getPayload<Record<string, unknown>>(`/meta/projects/${encodeURIComponent(id)}`),
  pauseProject: (id: string) => postPayload<Record<string, unknown>>(`/meta/projects/${encodeURIComponent(id)}/pause`, {}),
  resumeProject: (id: string) => postPayload<Record<string, unknown>>(`/meta/projects/${encodeURIComponent(id)}/resume`, {}),
  deleteProject: (id: string) => deletePayload<Record<string, unknown>>(`/meta/projects/${encodeURIComponent(id)}`),

  async fetchDashboard(projectId: string, environment = 'production'): Promise<DashboardSnapshot> {
    const queries = await Promise.allSettled([
      getPayload<Record<string, unknown>>(`/billing/usage/summary${buildQuery({ project_id: projectId })}`),
      getPayload<Record<string, unknown>>('/status/public'),
      getPayload<Record<string, unknown>>('/audit/summary'),
      getPayload<Record<string, unknown>>('/notify/stats'),
      getPayload<Record<string, unknown>>('/ai/collections'),
      getPayload<Record<string, unknown>>('/queue/jobs?limit=50'),
      getPayload<Record<string, unknown>>(`/config/flags${buildQuery({ environment })}`),
    ]);

    const usage = queries[0].status === 'fulfilled' ? queries[0].value : null;
    const status = queries[1].status === 'fulfilled' ? queries[1].value : {};
    const audit = queries[2].status === 'fulfilled' ? queries[2].value : null;
    const notify = queries[3].status === 'fulfilled' ? queries[3].value : null;
    const ai = queries[4].status === 'fulfilled' ? queries[4].value : {};
    const jobs = queries[5].status === 'fulfilled' ? queries[5].value : {};
    const flags = queries[6].status === 'fulfilled' ? queries[6].value : [];

    const statusData = (status && 'data' in status ? status.data : status) as Record<string, unknown>;
    const collections = (ai as { collections?: Array<Record<string, unknown>> }).collections ?? [];
    const allJobs = Array.isArray(jobs)
      ? jobs
      : ((jobs as { jobs?: Array<Record<string, unknown>>; data?: Array<Record<string, unknown>> }).jobs ??
        (jobs as { data?: Array<Record<string, unknown>> }).data ??
        []);
    const flagsData = Array.isArray(flags)
      ? flags
      : ((flags as { flags?: Array<Record<string, unknown>>; data?: Array<Record<string, unknown>> }).flags ??
        (flags as { data?: Array<Record<string, unknown>> }).data ??
        []);

    return {
      usageSummary: usage,
      incidents: (statusData?.incidents as Array<Record<string, unknown>>) ?? [],
      components: (statusData?.components as Array<Record<string, unknown>>) ?? [],
      auditSummary: audit,
      notifyStats: notify,
      collections,
      jobs: allJobs,
      flagsCount: flagsData.length,
    };
  },

  // AI
  listCollections: () => getPayload<{ collections: Array<Record<string, unknown>> }>('/ai/collections'),
  createCollection: (body: { name: string; description?: string }) => postPayload<Record<string, unknown>>('/ai/collections', body),
  deleteCollection: (name: string) => deletePayload<Record<string, unknown>>(`/ai/collections/${encodeURIComponent(name)}`),
  listDocuments: (name: string, limit = 100, offset = 0) =>
    getPayload<{ documents: Array<Record<string, unknown>>; count: number }>(
      `/ai/collections/${encodeURIComponent(name)}/documents${buildQuery({ limit, offset })}`
    ),
  upsertDocuments: (name: string, body: { documents: Array<Record<string, unknown>> }) =>
    postPayload<{ documents: Array<Record<string, unknown>>; count: number }>(
      `/ai/collections/${encodeURIComponent(name)}/documents`,
      body
    ),
  deleteDocument: (collection: string, id: string) =>
    deletePayload<Record<string, unknown>>(`/ai/collections/${encodeURIComponent(collection)}/documents/${encodeURIComponent(id)}`),
  searchDocuments: (
    name: string,
    body: { query: string; limit?: number; min_similarity?: number; filter?: Record<string, unknown> }
  ) => postPayload<{ results: Array<Record<string, unknown>>; count: number }>(`/ai/collections/${encodeURIComponent(name)}/search`, body),

  // Queue
  listJobs: (filters: QueueFilters) =>
    getPayload<Array<Record<string, unknown>>>(`/queue/jobs${buildQuery(filters as Record<string, unknown>)}`),
  listQueues: () => getPayload<Array<Record<string, unknown>>>('/queue/queues'),
  enqueueJob: (body: Record<string, unknown>) => postPayload<Record<string, unknown>>('/queue/jobs', body),
  listWebhooks: () => getPayload<Array<Record<string, unknown>>>('/queue/webhooks'),
  createWebhook: (body: Record<string, unknown>) => postPayload<Record<string, unknown>>('/queue/webhooks', body),
  updateWebhook: (id: string, body: Record<string, unknown>) => patchPayload<Record<string, unknown>>(`/queue/webhooks/${id}`, body),
  deleteWebhook: (id: string) => deletePayload<Record<string, unknown>>(`/queue/webhooks/${id}`),
  testWebhook: (id: string) => postPayload<Record<string, unknown>>(`/queue/webhooks/${id}/test`, {}),
  listCron: () => getPayload<Array<Record<string, unknown>>>('/queue/cron'),
  createCron: (body: Record<string, unknown>) => postPayload<Record<string, unknown>>('/queue/cron', body),
  updateCron: (id: string, body: Record<string, unknown>) => patchPayload<Record<string, unknown>>(`/queue/cron/${id}`, body),
  deleteCron: (id: string) => deletePayload<Record<string, unknown>>(`/queue/cron/${id}`),
  runCronNow: (id: string) => postPayload<Record<string, unknown>>(`/queue/cron/${id}/run-now`, {}),

  // Notifications
  sendPush: (body: Record<string, unknown>) => postPayload<Record<string, unknown>>('/notify/push', body),
  registerPushToken: (body: Record<string, unknown>) => postPayload<Record<string, unknown>>('/notify/push/register', body),
  sendSMS: (body: Record<string, unknown>) => postPayload<Record<string, unknown>>('/notify/sms', body),
  sendBatchSMS: (body: Record<string, unknown>) => postPayload<Record<string, unknown>>('/notify/sms/batch', body),
  sendEmail: (body: Record<string, unknown>) => postPayload<Record<string, unknown>>('/notify/email', body),
  sendBatchEmail: (body: Record<string, unknown>) => postPayload<Record<string, unknown>>('/notify/email/batch', body),
  sendWhatsApp: (body: Record<string, unknown>) => postPayload<Record<string, unknown>>('/notify/whatsapp', body),
  listNotifyTemplates: () => getPayload<Array<Record<string, unknown>>>('/notify/templates'),
  createNotifyTemplate: (body: Record<string, unknown>) => postPayload<Record<string, unknown>>('/notify/templates', body),
  updateNotifyTemplate: (name: string, body: Record<string, unknown>) =>
    apiClient.put<Record<string, unknown>>(`/notify/templates/${encodeURIComponent(name)}`, body),
  deleteNotifyTemplate: (name: string) => deletePayload<Record<string, unknown>>(`/notify/templates/${encodeURIComponent(name)}`),
  previewNotifyTemplate: (name: string, body: Record<string, unknown>) =>
    postPayload<Record<string, unknown>>(`/notify/templates/${encodeURIComponent(name)}/preview`, body),
  listNotifyHistory: (filters: Record<string, unknown>) =>
    getPayload<Array<Record<string, unknown>>>(`/notify/history${buildQuery(filters)}`),
  getNotifyStats: () => getPayload<Record<string, unknown>>('/notify/stats'),

  // Feature flags + remote config
  listEnvironments: () => getPayload<Array<Record<string, unknown>>>('/config/environments'),
  listFlags: (environment: string) => getPayload<Array<Record<string, unknown>>>(`/config/flags${buildQuery({ environment })}`),
  getFlag: (key: string, environment: string) =>
    getPayload<Record<string, unknown>>(`/config/flags/${encodeURIComponent(key)}${buildQuery({ environment })}`),
  createFlag: (body: Record<string, unknown>) => postPayload<Record<string, unknown>>('/config/flags', body),
  updateFlag: (key: string, environment: string, body: Record<string, unknown>) =>
    patchPayload<Record<string, unknown>>(`/config/flags/${encodeURIComponent(key)}${buildQuery({ environment })}`, body),
  deleteFlag: (key: string, environment: string) =>
    deletePayload<Record<string, unknown>>(`/config/flags/${encodeURIComponent(key)}${buildQuery({ environment })}`),
  evaluateFlags: (body: Record<string, unknown>) => postPayload<Record<string, unknown>>('/config/evaluate', body),
  listRemoteConfig: (environment: string) => getPayload<Array<Record<string, unknown>>>(`/config/remote${buildQuery({ environment })}`),
  getRemoteConfig: (key: string, environment: string) =>
    getPayload<Record<string, unknown>>(`/config/remote/${encodeURIComponent(key)}${buildQuery({ environment })}`),
  createRemoteConfig: (body: Record<string, unknown>) => postPayload<Record<string, unknown>>('/config/remote', body),
  updateRemoteConfig: (key: string, body: Record<string, unknown>, environment?: string) =>
    patchPayload<Record<string, unknown>>(`/config/remote/${encodeURIComponent(key)}${buildQuery({ environment })}`, body),
  deleteRemoteConfig: (key: string, environment?: string) =>
    deletePayload<Record<string, unknown>>(`/config/remote/${encodeURIComponent(key)}${buildQuery({ environment })}`),
  exportRemoteConfig: async (environment: string) => {
    const response = await apiClient.requestRaw(`/config/remote/export${buildQuery({ environment })}`, { method: 'GET' });
    if (!response.ok) {
      throw new Error(`Remote config export failed (${response.status})`);
    }
    return response.text();
  },

  // Enterprise SSO + SCIM
  verifyDomain: (body: Record<string, unknown>) => postPayload<Record<string, unknown>>('/auth/enterprise/domains/verify', body),
  listEnterpriseConnections: () => getPayload<Array<Record<string, unknown>>>('/auth/enterprise/connections'),
  getEnterpriseConnection: (id: string) => getPayload<Record<string, unknown>>(`/auth/enterprise/connections/${id}`),
  createEnterpriseConnection: (body: Record<string, unknown>) =>
    postPayload<Record<string, unknown>>('/auth/enterprise/connections', body),
  updateEnterpriseConnection: (id: string, body: Record<string, unknown>) =>
    apiClient.put<Record<string, unknown>>(`/auth/enterprise/connections/${id}`, body),
  deleteEnterpriseConnection: (id: string) => deletePayload<Record<string, unknown>>(`/auth/enterprise/connections/${id}`),
  listEnterpriseEvents: () => getPayload<Array<Record<string, unknown>>>('/auth/enterprise/events'),
  getSSOMetadata: async (slug: string) => {
    const response = await apiClient.requestRaw(`/auth/sso/${encodeURIComponent(slug)}/metadata`, { method: 'GET' });
    if (!response.ok) {
      throw new Error(`Metadata fetch failed (${response.status})`);
    }
    return response.text();
  },
  listSCIMTokens: (connectionId: string) =>
    getPayload<Array<Record<string, unknown>>>(`/auth/enterprise/connections/${connectionId}/scim/tokens`),
  createSCIMToken: (connectionId: string, body: Record<string, unknown>) =>
    postPayload<Record<string, unknown>>(`/auth/enterprise/connections/${connectionId}/scim/tokens`, body),
  rotateSCIMToken: (connectionId: string, tokenId: string) =>
    postPayload<Record<string, unknown>>(`/auth/enterprise/connections/${connectionId}/scim/tokens/${tokenId}/rotate`, {}),
  revokeSCIMToken: (connectionId: string, tokenId: string) =>
    deletePayload<Record<string, unknown>>(`/auth/enterprise/connections/${connectionId}/scim/tokens/${tokenId}`),

  // Audit
  listAuditEvents: (filters: AuditFilters) =>
    getPayload<Array<Record<string, unknown>>>(`/audit/events${buildQuery(filters as Record<string, unknown>)}`),
  getAuditEvent: (id: string) => getPayload<Record<string, unknown>>(`/audit/events/${id}`),
  getAuditSummary: () => getPayload<Record<string, unknown>>('/audit/summary'),
  downloadAuditExport: (format: 'json' | 'csv', filters: AuditFilters) =>
    apiClient.download(
      `/audit/export${buildQuery({ format, ...(filters as Record<string, unknown>) })}`,
      `indusbase-audit.${format}`
    ),

  // Billing
  listBillingPlans: () => getPayload<Array<Record<string, unknown>>>('/billing/plans'),
  getBillingUsageSummary: (projectId: string, from?: string, to?: string) =>
    getPayload<Record<string, unknown>>(`/billing/usage/summary${buildQuery({ project_id: projectId, from, to })}`),
  listBillingUsageDaily: (projectId: string, days = 30) =>
    getPayload<Array<Record<string, unknown>>>(`/billing/usage${buildQuery({ project_id: projectId, days })}`),
  listInvoices: (projectId: string) => getPayload<Array<Record<string, unknown>>>(`/billing/invoices${buildQuery({ project_id: projectId })}`),
  getInvoice: (id: string) => getPayload<Record<string, unknown>>(`/billing/invoices/${id}`),
  previewInvoice: (projectId: string) => getPayload<Record<string, unknown>>(`/billing/invoices/preview${buildQuery({ project_id: projectId })}`),
  createSubscription: (body: Record<string, unknown>) => postPayload<Record<string, unknown>>('/billing/subscriptions', body),
  updateSubscription: (id: string, body: Record<string, unknown>) => patchPayload<Record<string, unknown>>(`/billing/subscriptions/${id}`, body),
  getActiveSubscription: (projectId: string) =>
    getPayload<Record<string, unknown>>(`/billing/subscriptions/active${buildQuery({ project_id: projectId })}`),

  // Trust center + security scans
  getTrustCenterSettings: () => getPayload<Record<string, unknown>>('/meta/trust-center'),
  updateTrustCenterSettings: (body: Record<string, unknown>) => apiClient.put<Record<string, unknown>>('/meta/trust-center', body),
  listSubprocessors: () => getPayload<Array<Record<string, unknown>>>('/meta/subprocessors'),
  createSubprocessor: (body: Record<string, unknown>) => postPayload<Record<string, unknown>>('/meta/subprocessors', body),
  updateSubprocessor: (id: string, body: Record<string, unknown>) =>
    apiClient.put<Record<string, unknown>>(`/meta/subprocessors/${id}`, body),
  deleteSubprocessor: (id: string) => deletePayload<Record<string, unknown>>(`/meta/subprocessors/${id}`),
  listComplianceMilestones: () => getPayload<Array<Record<string, unknown>>>('/meta/compliance-milestones'),
  createComplianceMilestone: (body: Record<string, unknown>) => postPayload<Record<string, unknown>>('/meta/compliance-milestones', body),
  updateComplianceMilestone: (id: string, body: Record<string, unknown>) =>
    apiClient.put<Record<string, unknown>>(`/meta/compliance-milestones/${id}`, body),
  deleteComplianceMilestone: (id: string) => deletePayload<Record<string, unknown>>(`/meta/compliance-milestones/${id}`),
  listPublicIncidents: () => getPayload<Array<Record<string, unknown>>>('/meta/public-incidents'),
  createPublicIncident: (body: Record<string, unknown>) => postPayload<Record<string, unknown>>('/meta/public-incidents', body),
  updatePublicIncident: (id: string, body: Record<string, unknown>) =>
    apiClient.put<Record<string, unknown>>(`/meta/public-incidents/${id}`, body),
  deletePublicIncident: (id: string) => deletePayload<Record<string, unknown>>(`/meta/public-incidents/${id}`),
  getSecurityScanSummary: () => getPayload<Record<string, unknown>>('/meta/security/scans/summary'),
  listSecurityScanRuns: () => getPayload<Array<Record<string, unknown>>>('/meta/security/scans'),

  // Secrets
  listSecrets: (filters: { scope?: string; project_id?: string }) =>
    getPayload<Array<Record<string, unknown>>>(`/secrets${buildQuery(filters)}`),
  createSecret: (body: Record<string, unknown>) => postPayload<Record<string, unknown>>('/secrets', body),
  getSecret: (name: string) => getPayload<Record<string, unknown>>(`/secrets/${encodeURIComponent(name)}`),
  rotateSecret: (name: string, value: string) =>
    postPayload<Record<string, unknown>>(`/secrets/${encodeURIComponent(name)}/rotate`, { value }),
  rollbackSecret: (name: string, version: number) =>
    postPayload<Record<string, unknown>>(`/secrets/${encodeURIComponent(name)}/rollback`, { version }),
  listSecretVersions: (name: string) =>
    getPayload<Array<Record<string, unknown>>>(`/secrets/${encodeURIComponent(name)}/versions`),

  // Status + incidents
  getStatusPublic: () => getPayload<Record<string, unknown>>('/status/public'),
  listIncidents: () => getPayload<Array<Record<string, unknown>>>('/status/incidents'),
  createIncident: (body: Record<string, unknown>) => postPayload<Record<string, unknown>>('/status/incidents', body),
  updateIncident: (id: string, body: Record<string, unknown>) => patchPayload<Record<string, unknown>>(`/status/incidents/${id}`, body),
  resolveIncident: (id: string, body?: Record<string, unknown>) => postPayload<Record<string, unknown>>(`/status/incidents/${id}/resolve`, body ?? {}),
  listMaintenance: () => getPayload<Array<Record<string, unknown>>>('/status/maintenance'),
  createMaintenance: (body: Record<string, unknown>) => postPayload<Record<string, unknown>>('/status/maintenance', body),
  subscribeStatus: (email: string) => postPayload<Record<string, unknown>>('/status/subscribe', { email }),

  // Support console
  supportSearchUsers: (query: string) =>
    getPayload<Array<Record<string, unknown>>>(`/meta/support/users/search${buildQuery({ q: query })}`),
  supportSearchProjects: (query: string) =>
    getPayload<Array<Record<string, unknown>>>(`/meta/support/projects/search${buildQuery({ q: query })}`),
  supportContext: (userId?: string, projectId?: string) =>
    getPayload<Record<string, unknown>>(`/meta/support/context${buildQuery({ user_id: userId, project_id: projectId })}`),
  supportCreateNote: (body: Record<string, unknown>) => postPayload<Record<string, unknown>>('/meta/support/notes', body),
  supportListNotes: (userId?: string, projectId?: string) =>
    getPayload<Array<Record<string, unknown>>>(`/meta/support/notes${buildQuery({ user_id: userId, project_id: projectId })}`),
  supportRequestImpersonation: (body: Record<string, unknown>) =>
    postPayload<Record<string, unknown>>('/meta/support/impersonation/request', body),

  // Auth admin users
  listAuthUsers: (filters: AdminUserFilters) =>
    getWithFallback<Record<string, unknown>>([
      `/auth/admin/users${buildQuery(filters as Record<string, unknown>)}`,
      `/admin/users${buildQuery(filters as Record<string, unknown>)}`
    ]),
  getAuthUser: (id: string) =>
    getWithFallback<Record<string, unknown>>([
      `/auth/admin/users/${id}`,
      `/admin/users/${id}`
    ]),
  banAuthUser: (id: string, reason?: string) =>
    postWithFallback<Record<string, unknown>>([
      `/auth/admin/users/${id}/ban`,
      `/admin/users/${id}/ban`
    ], reason ? { reason } : {}),
  unbanAuthUser: (id: string) =>
    postWithFallback<Record<string, unknown>>([
      `/auth/admin/users/${id}/unban`,
      `/admin/users/${id}/unban`
    ], {}),
  deleteAuthUser: (id: string) =>
    deleteWithFallback<Record<string, unknown>>([
      `/auth/admin/users/${id}`,
      `/admin/users/${id}`
    ]),

  // SQL + table editor
  executeSQL: async (query: string) => {
    const response = await apiClient.requestRaw('/meta/query', {
      method: 'POST',
      body: JSON.stringify({ query }),
      headers: { 'Content-Type': 'application/json' },
    });

    const payload = (await response.json().catch(() => ({}))) as Record<string, unknown>;
    if (!response.ok || payload.success === false) {
      throw new Error(String(payload.error ?? `SQL query failed (${response.status})`));
    }
    const result = payload.result as Record<string, unknown> | undefined;
    return {
      columns: (result?.columns as string[] | undefined) ?? [],
      rows: (result?.rows as Array<Array<unknown>> | undefined) ?? [],
      count: Number(result?.count ?? 0),
    };
  },
  listTables: async () => {
    const response = await apiClient.requestRaw('/graphql', {
      method: 'POST',
      body: JSON.stringify({ query: '{ tables }' }),
      headers: { 'Content-Type': 'application/json' },
    });
    const payload = (await response.json().catch(() => ({}))) as {
      data?: { tables?: string[] };
      errors?: Array<{ message?: string }>;
    };
    if (!response.ok || payload.errors?.length) {
      throw new Error(payload.errors?.[0]?.message ?? `Failed to list tables (${response.status})`);
    }
    return payload.data?.tables ?? [];
  },
  listTableRows: (table: string, page = 1, limit = 50) =>
    getPayload<{
      data: Array<Record<string, unknown>>;
      meta: { page: number; limit: number; total: number; total_pages: number; has_next: boolean; has_prev: boolean };
    }>(`/rest/${encodeURIComponent(table)}${buildQuery({ page, limit })}`),
  getTableRow: (table: string, id: string) =>
    getPayload<{ data: Record<string, unknown> }>(`/rest/${encodeURIComponent(table)}/${encodeURIComponent(id)}`),

  // Storage
  listBuckets: () => getPayload<Record<string, unknown>>('/storage/v1/bucket'),
  createBucket: (body: Record<string, unknown>) => postPayload<Record<string, unknown>>('/storage/v1/bucket', body),
  updateBucket: (id: string, body: Record<string, unknown>) =>
    patchPayload<Record<string, unknown>>(`/storage/v1/bucket/${encodeURIComponent(id)}`, body),
  deleteBucket: (id: string) => deletePayload<Record<string, unknown>>(`/storage/v1/bucket/${encodeURIComponent(id)}`),
  listObjects: (bucket: string, prefix?: string) =>
    getPayload<Record<string, unknown>>(`/storage/v1/object/list/${encodeURIComponent(bucket)}${buildQuery({ prefix })}`),
  uploadObject: async (bucket: string, filepath: string, form: FormData) => {
    const encodedPath = encodeObjectPath(filepath);
    const res = await apiClient.requestRaw(`/storage/v1/object/${encodeURIComponent(bucket)}/${encodedPath}`, {
      method: 'POST',
      body: form,
      headers: {},
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(text || `Upload failed (${res.status})`);
    }
    const contentType = res.headers.get('content-type') || '';
    return contentType.includes('application/json') ? res.json() : {};
  },
  deleteObject: (bucket: string, filepath: string) =>
    deletePayload<Record<string, unknown>>(`/storage/v1/object/${encodeURIComponent(bucket)}/${encodeObjectPath(filepath)}`),
  downloadObject: async (bucket: string, filepath: string) => {
    const res = await apiClient.requestRaw(`/storage/v1/object/${encodeURIComponent(bucket)}/${encodeObjectPath(filepath)}`, { method: 'GET' });
    if (!res.ok) throw new Error(`Download failed (${res.status})`);
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filepath.split('/').pop() || 'download';
    link.click();
    URL.revokeObjectURL(url);
  },
};
