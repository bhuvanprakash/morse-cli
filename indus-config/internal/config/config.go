package config

import (
	"os"
	"strconv"
	"time"
)

type Config struct {
	ServerPort          int
	DatabaseURL         string
	InternalSecret      string
	AuditServiceURL     string
	ConfigEncryptionKey string
	AuthServiceURL      string
	CacheTTL            time.Duration
}

func FromEnv() *Config {
	port, _ := strconv.Atoi(getEnvDefault("SERVER_PORT", "8010"))
	cacheTTLSeconds, _ := strconv.Atoi(getEnvDefault("CONFIG_CACHE_TTL_SECONDS", "30"))
	return &Config{
		ServerPort:          port,
		DatabaseURL:         requireEnv("DATABASE_URL"),
		InternalSecret:      requireEnv("INTERNAL_SECRET"),
		AuditServiceURL:     getEnvDefault("AUDIT_SERVICE_URL", "http://indus-audit:8011"),
		ConfigEncryptionKey: requireEnv("CONFIG_ENCRYPTION_KEY"),
		AuthServiceURL:      getEnvDefault("AUTH_SERVICE_URL", "http://indus-auth:8001"),
		CacheTTL:            time.Duration(cacheTTLSeconds) * time.Second,
	}
}

func requireEnv(key string) string {
	value := os.Getenv(key)
	if value == "" {
		panic("required env var missing: " + key)
	}
	return value
}

func getEnvDefault(key, fallback string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return fallback
}
