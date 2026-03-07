package api

import (
	"context"
	"database/sql"
	"fmt"
	"log"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/indusbase/indus-store/internal/config"
	"github.com/indusbase/indus-store/internal/handlers"
	"github.com/indusbase/indus-store/internal/repository"
	"github.com/indusbase/indus-store/internal/storage"
)

// Server holds the HTTP server and its dependencies
type Server struct {
	router           *gin.Engine
	httpServer       *http.Server
	config           *config.Config
	storage          storage.Storage
	bucketHandler    *handlers.BucketHandler
	objectHandler    *handlers.ObjectHandler
	signedURLHandler *handlers.SignedURLHandler
	authMiddleware   *AuthMiddleware
}

// NewServer creates a new server instance
func NewServer(cfg *config.Config, db *sql.DB, store storage.Storage) (*Server, error) {
	// Set Gin mode
	if gin.Mode() == "" {
		gin.SetMode(gin.ReleaseMode)
	}

	// Create router
	router := gin.New()
	router.Use(LoggerMiddleware())
	router.Use(gin.Recovery())
	router.Use(CORSMiddleware())

	// Create auth middleware
	authMiddleware, err := NewAuthMiddleware(cfg.JWTPublicKeyPath)
	if err != nil {
		return nil, fmt.Errorf("failed to create auth middleware: %w", err)
	}

	// Create repositories
	bucketRepo := repository.NewBucketRepository(db)
	objectRepo := repository.NewObjectRepository(db)

	// Create handlers
	bucketHandler := handlers.NewBucketHandler(bucketRepo)
	objectHandler := handlers.NewObjectHandler(objectRepo, bucketRepo, store, cfg.StorageBackend)
	signedURLHandler := handlers.NewSignedURLHandler(objectRepo, bucketRepo, store, cfg.InternalSecret, cfg.SignedURLExpirySecs)

	// Setup routes
	SetupRoutes(router, authMiddleware, bucketHandler, objectHandler, signedURLHandler)

	// Create HTTP server
	httpServer := &http.Server{
		Addr:         ":" + cfg.ServerPort,
		Handler:      router,
		ReadTimeout:  30 * time.Second,
		WriteTimeout: 30 * time.Second,
		IdleTimeout:  120 * time.Second,
	}

	return &Server{
		router:           router,
		httpServer:       httpServer,
		config:           cfg,
		storage:          store,
		bucketHandler:    bucketHandler,
		objectHandler:    objectHandler,
		signedURLHandler: signedURLHandler,
		authMiddleware:   authMiddleware,
	}, nil
}

// Start starts the HTTP server
func (s *Server) Start() error {
	log.Printf("Starting indus-store server on port %s", s.config.ServerPort)
	return s.httpServer.ListenAndServe()
}

// Stop gracefully shuts down the server
func (s *Server) Stop() error {
	log.Println("Shutting down server...")
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	return s.httpServer.Shutdown(ctx)
}
