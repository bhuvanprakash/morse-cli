package models

import (
	"time"

	"github.com/google/uuid"
)

type ConfigEntry struct {
	ID            uuid.UUID  `json:"id" db:"id"`
	Key           string     `json:"key" db:"key"`
	EnvironmentID uuid.UUID  `json:"environment_id" db:"environment_id"`
	Value         string     `json:"value" db:"value"`
	ValueType     ValueType  `json:"value_type" db:"value_type"`
	Description   string     `json:"description" db:"description"`
	IsSecret      bool       `json:"is_secret" db:"is_secret"`
	OwnerID       *uuid.UUID `json:"owner_id,omitempty" db:"owner_id"`
	CreatedAt     time.Time  `json:"created_at" db:"created_at"`
	UpdatedAt     time.Time  `json:"updated_at" db:"updated_at"`
}

type CreateConfigRequest struct {
	Key           string    `json:"key"`
	EnvironmentID string    `json:"environment_id"`
	Value         string    `json:"value"`
	ValueType     ValueType `json:"value_type"`
	Description   string    `json:"description"`
	IsSecret      bool      `json:"is_secret"`
}
