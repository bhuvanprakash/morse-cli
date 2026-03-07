/**
 * Filter operators for query conditions
 */
export type FilterOperator =
    | 'eq'
    | 'neq'
    | 'gt'
    | 'gte'
    | 'lt'
    | 'lte'
    | 'like'
    | 'ilike'
    | 'is'
    | 'in'
    | 'contains'
    | 'containedBy'
    | 'rangeLt'
    | 'rangeGt'
    | 'rangeLte'
    | 'rangeGte'
    | 'rangeAdjacent'
    | 'overlaps'
    | 'textSearch'
    | 'match'
    | 'not';

/**
 * Filter value types
 */
export type FilterValue =
    | string
    | number
    | boolean
    | null
    | undefined
    | Date
    | string[]
    | number[];

/**
 * Query result containing data and metadata
 */
export interface QueryResult<T> {
    data: T[];
    error: null;
    count: number | null;
    status: number;
    statusText: string;
}

/**
 * Single result for queries that return one item
 */
export interface SingleResult<T> {
    data: T | null;
    error: null;
    status: number;
    statusText: string;
}

/**
 * Query error result
 */
export interface QueryErrorResult {
    data: null;
    error: Error;
    count: null;
    status: number;
    statusText: string;
}

/**
 * Order direction
 */
export type OrderDirection = 'asc' | 'desc';

/**
 * Order nulls positioning
 */
export type OrderNulls = 'first' | 'last';

/**
 * Order options
 */
export interface OrderOptions {
    ascending?: boolean;
    nullsFirst?: boolean;
    foreignTable?: string;
}

/**
 * Range options for pagination
 */
export interface RangeOptions {
    from: number;
    to: number;
}

/**
 * Query filter definition
 */
export interface QueryFilter {
    column: string;
    operator: FilterOperator;
    value: FilterValue;
}

/**
 * Head result for count queries
 */
export interface CountResult {
    count: number | null;
    error: null;
    status: number;
    statusText: string;
    data: [];
}
