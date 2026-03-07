package api

import (
	"context"
	"fmt"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/indusbase/indus-meta/internal/config"
	"github.com/indusbase/indus-meta/internal/postgres"
)

// Server represents the HTTP server
type Server struct {
	router *gin.Engine
	cfg    *config.Config
	db     *postgres.DB
	http   *http.Server
}

// NewServer creates a new HTTP server
func NewServer(cfg *config.Config, db *postgres.DB) *Server {
	gin.SetMode(gin.ReleaseMode)
	router := gin.New()
	router.Use(gin.Recovery())
	router.Use(Logger())

	server := &Server{
		router: router,
		cfg:    cfg,
		db:     db,
	}

	server.setupMiddleware()
	server.setupRoutes()

	server.http = &http.Server{
		Addr:    cfg.Addr(),
		Handler: router,
	}

	return server
}

// setupMiddleware configures middleware
func (s *Server) setupMiddleware() {
	s.router.Use(InternalOnly(s.cfg))
}

// setupRoutes configures routes
func (s *Server) setupRoutes() {
	// Health check
	s.router.GET("/health", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"status": "ok"})
	})

	// Register all routes
	RegisterRoutes(s.router, s.db)
}

// Start starts the HTTP server with graceful shutdown
func (s *Server) Start() error {
	// Start server in a goroutine
	go func() {
		fmt.Printf("Server starting on %s\n", s.cfg.Addr())
		if err := s.http.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			fmt.Printf("Server error: %v\n", err)
		}
	}()

	// Wait for interrupt signal
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit

	fmt.Println("Shutting down server...")

	// Graceful shutdown with timeout
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	return s.http.Shutdown(ctx)
}

// Close closes the server
func (s *Server) Close() error {
	return s.http.Close()
}
