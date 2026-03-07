package metrics

import (
	"net/http"

	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promauto"
	"github.com/prometheus/client_golang/prometheus/promhttp"
)

var (
	EventsIngestedTotal = promauto.NewCounterVec(prometheus.CounterOpts{
		Name: "audit_events_ingested_total",
		Help: "Total audit events ingested",
	}, []string{"severity", "actor_type", "action"})

	EventsQueryTotal = promauto.NewCounter(prometheus.CounterOpts{
		Name: "audit_events_query_total",
		Help: "Total audit query requests",
	})

	EventsExportTotal = promauto.NewCounterVec(prometheus.CounterOpts{
		Name: "audit_events_export_total",
		Help: "Total audit export requests",
	}, []string{"format"})
)

func Handler() http.Handler {
	return promhttp.Handler()
}
