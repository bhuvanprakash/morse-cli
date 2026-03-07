package api

import (
	"fmt"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/indusbase/indus-secrets/internal/handlers"
	"github.com/indusbase/indus-secrets/internal/metrics"
)

func NewServer(port int, handler *handlers.SecretsHandler) *http.Server {
	gin.SetMode(gin.ReleaseMode)
	r := gin.New()
	r.Use(gin.Recovery())
	r.Use(gin.Logger())

	r.GET("/health", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"data": gin.H{"status": "ok"}, "error": nil})
	})
	r.GET("/metrics", gin.WrapH(metrics.Handler()))

	r.POST("/secrets", handler.Create)
	r.GET("/secrets", handler.List)
	r.GET("/secrets/:name", handler.Get)
	r.POST("/secrets/:name/rotate", handler.Rotate)
	r.POST("/secrets/:name/rollback", handler.Rollback)
	r.GET("/secrets/:name/versions", handler.Versions)
	r.POST("/secrets/internal/fetch", handler.InternalFetch)

	return &http.Server{
		Addr:              fmt.Sprintf(":%d", port),
		Handler:           r,
		ReadHeaderTimeout: 10 * time.Second,
		ReadTimeout:       15 * time.Second,
		WriteTimeout:      15 * time.Second,
		IdleTimeout:       60 * time.Second,
	}
}
