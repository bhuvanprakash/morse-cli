package repository

import (
	"context"
	"database/sql"
	"time"

	"github.com/indusbase/indus-queue/internal/models"
)

// QueueRepository handles queue database operations
type QueueRepository struct {
	db *sql.DB
}

// NewQueueRepository creates a new queue repository
func NewQueueRepository(db *sql.DB) *QueueRepository {
	return &QueueRepository{db: db}
}

// Create creates a new queue
func (r *QueueRepository) Create(ctx context.Context, req models.CreateQueueRequest) (*models.Queue, error) {
	id := ""
	now := time.Now()
	query := `
		INSERT INTO indusbase_queue.queues (id, name, description, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5)
		RETURNING id, name, description, created_at, updated_at
	`

	var queue models.Queue
	err := r.db.QueryRowContext(ctx, query, id, req.Name, req.Description, now, now).Scan(
		&queue.ID, &queue.Name, &queue.Description, &queue.CreatedAt, &queue.UpdatedAt,
	)
	if err != nil {
		return nil, err
	}

	return &queue, nil
}

// Get retrieves a queue by name
func (r *QueueRepository) Get(ctx context.Context, name string) (*models.Queue, error) {
	query := `
		SELECT id, name, description, created_at, updated_at
		FROM indusbase_queue.queues
		WHERE name = $1
	`

	var queue models.Queue
	err := r.db.QueryRowContext(ctx, query, name).Scan(
		&queue.ID, &queue.Name, &queue.Description, &queue.CreatedAt, &queue.UpdatedAt,
	)
	if err != nil {
		return nil, err
	}

	return &queue, nil
}

// List retrieves all queues
func (r *QueueRepository) List(ctx context.Context) ([]*models.Queue, error) {
	query := `
		SELECT id, name, description, created_at, updated_at
		FROM indusbase_queue.queues
		ORDER BY name ASC
	`

	rows, err := r.db.QueryContext(ctx, query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var queues []*models.Queue
	for rows.Next() {
		var queue models.Queue
		err := rows.Scan(
			&queue.ID, &queue.Name, &queue.Description, &queue.CreatedAt, &queue.UpdatedAt,
		)
		if err != nil {
			return nil, err
		}
		queues = append(queues, &queue)
	}

	return queues, rows.Err()
}

// Delete removes a queue by name
func (r *QueueRepository) Delete(ctx context.Context, name string) error {
	_, err := r.db.ExecContext(ctx, "DELETE FROM indusbase_queue.queues WHERE name = $1", name)
	return err
}

// CreateIfNotExists inserts a queue if it does not exist.
func (r *QueueRepository) CreateIfNotExists(ctx context.Context, req models.CreateQueueRequest) error {
	description := req.Description
	if description == "" {
		description = "system queue"
	}
	_, err := r.db.ExecContext(ctx, `
		INSERT INTO indusbase_queue.queues (name, description)
		VALUES ($1, $2)
		ON CONFLICT (name) DO NOTHING
	`, req.Name, description)
	return err
}
