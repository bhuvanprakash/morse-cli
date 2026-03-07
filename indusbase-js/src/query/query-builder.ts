import { FetchClient } from '../lib/fetch.js';
import { QueryError } from '../lib/errors.js';
import {
    CountResult,
    FilterOperator,
    FilterValue,
    OrderDirection,
    OrderOptions,
    QueryFilter,
    QueryResult,
    SingleResult,
} from './types.js';

export class QueryBuilder<T = Record<string, unknown>> {
    private fetchClient: FetchClient;
    private table: string;
    private method: 'GET' | 'POST' | 'PATCH' | 'DELETE' = 'GET';
    private filters: QueryFilter[] = [];
    private columns: string = '*';
    private orderColumn: string | undefined;
    private orderDirection: OrderDirection = 'asc';
    private orderOptions: OrderOptions | undefined;
    private limitCount: number | undefined;
    private offsetCount: number | undefined;
    private rangeFrom: number | undefined;
    private rangeTo: number | undefined;
    private countMode: 'exact' | 'planned' | 'estimated' | undefined;

    constructor(fetchClient: FetchClient, table: string) {
        this.fetchClient = fetchClient;
        this.table = table;
    }

    /**
     * Select specific columns
     */
    select(columns: string = '*', options?: { head?: boolean; count?: 'exact' | 'planned' | 'estimated' }): this {
        this.columns = columns;
        // Head option is passed to count query, not stored
        if (options?.count) {
            this.countMode = options.count;
        }
        return this;
    }

    /**
     * Insert data (called from QueryClient)
     */
    insert(values: Partial<T> | Partial<T>[], options?: { count?: 'exact' | 'planned' | 'estimated' }): this {
        this.method = 'POST';
        // Store values for later use in execute
        (this as unknown as { insertValues: unknown }).insertValues = values;
        if (options?.count) {
            this.countMode = options.count;
        }
        return this;
    }

    /**
     * Update data (called from QueryClient)
     */
    update(values: Partial<T>, options?: { count?: 'exact' | 'planned' | 'estimated' }): this {
        this.method = 'PATCH';
        (this as unknown as { updateValues: unknown }).updateValues = values;
        if (options?.count) {
            this.countMode = options.count;
        }
        return this;
    }

    /**
     * Delete data (called from QueryClient)
     */
    delete(options?: { count?: 'exact' | 'planned' | 'estimated' }): this {
        this.method = 'DELETE';
        if (options?.count) {
            this.countMode = options.count;
        }
        return this;
    }

    /**
     * Equality filter
     */
    eq(column: keyof T, value: FilterValue): this {
        this.filters.push({ column: String(column), operator: 'eq', value });
        return this;
    }

    /**
     * Not equal filter
     */
    neq(column: keyof T, value: FilterValue): this {
        this.filters.push({ column: String(column), operator: 'neq', value });
        return this;
    }

    /**
     * Greater than filter
     */
    gt(column: keyof T, value: FilterValue): this {
        this.filters.push({ column: String(column), operator: 'gt', value });
        return this;
    }

    /**
     * Greater than or equal filter
     */
    gte(column: keyof T, value: FilterValue): this {
        this.filters.push({ column: String(column), operator: 'gte', value });
        return this;
    }

    /**
     * Less than filter
     */
    lt(column: keyof T, value: FilterValue): this {
        this.filters.push({ column: String(column), operator: 'lt', value });
        return this;
    }

    /**
     * Less than or equal filter
     */
    lte(column: keyof T, value: FilterValue): this {
        this.filters.push({ column: String(column), operator: 'lte', value });
        return this;
    }

    /**
     * Like filter (case-sensitive pattern match)
     */
    like(column: keyof T, pattern: string): this {
        this.filters.push({ column: String(column), operator: 'like', value: pattern });
        return this;
    }

    /**
     * ILike filter (case-insensitive pattern match)
     */
    ilike(column: keyof T, pattern: string): this {
        this.filters.push({ column: String(column), operator: 'ilike', value: pattern });
        return this;
    }

    /**
     * Is filter (for null checks)
     */
    is(column: keyof T, value: null | boolean): this {
        this.filters.push({ column: String(column), operator: 'is', value });
        return this;
    }

    /**
     * In filter (value in array)
     */
    in(column: keyof T, values: string[] | number[]): this {
        this.filters.push({ column: String(column), operator: 'in', value: values });
        return this;
    }

    /**
     * Contains filter (for arrays/jsonb)
     */
    contains(column: keyof T, value: FilterValue): this {
        this.filters.push({ column: String(column), operator: 'contains', value });
        return this;
    }

    /**
     * Contained by filter
     */
    containedBy(column: keyof T, value: FilterValue): this {
        this.filters.push({ column: String(column), operator: 'containedBy', value });
        return this;
    }

    /**
     * Text search filter
     */
    textSearch(column: keyof T, query: string, options?: { type?: 'plain' | 'phrase' | 'websearch' }): this {
        const value = options?.type ? `${options.type}:${query}` : query;
        this.filters.push({ column: String(column), operator: 'textSearch', value });
        return this;
    }

