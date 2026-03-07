package api

import (
	"net/http"

	"github.com/indusbase/indus-queue/internal/handlers"
	"github.com/indusbase/indus-queue/internal/metrics"
)

// Server represents the HTTP server
type Server struct {
	httpServer *http.Server
}

// NewServer creates a new HTTP server
func NewServer(handler http.Handler, port string) *Server {
	return &Server{
		httpServer: &http.Server{
			Addr:    ":" + port,
			Handler: handler,
		},
	}
}

// Start starts the HTTP server
func (s *Server) Start() error {
	return s.httpServer.ListenAndServe()
}

// Stop gracefully stops the HTTP server
func (s *Server) Stop() error {
	return s.httpServer.Shutdown(nil)
}

// SetupRoutes sets up all HTTP routes
func SetupRoutes(
	queueHandler *handlers.QueueHandler,
	jobHandler *handlers.JobHandler,
	webhookHandler *handlers.WebhookHandler,
	cronHandler *handlers.CronHandler,
	internalHandler *handlers.InternalHandler,
	internalSecret string,
) http.Handler {
	mux := http.NewServeMux()

	// Queue routes
	mux.HandleFunc("POST /queue/queues", queueHandler.Create)
	mux.HandleFunc("GET /queue/queues", queueHandler.List)
	mux.HandleFunc("DELETE /queue/queues/{name}", queueHandler.Delete)

	// Job routes
	mux.HandleFunc("POST /queue/jobs", jobHandler.Enqueue)
	mux.HandleFunc("POST /queue/jobs/batch", jobHandler.EnqueueBatch)
	mux.HandleFunc("GET /queue/jobs", jobHandler.List)
	mux.HandleFunc("POST /queue/jobs/{id}/ack", jobHandler.Ack)
	mux.HandleFunc("POST /queue/jobs/{id}/fail", jobHandler.Fail)
	mux.HandleFunc("DELETE /queue/jobs/{id}", jobHandler.Delete)

	// Webhook routes
	mux.HandleFunc("POST /queue/webhooks", webhookHandler.Create)
	mux.HandleFunc("GET /queue/webhooks", webhookHandler.List)
	mux.HandleFunc("PATCH /queue/webhooks/{id}", webhookHandler.Update)
	mux.HandleFunc("DELETE /queue/webhooks/{id}", webhookHandler.Delete)
	mux.HandleFunc("POST /queue/webhooks/{id}/test", webhookHandler.Test)

	// Cron routes
	mux.HandleFunc("POST /queue/cron", cronHandler.Create)
	mux.HandleFunc("GET /queue/cron", cronHandler.List)
	mux.HandleFunc("PATCH /queue/cron/{id}", cronHandler.Update)
	mux.HandleFunc("DELETE /queue/cron/{id}", cronHandler.Delete)
	mux.HandleFunc("POST /queue/cron/{id}/run-now", cronHandler.RunNow)

	// Internal WAL event bridge (indus-live -> indus-queue)
	mux.HandleFunc("POST /queue/internal/wal-event", func(w http.ResponseWriter, r *http.Request) {
		if !IsInternalAuthorized(r, internalSecret) {
			handlers.Error(w, http.StatusUnauthorized, "invalid authorization secret")
			return
		}
		internalHandler.HandleWALEvent(w, r)
	})

	// Health check
	mux.HandleFunc("GET /health", func(w http.ResponseWriter, r *http.Request) {
		JSON(w, http.StatusOK, map[string]string{"status": "healthy"})
	})
	mux.Handle("GET /metrics", metrics.Handler())

	var handler http.Handler = mux
	handler = MetricsMiddleware(handler)
	handler = CORSMiddleware(handler)
	handler = LoggingMiddleware(handler)
	return handler
}
