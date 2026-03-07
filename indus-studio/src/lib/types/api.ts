export interface ApiErrorShape {
  code: string;
  message: string;
  details?: Record<string, unknown>;
}

export interface ApiEnvelope<T> {
  data: T | null;
  error: ApiErrorShape | null;
}

export interface LegacySuccessEnvelope<T> {
  success: boolean;
  data?: T;
  error?: ApiErrorShape;
}

export interface PaginationState {
  page: number;
  pageSize: number;
  total: number;
}

export type EnvironmentName = 'development' | 'staging' | 'production';
