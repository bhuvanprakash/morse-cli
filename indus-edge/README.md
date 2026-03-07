# Indus Edge

Serverless edge functions runtime - like Cloudflare Workers. A Zig runtime manager spawns isolated Bun processes per function invocation.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Indus Edge Runtime                       │
│  ┌─────────────┐  ┌──────────────┐  ┌─────────────────┐    │
│  │ HTTP Server │  │ Function     │  │ Worker Pool     │    │
│  │ (Zig)       │◄─┤ Registry     │◄─┤ (Bun processes) │    │
│  └─────────────┘  └──────────────┘  └─────────────────┘    │
│         │                                    │              │
│         ▼                                    ▼              │
│  ┌──────────────────────────────────────────────────────┐  │
│  │        Bun Worker Process (isolated sandbox)         │  │
│  │  ┌─────────────┐  ┌──────────────┐  ┌────────────┐  │  │
│  │  │ handler.ts  │  │ User Function│  │ stdin/out │  │  │
│  │  └─────────────┘  └──────────────┘  └────────────┘  │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

## Features

- **Isolated Workers**: Each function runs in a separate Bun process with resource limits
- **Warm Pool**: Pre-warmed workers for low-latency invocations
- **Hot Reload**: Automatic reloading of functions when files change (via inotify)
- **Resource Limits**: Memory, CPU, and file descriptor limits per worker
- **Structured Logging**: JSON-formatted logs for observability
- **Health Checks**: Built-in health and readiness endpoints

## Quick Start

### Build

```bash
# Build the Zig runtime
zig build

# Build Docker image
docker build -t indus-edge:latest .
```

### Run

```bash
# Run locally
./zig-out/bin/indus-edge

# Run with Docker
docker run -p 8006:8006 \
  -v $(pwd)/functions:/var/indusbase/functions \
  indus-edge:latest
```

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `INDUS_EDGE_PORT` | 8006 | HTTP server port |
| `INDUS_FUNCTIONS_DIR` | /var/indusbase/functions | Directory containing function files |
| `INDUS_BUN_PATH` | /usr/local/bin/bun | Path to Bun binary |
| `INDUS_HANDLER_PATH` | /opt/indus-edge/runtime/handler.ts | Path to handler script |
| `INDUS_WARMPOOL_SIZE` | 3 | Workers to pre-warm per function |
| `INDUS_WORKER_MEMORY_MB` | 128 | Memory limit per worker (MB) |
| `INDUS_WORKER_TIMEOUT_MS` | 30000 | Worker timeout (ms) |
| `INDUS_MAX_CONCURRENT` | 100 | Max concurrent invocations |
| `INDUS_INTERNAL_SECRET` | "" | Secret for internal auth |
| `INDUS_API_URL` | http://localhost:8000 | Indusbase API URL |

## Writing Functions

Create TypeScript files in the functions directory:

```typescript
/**
 * @route /api/hello
 * @public
 * @version 1.0.0
 * @description A simple hello world function
 */

interface Context {
  req: Request;
  url: URL;
  headers: Headers;
  method: string;
  query: Record<string, string>;
  env: Record<string, string>;
  log: (...args: unknown[]) => void;
}

export default async function handler(ctx: Context): Promise<Response> {
  ctx.log("Handling request", ctx.url.pathname);
  
  return new Response(JSON.stringify({
    message: "Hello from Indus Edge!",
    timestamp: new Date().toISOString(),
  }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}
```

## API Endpoints

### Health
- `GET /health` - Service health check
- `GET /functions/:name/health` - Function health check

### Functions
- `GET /functions` - List all loaded functions
- `POST /functions/:name` - Invoke a function
- `POST /functions/:name/invoke` - Invoke a function (alias)

## Architecture Details

### Worker Lifecycle

1. **Spawn**: Bun process is forked with resource limits
2. **Warm**: Function code is loaded but idle
3. **Invoke**: Request is sent via stdin, response via stdout
4. **Recycle**: Worker returns to idle pool or is killed

### Security

- Workers run with limited resources (rlimit)
- Each function in isolated process
- No shared state between invocations
- Request timeout enforcement

## Development

```bash
# Run tests
zig build test

# Run with debug logging
zig build run
```

## License

MIT