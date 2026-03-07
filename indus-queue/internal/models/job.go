package models

import (
	"encoding/json"
	"time"
)

// JobStatus represents the status of a job
type JobStatus string

const (
	// JobStatusPending represents a pending job
	JobStatusPending JobStatus = "pending"
	// JobStatusRunning represents a running job
	JobStatusRunning JobStatus = "running"
	// JobStatusCompleted represents a completed job
	JobStatusCompleted JobStatus = "completed"
	// JobStatusFailed represents a failed job
	JobStatusFailed JobStatus = "failed"
	// JobStatusDeadLetter represents a dead letter job
	JobStatusDeadLetter JobStatus = "dead_letter"
)

// Job represents a queue job
type Job struct {
	ID             string          `json:"id"`
	QueueName      string          `json:"queue_name"`
	Payload        json.RawMessage `json:"payload"`
	Status         JobStatus       `json:"status"`
	Priority       int             `json:"priority"`
	ScheduledAt    time.Time       `json:"scheduled_at"`
	StartedAt      *time.Time      `json:"started_at,omitempty"`
	CompletedAt    *time.Time      `json:"completed_at,omitempty"`
	AttemptCount   int             `json:"attempt_count"`
	MaxRetries     int             `json:"max_retries"`
	RetryCount     int             `json:"retry_count"`
	ErrorMessage   *string         `json:"error_message,omitempty"`
	WorkerID       *string         `json:"worker_id,omitempty"`
	InvisibleUntil time.Time       `json:"invisible_until"`
	CreatedAt      time.Time       `json:"created_at"`
	UpdatedAt      time.Time       `json:"updated_at"`
}

// EnqueueRequest represents a request to enqueue a job
type EnqueueRequest struct {
	QueueName   string          `json:"queue_name"`
	Payload     json.RawMessage `json:"payload"`
	Priority    int             `json:"priority"`
	ScheduledAt *time.Time      `json:"scheduled_at,omitempty"`
	MaxRetries  int             `json:"max_retries"`
	RetryCount  int             `json:"retry_count"`
}

// BatchEnqueueRequest represents a request to enqueue multiple jobs
type BatchEnqueueRequest struct {
	Jobs []EnqueueRequest `json:"jobs"`
}

// JobListRequest represents a request to list jobs
type JobListRequest struct {
	QueueName string    `json:"queue_name"`
	Status    JobStatus `json:"status"`
	Limit     int       `json:"limit"`
	Offset    int       `json:"offset"`
}

// FailRequest represents a request to mark a job as failed
type FailRequest struct {
	ErrorMessage string `json:"error_message"`
}
