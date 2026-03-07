package api

import (
	"context"
	"fmt"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/indusbase/indus-auth/internal/auth"
	"github.com/indusbase/indus-auth/internal/config"
	"github.com/indusbase/indus-auth/internal/db"
	"github.com/indusbase/indus-auth/pkg/email"
)

// Server represents the HTTP server
type Server struct {
	router     *gin.Engine
	httpServer *http.Server
	config     *config.Config
	deps       *Dependencies
}

// NewServer creates a new HTTP server
func NewServer(cfg *config.Config, postgresDB *db.PostgresDB, redisClient *db.RedisClient, emailClient *email.Client) (*Server, error) {
	// Set Gin mode
	if cfg.ServerPort == "8001" {
		gin.SetMode(gin.DebugMode)
	} else {
		gin.SetMode(gin.ReleaseMode)
	}

	// Load RSA keys
	privateKey, publicKey, err := auth.LoadKeys(cfg.JWTPrivateKeyPath, cfg.JWTPublicKeyPath)
	if err != nil {
		return nil, fmt.Errorf("failed to load RSA keys: %w", err)
	}

	// Create dependencies
	deps := &Dependencies{
		Config:      cfg,
		DB:          postgresDB.DB,
		Redis:       redisClient,
		PrivateKey:  privateKey,
		PublicKey:   publicKey,
		EmailClient: emailClient,
	}

	// Create router
	router := gin.New()

	// Setup routes
	SetupRoutes(router, deps)

	// Create HTTP server
	httpServer := &http.Server{
		Addr:         ":" + cfg.ServerPort,
		Handler:      router,
		ReadTimeout:  15 * time.Second,
		WriteTimeout: 15 * time.Second,
		IdleTimeout:  60 * time.Second,
	}

	return &Server{
		router:     router,
		httpServer: httpServer,
		config:     cfg,
		deps:       deps,
	}, nil
}

// Start starts the HTTP server
func (s *Server) Start() error {
	return s.httpServer.ListenAndServe()
}

// Shutdown gracefully shuts down the server
func (s *Server) Shutdown() error {
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()
	return s.httpServer.Shutdown(ctx)
}
