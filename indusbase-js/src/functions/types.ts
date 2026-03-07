/**
 * Function invocation options
 */
export interface InvokeOptions {
    /**
     * Request body
     */
    body?: Record<string, unknown> | string | Blob | ArrayBuffer | FormData;

    /**
     * Request headers
     */
    headers?: Record<string, string>;

    /**
     * HTTP method
     */
    method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

    /**
     * Query parameters
     */
    query?: Record<string, string | number | boolean>;
}

/**
 * Function response
 */
export interface FunctionResponse<T = unknown> {
    data: T;
    error: null;
}

/**
 * Function error response
 */
export interface FunctionErrorResponse {
    data: null;
    error: Error;
}
