package config

import (
	"errors"
	"fmt"
	"os"
)

// Config holds application configuration
type Config struct {
	ServerPort     string // default "8003"
	DatabaseURL    string // required
	InternalSecret string // required for X-IndusBase-Internal header validation
}

// Load loads configuration from environment variables
func Load() *Config {
	return &Config{
		ServerPort:     getEnv("SERVER_PORT", "8003"),
		DatabaseURL:    getEnv("DATABASE_URL", ""),
		InternalSecret: getEnv("INTERNAL_SECRET", ""),
	}
}

// Validate validates the configuration
func (c *Config) Validate() error {
	if c.DatabaseURL == "" {
		return errors.New("DATABASE_URL is required")
	}
	if c.InternalSecret == "" {
		return errors.New("INTERNAL_SECRET is required")
	}
	return nil
}

// Addr returns the server address
func (c *Config) Addr() string {
	return fmt.Sprintf(":%s", c.ServerPort)
}

func getEnv(key, defaultValue string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return defaultValue
}
