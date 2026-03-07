/**
 * Indus Edge Function Worker Handler
 * 
 * This script runs inside each spawned Bun process and wraps user functions.
 * It communicates with the Zig runtime via stdin/stdout using JSON protocol.
 */

interface InvokeRequest {
    id: string;
    function_name: string;
    method: string;
    path: string;
    headers: Record<string, string>;
    body: string;
    query_params: Record<string, string>;
}

interface InvokeResponse {
    id: string;
    status: number;
    headers: Record<string, string>;
    body: string;
    error?: string;
}

interface EdgeContext {
    req: Request;
    url: URL;
    headers: Headers;
    method: string;
    query: Record<string, string>;
    env: Record<string, string>;
    log: (...args: unknown[]) => void;
}

type EdgeFunction = (ctx: EdgeContext) => Promise<Response> | Response;

// Global function reference
let userFunction: EdgeFunction | null = null;

/**
 * Load user function from the specified path
 */
async function loadUserFunction(functionPath: string): Promise<void> {
    try {
        const module = await import(functionPath);

        // Support default export or named 'handler' export
        if (module.default && typeof module.default === 'function') {
            userFunction = module.default as EdgeFunction;
        } else if (module.handler && typeof module.handler === 'function') {
            userFunction = module.handler as EdgeFunction;
        } else {
            throw new Error('Function must export a default function or named "handler"');
        }
    } catch (err) {
        const error = err instanceof Error ? err.message : String(err);
        console.error(`Failed to load function: ${error}`);
        throw err;
    }
}

/**
 * Build Request object from invoke request
 */
function buildRequest(req: InvokeRequest): Request {
    const url = new URL(req.path, 'http://localhost');

    // Add query params
    Object.entries(req.query_params).forEach(([key, value]) => {
        url.searchParams.set(key, value);
    });

    const headers = new Headers(req.headers);

    return new Request(url.toString(), {
        method: req.method,
        headers,
        body: req.body.length > 0 ? req.body : undefined,
    });
}

/**
 * Execute the user function
 */
async function executeFunction(request: InvokeRequest): Promise<InvokeResponse> {
    if (!userFunction) {
        return {
            id: request.id,
            status: 500,
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ error: 'Function not loaded' }),
        };
    }

    try {
        const req = buildRequest(request);
        const url = new URL(req.url);

        const ctx: EdgeContext = {
            req,
            url,
            headers: req.headers,
            method: req.method,
            query: request.query_params,
            env: process.env as Record<string, string>,
            log: console.log,
        };

        const result = await userFunction(ctx);

        // Convert Response to response data
        const body = await result.text();
        const headers: Record<string, string> = {};
        result.headers.forEach((value, key) => {
            headers[key] = value;
        });

        return {
            id: request.id,
            status: result.status,
            headers,
            body,
        };
    } catch (err) {
        const error = err instanceof Error ? err.message : String(err);
        console.error(`Function execution error: ${error}`);

        return {
            id: request.id,
            status: 500,
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ error: 'Internal server error', message: error }),
            error,
        };
    }
}

/**
 * Send response back to parent process
 */
function sendResponse(response: InvokeResponse): void {
    const line = JSON.stringify(response) + '\n';
    process.stdout.write(line);
}

/**
 * Main message loop
 */
async function main(): Promise<void> {
    const functionPath = process.env.INDUS_FUNCTION_PATH;

    if (!functionPath) {
        console.error('INDUS_FUNCTION_PATH environment variable required');
        process.exit(1);
    }

    // Load the user function
    await loadUserFunction(functionPath);

    // Signal ready
    process.stdout.write(JSON.stringify({ ready: true }) + '\n');

    // Read from stdin
    const reader = Bun.stdin.stream().getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
        const { done, value } = await reader.read();

        if (done) {
            break;
        }

        buffer += decoder.decode(value, { stream: true });

        // Process complete lines
        let newlineIndex: number;
        while ((newlineIndex = buffer.indexOf('\n')) !== -1) {
            const line = buffer.slice(0, newlineIndex);
            buffer = buffer.slice(newlineIndex + 1);

            if (line.trim().length === 0) continue;

            try {
                const request: InvokeRequest = JSON.parse(line);
                const response = await executeFunction(request);
                sendResponse(response);
            } catch (err) {
                const error = err instanceof Error ? err.message : String(err);
                console.error(`Failed to process request: ${error}`);

                // Send error response
                sendResponse({
                    id: 'unknown',
                    status: 400,
                    headers: { 'content-type': 'application/json' },
                    body: JSON.stringify({ error: 'Invalid request', message: error }),
                    error,
                });
            }
        }
    }
}

// Handle graceful shutdown
process.on('SIGTERM', () => {
    process.exit(0);
});

process.on('SIGINT', () => {
    process.exit(0);
});

// Run main
main().catch((err) => {
    console.error('Fatal error:', err);
    process.exit(1);
});