/**
 * Base error class for all IndusBase errors
 */
export class IndusBaseError extends Error {
    readonly code: string;
    readonly statusCode: number | undefined;
    readonly details: Record<string, unknown> | undefined;

    constructor(
        message: string,
        code: string,
        statusCode?: number,
        details?: Record<string, unknown>
    ) {
        super(message);
        this.name = 'IndusBaseError';
        this.code = code;
        this.statusCode = statusCode;
        this.details = details;

        // Maintains proper stack trace for where error was thrown
        if ((Error as unknown as { captureStackTrace?: (target: object, constructor: unknown) => void }).captureStackTrace) {
            (Error as unknown as { captureStackTrace: (target: object, constructor: unknown) => void }).captureStackTrace(this, IndusBaseError);
        }
    }

    toJSON(): Record<string, unknown> {
        return {
            name: this.name,
            message: this.message,
            code: this.code,
            statusCode: this.statusCode,
            details: this.details,
        };
    }
}

/**
 * Authentication error - thrown when auth operations fail
 */
export class AuthError extends IndusBaseError {
    constructor(
        message: string,
        code: string = 'AUTH_ERROR',
        statusCode?: number,
        details?: Record<string, unknown>
    ) {
        super(message, code, statusCode, details);
        this.name = 'AuthError';

        if ((Error as unknown as { captureStackTrace?: (target: object, constructor: unknown) => void }).captureStackTrace) {
            (Error as unknown as { captureStackTrace: (target: object, constructor: unknown) => void }).captureStackTrace(this, AuthError);
        }
    }
}

/**
 * Query error - thrown when database operations fail
 */
export class QueryError extends IndusBaseError {
    readonly query: string | undefined;

    constructor(
        message: string,
        code: string = 'QUERY_ERROR',
        statusCode?: number,
        details?: Record<string, unknown>,
        query?: string
    ) {
        super(message, code, statusCode, details);
        this.name = 'QueryError';
        this.query = query;

        if ((Error as unknown as { captureStackTrace?: (target: object, constructor: unknown) => void }).captureStackTrace) {
            (Error as unknown as { captureStackTrace: (target: object, constructor: unknown) => void }).captureStackTrace(this, QueryError);
        }
    }

    override toJSON(): Record<string, unknown> {
        return {
            ...super.toJSON(),
            query: this.query,
        };
    }
}

/**
 * Storage error - thrown when storage operations fail
 */
export class StorageError extends IndusBaseError {
    readonly path: string | undefined;
    readonly bucket: string | undefined;

    constructor(
        message: string,
        code: string = 'STORAGE_ERROR',
        statusCode?: number,
        details?: Record<string, unknown>,
        path?: string,
        bucket?: string
    ) {
        super(message, code, statusCode, details);
        this.name = 'StorageError';
        this.path = path;
        this.bucket = bucket;

        if ((Error as unknown as { captureStackTrace?: (target: object, constructor: unknown) => void }).captureStackTrace) {
            (Error as unknown as { captureStackTrace: (target: object, constructor: unknown) => void }).captureStackTrace(this, StorageError);
        }
    }

    override toJSON(): Record<string, unknown> {
        return {
            ...super.toJSON(),
            path: this.path,
            bucket: this.bucket,
        };
    }
}

/**
 * Realtime error - thrown when realtime/WebSocket operations fail
 */
export class RealtimeError extends IndusBaseError {
    constructor(
        message: string,
        code: string = 'REALTIME_ERROR',
        statusCode?: number,
        details?: Record<string, unknown>
    ) {
        super(message, code, statusCode, details);
        this.name = 'RealtimeError';

        if ((Error as unknown as { captureStackTrace?: (target: object, constructor: unknown) => void }).captureStackTrace) {
            (Error as unknown as { captureStackTrace: (target: object, constructor: unknown) => void }).captureStackTrace(this, RealtimeError);
        }
    }
}

/**
 * Functions error - thrown when edge function invocations fail
 */
export class FunctionsError extends IndusBaseError {
    readonly functionName: string | undefined;

    constructor(
        message: string,
        code: string = 'FUNCTIONS_ERROR',
        statusCode?: number,
        details?: Record<string, unknown>,
        functionName?: string
    ) {
        super(message, code, statusCode, details);
        this.name = 'FunctionsError';
        this.functionName = functionName;

        if ((Error as unknown as { captureStackTrace?: (target: object, constructor: unknown) => void }).captureStackTrace) {
            (Error as unknown as { captureStackTrace: (target: object, constructor: unknown) => void }).captureStackTrace(this, FunctionsError);
        }
    }

    override toJSON(): Record<string, unknown> {
        return {
            ...super.toJSON(),
            functionName: this.functionName,
        };
    }
}
