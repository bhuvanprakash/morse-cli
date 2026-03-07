package repository

import (
	"context"
	"database/sql"
	"time"

	"github.com/indusbase/indus-queue/internal/models"
)

// CronRepository handles cron schedule database operations
type CronRepository struct {
	db *sql.DB
}

// NewCronRepository creates a new cron repository
func NewCronRepository(db *sql.DB) *CronRepository {
	return &CronRepository{db: db}
}

// Create creates a new cron schedule
func (r *CronRepository) Create(ctx context.Context, req models.CreateCronRequest) (*models.CronSchedule, error) {
	id := ""
	now := time.Now()
	query := `
		INSERT INTO indusbase_queue.cron_schedules (id, name, cron_expression, timezone, job_payload, enabled, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
		RETURNING id, name, cron_expression, timezone, job_payload, enabled, last_run_at, next_run_at, created_at, updated_at
	`

	var schedule models.CronSchedule
	var jobPayload []byte
	err := r.db.QueryRowContext(ctx, query, id, req.Name, req.CronExpression, req.Timezone, req.JobPayload, req.Enabled, now, now).Scan(
		&schedule.ID, &schedule.Name, &schedule.CronExpression, &schedule.Timezone, &jobPayload, &schedule.Enabled, &schedule.LastRunAt, &schedule.NextRunAt, &schedule.CreatedAt, &schedule.UpdatedAt,
	)
	if err != nil {
		return nil, err
	}
	schedule.JobPayload = jobPayload

	return &schedule, nil
}

// Get retrieves a cron schedule by ID
func (r *CronRepository) Get(ctx context.Context, id string) (*models.CronSchedule, error) {
	query := `
		SELECT id, name, cron_expression, timezone, job_payload, enabled, last_run_at, next_run_at, created_at, updated_at
		FROM indusbase_queue.cron_schedules
		WHERE id = $1
	`

	var schedule models.CronSchedule
	var jobPayload []byte
	err := r.db.QueryRowContext(ctx, query, id).Scan(
		&schedule.ID, &schedule.Name, &schedule.CronExpression, &schedule.Timezone, &jobPayload, &schedule.Enabled, &schedule.LastRunAt, &schedule.NextRunAt, &schedule.CreatedAt, &schedule.UpdatedAt,
	)
	if err != nil {
		return nil, err
	}
	schedule.JobPayload = jobPayload

	return &schedule, nil
}

// List retrieves all cron schedules
func (r *CronRepository) List(ctx context.Context) ([]*models.CronSchedule, error) {
	query := `
		SELECT id, name, cron_expression, timezone, job_payload, enabled, last_run_at, next_run_at, created_at, updated_at
		FROM indusbase_queue.cron_schedules
		ORDER BY created_at DESC
	`

	rows, err := r.db.QueryContext(ctx, query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var schedules []*models.CronSchedule
	for rows.Next() {
		var schedule models.CronSchedule
		var jobPayload []byte
		err := rows.Scan(
			&schedule.ID, &schedule.Name, &schedule.CronExpression, &schedule.Timezone, &jobPayload, &schedule.Enabled, &schedule.LastRunAt, &schedule.NextRunAt, &schedule.CreatedAt, &schedule.UpdatedAt,
		)
		if err != nil {
			return nil, err
		}
		schedule.JobPayload = jobPayload
		schedules = append(schedules, &schedule)
	}

	return schedules, rows.Err()
}

// Update updates a cron schedule
func (r *CronRepository) Update(ctx context.Context, id string, req models.UpdateCronRequest) (*models.CronSchedule, error) {
	// Build dynamic update query
	query := `UPDATE indusbase_queue.cron_schedules SET updated_at = NOW()`
	args := []interface{}{}
	argNum := 1

	if req.Name != nil {
		query += ", name = $"
		query += string(rune(argNum + '0'))
		args = append(args, *req.Name)
		argNum++
	}
	if req.CronExpression != nil {
		query += ", cron_expression = $"
		query += string(rune(argNum + '0'))
		args = append(args, *req.CronExpression)
		argNum++
	}
	if req.Timezone != nil {
		query += ", timezone = $"
		query += string(rune(argNum + '0'))
		args = append(args, *req.Timezone)
		argNum++
	}
	if req.JobPayload != nil {
		query += ", job_payload = $"
		query += string(rune(argNum + '0'))
		args = append(args, req.JobPayload)
		argNum++
	}
	if req.Enabled != nil {
		query += ", enabled = $"
		query += string(rune(argNum + '0'))
		args = append(args, *req.Enabled)
		argNum++
	}

	query += " WHERE id = $"
	query += string(rune(argNum + '0'))
	args = append(args, id)

	query += " RETURNING id, name, cron_expression, timezone, job_payload, enabled, last_run_at, next_run_at, created_at, updated_at"

	var schedule models.CronSchedule
	var jobPayload []byte
	err := r.db.QueryRowContext(ctx, query, args...).Scan(
		&schedule.ID, &schedule.Name, &schedule.CronExpression, &schedule.Timezone, &jobPayload, &schedule.Enabled, &schedule.LastRunAt, &schedule.NextRunAt, &schedule.CreatedAt, &schedule.UpdatedAt,
	)
	if err != nil {
		return nil, err
	}
	schedule.JobPayload = jobPayload

	return &schedule, nil
}

// Delete removes a cron schedule
func (r *CronRepository) Delete(ctx context.Context, id string) error {
	_, err := r.db.ExecContext(ctx, "DELETE FROM indusbase_queue.cron_schedules WHERE id = $1", id)
	return err
}

// GetEnabled retrieves all enabled cron schedules
func (r *CronRepository) GetEnabled(ctx context.Context) ([]*models.CronSchedule, error) {
	query := `
		SELECT id, name, cron_expression, timezone, job_payload, enabled, last_run_at, next_run_at, created_at, updated_at
		FROM indusbase_queue.cron_schedules
		WHERE enabled = true
		ORDER BY next_run_at ASC
	`

	rows, err := r.db.QueryContext(ctx, query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var schedules []*models.CronSchedule
	for rows.Next() {
		var schedule models.CronSchedule
		var jobPayload []byte
		err := rows.Scan(
			&schedule.ID, &schedule.Name, &schedule.CronExpression, &schedule.Timezone, &jobPayload, &schedule.Enabled, &schedule.LastRunAt, &schedule.NextRunAt, &schedule.CreatedAt, &schedule.UpdatedAt,
		)
		if err != nil {
			return nil, err
		}
		schedule.JobPayload = jobPayload
		schedules = append(schedules, &schedule)
	}

	return schedules, rows.Err()
}

// UpdateLastRun updates the last run time and calculates next run
func (r *CronRepository) UpdateLastRun(ctx context.Context, id string, nextRunAt time.Time) error {
	query := `
		UPDATE indusbase_queue.cron_schedules
		SET last_run_at = NOW(), next_run_at = $2, updated_at = NOW()
		WHERE id = $1
	`
	_, err := r.db.ExecContext(ctx, query, id, nextRunAt)
	return err
}
