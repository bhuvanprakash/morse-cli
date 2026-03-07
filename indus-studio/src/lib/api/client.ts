import { browser } from '$app/environment';
import { goto } from '$app/navigation';

export interface TokenResponse {
  access_token: string;
  refresh_token: string;
  expires_in?: number;
}

export interface ApiError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
}

export interface ApiEnvelope<T> {
  data: T | null;
  error: ApiError | null;
}

function normalizeEnvelope<T>(payload: unknown): ApiEnvelope<T> {
  if (payload && typeof payload === 'object') {
    const obj = payload as Record<string, unknown>;

    if (typeof obj.success === 'boolean') {
      if (obj.success) {
        return { data: (obj.data as T) ?? null, error: null };
      }
      const err = (obj.error as Record<string, unknown>) ?? {};
      return {
        data: null,
        error: {
          code: String(err.code ?? 'REQUEST_FAILED'),
          message: String(err.message ?? 'Request failed'),
          details: err.details as Record<string, unknown> | undefined,
        },
      };
    }

    if ('data' in obj || 'error' in obj) {
      const err = obj.error as Record<string, unknown> | null | undefined;
      return {
        data: (obj.data as T) ?? null,
        error: err
          ? {
              code: String(err.code ?? 'REQUEST_FAILED'),
              message: String(err.message ?? 'Request failed'),
              details: err.details as Record<string, unknown> | undefined,
            }
          : null,
      };
    }

    if ('error' in obj && typeof obj.error === 'string') {
      return { data: null, error: { code: 'REQUEST_FAILED', message: String(obj.error) } };
    }
  }

  return { data: payload as T, error: null };
}

function makeError(message: string, code = 'REQUEST_FAILED', details?: Record<string, unknown>): ApiError {
  return { code, message, details };
}

export class IndusBaseClient {
  private baseUrl: string;
  private accessToken: string | null = null;
  private refreshToken: string | null = null;
  private refreshPromise: Promise<void> | null = null;
  private activeOrganizationId: string | null = null;
  private activeProjectId: string | null = null;
  private activeEnvironment: string | null = null;

  constructor() {
    this.baseUrl = import.meta.env.PUBLIC_INDUSBASE_URL || 'http://localhost:8000';
    if (browser) this.loadFromStorage();
  }

  setTokens(access: string, refresh: string): void {
    this.accessToken = access;
    this.refreshToken = refresh;
    if (!browser) return;
    localStorage.setItem('access_token', access);
    localStorage.setItem('refresh_token', refresh);
  }

  getBaseUrl(): string {
    return this.baseUrl;
  }

  setBaseUrl(url: string): void {
    this.baseUrl = url.replace(/\/$/, '');
    if (!browser) return;
    localStorage.setItem('studio_api_base_url', this.baseUrl);
  }

  setContext(projectId?: string | null, environment?: string | null, organizationId?: string | null): void {
    this.activeOrganizationId = organizationId ?? null;
    this.activeProjectId = projectId ?? null;
    this.activeEnvironment = environment ?? null;
    if (!browser) return;
    if (organizationId) localStorage.setItem('active_org_id', organizationId);
    if (projectId) localStorage.setItem('active_project_id', projectId);
    if (environment) localStorage.setItem('active_environment', environment);
  }

  loadFromStorage(): void {
    if (!browser) return;
    this.baseUrl = localStorage.getItem('studio_api_base_url') || this.baseUrl;
    this.accessToken = localStorage.getItem('access_token');
    this.refreshToken = localStorage.getItem('refresh_token');
    this.activeOrganizationId = localStorage.getItem('active_org_id');
    this.activeProjectId = localStorage.getItem('active_project_id');
    this.activeEnvironment = localStorage.getItem('active_environment') || 'production';
  }

  clearTokens(): void {
    this.accessToken = null;
    this.refreshToken = null;
    if (!browser) return;
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
  }

  getAccessToken(): string | null {
    return this.accessToken;
  }

  private buildHeaders(custom?: HeadersInit): Headers {
    const headers = new Headers(custom || {});
    if (!headers.has('Content-Type')) headers.set('Content-Type', 'application/json');

    const token = this.accessToken ?? (browser ? localStorage.getItem('access_token') : null);
    if (token && !headers.has('Authorization')) {
      headers.set('Authorization', `Bearer ${token}`);
    }

    const organizationId = this.activeOrganizationId ?? (browser ? localStorage.getItem('active_org_id') : null);
    if (organizationId && !headers.has('X-IndusBase-Organization-ID')) {
      headers.set('X-IndusBase-Organization-ID', organizationId);
    }

    const projectId = this.activeProjectId ?? (browser ? localStorage.getItem('active_project_id') : null);
    if (projectId && !headers.has('X-IndusBase-Project-ID')) {
      headers.set('X-IndusBase-Project-ID', projectId);
    }

    const env = this.activeEnvironment ?? (browser ? localStorage.getItem('active_environment') : null);
    if (env && !headers.has('X-IndusBase-Environment')) {
      headers.set('X-IndusBase-Environment', env);
    }

    const apikey = browser ? localStorage.getItem('active_project_anon_key') : null;
    if (apikey && !headers.has('apikey')) {
      headers.set('apikey', apikey);
    }

    return headers;
  }

  async requestRaw(path: string, init: RequestInit = {}): Promise<Response> {
    const headers = this.buildHeaders(init.headers);
    if (init.body instanceof FormData) {
      headers.delete('Content-Type');
    }

    const response = await fetch(`${this.baseUrl}${path}`, {
      ...init,
      headers,
    });

    if (response.status === 401 && this.refreshToken) {
      await this.refreshAccessToken();
      const retryHeaders = this.buildHeaders(init.headers);
      if (init.body instanceof FormData) {
        retryHeaders.delete('Content-Type');
      }
      return fetch(`${this.baseUrl}${path}`, {
        ...init,
        headers: retryHeaders,
      });
    }

    return response;
  }

