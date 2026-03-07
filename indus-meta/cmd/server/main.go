package main

import (
	"log"
	"os"

	"github.com/indusbase/indus-meta/internal/api"
	"github.com/indusbase/indus-meta/internal/config"
	"github.com/indusbase/indus-meta/internal/postgres"
)

func main() {
	// Load configuration
	cfg := config.Load()

	// Validate configuration
	if err := cfg.Validate(); err != nil {
		log.Fatalf("Configuration error: %v", err)
	}

	// Initialize database connection
	db, err := postgres.Connect(cfg.DatabaseURL)
	if err != nil {
		log.Fatalf("Failed to connect to database: %v", err)
	}
	defer db.Close()

	// Verify database connection
	if err := db.Ping(); err != nil {
		log.Fatalf("Failed to ping database: %v", err)
	}

	log.Println("Connected to database successfully")

	// Create and start server
	server := api.NewServer(cfg, db)
	if err := server.Start(); err != nil {
		log.Fatalf("Server error: %v", err)
	}

	log.Println("Server shutdown complete")
	os.Exit(0)
}
