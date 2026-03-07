package metrics

import (
	"net/http"

	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promauto"
	"github.com/prometheus/client_golang/prometheus/promhttp"
)

var (
	SecretOpsTotal = promauto.NewCounterVec(prometheus.CounterOpts{
		Name: "secrets_operations_total",
		Help: "Total secret operations",
	}, []string{"action", "scope", "status"})
)

func Handler() http.Handler {
	return promhttp.Handler()
}
