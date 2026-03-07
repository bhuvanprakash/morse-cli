package models

import (
	"encoding/json"
	"time"
)

// User represents a user in the system
type User struct {
	ID            string          `json:"id" db:"id"`
	Email         string          `json:"email" db:"email"`
	Phone         *string         `json:"phone,omitempty" db:"phone"`
	PasswordHash  string          `json:"-" db:"password_hash"`
	Name          string          `json:"name" db:"name"`
	Role          string          `json:"role" db:"role"`
	EmailVerified bool            `json:"email_verified" db:"email_verified"`
	PhoneVerified bool            `json:"phone_verified" db:"phone_verified"`
	Status        string          `json:"status" db:"status"`
	AvatarURL     *string         `json:"avatar_url,omitempty" db:"avatar_url"`
	Metadata      json.RawMessage `json:"metadata,omitempty" db:"metadata"`
	LastSignInAt  *time.Time      `json:"last_sign_in_at,omitempty" db:"last_sign_in_at"`
	CreatedAt     time.Time       `json:"created_at" db:"created_at"`
	UpdatedAt     time.Time       `json:"updated_at" db:"updated_at"`
	DeletedAt     *time.Time      `json:"deleted_at,omitempty" db:"deleted_at"`
}

// PublicUser represents user data returned in API responses
type PublicUser struct {
	ID            string          `json:"id"`
	Email         string          `json:"email"`
	Phone         *string         `json:"phone,omitempty"`
	Name          string          `json:"name"`
	Role          string          `json:"role"`
	EmailVerified bool            `json:"email_verified"`
	PhoneVerified bool            `json:"phone_verified"`
	Status        string          `json:"status"`
	AvatarURL     *string         `json:"avatar_url,omitempty"`
	Metadata      json.RawMessage `json:"metadata,omitempty"`
	LastSignInAt  *time.Time      `json:"last_sign_in_at,omitempty"`
	CreatedAt     time.Time       `json:"created_at"`
	UpdatedAt     time.Time       `json:"updated_at"`
}

// ToPublic converts User to PublicUser
func (u *User) ToPublic() PublicUser {
	return PublicUser{
		ID:            u.ID,
		Email:         u.Email,
		Phone:         u.Phone,
		Name:          u.Name,
		Role:          u.Role,
		EmailVerified: u.EmailVerified,
		PhoneVerified: u.PhoneVerified,
		Status:        u.Status,
		AvatarURL:     u.AvatarURL,
		Metadata:      u.Metadata,
		LastSignInAt:  u.LastSignInAt,
		CreatedAt:     u.CreatedAt,
		UpdatedAt:     u.UpdatedAt,
	}
}

// IsActive checks if user is active
func (u *User) IsActive() bool {
	return u.Status == "active" && u.DeletedAt == nil
}

// IsAdmin checks if user has admin role
func (u *User) IsAdmin() bool {
	return u.Role == "admin"
}
