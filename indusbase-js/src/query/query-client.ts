import { FetchClient } from '../lib/fetch.js';
import { QueryBuilder } from './query-builder.js';
import { FilterValue, QueryResult } from './types.js';

export interface InsertOptions {
    count?: 'exact' | 'planned' | 'estimated' | undefined;
    returning?: 'minimal' | 'representation' | undefined;
}

export interface UpdateOptions {
    count?: 'exact' | 'planned' | 'estimated' | undefined;
}

export interface DeleteOptions {
    count?: 'exact' | 'planned' | 'estimated' | undefined;
}

export class QueryClient {
    private fetchClient: FetchClient;

    constructor(fetchClient: FetchClient) {
        this.fetchClient = fetchClient;
    }

    /**
     * Create a query builder for a table
     */
    from<T = Record<string, unknown>>(table: string): QueryBuilder<T> {
        return new QueryBuilder<T>(this.fetchClient, table);
    }

    /**
     * Insert data into a table
     */
    async insert<T = Record<string, unknown>>(
        table: string,
        values: Partial<T> | Partial<T>[],
        options: InsertOptions = {}
    ): Promise<QueryResult<T>> {
        const builder = new QueryBuilder<T>(this.fetchClient, table);
        const opts = options.count !== undefined ? { count: options.count } : undefined;
        return builder.insert(values, opts).execute();
    }

    /**
     * Update data in a table
     */
    async update<T = Record<string, unknown>>(
        table: string,
        values: Partial<T>,
        filters: { column: string; operator: string; value: FilterValue }[],
        options: UpdateOptions = {}
    ): Promise<QueryResult<T>> {
        const opts = options.count !== undefined ? { count: options.count } : undefined;
        const builder = new QueryBuilder<T>(this.fetchClient, table).update(values, opts);

        // Apply filters
        for (const filter of filters) {
            switch (filter.operator) {
                case 'eq':
                    builder.eq(filter.column as keyof T, filter.value);
                    break;
                case 'neq':
                    builder.neq(filter.column as keyof T, filter.value);
                    break;
                case 'gt':
                    builder.gt(filter.column as keyof T, filter.value);
                    break;
                case 'gte':
                    builder.gte(filter.column as keyof T, filter.value);
                    break;
                case 'lt':
                    builder.lt(filter.column as keyof T, filter.value);
                    break;
                case 'lte':
                    builder.lte(filter.column as keyof T, filter.value);
                    break;
                case 'like':
                    builder.like(filter.column as keyof T, String(filter.value));
                    break;
                case 'ilike':
                    builder.ilike(filter.column as keyof T, String(filter.value));
                    break;
                case 'in':
                    builder.in(filter.column as keyof T, filter.value as string[] | number[]);
                    break;
            }
        }

        return builder.execute();
    }

    /**
     * Delete data from a table
     */
    async delete<T = Record<string, unknown>>(
        table: string,
        filters: { column: string; operator: string; value: FilterValue }[],
        options: DeleteOptions = {}
    ): Promise<QueryResult<T>> {
        const opts = options.count !== undefined ? { count: options.count } : undefined;
        const builder = new QueryBuilder<T>(this.fetchClient, table).delete(opts);

        // Apply filters
        for (const filter of filters) {
            switch (filter.operator) {
                case 'eq':
                    builder.eq(filter.column as keyof T, filter.value);
                    break;
                case 'neq':
                    builder.neq(filter.column as keyof T, filter.value);
                    break;
                case 'gt':
                    builder.gt(filter.column as keyof T, filter.value);
                    break;
                case 'gte':
                    builder.gte(filter.column as keyof T, filter.value);
                    break;
                case 'lt':
                    builder.lt(filter.column as keyof T, filter.value);
                    break;
                case 'lte':
                    builder.lte(filter.column as keyof T, filter.value);
                    break;
                case 'like':
                    builder.like(filter.column as keyof T, String(filter.value));
                    break;
                case 'ilike':
                    builder.ilike(filter.column as keyof T, String(filter.value));
                    break;
                case 'in':
                    builder.in(filter.column as keyof T, filter.value as string[] | number[]);
                    break;
            }
        }

        return builder.execute();
    }

    /**
     * Execute a stored procedure (RPC)
     */
    async rpc<T = unknown>(fn: string, params?: Record<string, unknown>): Promise<{ data: T; error: null }> {
        const body = params ? JSON.stringify(params) : null;
        const { data } = await this.fetchClient.request<T>(`/rest/v1/rpc/${fn}`, {
            method: 'POST',
            body,
        });

        return { data, error: null };
    }
}