  async requestNormalized<T>(method: string, path: string, body?: unknown, options: RequestInit = {}): Promise<ApiEnvelope<T>> {
    const init: RequestInit = {
      ...options,
      method,
      headers: this.buildHeaders(options.headers),
    };

    if (body !== undefined && method !== 'GET' && method !== 'HEAD') {
      init.body = JSON.stringify(body);
    }

    let response: Response;
    try {
      response = await this.requestRaw(path, init);
    } catch (error) {
      return {
        data: null,
        error: makeError((error as Error).message || 'Network error', 'NETWORK_ERROR'),
      };
    }

    const contentType = response.headers.get('content-type') || '';
    const payload = contentType.includes('application/json')
      ? await response.json().catch(() => ({}))
      : await response.text().catch(() => '');

    const normalized = normalizeEnvelope<T>(payload);

    if (!response.ok && !normalized.error) {
      return {
        data: null,
        error: makeError(
          typeof payload === 'string' ? payload : `HTTP ${response.status}`,
          'HTTP_ERROR',
        ),
      };
    }

    return normalized;
  }

  async request<T>(method: string, path: string, body?: unknown, options: RequestInit = {}): Promise<T> {
    const result = await this.requestNormalized<T>(method, path, body, options);
    if (result.error) {
      if (result.error.code === 'UNAUTHORIZED' || result.error.code === 'TOKEN_EXPIRED') {
        this.clearTokens();
        if (browser) goto('/login');
      }
      throw result.error;
    }
    return result.data as T;
  }

  get<T>(path: string, options?: RequestInit): Promise<T> {
    return this.request<T>('GET', path, undefined, options);
  }
  post<T>(path: string, body?: unknown, options?: RequestInit): Promise<T> {
    return this.request<T>('POST', path, body, options);
  }
  patch<T>(path: string, body?: unknown, options?: RequestInit): Promise<T> {
    return this.request<T>('PATCH', path, body, options);
  }
  put<T>(path: string, body?: unknown, options?: RequestInit): Promise<T> {
    return this.request<T>('PUT', path, body, options);
  }
  delete<T>(path: string, options?: RequestInit): Promise<T> {
    return this.request<T>('DELETE', path, undefined, options);
  }

  async getNormalized<T>(path: string, options?: RequestInit): Promise<T | null> {
    const envelope = await this.requestNormalized<T>('GET', path, undefined, options);
    if (envelope.error) throw envelope.error;
    return envelope.data;
  }

  async download(path: string, filename: string): Promise<void> {
    const response = await this.requestRaw(path, { method: 'GET' });
    if (!response.ok) {
      throw makeError(`Download failed (${response.status})`, 'DOWNLOAD_FAILED');
    }
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  private async refreshAccessToken(): Promise<void> {
    if (this.refreshPromise) return this.refreshPromise;
    this.refreshPromise = this.doRefresh();
    try {
      await this.refreshPromise;
    } finally {
      this.refreshPromise = null;
    }
  }

  private async doRefresh(): Promise<void> {
    if (!this.refreshToken) throw new Error('No refresh token');

    const response = await fetch(`${this.baseUrl}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: this.refreshToken }),
    });

    const payload = await response.json().catch(() => ({}));
    const normalized = normalizeEnvelope<TokenResponse>(payload);
    if (!response.ok || normalized.error || !normalized.data?.access_token) {
      this.clearTokens();
      throw new Error(normalized.error?.message || 'Token refresh failed');
    }

    this.setTokens(normalized.data.access_token, normalized.data.refresh_token || this.refreshToken);
  }
}

export const apiClient = new IndusBaseClient();

export interface User {
  id: string;
  email: string;
  role?: string;
  created_at?: string;
  updated_at?: string;
  [key: string]: unknown;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface SignupCredentials {
  email: string;
  password: string;
  name?: string;
  metadata?: Record<string, unknown>;
}

export const authApi = {
  login: async (credentials: LoginCredentials): Promise<{ user: User } & TokenResponse> => {
    const payload = await apiClient.request<{ access_token: string; refresh_token: string; user: User; expires_in?: number }>(
      'POST',
      '/auth/signin',
      credentials,
    );
    apiClient.setTokens(payload.access_token, payload.refresh_token);
    return {
      user: payload.user,
      access_token: payload.access_token,
      refresh_token: payload.refresh_token,
      expires_in: payload.expires_in ?? 3600,
    };
  },

  signup: async (credentials: SignupCredentials): Promise<{ user: User } & TokenResponse> => {
    await apiClient.request('POST', '/auth/signup', credentials);
    // Sign in immediately for Studio onboarding experience.
    return authApi.login({ email: credentials.email, password: credentials.password });
  },

  logout: async (): Promise<void> => {
    try {
      await apiClient.request('POST', '/auth/signout', {});
    } finally {
      apiClient.clearTokens();
    }
  },

  getUser: async (): Promise<User> => {
    return apiClient.request<User>('GET', '/auth/user');
  },

  googleLogin: async (redirectTo: string = '/dashboard'): Promise<void> => {
    const redirect = encodeURIComponent(`${window.location.origin}${redirectTo}`);
    window.location.href = `${apiClient.getBaseUrl()}/auth/oauth/google?redirect_to=${redirect}`;
  },
};
