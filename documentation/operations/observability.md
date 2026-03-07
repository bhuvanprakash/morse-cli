# Observability - Monitoring & Metrics

> Production-grade observability infrastructure with OpenTelemetry, Prometheus, Grafana, and Alertmanager

## Overview

The IndusBase observability stack provides:
- **Metrics**: Prometheus for time-series metrics
- **Visualization**: Grafana dashboards
- **Tracing**: OpenTelemetry collection
- **Alerting**: Alertmanager with email, Slack, PagerDuty

## Quick Start

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
- Config: `prometheus/prometheus.yml`

### Grafana

- Pre-configured with Prometheus datasource
- Includes 5 dashboards:
  - **IndusBase Overview** - Platform-wide metrics
  - **API Gateway** - indus-gate metrics
  - **Auth Service** - indus-auth metrics
  - **Query Service** - indus-query metrics
  - **AI Service** - indus-ai metrics
- Port: 3001 (to avoid conflict with indus-studio)

### OpenTelemetry Collector

- Receives OTLP traces from services
- Processes and exports to backend
- Exposes Prometheus metrics on port 8889

### Alertmanager

- Routes alerts based on severity and team
- Email, Slack, and PagerDuty integrations
- Config: `alertmanager/alertmanager.yml`

## Sending Traces

### Python

```python
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

### HTTP/JSON

```bash
curl -X POST http://localhost:4318/v1/traces \
  -H "Content-Type: application/json" \
  -d @- < traces.json
```

### Environment Variables

```yaml
environment:
  - OTEL_EXPORTER_OTLP_ENDPOINT=http://otel-collector:4317
  - OTEL_EXPORTER_OTLP_TRACES_ENDPOINT=http://otel-collector:4317
  - OTEL_EXPORTER_OTLP_METRICS_ENDPOINT=http://otel-collector:4317
```

## Prometheus Targets

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

## Alert Rules

### Service Alerts

- **ServiceDown** - Service is not responding
- **HighAPILatency** - P95 latency > 2s
- **CriticalAPILatency** - P99 latency > 5s

### Error Alerts

- **HighAuthFailureRate** - Auth failures > 30%
- **HighErrorRate** - 5xx errors > 5%
- **CriticalErrorRate** - 5xx errors > 20%

### Queue Alerts

- **QueueDepthHigh** - Queue messages > 10,000
- **DeadLetterQueueGrowing** - DLQ messages > 100

### Database Alerts

- **PoolConnectionsExhausted** - Database connections > 95%

### AI Alerts

- **AIEmbeddingFailures** - Embedding failures > 10%
- **AISearchLatencyHigh** - Search P95 > 5s

## Recording Rules

Pre-computed metrics:
- Service health ratios
- Request rates by service
- Latency percentiles (P50, P95, P99)
- Error rates
- Queue metrics
- AI/ML metrics

## Grafana Dashboards

### Variables

Each dashboard supports:
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
├── docker-compose.observe.yml
├── prometheus/
│   ├── prometheus.yml
│   └── rules/
│       ├── indusbase_alerts.yml
│       └── indusbase_records.yml
├── grafana/
│   ├── provisioning/
│   │   ├── datasources/
│   │   └── dashboards/
│   └── dashboards/
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
