package main

import (
	"flag"
	"log"
	"os"
	"os/signal"
	"path/filepath"
	"syscall"

	"github.com/indusbase/indus-auth/internal/api"
	"github.com/indusbase/indus-auth/internal/config"
	"github.com/indusbase/indus-auth/internal/db"
	"github.com/indusbase/indus-auth/pkg/email"
)

func main() {
	var (
		configPath = flag.String("config", "", "Path to config file")
		port       = flag.String("port", "", "Server port (overrides config)")
	)
	flag.Parse()

	log.Println("Starting indus-auth service...")

	// Load configuration
	cfg, err := config.Load(*configPath)
	if err != nil {
		log.Fatalf("Failed to load config: %v", err)
	}

	// Override port if provided via flag
	if *port != "" {
		cfg.ServerPort = *port
	}

	log.Printf("Configuration loaded. Server will run on port %s", cfg.ServerPort)

	// Initialize database connection
	log.Println("Connecting to PostgreSQL...")
	postgresDB, err := db.Connect(cfg.DatabaseURL)
	if err != nil {
		log.Fatalf("Failed to connect to PostgreSQL: %v", err)
	}
	defer postgresDB.Close()
	log.Println("Connected to PostgreSQL")

	// Test database connection
	if err := postgresDB.Ping(nil); err != nil {
		log.Fatalf("Failed to ping PostgreSQL: %v", err)
	}

	// Run migrations
	log.Println("Running database migrations...")
	migrationsDir := filepath.Join("internal", "db", "migrations")
	if err := db.RunMigrations(postgresDB.DB, migrationsDir); err != nil {
		log.Fatalf("Failed to run migrations: %v", err)
	}
	log.Println("Database migrations completed")

	// Initialize Redis
	log.Println("Connecting to Redis...")
	redisClient, err := db.ConnectRedis(cfg.RedisURL)
	if err != nil {
		log.Fatalf("Failed to connect to Redis: %v", err)
	}
	defer redisClient.Close()
	log.Println("Connected to Redis")

	// Initialize email client
	var emailClient *email.Client
	if cfg.SMTPHost != "" && cfg.SMTPUser != "" {
		emailClient = email.NewClient(
			cfg.SMTPHost,
			cfg.SMTPPort,
			cfg.SMTPUser,
			cfg.SMTPPassword,
			cfg.SMTPFrom,
		)
		log.Println("Email client initialized")
	} else {
		log.Println("SMTP not configured, email features disabled")
	}

	// Create and start server
	log.Println("Initializing HTTP server...")
	server, err := api.NewServer(cfg, postgresDB, redisClient, emailClient)
	if err != nil {
		log.Fatalf("Failed to create server: %v", err)
	}

	// Handle graceful shutdown
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)

	go func() {
		log.Printf("Server starting on port %s", cfg.ServerPort)
		if err := server.Start(); err != nil {
			log.Fatalf("Failed to start server: %v", err)
		}
	}()

	<-quit
	log.Println("Shutting down server...")

	if err := server.Shutdown(); err != nil {
		log.Printf("Server forced to shutdown: %v", err)
	}

	log.Println("Server exited gracefully")
}
