package config

import (
	"fmt"
	"os"
	"strconv"
	"strings"
)

// Config holds all configuration for the indus-store service
type Config struct {
	// Required settings
	ServerPort       string
	DatabaseURL      string
	InternalSecret   string
	JWTPublicKeyPath string

	// Storage backend settings
	StorageBackend   string // "local" or "s3"
	LocalStoragePath string

	// S3/MinIO settings
	S3Endpoint  string
	S3AccessKey string
	S3SecretKey string
	S3Bucket    string
	S3Region    string

	// Limits and expiry
	MaxFileSizeMB       int
	SignedURLExpirySecs int
}

// FromEnv loads configuration from environment variables
func FromEnv() (*Config, error) {
	cfg := &Config{
		ServerPort:          getEnv("SERVER_PORT", "8080"),
		DatabaseURL:         getEnv("DATABASE_URL", ""),
		InternalSecret:      getEnv("INTERNAL_SECRET", ""),
		JWTPublicKeyPath:    getEnv("JWT_PUBLIC_KEY_PATH", ""),
		StorageBackend:      getEnv("STORAGE_BACKEND", "local"),
		LocalStoragePath:    getEnv("LOCAL_STORAGE_PATH", "/data/storage"),
		S3Endpoint:          getEnv("S3_ENDPOINT", ""),
		S3AccessKey:         getEnv("S3_ACCESS_KEY", ""),
		S3SecretKey:         getEnv("S3_SECRET_KEY", ""),
		S3Bucket:            getEnv("S3_BUCKET", ""),
		S3Region:            getEnv("S3_REGION", "us-east-1"),
		MaxFileSizeMB:       getEnvInt("MAX_FILE_SIZE_MB", 100),
		SignedURLExpirySecs: getEnvInt("SIGNED_URL_EXPIRY_SECS", 3600),
	}

	return cfg, nil
}

// Validate checks that all required configuration is present
func (c *Config) Validate() error {
	var missing []string

	if c.DatabaseURL == "" {
		missing = append(missing, "DATABASE_URL")
	}
	if c.InternalSecret == "" {
		missing = append(missing, "INTERNAL_SECRET")
	}
	if c.JWTPublicKeyPath == "" {
		missing = append(missing, "JWT_PUBLIC_KEY_PATH")
	}

	if c.StorageBackend == "s3" {
		if c.S3Endpoint == "" {
			missing = append(missing, "S3_ENDPOINT")
		}
		if c.S3AccessKey == "" {
			missing = append(missing, "S3_ACCESS_KEY")
		}
		if c.S3SecretKey == "" {
			missing = append(missing, "S3_SECRET_KEY")
		}
		if c.S3Bucket == "" {
			missing = append(missing, "S3_BUCKET")
		}
	}

	if len(missing) > 0 {
		return fmt.Errorf("missing required environment variables: %s", strings.Join(missing, ", "))
	}

	return nil
}

func getEnv(key, defaultValue string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return defaultValue
}

func getEnvInt(key string, defaultValue int) int {
	if value := os.Getenv(key); value != "" {
		if intVal, err := strconv.Atoi(value); err == nil {
			return intVal
		}
	}
	return defaultValue
}
