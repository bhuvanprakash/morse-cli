package models

import (
	"time"
)

// Queue represents a job queue
type Queue struct {
	ID          string    `json:"id"`
	Name        string    `json:"name"`
	Description string    `json:"description"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
}

// CreateQueueRequest represents a request to create a queue
type CreateQueueRequest struct {
	Name                  string `json:"name"`
	Description           string `json:"description"`
	MaxRetries            int    `json:"max_retries"`
	VisibilityTimeoutSecs int    `json:"visibility_timeout_secs"`
}
