import type { PaginationState } from '$lib/types/api';

export function createPagination(initial?: Partial<PaginationState>): PaginationState {
  return {
    page: initial?.page ?? 1,
    pageSize: initial?.pageSize ?? 20,
    total: initial?.total ?? 0,
  };
}

export function pageOffset(state: PaginationState): number {
  return Math.max(0, (state.page - 1) * state.pageSize);
}

export function totalPages(state: PaginationState): number {
  if (state.pageSize <= 0) return 1;
  return Math.max(1, Math.ceil(state.total / state.pageSize));
}
