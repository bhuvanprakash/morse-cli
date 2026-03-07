package repository

import (
	"context"
	"database/sql"
	"encoding/json"
	"time"

	"github.com/google/uuid"
	"github.com/indusbase/indus-queue/internal/models"
)

// JobRepository handles job database operations
type JobRepository struct {
	db *sql.DB
}

// NewJobRepository creates a new job repository
func NewJobRepository(db *sql.DB) *JobRepository {
	return &JobRepository{db: db}
}

// Enqueue adds a new job to the queue
func (r *JobRepository) Enqueue(ctx context.Context, req models.EnqueueRequest) (*models.Job, error) {
	id := uuid.New().String()
	now := time.Now()
	scheduledAt := now
	if req.ScheduledAt != nil {
		scheduledAt = *req.ScheduledAt
	}

	query := `
		INSERT INTO indusbase_queue.jobs (id, queue_name, payload, status, priority, scheduled_at, max_retries, retry_count, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
		RETURNING id, queue_name, payload, status, priority, scheduled_at, started_at, completed_at, attempt_count, max_retries, retry_count, error_message, worker_id, invisible_until, created_at, updated_at
	`

	var job models.Job
	var payload []byte
	err := r.db.QueryRowContext(ctx, query,
		id, req.QueueName, req.Payload, models.JobStatusPending, req.Priority, scheduledAt, req.MaxRetries, req.RetryCount, now, now,
	).Scan(
		&job.ID, &job.QueueName, &payload, &job.Status, &job.Priority, &job.ScheduledAt, &job.StartedAt, &job.CompletedAt,
		&job.AttemptCount, &job.MaxRetries, &job.RetryCount, &job.ErrorMessage, &job.WorkerID, &job.InvisibleUntil, &job.CreatedAt, &job.UpdatedAt,
	)
	if err != nil {
		return nil, err
	}
	job.Payload = payload

	return &job, nil
}