    /**
     * Match filter (for multiple eq conditions)
     */
    match(query: Partial<T>): this {
        for (const [key, value] of Object.entries(query)) {
            this.filters.push({ column: key, operator: 'eq', value: value as FilterValue });
        }
        return this;
    }

    /**
     * Not filter (negates a condition)
     */
    not(column: keyof T, operator: FilterOperator, value: FilterValue): this {
        this.filters.push({ column: String(column), operator: 'not', value: { operator, value } as unknown as FilterValue });
        return this;
    }

    /**
     * Order results
     */
    order(column: keyof T, options?: OrderOptions): this {
        this.orderColumn = String(column);
        if (options?.ascending !== undefined) {
            this.orderDirection = options.ascending ? 'asc' : 'desc';
        }
        this.orderOptions = options;
        return this;
    }

    /**
     * Limit results
     */
    limit(count: number): this {
        this.limitCount = count;
        return this;
    }

    /**
     * Offset results
     */
    offset(count: number): this {
        this.offsetCount = count;
        return this;
    }

    /**
     * Range for pagination
     */
    range(from: number, to: number): this {
        this.rangeFrom = from;
        this.rangeTo = to;
        return this;
    }

    /**
     * Execute the query and return a single result
     */
    async single(): Promise<SingleResult<T>> {
        this.limitCount = 1;
        const result = await this.execute();
        return {
            data: result.data[0] ?? null,
            error: result.error,
            status: result.status,
            statusText: result.statusText,
        };
    }

    /**
     * Execute the query and return at most one result (or null)
     */
    async maybeSingle(): Promise<SingleResult<T>> {
        return this.single();
    }

    /**
     * Execute as a count query
     */
    async count(): Promise<CountResult> {
        this.countMode = 'exact';
        const result = await this.execute();
        return {
            count: result.count,
            error: result.error,
            status: result.status,
            statusText: result.statusText,
            data: [],
        };
    }

    /**
     * Execute the query
     */
    async execute(): Promise<QueryResult<T>> {
        const url = new URL(`/rest/v1/${this.table}`, this.fetchClient.getBaseUrl());

        // Build query parameters
        if (this.columns && this.method === 'GET') {
            url.searchParams.set('select', this.columns);
        }

        // Add filters
        for (const filter of this.filters) {
            const value = this.formatFilterValue(filter.value);
            url.searchParams.set(`${filter.column}.${filter.operator}`, value);
        }

        // Add ordering
        if (this.orderColumn) {
            const nullsOption = this.orderOptions?.nullsFirst ? 'nullsfirst' : 'nullslast';
            url.searchParams.set('order', `${this.orderColumn}.${this.orderDirection}.${nullsOption}`);
        }

        // Add limit
        if (this.limitCount !== undefined) {
            url.searchParams.set('limit', String(this.limitCount));
        }

        // Add offset
        if (this.offsetCount !== undefined) {
            url.searchParams.set('offset', String(this.offsetCount));
        }

        const headers: Record<string, string> = {};

        // Add range headers
        if (this.rangeFrom !== undefined && this.rangeTo !== undefined) {
            headers['Prefer'] = `count=${this.countMode ?? 'exact'}`;
            headers['Range'] = `${this.rangeFrom}-${this.rangeTo}`;
        } else if (this.countMode) {
            headers['Prefer'] = `count=${this.countMode}`;
        }

        // Handle insert/update/delete
        let body: string | null = null;
        if (this.method === 'POST') {
            const insertValues = (this as unknown as { insertValues: unknown }).insertValues;
            body = JSON.stringify(insertValues);
            headers['Prefer'] = 'return=representation';
        } else if (this.method === 'PATCH') {
            const updateValues = (this as unknown as { updateValues: unknown }).updateValues;
            body = JSON.stringify(updateValues);
            headers['Prefer'] = 'return=representation';
        } else if (this.method === 'DELETE') {
            headers['Prefer'] = 'return=representation';
        }

        try {
            const { data, response } = await this.fetchClient.request<T[]>(url.pathname + url.search, {
                method: this.method,
                headers,
                body,
            });

            // Parse count from header
            const contentRange = response.headers.get('content-range');
            let count: number | null = null;
            if (contentRange) {
                const match = /\/(\d+|\*)/.exec(contentRange);
                if (match?.[1] && match[1] !== '*') {
                    count = parseInt(match[1], 10);
                }
            }

            return {
                data: Array.isArray(data) ? data : [data],
                error: null,
                count,
                status: response.status,
                statusText: response.statusText,
            };
        } catch (error) {
            if (error instanceof QueryError) {
                throw error;
            }
            throw new QueryError(
                error instanceof Error ? error.message : 'Query failed',
                'QUERY_ERROR',
                500,
                {},
                url.toString()
            );
        }
    }

    private formatFilterValue(value: FilterValue): string {
        if (value === null) return 'null';
        if (value === undefined) return 'null';
        if (typeof value === 'boolean') return String(value);
        if (value instanceof Date) return value.toISOString();
        if (Array.isArray(value)) return `(${value.map(v => `"${v}"`).join(',')})`;
        return String(value);
    }
}
