package main

import (
	"log"
	"os"
	"os/signal"
	"syscall"

	"github.com/indusbase/indus-store/internal/api"
	"github.com/indusbase/indus-store/internal/config"
	"github.com/indusbase/indus-store/internal/db"
	"github.com/indusbase/indus-store/internal/storage"
)

func main() {
	// Load configuration
	cfg, err := config.FromEnv()
	if err != nil {
		log.Fatalf("Failed to load config: %v", err)
	}

	if err := cfg.Validate(); err != nil {
		log.Fatalf("Invalid configuration: %v", err)
	}

	// Connect to database
	database, err := db.Connect(cfg.DatabaseURL)
	if err != nil {
		log.Fatalf("Failed to connect to database: %v", err)
	}
	defer db.Close()

	// Run migrations
	if err := db.RunMigrations(database); err != nil {
		log.Fatalf("Failed to run migrations: %v", err)
	}
	log.Println("Database migrations completed")

	// Initialize storage backend
	var store storage.Storage
	switch cfg.StorageBackend {
	case "s3":
		s3Storage, err := storage.NewS3Storage(storage.S3Config{
			Endpoint:  cfg.S3Endpoint,
			Region:    cfg.S3Region,
			AccessKey: cfg.S3AccessKey,
			SecretKey: cfg.S3SecretKey,
			Bucket:    cfg.S3Bucket,
		})
		if err != nil {
			log.Fatalf("Failed to initialize S3 storage: %v", err)
		}
		store = s3Storage
		log.Println("Using S3 storage backend")

	default:
		localStorage, err := storage.NewLocalStorage(cfg.LocalStoragePath, cfg.InternalSecret)
		if err != nil {
			log.Fatalf("Failed to initialize local storage: %v", err)
		}
		store = localStorage
		log.Println("Using local storage backend")
	}

	// Create and start server
	server, err := api.NewServer(cfg, database, store)
	if err != nil {
		log.Fatalf("Failed to create server: %v", err)
	}

	// Handle graceful shutdown
	sigChan := make(chan os.Signal, 1)
	signal.Notify(sigChan, syscall.SIGINT, syscall.SIGTERM)

	go func() {
		<-sigChan
		if err := server.Stop(); err != nil {
			log.Printf("Error during shutdown: %v", err)
		}
	}()

	// Start server
	if err := server.Start(); err != nil {
		log.Fatalf("Server error: %v", err)
	}
}
