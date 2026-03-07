package auth

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"
	"regexp"
	"strings"
	"time"

	"github.com/indusbase/indus-auth/internal/db"
	"github.com/indusbase/indus-auth/pkg/crypto"
)

const (
	phoneOTPKeyPrefix    = "phone_otp:"
	phoneOTPMaxAttempts  = 3
	phoneOTPRateLimitKey = "phone_otp_rate:"
)

// WhatsAppOTPConfig holds configuration for WhatsApp OTP via Gupshup API
type WhatsAppOTPConfig struct {
	GupshupAPIKey string
	SenderPhone   string
	TemplateName  string
}

// Validate validates the WhatsApp OTP configuration
func (c *WhatsAppOTPConfig) Validate() error {
	if c.GupshupAPIKey == "" {
		return fmt.Errorf("gupshup API key is required")
	}
	if c.SenderPhone == "" {
		return fmt.Errorf("sender phone number is required")
	}
	if c.TemplateName == "" {
		c.TemplateName = "indusbase_otp"
	}
	return nil
}

// PhoneOTPData represents stored phone OTP data
type PhoneOTPData struct {
	Code      string    `json:"code"`
	Type      string    `json:"type"`
	Attempts  int       `json:"attempts"`
	Phone     string    `json:"phone"`
	CreatedAt time.Time `json:"created_at"`
}

// GupshupOTPRequest represents the request payload for Gupshup API
type GupshupOTPRequest struct {
	Channel      string `json:"channel"`
	Source       string `json:"source"`
	Destination  string `json:"destination"`
	Message      string `json:"message"`
	SrcName      string `json:"src.name"`
	TemplateName string `json:"template_name,omitempty"`
	TemplateJSON string `json:"template_json,omitempty"`
}

// GupshupResponse represents the response from Gupshup API
type GupshupResponse struct {
	Status    string `json:"status"`
	MessageID string `json:"messageId"`
	ErrorCode string `json:"errorCode"`
	ErrorMsg  string `json:"errorMsg"`
}

// ValidateIndianPhoneNumber validates Indian phone number format (91XXXXXXXXXX)
func ValidateIndianPhoneNumber(phone string) error {
	// Remove any spaces, dashes, or + prefix
	phone = strings.TrimSpace(phone)
	phone = strings.TrimPrefix(phone, "+")

	// Check if it matches Indian format: 91 followed by 10 digits
	// Valid formats: 91XXXXXXXXXX, +91XXXXXXXXXX
	re := regexp.MustCompile(`^91[6-9]\d{9}$`)
	if !re.MatchString(phone) {
		return fmt.Errorf("invalid Indian phone number format. Expected: 91XXXXXXXXXX (12 digits starting with 91)")
	}

	return nil
}

// NormalizeIndianPhone normalizes Indian phone number to standard format
func NormalizeIndianPhone(phone string) string {
	// Remove any non-digit characters
	re := regexp.MustCompile(`\D`)
	phone = re.ReplaceAllString(phone, "")

	// Add 91 prefix if missing and number is 10 digits
	if len(phone) == 10 && phone[0] >= '6' && phone[0] <= '9' {
		phone = "91" + phone
	}

	return phone
}

// SendWhatsAppOTP sends an OTP via WhatsApp using Gupshup API
func SendWhatsAppOTP(ctx context.Context, cfg *WhatsAppOTPConfig, phone, otp string) error {
	if err := ValidateIndianPhoneNumber(phone); err != nil {
		return err
	}

	if cfg == nil {
		return fmt.Errorf("whatsapp OTP config is nil")
	}

	if err := cfg.Validate(); err != nil {
		return err
	}

	// Gupshup API endpoint
	apiURL := "https://api.gupshup.io/sm/api/v1/msg"

	// Prepare message with OTP
	message := fmt.Sprintf("Your IndusBase verification code is: %s. Valid for 10 minutes. Do not share this code with anyone.", otp)

	// Prepare form data
	data := url.Values{}
	data.Set("channel", "whatsapp")
	data.Set("source", cfg.SenderPhone)
	data.Set("destination", phone)
	data.Set("message", message)
	data.Set("src.name", "IndusBase")

	// Create request
	req, err := http.NewRequestWithContext(ctx, "POST", apiURL, strings.NewReader(data.Encode()))
	if err != nil {
		return fmt.Errorf("failed to create request: %w", err)
	}

	// Set headers
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	req.Header.Set("apikey", cfg.GupshupAPIKey)

	// Execute request
	client := &http.Client{Timeout: 30 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return fmt.Errorf("failed to send WhatsApp OTP: %w", err)
	}
	defer resp.Body.Close()

	// Parse response
	var gupshupResp GupshupResponse
	if err := json.NewDecoder(resp.Body).Decode(&gupshupResp); err != nil {
		return fmt.Errorf("failed to decode Gupshup response: %w", err)
	}

	// Check for errors
	if gupshupResp.Status != "submitted" && gupshupResp.Status != "success" {
		if gupshupResp.ErrorMsg != "" {
			return fmt.Errorf("gupshup API error: %s (code: %s)", gupshupResp.ErrorMsg, gupshupResp.ErrorCode)
		}
		return fmt.Errorf("gupshup API returned unexpected status: %s", gupshupResp.Status)
	}

	return nil
}

