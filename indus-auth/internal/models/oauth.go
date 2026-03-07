package models

import (
	"time"
)

// OAuthAccount represents a linked OAuth account
type OAuthAccount struct {
	ID             string     `json:"id" db:"id"`
	UserID         string     `json:"user_id" db:"user_id"`
	Provider       string     `json:"provider" db:"provider"`
	ProviderUserID string     `json:"provider_user_id" db:"provider_user_id"`
	Email          *string    `json:"email,omitempty" db:"email"`
	Name           *string    `json:"name,omitempty" db:"name"`
	AvatarURL      *string    `json:"avatar_url,omitempty" db:"avatar_url"`
	AccessToken    *string    `json:"-" db:"access_token"`
	RefreshToken   *string    `json:"-" db:"refresh_token"`
	ExpiresAt      *time.Time `json:"expires_at,omitempty" db:"expires_at"`
	CreatedAt      time.Time  `json:"created_at" db:"created_at"`
	UpdatedAt      time.Time  `json:"updated_at" db:"updated_at"`
}

// OAuthProvider represents supported OAuth providers
type OAuthProvider string

const (
	OAuthProviderGoogle OAuthProvider = "google"
	OAuthProviderGitHub OAuthProvider = "github"
)

// IsValidProvider checks if the provider is supported
func IsValidProvider(provider string) bool {
	switch OAuthProvider(provider) {
	case OAuthProviderGoogle, OAuthProviderGitHub:
		return true
	default:
		return false
	}
}

// HasValidToken checks if the access token is still valid
func (o *OAuthAccount) HasValidToken() bool {
	if o.ExpiresAt == nil {
		return true
	}
	return time.Now().Before(*o.ExpiresAt)
}

// GoogleUserInfo represents user info from Google
type GoogleUserInfo struct {
	ID            string `json:"id"`
	Email         string `json:"email"`
	VerifiedEmail bool   `json:"verified_email"`
	Name          string `json:"name"`
	GivenName     string `json:"given_name"`
	FamilyName    string `json:"family_name"`
	Picture       string `json:"picture"`
	Locale        string `json:"locale"`
}

// GithubUserInfo represents user info from GitHub
type GithubUserInfo struct {
	ID        int64  `json:"id"`
	Login     string `json:"login"`
	Email     string `json:"email"`
	Name      string `json:"name"`
	AvatarURL string `json:"avatar_url"`
	NodeID    string `json:"node_id"`
}
