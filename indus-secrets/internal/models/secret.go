package models

import "time"

type Secret struct {
	ID             string    `json:"id"`
	Name           string    `json:"name"`
	Scope          string    `json:"scope"`
	OrganizationID *string   `json:"organization_id,omitempty"`
	ProjectID      *string   `json:"project_id,omitempty"`
	FunctionID     *string   `json:"function_id,omitempty"`
	ActiveVersion  int       `json:"active_version"`
	Description    *string   `json:"description,omitempty"`
	CreatedAt      time.Time `json:"created_at"`
	UpdatedAt      time.Time `json:"updated_at"`
}

type SecretVersion struct {
	ID             string     `json:"id"`
	SecretID       string     `json:"secret_id"`
	Version        int        `json:"version"`
	EncryptedValue string     `json:"-"`
	ValuePreview   string     `json:"value_preview"`
	CreatedBy      *string    `json:"created_by,omitempty"`
	CreatedAt      time.Time  `json:"created_at"`
	RotatedAt      *time.Time `json:"rotated_at,omitempty"`
}
