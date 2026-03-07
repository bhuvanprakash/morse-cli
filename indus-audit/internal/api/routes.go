package api

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/indusbase/indus-audit/internal/handlers"
	"github.com/indusbase/indus-audit/internal/metrics"
)

func RegisterRoutes(r *gin.Engine, internalSecret string, auditHandler *handlers.AuditHandler, exportHandler *handlers.ExportHandler) {
	r.GET("/health", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"data": gin.H{"status": "ok"}, "error": nil})
	})
	r.GET("/metrics", gin.WrapH(metrics.Handler()))

	internal := r.Group("/audit/internal")
	internal.Use(InternalAuth(internalSecret))
	{
		internal.POST("/events", auditHandler.IngestInternal)
	}

	r.GET("/audit/events", auditHandler.List)
	r.GET("/audit/events/:id", auditHandler.Get)
	r.GET("/audit/export", exportHandler.Export)
	r.GET("/audit/summary", auditHandler.Summary)
}
