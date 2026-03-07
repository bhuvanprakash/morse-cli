import { a as apiClient } from "./client2.js";
function buildQuery(params) {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value == null || value === "") continue;
    if (Array.isArray(value)) {
      for (const item of value) {
        if (item != null && item !== "") search.append(key, String(item));
      }
      continue;
    }
    search.set(key, String(value));
  }
  const qs = search.toString();
  return qs ? `?${qs}` : "";
}
async function getPayload(path) {
  return apiClient.get(path);
}
async function postPayload(path, body) {
  return apiClient.post(path, body);
}
async function patchPayload(path, body) {
  return apiClient.patch(path, body);
}
async function deletePayload(path) {
  return apiClient.delete(path);
}
async function getWithFallback(paths) {
  let lastError;
  for (const path of paths) {
    try {
      return await getPayload(path);
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError ?? new Error("Request failed");
}
async function postWithFallback(paths, body) {
  let lastError;
  for (const path of paths) {
    try {
      return await postPayload(path, body);
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError ?? new Error("Request failed");
}
async function deleteWithFallback(paths) {
  let lastError;
  for (const path of paths) {
    try {
      return await deletePayload(path);
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError ?? new Error("Request failed");
}
function encodeObjectPath(path) {
  return path.split("/").filter((segment) => segment.length > 0).map((segment) => encodeURIComponent(segment)).join("/");
}
const studioApi = {
  // Platform context
  listOrganizations: () => getPayload("/meta/organizations"),
  createOrganization: (body) => postPayload("/meta/organizations", body),
  listProjects: (orgId) => getPayload(`/meta/projects${buildQuery({ org_id: orgId })}`),
  createProject: (body) => postPayload("/meta/projects", body),
  getProject: (id) => getPayload(`/meta/projects/${encodeURIComponent(id)}`),
  pauseProject: (id) => postPayload(`/meta/projects/${encodeURIComponent(id)}/pause`, {}),
  resumeProject: (id) => postPayload(`/meta/projects/${encodeURIComponent(id)}/resume`, {}),
  deleteProject: (id) => deletePayload(`/meta/projects/${encodeURIComponent(id)}`),
  async fetchDashboard(projectId, environment = "production") {
    const queries = await Promise.allSettled([
      getPayload(`/billing/usage/summary${buildQuery({ project_id: projectId })}`),
      getPayload("/status/public"),
      getPayload("/audit/summary"),
      getPayload("/notify/stats"),
      getPayload("/ai/collections"),
      getPayload("/queue/jobs?limit=50"),
      getPayload(`/config/flags${buildQuery({ environment })}`)
    ]);
    const usage = queries[0].status === "fulfilled" ? queries[0].value : null;
    const status = queries[1].status === "fulfilled" ? queries[1].value : {};
    const audit = queries[2].status === "fulfilled" ? queries[2].value : null;
    const notify = queries[3].status === "fulfilled" ? queries[3].value : null;
    const ai = queries[4].status === "fulfilled" ? queries[4].value : {};
    const jobs = queries[5].status === "fulfilled" ? queries[5].value : {};
    const flags = queries[6].status === "fulfilled" ? queries[6].value : [];
    const statusData = status && "data" in status ? status.data : status;
    const collections = ai.collections ?? [];
    const allJobs = Array.isArray(jobs) ? jobs : jobs.jobs ?? jobs.data ?? [];
    const flagsData = Array.isArray(flags) ? flags : flags.flags ?? flags.data ?? [];
    return {
      usageSummary: usage,
      incidents: statusData?.incidents ?? [],
      components: statusData?.components ?? [],
      auditSummary: audit,
      notifyStats: notify,
      collections,
      jobs: allJobs,
      flagsCount: flagsData.length
    };
  },
  // AI
  listCollections: () => getPayload("/ai/collections"),
  createCollection: (body) => postPayload("/ai/collections", body),
  deleteCollection: (name) => deletePayload(`/ai/collections/${encodeURIComponent(name)}`),
  listDocuments: (name, limit = 100, offset = 0) => getPayload(
    `/ai/collections/${encodeURIComponent(name)}/documents${buildQuery({ limit, offset })}`
  ),
  upsertDocuments: (name, body) => postPayload(
    `/ai/collections/${encodeURIComponent(name)}/documents`,
    body
  ),
  deleteDocument: (collection, id) => deletePayload(`/ai/collections/${encodeURIComponent(collection)}/documents/${encodeURIComponent(id)}`),
  searchDocuments: (name, body) => postPayload(`/ai/collections/${encodeURIComponent(name)}/search`, body),
  // Queue
  listJobs: (filters) => getPayload(`/queue/jobs${buildQuery(filters)}`),
  listQueues: () => getPayload("/queue/queues"),
  enqueueJob: (body) => postPayload("/queue/jobs", body),
  listWebhooks: () => getPayload("/queue/webhooks"),
  createWebhook: (body) => postPayload("/queue/webhooks", body),
  updateWebhook: (id, body) => patchPayload(`/queue/webhooks/${id}`, body),
  deleteWebhook: (id) => deletePayload(`/queue/webhooks/${id}`),
  testWebhook: (id) => postPayload(`/queue/webhooks/${id}/test`, {}),
  listCron: () => getPayload("/queue/cron"),
  createCron: (body) => postPayload("/queue/cron", body),
  updateCron: (id, body) => patchPayload(`/queue/cron/${id}`, body),
  deleteCron: (id) => deletePayload(`/queue/cron/${id}`),
  runCronNow: (id) => postPayload(`/queue/cron/${id}/run-now`, {}),
  // Notifications
  sendPush: (body) => postPayload("/notify/push", body),
  registerPushToken: (body) => postPayload("/notify/push/register", body),
  sendSMS: (body) => postPayload("/notify/sms", body),
  sendBatchSMS: (body) => postPayload("/notify/sms/batch", body),
  sendEmail: (body) => postPayload("/notify/email", body),
  sendBatchEmail: (body) => postPayload("/notify/email/batch", body),
  sendWhatsApp: (body) => postPayload("/notify/whatsapp", body),
  listNotifyTemplates: () => getPayload("/notify/templates"),
  createNotifyTemplate: (body) => postPayload("/notify/templates", body),
  updateNotifyTemplate: (name, body) => apiClient.put(`/notify/templates/${encodeURIComponent(name)}`, body),
  deleteNotifyTemplate: (name) => deletePayload(`/notify/templates/${encodeURIComponent(name)}`),
  previewNotifyTemplate: (name, body) => postPayload(`/notify/templates/${encodeURIComponent(name)}/preview`, body),
  listNotifyHistory: (filters) => getPayload(`/notify/history${buildQuery(filters)}`),
  getNotifyStats: () => getPayload("/notify/stats"),
  // Feature flags + remote config
  listEnvironments: () => getPayload("/config/environments"),
  listFlags: (environment) => getPayload(`/config/flags${buildQuery({ environment })}`),
  getFlag: (key, environment) => getPayload(`/config/flags/${encodeURIComponent(key)}${buildQuery({ environment })}`),
  createFlag: (body) => postPayload("/config/flags", body),
  updateFlag: (key, environment, body) => patchPayload(`/config/flags/${encodeURIComponent(key)}${buildQuery({ environment })}`, body),
  deleteFlag: (key, environment) => deletePayload(`/config/flags/${encodeURIComponent(key)}${buildQuery({ environment })}`),
  evaluateFlags: (body) => postPayload("/config/evaluate", body),
  listRemoteConfig: (environment) => getPayload(`/config/remote${buildQuery({ environment })}`),
  getRemoteConfig: (key, environment) => getPayload(`/config/remote/${encodeURIComponent(key)}${buildQuery({ environment })}`),
  createRemoteConfig: (body) => postPayload("/config/remote", body),
  updateRemoteConfig: (key, body, environment) => patchPayload(`/config/remote/${encodeURIComponent(key)}${buildQuery({ environment })}`, body),
  deleteRemoteConfig: (key, environment) => deletePayload(`/config/remote/${encodeURIComponent(key)}${buildQuery({ environment })}`),
  exportRemoteConfig: async (environment) => {
    const response = await apiClient.requestRaw(`/config/remote/export${buildQuery({ environment })}`, { method: "GET" });
    if (!response.ok) {
      throw new Error(`Remote config export failed (${response.status})`);
    }
    return response.text();
  },
  // Enterprise SSO + SCIM
  verifyDomain: (body) => postPayload("/auth/enterprise/domains/verify", body),
  listEnterpriseConnections: () => getPayload("/auth/enterprise/connections"),
  getEnterpriseConnection: (id) => getPayload(`/auth/enterprise/connections/${id}`),
  createEnterpriseConnection: (body) => postPayload("/auth/enterprise/connections", body),
  updateEnterpriseConnection: (id, body) => apiClient.put(`/auth/enterprise/connections/${id}`, body),
  deleteEnterpriseConnection: (id) => deletePayload(`/auth/enterprise/connections/${id}`),
  listEnterpriseEvents: () => getPayload("/auth/enterprise/events"),
  getSSOMetadata: async (slug) => {
    const response = await apiClient.requestRaw(`/auth/sso/${encodeURIComponent(slug)}/metadata`, { method: "GET" });
    if (!response.ok) {
      throw new Error(`Metadata fetch failed (${response.status})`);
    }
    return response.text();
  },
  listSCIMTokens: (connectionId) => getPayload(`/auth/enterprise/connections/${connectionId}/scim/tokens`),
  createSCIMToken: (connectionId, body) => postPayload(`/auth/enterprise/connections/${connectionId}/scim/tokens`, body),
  rotateSCIMToken: (connectionId, tokenId) => postPayload(`/auth/enterprise/connections/${connectionId}/scim/tokens/${tokenId}/rotate`, {}),
  revokeSCIMToken: (connectionId, tokenId) => deletePayload(`/auth/enterprise/connections/${connectionId}/scim/tokens/${tokenId}`),
  // Audit
  listAuditEvents: (filters) => getPayload(`/audit/events${buildQuery(filters)}`),
  getAuditEvent: (id) => getPayload(`/audit/events/${id}`),
  getAuditSummary: () => getPayload("/audit/summary"),
  downloadAuditExport: (format, filters) => apiClient.download(
    `/audit/export${buildQuery({ format, ...filters })}`,
    `indusbase-audit.${format}`
  ),
  // Billing
  listBillingPlans: () => getPayload("/billing/plans"),
  getBillingUsageSummary: (projectId, from, to) => getPayload(`/billing/usage/summary${buildQuery({ project_id: projectId, from, to })}`),
  listBillingUsageDaily: (projectId, days = 30) => getPayload(`/billing/usage${buildQuery({ project_id: projectId, days })}`),
  listInvoices: (projectId) => getPayload(`/billing/invoices${buildQuery({ project_id: projectId })}`),
  getInvoice: (id) => getPayload(`/billing/invoices/${id}`),
  previewInvoice: (projectId) => getPayload(`/billing/invoices/preview${buildQuery({ project_id: projectId })}`),
  createSubscription: (body) => postPayload("/billing/subscriptions", body),
  updateSubscription: (id, body) => patchPayload(`/billing/subscriptions/${id}`, body),
  getActiveSubscription: (projectId) => getPayload(`/billing/subscriptions/active${buildQuery({ project_id: projectId })}`),
  // Trust center + security scans
  getTrustCenterSettings: () => getPayload("/meta/trust-center"),
  updateTrustCenterSettings: (body) => apiClient.put("/meta/trust-center", body),
  listSubprocessors: () => getPayload("/meta/subprocessors"),
  createSubprocessor: (body) => postPayload("/meta/subprocessors", body),
  updateSubprocessor: (id, body) => apiClient.put(`/meta/subprocessors/${id}`, body),
  deleteSubprocessor: (id) => deletePayload(`/meta/subprocessors/${id}`),
  listComplianceMilestones: () => getPayload("/meta/compliance-milestones"),
  createComplianceMilestone: (body) => postPayload("/meta/compliance-milestones", body),
  updateComplianceMilestone: (id, body) => apiClient.put(`/meta/compliance-milestones/${id}`, body),
  deleteComplianceMilestone: (id) => deletePayload(`/meta/compliance-milestones/${id}`),
  listPublicIncidents: () => getPayload("/meta/public-incidents"),
  createPublicIncident: (body) => postPayload("/meta/public-incidents", body),
  updatePublicIncident: (id, body) => apiClient.put(`/meta/public-incidents/${id}`, body),
  deletePublicIncident: (id) => deletePayload(`/meta/public-incidents/${id}`),
  getSecurityScanSummary: () => getPayload("/meta/security/scans/summary"),
  listSecurityScanRuns: () => getPayload("/meta/security/scans"),
  // Secrets
  listSecrets: (filters) => getPayload(`/secrets${buildQuery(filters)}`),
  createSecret: (body) => postPayload("/secrets", body),
  getSecret: (name) => getPayload(`/secrets/${encodeURIComponent(name)}`),
  rotateSecret: (name, value) => postPayload(`/secrets/${encodeURIComponent(name)}/rotate`, { value }),
  rollbackSecret: (name, version) => postPayload(`/secrets/${encodeURIComponent(name)}/rollback`, { version }),
  listSecretVersions: (name) => getPayload(`/secrets/${encodeURIComponent(name)}/versions`),
  // Status + incidents
  getStatusPublic: () => getPayload("/status/public"),
  listIncidents: () => getPayload("/status/incidents"),
  createIncident: (body) => postPayload("/status/incidents", body),
  updateIncident: (id, body) => patchPayload(`/status/incidents/${id}`, body),
  resolveIncident: (id, body) => postPayload(`/status/incidents/${id}/resolve`, body ?? {}),
  listMaintenance: () => getPayload("/status/maintenance"),
  createMaintenance: (body) => postPayload("/status/maintenance", body),
  subscribeStatus: (email) => postPayload("/status/subscribe", { email }),
  // Support console
  supportSearchUsers: (query) => getPayload(`/meta/support/users/search${buildQuery({ q: query })}`),
  supportSearchProjects: (query) => getPayload(`/meta/support/projects/search${buildQuery({ q: query })}`),
  supportContext: (userId, projectId) => getPayload(`/meta/support/context${buildQuery({ user_id: userId, project_id: projectId })}`),
  supportCreateNote: (body) => postPayload("/meta/support/notes", body),
  supportListNotes: (userId, projectId) => getPayload(`/meta/support/notes${buildQuery({ user_id: userId, project_id: projectId })}`),
  supportRequestImpersonation: (body) => postPayload("/meta/support/impersonation/request", body),
  // Auth admin users
  listAuthUsers: (filters) => getWithFallback([
    `/auth/admin/users${buildQuery(filters)}`,
    `/admin/users${buildQuery(filters)}`
  ]),
  getAuthUser: (id) => getWithFallback([
    `/auth/admin/users/${id}`,
    `/admin/users/${id}`
  ]),
  banAuthUser: (id, reason) => postWithFallback([
    `/auth/admin/users/${id}/ban`,
    `/admin/users/${id}/ban`
  ], reason ? { reason } : {}),
  unbanAuthUser: (id) => postWithFallback([
    `/auth/admin/users/${id}/unban`,
    `/admin/users/${id}/unban`
  ], {}),
  deleteAuthUser: (id) => deleteWithFallback([
    `/auth/admin/users/${id}`,
    `/admin/users/${id}`
  ]),
  // SQL + table editor
  executeSQL: async (query) => {
    const response = await apiClient.requestRaw("/meta/query", {
      method: "POST",
      body: JSON.stringify({ query }),
      headers: { "Content-Type": "application/json" }
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok || payload.success === false) {
      throw new Error(String(payload.error ?? `SQL query failed (${response.status})`));
    }
    const result = payload.result;
    return {
      columns: result?.columns ?? [],
      rows: result?.rows ?? [],
      count: Number(result?.count ?? 0)
    };
  },
  listTables: async () => {
    const response = await apiClient.requestRaw("/graphql", {
      method: "POST",
      body: JSON.stringify({ query: "{ tables }" }),
      headers: { "Content-Type": "application/json" }
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok || payload.errors?.length) {
      throw new Error(payload.errors?.[0]?.message ?? `Failed to list tables (${response.status})`);
    }
    return payload.data?.tables ?? [];
  },
  listTableRows: (table, page = 1, limit = 50) => getPayload(`/rest/${encodeURIComponent(table)}${buildQuery({ page, limit })}`),
  getTableRow: (table, id) => getPayload(`/rest/${encodeURIComponent(table)}/${encodeURIComponent(id)}`),
  // Storage
  listBuckets: () => getPayload("/storage/v1/bucket"),
  createBucket: (body) => postPayload("/storage/v1/bucket", body),
  updateBucket: (id, body) => patchPayload(`/storage/v1/bucket/${encodeURIComponent(id)}`, body),
  deleteBucket: (id) => deletePayload(`/storage/v1/bucket/${encodeURIComponent(id)}`),
  listObjects: (bucket, prefix) => getPayload(`/storage/v1/object/list/${encodeURIComponent(bucket)}${buildQuery({ prefix })}`),
  uploadObject: async (bucket, filepath, form) => {
    const encodedPath = encodeObjectPath(filepath);
    const res = await apiClient.requestRaw(`/storage/v1/object/${encodeURIComponent(bucket)}/${encodedPath}`, {
      method: "POST",
      body: form,
      headers: {}
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(text || `Upload failed (${res.status})`);
    }
    const contentType = res.headers.get("content-type") || "";
    return contentType.includes("application/json") ? res.json() : {};
  },
  deleteObject: (bucket, filepath) => deletePayload(`/storage/v1/object/${encodeURIComponent(bucket)}/${encodeObjectPath(filepath)}`),
  downloadObject: async (bucket, filepath) => {
    const res = await apiClient.requestRaw(`/storage/v1/object/${encodeURIComponent(bucket)}/${encodeObjectPath(filepath)}`, { method: "GET" });
    if (!res.ok) throw new Error(`Download failed (${res.status})`);
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filepath.split("/").pop() || "download";
    link.click();
    URL.revokeObjectURL(url);
  }
};
export {
  studioApi as s
};
