package worker

import (
	"context"
	"math"
	"time"

	"github.com/indusbase/indus-queue/internal/models"
	"github.com/indusbase/indus-queue/internal/repository"
)

// RetryConfig holds retry configuration
type RetryConfig struct {
	// MaxRetries is the maximum number of retries
	MaxRetries int
	// BaseDelay is the base delay for exponential backoff
	BaseDelay time.Duration
	// MaxDelay is the maximum delay between retries
	MaxDelay time.Duration
}

// DefaultRetryConfig returns the default retry configuration
func DefaultRetryConfig() *RetryConfig {
	return &RetryConfig{
		MaxRetries: 5,
		BaseDelay:  time.Second,
		MaxDelay:   5 * time.Minute,
	}
}

// RetryHandler handles job retry logic
type RetryHandler struct {
	jobRepo *repository.JobRepository
	config  *RetryConfig
}

// NewRetryHandler creates a new retry handler
func NewRetryHandler(jobRepo *repository.JobRepository, config *RetryConfig) *RetryHandler {
	if config == nil {
		config = DefaultRetryConfig()
	}
	return &RetryHandler{
		jobRepo: jobRepo,
		config:  config,
	}
}

// CalculateBackoff calculates the next retry delay using exponential backoff
func (r *RetryHandler) CalculateBackoff(attemptCount int) time.Duration {
	// Exponential backoff: base * 2^attempt
	delay := r.config.BaseDelay * time.Duration(math.Pow(2, float64(attemptCount)))

	// Cap at max delay
	if delay > r.config.MaxDelay {
		delay = r.config.MaxDelay
	}

	return delay
}

// ShouldRetry determines if a job should be retried
func (r *RetryHandler) ShouldRetry(job *models.Job) bool {
	return job.RetryCount < job.MaxRetries
}

// ScheduleRetry schedules a job for retry
func (r *RetryHandler) ScheduleRetry(ctx context.Context, job *models.Job) error {
	if !r.ShouldRetry(job) {
		// Move to dead letter queue
		return r.moveToDeadLetter(ctx, job)
	}

	// Calculate next retry time
	delay := r.CalculateBackoff(job.RetryCount)
	_ = delay

	// Update job to pending with scheduled time
	// Note: This requires a new method in the repository
	// For now, we'll just re-queue it immediately
	_, err := r.jobRepo.Fail(ctx, job.ID, "retry scheduled")
	return err
}

// moveToDeadLetter moves a job to the dead letter queue
func (r *RetryHandler) moveToDeadLetter(ctx context.Context, job *models.Job) error {
	// Update job status to dead_letter
	// This is handled by the Fail method in jobRepo
	_, err := r.jobRepo.Fail(ctx, job.ID, "max retries exceeded")
	return err
}

// GetRetryStatus returns the retry status for a job
func (r *RetryHandler) GetRetryStatus(job *models.Job) string {
	if job.Status == models.JobStatusDeadLetter {
		return "dead_letter"
	}
	if job.RetryCount >= job.MaxRetries {
		return "max_retries_exceeded"
	}
	if job.RetryCount > 0 {
		return "retry_pending"
	}
	return "no_retries"
}
