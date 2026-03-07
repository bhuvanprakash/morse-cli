package models

import (
	"time"
)

// OTPType represents the type of OTP
type OTPType string

const (
	OTPTypeEmailVerification OTPType = "email_verification"
	OTPTypePasswordReset     OTPType = "password_reset"
	OTPTypePhoneVerification OTPType = "phone_verification"
	OTPTypeLogin             OTPType = "login"
)

// OTPCode represents an OTP code
type OTPCode struct {
	ID          string    `json:"id" db:"id"`
	Email       *string   `json:"email,omitempty" db:"email"`
	Phone       *string   `json:"phone,omitempty" db:"phone"`
	Code        string    `json:"-" db:"code"`
	Type        string    `json:"type" db:"type"`
	Attempts    int       `json:"attempts" db:"attempts"`
	MaxAttempts int       `json:"max_attempts" db:"max_attempts"`
	IsUsed      bool      `json:"is_used" db:"is_used"`
	ExpiresAt   time.Time `json:"expires_at" db:"expires_at"`
	CreatedAt   time.Time `json:"created_at" db:"created_at"`
}

// IsValid checks if the OTP code is valid (not expired, not used, attempts not exceeded)
func (o *OTPCode) IsValid() bool {
	if o.IsUsed {
		return false
	}
	if time.Now().After(o.ExpiresAt) {
		return false
	}
	if o.Attempts >= o.MaxAttempts {
		return false
	}
	return true
}

// CanAttempt checks if another attempt is allowed
func (o *OTPCode) CanAttempt() bool {
	return o.Attempts < o.MaxAttempts && !o.IsUsed && time.Now().Before(o.ExpiresAt)
}

// RecordAttempt increments the attempt counter
func (o *OTPCode) RecordAttempt() {
	o.Attempts++
}

// MarkUsed marks the OTP as used
func (o *OTPCode) MarkUsed() {
	o.IsUsed = true
}
