package auth

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"github.com/indusbase/indus-auth/internal/db"
	"github.com/indusbase/indus-auth/pkg/crypto"
	"github.com/indusbase/indus-auth/pkg/email"
)

const (
	otpKeyPrefix    = "otp:"
	otpMaxAttempts  = 3
	otpRateLimitKey = "otp_rate:"
)

// OTPErrors represents OTP verification errors
type OTPErrors struct {
	InvalidCode error
	Expired     error
	MaxAttempts error
	NotFound    error
}

// OTPErrors instances
var (
	ErrInvalidOTP     = fmt.Errorf("invalid OTP code")
	ErrExpiredOTP     = fmt.Errorf("OTP has expired")
	ErrMaxAttemptsOTP = fmt.Errorf("maximum attempts exceeded")
	ErrOTPNotFound    = fmt.Errorf("OTP not found")
)

// GenerateAndStoreOTP generates and stores an OTP in Redis
func GenerateAndStoreOTP(ctx context.Context, redis *db.RedisClient, email string, otpType string, length int, expiry time.Duration) (string, error) {
	// Check rate limiting
	rateLimitKey := otpRateLimitKey + email
	exists, err := redis.Exists(ctx, rateLimitKey)
	if err != nil {
		return "", fmt.Errorf("failed to check rate limit: %w", err)
	}
	if exists {
		return "", fmt.Errorf("rate limit exceeded, please wait before requesting another OTP")
	}

	// Generate OTP
	otp, err := crypto.GenerateOTP(length)
	if err != nil {
		return "", fmt.Errorf("failed to generate OTP: %w", err)
	}

	// Store OTP data
	otpData := map[string]interface{}{
		"code":     otp,
		"type":     otpType,
		"attempts": 0,
		"email":    email,
	}

	data, err := json.Marshal(otpData)
	if err != nil {
		return "", fmt.Errorf("failed to marshal OTP data: %w", err)
	}

	key := otpKeyPrefix + email + ":" + otpType
	if err := redis.SetWithTTL(ctx, key, string(data), expiry); err != nil {
		return "", fmt.Errorf("failed to store OTP: %w", err)
	}

	// Set rate limit (1 minute)
	if err := redis.SetWithTTL(ctx, rateLimitKey, "1", time.Minute); err != nil {
		// Non-critical error, log but don't fail
		_ = err
	}

	return otp, nil
}

// VerifyOTP verifies an OTP code
func VerifyOTP(ctx context.Context, redis *db.RedisClient, email, otpType, inputCode string) error {
	key := otpKeyPrefix + email + ":" + otpType

	data, err := redis.Get(ctx, key)
	if err != nil {
		return ErrOTPNotFound
	}

	var otpData map[string]interface{}
	if err := json.Unmarshal([]byte(data), &otpData); err != nil {
		return fmt.Errorf("failed to unmarshal OTP data: %w", err)
	}

	// Check if code matches
	storedCode, ok := otpData["code"].(string)
	if !ok {
		return ErrInvalidOTP
	}

	// Check attempts
	attempts := 0
	if a, ok := otpData["attempts"].(float64); ok {
		attempts = int(a)
	}

	if attempts >= otpMaxAttempts {
		_ = redis.Delete(ctx, key)
		return ErrMaxAttemptsOTP
	}

	// Increment attempts
	attempts++
	otpData["attempts"] = attempts

	if storedCode != inputCode {
		// Update attempts
		newData, _ := json.Marshal(otpData)
		_ = redis.SetWithTTL(ctx, key, string(newData), time.Minute*10)
		return ErrInvalidOTP
	}

	// Success - delete OTP
	_ = redis.Delete(ctx, key)

	return nil
}

// SendOTPEmail sends an OTP email
func SendOTPEmail(ctx context.Context, smtpClient *email.Client, to, otp, otpType string) error {
	if smtpClient == nil || !smtpClient.IsConfigured() {
		return fmt.Errorf("SMTP client not configured")
	}

	return smtpClient.SendOTPEmail(to, otp, otpType)
}

// DeleteOTP deletes an OTP from Redis
func DeleteOTP(ctx context.Context, redis *db.RedisClient, email, otpType string) error {
	key := otpKeyPrefix + email + ":" + otpType
	return redis.Delete(ctx, key)
}
