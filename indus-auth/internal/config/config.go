package config

import (
	"fmt"
	"os"
	"strconv"
	"strings"
	"time"
)

// Config holds all application configuration
type Config struct {
	// Server
	ServerPort string

	// Database
	DatabaseURL string

	// Redis
	RedisURL string

	// JWT
	JWTPrivateKeyPath string
	JWTPublicKeyPath  string
	JWTAccessExpiry   time.Duration
	JWTRefreshExpiry  time.Duration

	// OTP
	OTPExpiry time.Duration
	OTPLength int

	// SMTP
	SMTPHost     string
	SMTPPort     int
	SMTPUser     string
	SMTPPassword string
	SMTPFrom     string

	// OAuth - Google
	GoogleClientID     string
	GoogleClientSecret string
	GoogleRedirectURL  string

	// OAuth - GitHub
	GithubClientID     string
	GithubClientSecret string
	GithubRedirectURL  string

	// Security
	InternalSecret         string
	BCryptCost             int
	SAMLSigningCert        string
	SAMLSigningKey         string
	SCIMTokenSigningSecret string

	// CORS
	AllowedOrigins []string
}

// Load loads configuration from environment variables
func Load(configPath string) (*Config, error) {
	cfg := &Config{
		ServerPort:             getEnv("SERVER_PORT", "8001"),
		DatabaseURL:            getEnv("DATABASE_URL", ""),
		RedisURL:               getEnv("REDIS_URL", ""),
		JWTPrivateKeyPath:      getEnv("JWT_PRIVATE_KEY_PATH", ""),
		JWTPublicKeyPath:       getEnv("JWT_PUBLIC_KEY_PATH", ""),
		JWTAccessExpiry:        getEnvAsDuration("JWT_ACCESS_EXPIRY", 15*time.Minute),
		JWTRefreshExpiry:       getEnvAsDuration("JWT_REFRESH_EXPIRY", 7*24*time.Hour),
		OTPExpiry:              getEnvAsDuration("OTP_EXPIRY", 10*time.Minute),
		OTPLength:              getEnvAsInt("OTP_LENGTH", 6),
		SMTPHost:               getEnv("SMTP_HOST", ""),
		SMTPPort:               getEnvAsInt("SMTP_PORT", 587),
		SMTPUser:               getEnv("SMTP_USER", ""),
		SMTPPassword:           getEnv("SMTP_PASSWORD", ""),
		SMTPFrom:               getEnv("SMTP_FROM", ""),
		GoogleClientID:         getEnv("GOOGLE_CLIENT_ID", ""),
		GoogleClientSecret:     getEnv("GOOGLE_CLIENT_SECRET", ""),
		GoogleRedirectURL:      getEnv("GOOGLE_REDIRECT_URL", ""),
		GithubClientID:         getEnv("GITHUB_CLIENT_ID", ""),
		GithubClientSecret:     getEnv("GITHUB_CLIENT_SECRET", ""),
		GithubRedirectURL:      getEnv("GITHUB_REDIRECT_URL", ""),
		InternalSecret:         getEnv("INTERNAL_SECRET", ""),
		BCryptCost:             getEnvAsInt("BCRYPT_COST", 12),
		SAMLSigningCert:        getEnv("SAML_SIGNING_CERT", ""),
		SAMLSigningKey:         getEnv("SAML_SIGNING_KEY", ""),
		SCIMTokenSigningSecret: getEnv("SCIM_TOKEN_SIGNING_SECRET", ""),
		AllowedOrigins:         getEnvAsStringSlice("ALLOWED_ORIGINS", []string{"*"}),
	}

	if err := cfg.Validate(); err != nil {
		return nil, err
	}

	return cfg, nil
}

// Validate checks if all required configuration fields are set
func (c *Config) Validate() error {
	var missing []string

	if c.DatabaseURL == "" {
		missing = append(missing, "DATABASE_URL")
	}
	if c.RedisURL == "" {
		missing = append(missing, "REDIS_URL")
	}
	if c.JWTPrivateKeyPath == "" {
		missing = append(missing, "JWT_PRIVATE_KEY_PATH")
	}
	if c.JWTPublicKeyPath == "" {
		missing = append(missing, "JWT_PUBLIC_KEY_PATH")
	}
	if c.InternalSecret == "" {
		missing = append(missing, "INTERNAL_SECRET")
	}

	if len(missing) > 0 {
		return fmt.Errorf("missing required configuration: %s", strings.Join(missing, ", "))
	}

	return nil
}

func getEnv(key, defaultValue string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return defaultValue
}

func getEnvAsInt(key string, defaultValue int) int {
	if value := os.Getenv(key); value != "" {
		if intVal, err := strconv.Atoi(value); err == nil {
			return intVal
		}
	}
	return defaultValue
}

func getEnvAsDuration(key string, defaultValue time.Duration) time.Duration {
	if value := os.Getenv(key); value != "" {
		if duration, err := time.ParseDuration(value); err == nil {
			return duration
		}
	}
	return defaultValue
}

func getEnvAsStringSlice(key string, defaultValue []string) []string {
	if value := os.Getenv(key); value != "" {
		return strings.Split(value, ",")
	}
	return defaultValue
}