// GenerateAndStorePhoneOTP generates and stores a phone OTP in Redis
func GenerateAndStorePhoneOTP(ctx context.Context, redisClient *db.RedisClient, phone, otpType string, length int, expiry time.Duration) (string, error) {
	// Normalize phone number
	phone = NormalizeIndianPhone(phone)

	// Validate phone format
	if err := ValidateIndianPhoneNumber(phone); err != nil {
		return "", err
	}

	// Check rate limiting
	rateLimitKey := phoneOTPRateLimitKey + phone
	exists, err := redisClient.Exists(ctx, rateLimitKey)
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
	otpData := PhoneOTPData{
		Code:      otp,
		Type:      otpType,
		Attempts:  0,
		Phone:     phone,
		CreatedAt: time.Now(),
	}

	data, err := json.Marshal(otpData)
	if err != nil {
		return "", fmt.Errorf("failed to marshal OTP data: %w", err)
	}

	key := phoneOTPKeyPrefix + phone + ":" + otpType
	if err := redisClient.SetWithTTL(ctx, key, string(data), expiry); err != nil {
		return "", fmt.Errorf("failed to store OTP: %w", err)
	}

	// Set rate limit (1 minute between requests)
	if err := redisClient.SetWithTTL(ctx, rateLimitKey, "1", time.Minute); err != nil {
		// Non-critical error, log but don't fail
		_ = err
	}

	return otp, nil
}

// VerifyPhoneOTP verifies a phone OTP code
func VerifyPhoneOTP(ctx context.Context, redisClient *db.RedisClient, phone, otpType, inputCode string) error {
	// Normalize phone number
	phone = NormalizeIndianPhone(phone)

	key := phoneOTPKeyPrefix + phone + ":" + otpType

	data, err := redisClient.Get(ctx, key)
	if err != nil {
		return ErrOTPNotFound
	}

	var otpData PhoneOTPData
	if err := json.Unmarshal([]byte(data), &otpData); err != nil {
		return fmt.Errorf("failed to unmarshal OTP data: %w", err)
	}

	// Check attempts
	if otpData.Attempts >= phoneOTPMaxAttempts {
		_ = redisClient.Delete(ctx, key)
		return ErrMaxAttemptsOTP
	}

	// Increment attempts
	otpData.Attempts++

	// Check if code matches
	if otpData.Code != inputCode {
		// Update attempts
		newData, _ := json.Marshal(otpData)
		_ = redisClient.SetWithTTL(ctx, key, string(newData), time.Minute*10)
		return ErrInvalidOTP
	}

	// Success - delete OTP
	_ = redisClient.Delete(ctx, key)

	return nil
}

// DeletePhoneOTP deletes a phone OTP from Redis
func DeletePhoneOTP(ctx context.Context, redisClient *db.RedisClient, phone, otpType string) error {
	phone = NormalizeIndianPhone(phone)
	key := phoneOTPKeyPrefix + phone + ":" + otpType
	return redisClient.Delete(ctx, key)
}

// GetPhoneOTPStatus gets the current OTP status for a phone number
func GetPhoneOTPStatus(ctx context.Context, redisClient *db.RedisClient, phone, otpType string) (*PhoneOTPData, error) {
	phone = NormalizeIndianPhone(phone)
	key := phoneOTPKeyPrefix + phone + ":" + otpType

	data, err := redisClient.Get(ctx, key)
	if err != nil {
		return nil, ErrOTPNotFound
	}

	var otpData PhoneOTPData
	if err := json.Unmarshal([]byte(data), &otpData); err != nil {
		return nil, fmt.Errorf("failed to unmarshal OTP data: %w", err)
	}

	return &otpData, nil
}

// MaskPhone masks a phone number for display
func MaskPhone(phone string) string {
	phone = NormalizeIndianPhone(phone)
	if len(phone) != 12 {
		return "****"
	}
	// Show last 4 digits: 91******1234
	return phone[:2] + "******" + phone[8:]
}
