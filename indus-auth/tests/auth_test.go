package tests

import (
	"testing"

	"github.com/indusbase/indus-auth/pkg/crypto"
	"github.com/indusbase/indus-auth/pkg/validator"
)

func TestBcryptHash(t *testing.T) {
	// TODO: Implement bcrypt hash test
	t.Skip("TODO: Implement bcrypt hash test")

	password := "TestPassword123!"
	hash, err := crypto.BcryptHash(password)
	if err != nil {
		t.Fatalf("Failed to hash password: %v", err)
	}

	// Verify hash is not empty
	if hash == "" {
		t.Error("Expected hash to not be empty")
	}

	// Verify password matches
	err = crypto.BcryptVerify(password, hash)
	if err != nil {
		t.Errorf("Password verification failed: %v", err)
	}
}

func TestGenerateRandomToken(t *testing.T) {
	// TODO: Implement random token test
	t.Skip("TODO: Implement random token test")

	token, err := crypto.GenerateRandomToken(32)
	if err != nil {
		t.Fatalf("Failed to generate token: %v", err)
	}

	if len(token) == 0 {
		t.Error("Expected token to not be empty")
	}
}

func TestValidateEmail(t *testing.T) {
	// TODO: Implement email validation test
	t.Skip("TODO: Implement email validation test")

	tests := []struct {
		email    string
		expected bool
	}{
		{"test@example.com", true},
		{"invalid-email", false},
		{"@example.com", false},
		{"test@", false},
	}

	for _, tt := range tests {
		err := validator.ValidateEmail(tt.email)
		if tt.expected && err != nil {
			t.Errorf("Expected %s to be valid, got error: %v", tt.email, err)
		}
		if !tt.expected && err == nil {
			t.Errorf("Expected %s to be invalid, but got no error", tt.email)
		}
	}
}

func TestValidatePassword(t *testing.T) {
	// TODO: Implement password validation test
	t.Skip("TODO: Implement password validation test")

	tests := []struct {
		password string
		expected bool
	}{
		{"Test123!", true},
		{"weak", false},
		{"noSpecial123", false},
		{"NoNumber!", false},
	}

	for _, tt := range tests {
		err := validator.ValidatePassword(tt.password)
		if tt.expected && err != nil {
			t.Errorf("Expected password to be valid, got error: %v", err)
		}
		if !tt.expected && err == nil {
			t.Error("Expected password to be invalid, but got no error")
		}
	}
}

func TestIsStrongPassword(t *testing.T) {
	// TODO: Implement strong password test
	t.Skip("TODO: Implement strong password test")

	tests := []struct {
		password string
		expected bool
	}{
		{"StrongPass123!", true},
		{"weak", false},
		{"12345678", false},
	}

	for _, tt := range tests {
		result := validator.IsStrongPassword(tt.password)
		if result != tt.expected {
			t.Errorf("IsStrongPassword(%s) = %v, expected %v", tt.password, result, tt.expected)
		}
	}
}