// Dequeue retrieves and locks a job for processing using FOR UPDATE SKIP LOCKED
func (r *JobRepository) Dequeue(ctx context.Context, queueName string, workerID string, limit int) ([]*models.Job, error) {
	// Use CTE with FOR UPDATE SKIP LOCKED for atomic dequeue
	query := `
		WITH selected AS (
			SELECT id FROM indusbase_queue.jobs
			WHERE queue_name = $1
				AND status = 'pending'
				AND scheduled_at <= NOW()
			ORDER BY priority ASC, scheduled_at ASC
			LIMIT $2
			FOR UPDATE SKIP LOCKED
		)
		UPDATE indusbase_queue.jobs
		SET status = 'running', worker_id = $3, invisible_until = NOW() + interval '30 seconds',
			attempt_count = attempt_count + 1, updated_at = NOW()
		WHERE id IN (SELECT id FROM selected)
		RETURNING id, queue_name, payload, status, priority, scheduled_at, started_at, completed_at, attempt_count, max_retries, retry_count, error_message, worker_id, invisible_until, created_at, updated_at
	`

	rows, err := r.db.QueryContext(ctx, query, queueName, limit, workerID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var jobs []*models.Job
	for rows.Next() {
		var job models.Job
		var payload []byte
		err := rows.Scan(
			&job.ID, &job.QueueName, &payload, &job.Status, &job.Priority, &job.ScheduledAt, &job.StartedAt, &job.CompletedAt,
			&job.AttemptCount, &job.MaxRetries, &job.RetryCount, &job.ErrorMessage, &job.WorkerID, &job.InvisibleUntil, &job.CreatedAt, &job.UpdatedAt,
		)
		if err != nil {
			return nil, err
		}
		job.Payload = payload
		jobs = append(jobs, &job)
	}

	return jobs, rows.Err()
}

// Ack marks a job as completed
func (r *JobRepository) Ack(ctx context.Context, id string) (*models.Job, error) {
	now := time.Now()
	query := `
		UPDATE indusbase_queue.jobs
		SET status = 'completed', completed_at = $2, updated_at = $2
		WHERE id = $1
		RETURNING id, queue_name, payload, status, priority, scheduled_at, started_at, completed_at, attempt_count, max_retries, retry_count, error_message, worker_id, invisible_until, created_at, updated_at
	`

	var job models.Job
	var payload []byte
	err := r.db.QueryRowContext(ctx, query, id, now).Scan(
		&job.ID, &job.QueueName, &payload, &job.Status, &job.Priority, &job.ScheduledAt, &job.StartedAt, &job.CompletedAt,
		&job.AttemptCount, &job.MaxRetries, &job.RetryCount, &job.ErrorMessage, &job.WorkerID, &job.InvisibleUntil, &job.CreatedAt, &job.UpdatedAt,
	)
	if err != nil {
		return nil, err
	}
	job.Payload = payload

	return &job, nil
}

// Fail marks a job as failed with error message
func (r *JobRepository) Fail(ctx context.Context, id string, errorMessage string) (*models.Job, error) {
	now := time.Now()
	query := `
		UPDATE indusbase_queue.jobs
		SET status = CASE
			WHEN retry_count < max_retries THEN 'pending'
			ELSE 'dead_letter'
		END,
		error_message = $2,
		retry_count = retry_count + 1,
		updated_at = $3
		WHERE id = $1
		RETURNING id, queue_name, payload, status, priority, scheduled_at, started_at, completed_at, attempt_count, max_retries, retry_count, error_message, worker_id, invisible_until, created_at, updated_at
	`

	var job models.Job
	var payload []byte
	err := r.db.QueryRowContext(ctx, query, id, errorMessage, now).Scan(
		&job.ID, &job.QueueName, &payload, &job.Status, &job.Priority, &job.ScheduledAt, &job.StartedAt, &job.CompletedAt,
		&job.AttemptCount, &job.MaxRetries, &job.RetryCount, &job.ErrorMessage, &job.WorkerID, &job.InvisibleUntil, &job.CreatedAt, &job.UpdatedAt,
	)
	if err != nil {
		return nil, err
	}
	job.Payload = payload

	return &job, nil
}

// Get retrieves a job by ID
func (r *JobRepository) Get(ctx context.Context, id string) (*models.Job, error) {
	query := `
		SELECT id, queue_name, payload, status, priority, scheduled_at, started_at, completed_at, attempt_count, max_retries, retry_count, error_message, worker_id, invisible_until, created_at, updated_at
		FROM indusbase_queue.jobs
		WHERE id = $1
	`

	var job models.Job
	var payload []byte
	err := r.db.QueryRowContext(ctx, query, id).Scan(
		&job.ID, &job.QueueName, &payload, &job.Status, &job.Priority, &job.ScheduledAt, &job.StartedAt, &job.CompletedAt,
		&job.AttemptCount, &job.MaxRetries, &job.RetryCount, &job.ErrorMessage, &job.WorkerID, &job.InvisibleUntil, &job.CreatedAt, &job.UpdatedAt,
	)
	if err != nil {
		return nil, err
	}
	job.Payload = payload

	return &job, nil
}

// List retrieves jobs with filters
func (r *JobRepository) List(ctx context.Context, queueName string, status models.JobStatus, limit, offset int) ([]*models.Job, error) {
	query := `
		SELECT id, queue_name, payload, status, priority, scheduled_at, started_at, completed_at, attempt_count, max_retries, retry_count, error_message, worker_id, invisible_until, created_at, updated_at
		FROM indusbase_queue.jobs
		WHERE ($1::text IS NULL OR queue_name = $1)
			AND ($2::text IS NULL OR status = $2)
		ORDER BY priority DESC, scheduled_at ASC
		LIMIT $3 OFFSET $4
	`

	rows, err := r.db.QueryContext(ctx, query, queueName, status, limit, offset)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var jobs []*models.Job
	for rows.Next() {
		var job models.Job
		var payload []byte
		err := rows.Scan(
			&job.ID, &job.QueueName, &payload, &job.Status, &job.Priority, &job.ScheduledAt, &job.StartedAt, &job.CompletedAt,
			&job.AttemptCount, &job.MaxRetries, &job.RetryCount, &job.ErrorMessage, &job.WorkerID, &job.InvisibleUntil, &job.CreatedAt, &job.UpdatedAt,
		)
		if err != nil {
			return nil, err
		}
		job.Payload = payload
		jobs = append(jobs, &job)
	}

	return jobs, rows.Err()
}

// Delete removes a job
func (r *JobRepository) Delete(ctx context.Context, id string) error {
	_, err := r.db.ExecContext(ctx, "DELETE FROM indusbase_queue.jobs WHERE id = $1", id)
	return err
}

// EnqueueBatch enqueues multiple jobs
func (r *JobRepository) EnqueueBatch(ctx context.Context, jobs []models.EnqueueRequest) ([]*models.Job, error) {
	tx, err := r.db.BeginTx(ctx, nil)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback()

	result := make([]*models.Job, 0, len(jobs))
	for _, req := range jobs {
		job, err := r.Enqueue(ctx, req)
		if err != nil {
			return nil, err
		}
		result = append(result, job)
	}

	if err := tx.Commit(); err != nil {
		return nil, err
	}

	return result, nil
}

// Helper function to marshal/unmarshal payload
func marshalPayload(v interface{}) (json.RawMessage, error) {
	return json.Marshal(v)
}

func unmarshalPayload(data json.RawMessage, v interface{}) error {
	return json.Unmarshal(data, v)
}
