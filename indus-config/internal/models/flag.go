package models

import (
	"encoding/json"
	"time"

	"github.com/google/uuid"
)

type ValueType string

const (
	ValueTypeBoolean ValueType = "boolean"
	ValueTypeString  ValueType = "string"
	ValueTypeNumber  ValueType = "number"
	ValueTypeJSON    ValueType = "json"
)

type TargetingRule struct {
	Type        string        `json:"type"`
	Percentage  *float64      `json:"percentage,omitempty"`
	UserIDs     []string      `json:"user_ids,omitempty"`
	Property    *PropertyRule `json:"property,omitempty"`
	ReturnValue string        `json:"return_value"`
}

type PropertyRule struct {
	Name     string `json:"name"`
	Operator string `json:"operator"`
	Value    string `json:"value"`
}

type Flag struct {
	ID             uuid.UUID       `json:"id" db:"id"`
	Key            string          `json:"key" db:"key"`
	EnvironmentID  uuid.UUID       `json:"environment_id" db:"environment_id"`
	Description    string          `json:"description" db:"description"`
	ValueType      ValueType       `json:"value_type" db:"value_type"`
	DefaultValue   string          `json:"default_value" db:"default_value"`
	TargetingRules json.RawMessage `json:"targeting_rules" db:"targeting_rules"`
	IsActive       bool            `json:"is_active" db:"is_active"`
	OwnerID        *uuid.UUID      `json:"owner_id,omitempty" db:"owner_id"`
	CreatedAt      time.Time       `json:"created_at" db:"created_at"`
	UpdatedAt      time.Time       `json:"updated_at" db:"updated_at"`
}

type CreateFlagRequest struct {
	Key            string          `json:"key"`
	EnvironmentID  string          `json:"environment_id"`
	Description    string          `json:"description"`
	ValueType      ValueType       `json:"value_type"`
	DefaultValue   string          `json:"default_value"`
	TargetingRules []TargetingRule `json:"targeting_rules"`
}

type EvaluateRequest struct {
	Environment string            `json:"environment"`
	UserID      *string           `json:"user_id"`
	UserProps   map[string]string `json:"user_properties"`
	Keys        []string          `json:"keys"`
}

type EvaluateResponse struct {
	Flags  map[string]interface{} `json:"flags"`
	Config map[string]interface{} `json:"config"`
}
