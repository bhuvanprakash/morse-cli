package models

import (
	"encoding/json"
	"time"
)

// Webhook represents a webhook configuration
type Webhook struct {
	ID        string          `json:"id"`
	Name      string          `json:"name"`
	URL       string          `json:"url"`
	Event     string          `json:"event"`
	Secret    string          `json:"secret"`
	Enabled   bool            `json:"enabled"`
	Headers   json.RawMessage `json:"headers"`
	CreatedAt time.Time       `json:"created_at"`
	UpdatedAt time.Time       `json:"updated_at"`
}

// CreateWebhookRequest represents a request to create a webhook
type CreateWebhookRequest struct {
	Name    string          `json:"name"`
	URL     string          `json:"url"`
	Event   string          `json:"event"`
	Secret  string          `json:"secret"`
	Enabled bool            `json:"enabled"`
	Headers json.RawMessage `json:"headers"`
}

// UpdateWebhookRequest represents a request to update a webhook
type UpdateWebhookRequest struct {
	Name    *string         `json:"name,omitempty"`
	URL     *string         `json:"url,omitempty"`
	Event   *string         `json:"event,omitempty"`
	Secret  *string         `json:"secret,omitempty"`
	Enabled *bool           `json:"enabled,omitempty"`
	Headers json.RawMessage `json:"headers,omitempty"`
}

// TestWebhookRequest represents a request to test a webhook
type TestWebhookRequest struct {
	Payload json.RawMessage `json:"payload"`
}
