# IndusBase Observability Stack

Production-grade observability infrastructure with OpenTelemetry, Prometheus, Grafana, and Alertmanager.

## Quick Start

### Prerequisites

- Docker and Docker Compose
- The `indusbase_indusbase_net` Docker network (created by main docker-compose.yml)

### Starting the Stack

```bash
cd observe
docker-compose -f docker-compose.observe.yml up -d
```

### Access URLs

| Service | URL | Credentials |
|---------|-----|-------------|
| Grafana | http://localhost:3001 | admin / indusbase |
| Prometheus | http://localhost:9091 | - |
| Alertmanager | http://localhost:9093 | - |
| OTEL Collector (gRPC) | localhost:4317 | - |
| OTEL Collector (HTTP) | localhost:4318 | - |

## Services

### Prometheus
- Scrapes metrics from all 11 IndusBase services
- Port: 9091 (mapped to internal 9090)
- Config: [`prometheus/prometheus.yml`](prometheus/prometheus.yml)

### Grafana
- Pre-configured with Prometheus datasource
- Includes 5 dashboards:
  - **IndusBase Overview** - Platform-wide metrics
  - **API Gateway** - indus-gate metrics
  - **Auth Service** - indus-auth metrics
  - **Query Service** - indus-query metrics
  - **AI Service** - indus-ai metrics
- Port: 3001 (to avoid conflict with indus-studio on 3000)

### OpenTelemetry Collector
- Receives OTLP traces from services
- Processes and exports to backend
- Exposes Prometheus metrics on port 8889

### Alertmanager
- Routes alerts based on severity and team
- Email, Slack, and PagerDuty integrations
- Config: [`alertmanager/alertmanager.yml`](alertmanager/alertmanager.yml)

## Sending Traces

### Using OpenTelemetry SDK

Services should be instrumented with OpenTelemetry and send traces to the collector:

```python
# Python example
from opentelemetry import trace
from opentelemetry.exporter.otlp.proto.grpc.trace_exporter import OTLPSpanExporter
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import BatchSpanProcessor

provider = TracerProvider()
processor = BatchSpanProcessor(
    OTLPSpanExporter(endpoint="http://localhost:4317", insecure=True)
)
provider.add_span_processor(processor)
trace.set_tracer_provider(provider)
```

### Using HTTP/JSON

```bash
# Send traces via HTTP
curl -X POST http://localhost:4318/v1/traces \
  -H "Content-Type: application/json" \
  -d @- < traces.json
```

### Environment Variables for Services

Add to your service's environment:

```yaml
# docker-compose.yml for your service
environment:
  - OTEL_EXPORTER_OTLP_ENDPOINT=http://otel-collector:4317
  - OTEL_EXPORTER_OTLP_TRACES_ENDPOINT=http://otel-collector:4317
  - OTEL_EXPORTER_OTLP_METRICS_ENDPOINT=http://otel-collector:4317
```

## Prometheus Targets

The following services are automatically scraped:

| Service | Endpoint | Port |
|---------|----------|------|
| indus-gate | /metrics | 8000 |
| indus-auth | /metrics | 8001 |
| indus-query | /metrics | 8002 |
| indus-pool | /metrics | 9090 |
| indus-meta | /metrics | 8003 |
| indus-live | /metrics | 8004 |
| indus-store | /metrics | 8005 |
| indus-edge | /metrics | 8006 |
| indus-ai | /metrics | 8007 |
| indus-queue | /metrics | 8008 |
| indus-studio | /metrics | 8009 |

## Alerting Rules

Alerts are defined in [`prometheus/rules/indusbase_alerts.yml`](prometheus/rules/indusbase_alerts.yml):

- **ServiceDown** - Service is not responding
- **HighAPILatency** - P95 latency > 2s
- **CriticalAPILatency** - P99 latency > 5s
- **HighAuthFailureRate** - Auth failures > 30%
- **HighErrorRate** - 5xx errors > 5%
- **CriticalErrorRate** - 5xx errors > 20%
- **QueueDepthHigh** - Queue messages > 10,000
- **DeadLetterQueueGrowing** - DLQ messages > 100
- **PoolConnectionsExhausted** - Database connections > 95%
- **AIEmbeddingFailures** - Embedding failures > 10%
- **AISearchLatencyHigh** - Search P95 > 5s

## Recording Rules

Pre-computed metrics in [`prometheus/rules/indusbase_records.yml`](prometheus/rules/indusbase_records.yml):

- Service health ratios
- Request rates by service
- Latency percentiles (P50, P95, P99)
- Error rates
- Queue metrics
- AI/ML metrics

## Grafana Dashboards

### Variables

Each dashboard supports these variables:
- `$service` - Filter by service name
- `$interval` - Time range (1m, 5m, 15m, 1h)
- `$DS_PROMETHEUS` - Data source selection

### Overview Dashboard

Platform-wide metrics including:
- Service health status
- Request rates
- Latency percentiles
- Queue depth
- AI metrics

## Troubleshooting

### Check Prometheus targets

```bash
curl http://localhost:9091/api/v1/targets
```

### Check Alertmanager status

```bash
curl http://localhost:9093/api/v1/status
```

### View OTEL collector logs

```bash
docker logs otel-collector
```

### Verify Grafana datasource

1. Go to http://localhost:3001
2. Navigate to Configuration > Data Sources
3. Verify Prometheus is connected

## Configuration Files

```
observe/
├── docker-compose.observe.yml    # Main compose file
├── prometheus/
│   ├── prometheus.yml           # Scrape configuration
│   └── rules/
│       ├── indusbase_alerts.yml # Alert definitions
│       └── indusbase_records.yml# Recording rules
├── grafana/
│   ├── provisioning/
│   │   ├── datasources/
│   │   │   └── prometheus.yml   # Datasource config
│   │   └── dashboards/
│   │       └── dashboards.yml   # Dashboard config
│   └── dashboards/
│       ├── indusbase_overview.json
│       ├── indus_gate.json
│       ├── indus_auth.json
│       ├── indus_query.json
│       └── indus_ai.json
├── otel/
│   └── otel-collector-config.yaml
└── alertmanager/
    └── alertmanager.yml
```

## Security Notes

- Change default Grafana password in production
- Configure SMTP credentials for Alertmanager
- Set up PagerDuty/Slack webhooks for alerts
- Use TLS in production environments
- Secure OTLP endpoints with authentication

## Stopping the Stack

```bash
docker-compose -f docker-compose.observe.yml down
```

To also remove volumes:
```bash
docker-compose -f docker-compose.observe.yml down -v
```
