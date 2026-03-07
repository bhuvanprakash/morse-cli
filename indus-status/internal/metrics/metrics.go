package metrics

import (
	"net/http"

	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promauto"
	"github.com/prometheus/client_golang/prometheus/promhttp"
)

var (
	IncidentsTotal = promauto.NewCounterVec(prometheus.CounterOpts{
		Name: "status_incidents_total",
		Help: "Total incidents by status",
	}, []string{"status", "severity"})
	SubscribersTotal = promauto.NewGauge(prometheus.GaugeOpts{
		Name: "status_subscribers_total",
		Help: "Current number of status subscribers",
	})
)

func Handler() http.Handler {
	return promhttp.Handler()
}
