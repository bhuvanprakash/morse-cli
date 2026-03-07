import "clsx";
import "@sveltejs/kit/internal";
import "./exports.js";
import "./utils.js";
import "@sveltejs/kit/internal/server";
import "./root.js";
import "./state.svelte.js";
function normalizeEnvelope(payload) {
  if (payload && typeof payload === "object") {
    const obj = payload;
    if (typeof obj.success === "boolean") {
      if (obj.success) {
        return { data: obj.data ?? null, error: null };
      }
      const err = obj.error ?? {};
      return {
        data: null,
        error: {
          code: String(err.code ?? "REQUEST_FAILED"),
          message: String(err.message ?? "Request failed"),
          details: err.details
        }
      };
    }
    if ("data" in obj || "error" in obj) {
      const err = obj.error;
      return {
        data: obj.data ?? null,
        error: err ? {
          code: String(err.code ?? "REQUEST_FAILED"),
          message: String(err.message ?? "Request failed"),
          details: err.details
        } : null
      };
    }
    if ("error" in obj && typeof obj.error === "string") {
      return { data: null, error: { code: "REQUEST_FAILED", message: String(obj.error) } };
    }
  }
  return { data: payload, error: null };
}
function makeError(message, code = "REQUEST_FAILED", details) {
  return { code, message, details };
}
class IndusBaseClient {
  baseUrl;
  accessToken = null;
  refreshToken = null;
  refreshPromise = null;
  activeOrganizationId = null;
  activeProjectId = null;
  activeEnvironment = null;
  constructor() {
    this.baseUrl = "http://localhost:8000";
  }
  setTokens(access, refresh) {
    this.accessToken = access;
    this.refreshToken = refresh;
    return;
  }
  getBaseUrl() {
    return this.baseUrl;
  }
  setBaseUrl(url) {
    this.baseUrl = url.replace(/\/$/, "");
    return;
  }
  setContext(projectId, environment, organizationId) {
    this.activeOrganizationId = organizationId ?? null;
    this.activeProjectId = projectId ?? null;
    this.activeEnvironment = environment ?? null;
    return;
  }
  loadFromStorage() {
    return;
  }
  clearTokens() {
    this.accessToken = null;
    this.refreshToken = null;
    return;
  }
  getAccessToken() {
    return this.accessToken;
  }
  buildHeaders(custom) {
    const headers = new Headers(custom || {});
    if (!headers.has("Content-Type")) headers.set("Content-Type", "application/json");
    const token = this.accessToken ?? null;
    if (token && !headers.has("Authorization")) {
      headers.set("Authorization", `Bearer ${token}`);
    }
    const organizationId = this.activeOrganizationId ?? null;
    if (organizationId && !headers.has("X-IndusBase-Organization-ID")) {
      headers.set("X-IndusBase-Organization-ID", organizationId);
    }
    const projectId = this.activeProjectId ?? null;
    if (projectId && !headers.has("X-IndusBase-Project-ID")) {
      headers.set("X-IndusBase-Project-ID", projectId);
    }
    const env = this.activeEnvironment ?? null;
    if (env && !headers.has("X-IndusBase-Environment")) {
      headers.set("X-IndusBase-Environment", env);
    }
    return headers;
  }
  async requestRaw(path, init = {}) {
    const headers = this.buildHeaders(init.headers);
    if (init.body instanceof FormData) {
      headers.delete("Content-Type");
    }
    const response = await fetch(`${this.baseUrl}${path}`, {
      ...init,
      headers
    });
    if (response.status === 401 && this.refreshToken) {
      await this.refreshAccessToken();
      const retryHeaders = this.buildHeaders(init.headers);
      if (init.body instanceof FormData) {
        retryHeaders.delete("Content-Type");
      }
      return fetch(`${this.baseUrl}${path}`, {
        ...init,
        headers: retryHeaders
      });
    }
    return response;
  }
  async requestNormalized(method, path, body, options = {}) {
    const init = {
      ...options,
      method,
      headers: this.buildHeaders(options.headers)
    };
    if (body !== void 0 && method !== "GET" && method !== "HEAD") {
      init.body = JSON.stringify(body);
    }
    let response;
    try {
      response = await this.requestRaw(path, init);
    } catch (error) {
      return {
        data: null,
        error: makeError(error.message || "Network error", "NETWORK_ERROR")
      };
    }
    const contentType = response.headers.get("content-type") || "";
    const payload = contentType.includes("application/json") ? await response.json().catch(() => ({})) : await response.text().catch(() => "");
    const normalized = normalizeEnvelope(payload);
    if (!response.ok && !normalized.error) {
      return {
        data: null,
        error: makeError(
          typeof payload === "string" ? payload : `HTTP ${response.status}`,
          "HTTP_ERROR"
        )
      };
    }
    return normalized;
  }
  async request(method, path, body, options = {}) {
    const result = await this.requestNormalized(method, path, body, options);
    if (result.error) {
      if (result.error.code === "UNAUTHORIZED" || result.error.code === "TOKEN_EXPIRED") {
        this.clearTokens();
      }
      throw result.error;
    }
    return result.data;
  }
  get(path, options) {
    return this.request("GET", path, void 0, options);
  }
  post(path, body, options) {
    return this.request("POST", path, body, options);
  }
  patch(path, body, options) {
    return this.request("PATCH", path, body, options);
  }
  put(path, body, options) {
    return this.request("PUT", path, body, options);
  }
  delete(path, options) {
    return this.request("DELETE", path, void 0, options);
  }
  async getNormalized(path, options) {
    const envelope = await this.requestNormalized("GET", path, void 0, options);
    if (envelope.error) throw envelope.error;
    return envelope.data;
  }
  async download(path, filename) {
    const response = await this.requestRaw(path, { method: "GET" });
    if (!response.ok) {
      throw makeError(`Download failed (${response.status})`, "DOWNLOAD_FAILED");
    }
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }
  async refreshAccessToken() {
    if (this.refreshPromise) return this.refreshPromise;
    this.refreshPromise = this.doRefresh();
    try {
      await this.refreshPromise;
    } finally {
      this.refreshPromise = null;
    }
  }
  async doRefresh() {
    if (!this.refreshToken) throw new Error("No refresh token");
    const response = await fetch(`${this.baseUrl}/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh_token: this.refreshToken })
    });
    const payload = await response.json().catch(() => ({}));
    const normalized = normalizeEnvelope(payload);
    if (!response.ok || normalized.error || !normalized.data?.access_token) {
      this.clearTokens();
      throw new Error(normalized.error?.message || "Token refresh failed");
    }
    this.setTokens(normalized.data.access_token, normalized.data.refresh_token || this.refreshToken);
  }
}
const apiClient = new IndusBaseClient();
const authApi = {
  login: async (credentials) => {
    const payload = await apiClient.request(
      "POST",
      "/auth/signin",
      credentials
    );
    apiClient.setTokens(payload.access_token, payload.refresh_token);
    return {
      user: payload.user,
      access_token: payload.access_token,
      refresh_token: payload.refresh_token,
      expires_in: payload.expires_in ?? 3600
    };
  },
  signup: async (credentials) => {
    await apiClient.request("POST", "/auth/signup", credentials);
    return authApi.login({ email: credentials.email, password: credentials.password });
  },
  logout: async () => {
    try {
      await apiClient.request("POST", "/auth/signout", {});
    } finally {
      apiClient.clearTokens();
    }
  },
  getUser: async () => {
    return apiClient.request("GET", "/auth/user");
  },
  googleLogin: async (redirectTo = "/dashboard") => {
    const redirect = encodeURIComponent(`${window.location.origin}${redirectTo}`);
    window.location.href = `${apiClient.getBaseUrl()}/auth/oauth/google?redirect_to=${redirect}`;
  }
};
export {
  apiClient as a,
  authApi as b
};
