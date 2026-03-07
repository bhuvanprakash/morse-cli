package models

import (
	"encoding/json"
	"time"
)

type AuditEvent struct {
	ID           string          `json:"id"`
	ProjectID    *string         `json:"project_id,omitempty"`
	ActorUserID  *string         `json:"actor_user_id,omitempty"`
	ActorEmail   *string         `json:"actor_email,omitempty"`
	ActorType    string          `json:"actor_type"`
	Action       string          `json:"action"`
	ResourceType string          `json:"resource_type"`
	ResourceID   string          `json:"resource_id"`
	Severity     string          `json:"severity"`
	IPAddress    *string         `json:"ip_address,omitempty"`
	UserAgent    *string         `json:"user_agent,omitempty"`
	Metadata     json.RawMessage `json:"metadata"`
	CreatedAt    time.Time       `json:"created_at"`
}

type ListFilters struct {
	ProjectID    string
	Actor        string
	Action       string
	ResourceType string
	Severity     string
	From         string
	To           string
	Limit        int
	Offset       int
}
