package api

import (
	"net/http"

	"github.com/indusbase/indus-queue/internal/handlers"
)

// SetupRoutes sets up all HTTP routes with middleware
func SetupRoutesWithMiddleware(
	queueHandler *handlers.QueueHandler,
	jobHandler *handlers.JobHandler,
	webhookHandler *handlers.WebhookHandler,
	cronHandler *handlers.CronHandler,
	internalHandler *handlers.InternalHandler,
	internalSecret string,
) http.Handler {
	// Setup base routes
	mux := SetupRoutes(queueHandler, jobHandler, webhookHandler, cronHandler, internalHandler, internalSecret)

	// Apply middleware chain
	return LoggingMiddleware(
		CORSMiddleware(
			InternalAuthMiddleware(internalSecret)(mux),
		),
	)
}
