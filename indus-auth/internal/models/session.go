package models

import (
	"net"
	"time"
)

// Session represents a user session
type Session struct {
	ID           string    `json:"id" db:"id"`
	UserID       string    `json:"user_id" db:"user_id"`
	RefreshToken string    `json:"-" db:"refresh_token"`
	UserAgent    *string   `json:"user_agent,omitempty" db:"user_agent"`
	IPAddress    *net.IP   `json:"ip_address,omitempty" db:"ip_address"`
	IsRevoked    bool      `json:"is_revoked" db:"is_revoked"`
	ExpiresAt    time.Time `json:"expires_at" db:"expires_at"`
	CreatedAt    time.Time `json:"created_at" db:"created_at"`
	UpdatedAt    time.Time `json:"updated_at" db:"updated_at"`
}

// IsExpired checks if the session has expired
func (s *Session) IsExpired() bool {
	return time.Now().After(s.ExpiresAt)
}

// IsValid checks if the session is valid (not revoked and not expired)
func (s *Session) IsValid() bool {
	return !s.IsRevoked && !s.IsExpired()
}
