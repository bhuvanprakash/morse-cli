package models

import (
	"encoding/json"
	"time"
)

// CronSchedule represents a cron-based job schedule
type CronSchedule struct {
	ID             string          `json:"id"`
	Name           string          `json:"name"`
	CronExpression string          `json:"cron_expression"`
	Timezone       string          `json:"timezone"`
	JobPayload     json.RawMessage `json:"job_payload"`
	Enabled        bool            `json:"enabled"`
	LastRunAt      *time.Time      `json:"last_run_at,omitempty"`
	NextRunAt      *time.Time      `json:"next_run_at,omitempty"`
	CreatedAt      time.Time       `json:"created_at"`
	UpdatedAt      time.Time       `json:"updated_at"`
}

// CreateCronRequest represents a request to create a cron schedule
type CreateCronRequest struct {
	Name           string          `json:"name"`
	CronExpression string          `json:"cron_expression"`
	Timezone       string          `json:"timezone"`
	JobPayload     json.RawMessage `json:"job_payload"`
	Enabled        bool            `json:"enabled"`
}

// UpdateCronRequest represents a request to update a cron schedule
type UpdateCronRequest struct {
	Name           *string         `json:"name,omitempty"`
	CronExpression *string         `json:"cron_expression,omitempty"`
	Timezone       *string         `json:"timezone,omitempty"`
	JobPayload     json.RawMessage `json:"job_payload,omitempty"`
	Enabled        *bool           `json:"enabled,omitempty"`
}

// JobPayload represents the payload for a cron-triggered job
type JobPayload struct {
	QueueName string          `json:"queue_name"`
	Payload   json.RawMessage `json:"payload"`
	Priority  int             `json:"priority"`
}
