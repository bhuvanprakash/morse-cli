package main

import (
	"context"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/indusbase/indus-queue/internal/api"
	"github.com/indusbase/indus-queue/internal/config"
	"github.com/indusbase/indus-queue/internal/db"
	"github.com/indusbase/indus-queue/internal/handlers"
	"github.com/indusbase/indus-queue/internal/models"
	"github.com/indusbase/indus-queue/internal/repository"
	"github.com/indusbase/indus-queue/internal/scheduler"
	"github.com/indusbase/indus-queue/internal/worker"
)

func main() {
	// Load configuration
	cfg := config.Load()

	// Connect to database
	dbPool, err := db.Connect(cfg.DatabaseURL)
	if err != nil {
		log.Fatalf("Failed to connect to database: %v", err)
	}
	defer dbPool.Close()

	// Run migrations
	if err := db.RunMigrations(dbPool); err != nil {
		log.Fatalf("Failed to run migrations: %v", err)
	}

	// Initialize repositories
	queueRepo := repository.NewQueueRepository(dbPool)
	jobRepo := repository.NewJobRepository(dbPool)
	webhookRepo := repository.NewWebhookRepository(dbPool)
	cronRepo := repository.NewCronRepository(dbPool)

	// Initialize handlers
	jobHandler := handlers.NewJobHandler(jobRepo)
	queueHandler := handlers.NewQueueHandler(queueRepo)
	webhookHandler := handlers.NewWebhookHandler(webhookRepo)
	cronHandler := handlers.NewCronHandler(cronRepo, jobRepo)
	internalHandler := handlers.NewInternalHandler(webhookRepo, jobRepo)

	// Ensure required system queues exist.
	systemQueues := []models.CreateQueueRequest{
		{Name: "default", Description: "default jobs", MaxRetries: 3, VisibilityTimeoutSecs: 30},
		{Name: "webhooks", Description: "webhook delivery jobs", MaxRetries: 3, VisibilityTimeoutSecs: 10},
		{Name: "notifications", Description: "notification dispatch jobs", MaxRetries: 2, VisibilityTimeoutSecs: 30},
		{Name: "emails", Description: "email jobs", MaxRetries: 3, VisibilityTimeoutSecs: 60},
	}
	ctx := context.Background()
	for _, q := range systemQueues {
		_ = queueRepo.CreateIfNotExists(ctx, q)
	}

	// Initialize worker dispatcher
	dispatcher := worker.NewDispatcher(jobRepo, webhookRepo, cfg.WorkerPoolSize, cfg.PollInterval)
	dispatcher.AddQueue("default")
	dispatcher.AddQueue("webhooks")
	dispatcher.AddQueue("notifications")
	dispatcher.AddQueue("emails")
	dispatcher.Start()
	defer dispatcher.Stop()

	// Initialize cron scheduler
	cronScheduler := scheduler.NewCronScheduler(cronRepo, jobRepo, cfg.DefaultTimezone)
	cronScheduler.Start()
	defer cronScheduler.Stop()

	// Setup HTTP server
	server := &http.Server{
		Addr:    ":" + cfg.Port,
		Handler: api.SetupRoutes(queueHandler, jobHandler, webhookHandler, cronHandler, internalHandler, cfg.InternalAPISecret),
	}

	// Start server in goroutine
	go func() {
		log.Printf("Starting indus-queue server on port %s", cfg.Port)
		if err := server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("Failed to start server: %v", err)
		}
	}()

	// Wait for interrupt signal
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit
	log.Println("Shutting down server...")

	// Graceful shutdown with timeout
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	if err := server.Shutdown(ctx); err != nil {
		log.Fatalf("Server forced to shutdown: %v", err)
	}

	log.Println("Server exited properly")
}
