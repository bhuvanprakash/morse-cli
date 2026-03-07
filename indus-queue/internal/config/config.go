package config

import (
	"os"
	"strconv"
)

// Config holds all configuration for the queue service
type Config struct {
	// DatabaseURL is the PostgreSQL connection string
	DatabaseURL string

	// Port is the HTTP server port
	Port string

	// WorkerPoolSize is the number of concurrent workers
	WorkerPoolSize int

	// PollInterval is the queue poll interval in milliseconds
	PollInterval int

	// DefaultTimezone is the default timezone for cron jobs
	DefaultTimezone string

	// InternalAPISecret is the secret for internal API authentication
	InternalAPISecret string
}

// Load loads configuration from environment variables
func Load() *Config {
	return &Config{
		DatabaseURL:       getEnv("DATABASE_URL", "postgres://localhost:5432/indusbase"),
		Port:              getEnv("PORT", "8008"),
		WorkerPoolSize:    getEnvAsInt("WORKER_POOL_SIZE", 10),
		PollInterval:      getEnvAsInt("POLL_INTERVAL", 1000),
		DefaultTimezone:   getEnv("DEFAULT_TIMEZONE", "Asia/Kolkata"),
		InternalAPISecret: getEnv("INTERNAL_API_SECRET", "indus-internal-secret"),
	}
}

// getEnv returns the value of an environment variable or a default value
func getEnv(key, defaultValue string) string {
	if value, exists := os.LookupEnv(key); exists {
		return value
	}
	return defaultValue
}

// getEnvAsInt returns the value of an environment variable as an integer or a default value
func getEnvAsInt(key string, defaultValue int) int {
	if value, exists := os.LookupEnv(key); exists {
		if intValue, err := strconv.Atoi(value); err == nil {
			return intValue
		}
	}
	return defaultValue
}
