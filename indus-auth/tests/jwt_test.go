package tests

import (
	"testing"
	"time"

	"github.com/indusbase/indus-auth/internal/auth"
)

func TestNewJWTManager(t *testing.T) {
	// TODO: Implement JWT manager creation test
	t.Skip("TODO: Implement JWT manager creation test")

	privateKey := "test-private-key"
	publicKey := "test-public-key"

	manager, err := auth.NewJWTManager(privateKey, publicKey, 15*time.Minute, 7*24*time.Hour)
	if err != nil {
		t.Fatalf("Failed to create JWT manager: %v", err)
	}

	if manager == nil {
		t.Error("Expected manager to not be nil")
	}
}

func TestGenerateJWT(t *testing.T) {
	// TODO: Implement JWT generation test
	t.Skip("TODO: Implement JWT generation test")

	privateKey := "test-private-key"
	publicKey := "test-public-key"

	manager, err := auth.NewJWTManager(privateKey, publicKey, 15*time.Minute, 7*24*time.Hour)
	if err != nil {
		t.Fatalf("Failed to create JWT manager: %v", err)
	}

	token, err := manager.GenerateJWT("user123", "test@example.com", "user", "session123")
	if err != nil {
		t.Fatalf("Failed to generate JWT: %v", err)
	}

	if token == "" {
		t.Error("Expected token to not be empty")
	}
}

func TestValidateJWT(t *testing.T) {
	// TODO: Implement JWT validation test
	t.Skip("TODO: Implement JWT validation test")

	privateKey := "test-private-key"
	publicKey := "test-public-key"

	manager, err := auth.NewJWTManager(privateKey, publicKey, 15*time.Minute, 7*24*time.Hour)
	if err != nil {
		t.Fatalf("Failed to create JWT manager: %v", err)
	}

	token, err := manager.GenerateJWT("user123", "test@example.com", "user", "session123")
	if err != nil {
		t.Fatalf("Failed to generate JWT: %v", err)
	}

	claims, err := manager.ValidateJWT(token)
	if err != nil {
		t.Fatalf("Failed to validate JWT: %v", err)
	}

	if claims.UserID != "user123" {
		t.Errorf("Expected UserID to be 'user123', got '%s'", claims.UserID)
	}

	if claims.Email != "test@example.com" {
		t.Errorf("Expected Email to be 'test@example.com', got '%s'", claims.Email)
	}
}

func TestRefreshToken(t *testing.T) {
	// TODO: Implement refresh token test
	t.Skip("TODO: Implement refresh token test")

	privateKey := "test-private-key"
	publicKey := "test-public-key"

	manager, err := auth.NewJWTManager(privateKey, publicKey, 15*time.Minute, 7*24*time.Hour)
	if err != nil {
		t.Fatalf("Failed to create JWT manager: %v", err)
	}

	// Generate initial tokens
	accessToken, refreshToken, err := manager.RefreshToken("initial-refresh-token")
	if err != nil {
		t.Fatalf("Failed to refresh token: %v", err)
	}

	if accessToken == "" {
		t.Error("Expected access token to not be empty")
	}

	if refreshToken == "" {
		t.Error("Expected refresh token to not be empty")
	}
}

func TestGenerateRefreshToken(t *testing.T) {
	// TODO: Implement refresh token generation test
	t.Skip("TODO: Implement refresh token generation test")

	privateKey := "test-private-key"
	publicKey := "test-public-key"

	manager, err := auth.NewJWTManager(privateKey, publicKey, 15*time.Minute, 7*24*time.Hour)
	if err != nil {
		t.Fatalf("Failed to create JWT manager: %v", err)
	}

	refreshToken, err := manager.GenerateRefreshToken("user123", "session123")
	if err != nil {
		t.Fatalf("Failed to generate refresh token: %v", err)
	}

	if refreshToken == "" {
		t.Error("Expected refresh token to not be empty")
	}
}
