package config

import (
	"os"
	"strconv"
)

type Config struct {
	ServerPort            int
	DatabaseURL           string
	InternalSecret        string
	PlatformEncryptionKey string
	AuditServiceURL       string
}

func FromEnv() *Config {
	return &Config{
		ServerPort:            envInt("SERVER_PORT", 8013),
		DatabaseURL:           mustEnv("DATABASE_URL"),
		InternalSecret:        mustEnv("INTERNAL_SECRET"),
		PlatformEncryptionKey: mustEnv("PLATFORM_ENCRYPTION_KEY"),
		AuditServiceURL:       env("AUDIT_SERVICE_URL", "http://indus-audit:8011"),
	}
}

func env(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}

func envInt(key string, fallback int) int {
	v := os.Getenv(key)
	if v == "" {
		return fallback
	}
	n, err := strconv.Atoi(v)
	if err != nil {
		return fallback
	}
	return n
}

func mustEnv(key string) string {
	v := os.Getenv(key)
	if v == "" {
		panic("required env var missing: " + key)
	}
	return v
}
