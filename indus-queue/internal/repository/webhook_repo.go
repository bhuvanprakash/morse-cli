package repository

import (
	"context"
	"database/sql"
	"encoding/json"
	"time"

	"github.com/indusbase/indus-queue/internal/models"
)

// WebhookRepository handles webhook database operations
type WebhookRepository struct {
	db *sql.DB
}

// NewWebhookRepository creates a new webhook repository
func NewWebhookRepository(db *sql.DB) *WebhookRepository {
	return &WebhookRepository{db: db}
}

// Create creates a new webhook
func (r *WebhookRepository) Create(ctx context.Context, req models.CreateWebhookRequest) (*models.Webhook, error) {
	id := ""
	now := time.Now()
	query := `
		INSERT INTO indusbase_queue.webhooks (id, name, url, event, secret, enabled, headers, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
		RETURNING id, name, url, event, secret, enabled, headers, created_at, updated_at
	`

	var webhook models.Webhook
	var headers []byte
	err := r.db.QueryRowContext(ctx, query, id, req.Name, req.URL, req.Event, req.Secret, req.Enabled, req.Headers, now, now).Scan(
		&webhook.ID, &webhook.Name, &webhook.URL, &webhook.Event, &webhook.Secret, &webhook.Enabled, &headers, &webhook.CreatedAt, &webhook.UpdatedAt,
	)
	if err != nil {
		return nil, err
	}
	webhook.Headers = headers

	return &webhook, nil
}

// Get retrieves a webhook by ID
func (r *WebhookRepository) Get(ctx context.Context, id string) (*models.Webhook, error) {
	query := `
		SELECT id, name, url, event, secret, enabled, headers, created_at, updated_at
		FROM indusbase_queue.webhooks
		WHERE id = $1
	`

	var webhook models.Webhook
	var headers []byte
	err := r.db.QueryRowContext(ctx, query, id).Scan(
		&webhook.ID, &webhook.Name, &webhook.URL, &webhook.Event, &webhook.Secret, &webhook.Enabled, &headers, &webhook.CreatedAt, &webhook.UpdatedAt,
	)
	if err != nil {
		return nil, err
	}
	webhook.Headers = headers

	return &webhook, nil
}

// GetByID retrieves a webhook by ID.
func (r *WebhookRepository) GetByID(ctx context.Context, id string) (*models.Webhook, error) {
	return r.Get(ctx, id)
}

// List retrieves all webhooks
func (r *WebhookRepository) List(ctx context.Context) ([]*models.Webhook, error) {
	query := `
		SELECT id, name, url, event, secret, enabled, headers, created_at, updated_at
		FROM indusbase_queue.webhooks
		ORDER BY created_at DESC
	`

	rows, err := r.db.QueryContext(ctx, query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var webhooks []*models.Webhook
	for rows.Next() {
		var webhook models.Webhook
		var headers []byte
		err := rows.Scan(
			&webhook.ID, &webhook.Name, &webhook.URL, &webhook.Event, &webhook.Secret, &webhook.Enabled, &headers, &webhook.CreatedAt, &webhook.UpdatedAt,
		)
		if err != nil {
			return nil, err
		}
		webhook.Headers = headers
		webhooks = append(webhooks, &webhook)
	}

	return webhooks, rows.Err()
}

// Update updates a webhook
func (r *WebhookRepository) Update(ctx context.Context, id string, req models.UpdateWebhookRequest) (*models.Webhook, error) {
	// Build dynamic update query
	query := `UPDATE indusbase_queue.webhooks SET updated_at = NOW()`
	args := []interface{}{}
	argNum := 1

	if req.Name != nil {
		query += ", name = $" + string(rune(argNum+'0'))
		args = append(args, *req.Name)
		argNum++
	}
	if req.URL != nil {
		query += ", url = $" + string(rune(argNum+'0'))
		args = append(args, *req.URL)
		argNum++
	}
	if req.Event != nil {
		query += ", event = $" + string(rune(argNum+'0'))
		args = append(args, *req.Event)
		argNum++
	}
	if req.Secret != nil {
		query += ", secret = $" + string(rune(argNum+'0'))
		args = append(args, *req.Secret)
		argNum++
	}
	if req.Enabled != nil {
		query += ", enabled = $" + string(rune(argNum+'0'))
		args = append(args, *req.Enabled)
		argNum++
	}
	if req.Headers != nil {
		query += ", headers = $" + string(rune(argNum+'0'))
		args = append(args, req.Headers)
		argNum++
	}

	query += " WHERE id = $" + string(rune(argNum+'0'))
	args = append(args, id)

	query += " RETURNING id, name, url, event, secret, enabled, headers, created_at, updated_at"

	var webhook models.Webhook
	var headers []byte
	err := r.db.QueryRowContext(ctx, query, args...).Scan(
		&webhook.ID, &webhook.Name, &webhook.URL, &webhook.Event, &webhook.Secret, &webhook.Enabled, &headers, &webhook.CreatedAt, &webhook.UpdatedAt,
	)
	if err != nil {
		return nil, err
	}
	webhook.Headers = headers

	return &webhook, nil
}

// Delete removes a webhook
func (r *WebhookRepository) Delete(ctx context.Context, id string) error {
	_, err := r.db.ExecContext(ctx, "DELETE FROM indusbase_queue.webhooks WHERE id = $1", id)
	return err
}

// GetByEvent retrieves webhooks by event type
func (r *WebhookRepository) GetByEvent(ctx context.Context, event string) ([]*models.Webhook, error) {
	query := `
		SELECT id, name, url, event, secret, enabled, headers, created_at, updated_at
		FROM indusbase_queue.webhooks
		WHERE event = $1 AND enabled = true
	`

	rows, err := r.db.QueryContext(ctx, query, event)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var webhooks []*models.Webhook
	for rows.Next() {
		var webhook models.Webhook
		var headers []byte
		err := rows.Scan(
			&webhook.ID, &webhook.Name, &webhook.URL, &webhook.Event, &webhook.Secret, &webhook.Enabled, &headers, &webhook.CreatedAt, &webhook.UpdatedAt,
		)
		if err != nil {
			return nil, err
		}
		webhook.Headers = headers
		webhooks = append(webhooks, &webhook)
	}

	return webhooks, rows.Err()
}

// FindMatchingWebhooks returns all active webhooks for schema/table/event.
// This repository model stores a single event string, so we support:
// 1) exact event match (INSERT/UPDATE/DELETE)
// 2) qualified event match "schema.table:EVENT"
func (r *WebhookRepository) FindMatchingWebhooks(
	ctx context.Context,
	tableSchema, tableName, event string,
) ([]models.Webhook, error) {
	query := `
		SELECT id, name, url, event, secret, enabled, headers, created_at, updated_at
		FROM indusbase_queue.webhooks
		WHERE enabled = TRUE
		  AND (event = $1 OR event = $2)
		ORDER BY created_at DESC
	`
	qualifiedEvent := tableSchema + "." + tableName + ":" + event
	rows, err := r.db.QueryContext(ctx, query, event, qualifiedEvent)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	webhooks := make([]models.Webhook, 0)
	for rows.Next() {
		var webhook models.Webhook
		var headers []byte
		if err := rows.Scan(
			&webhook.ID, &webhook.Name, &webhook.URL, &webhook.Event, &webhook.Secret,
			&webhook.Enabled, &headers, &webhook.CreatedAt, &webhook.UpdatedAt,
		); err != nil {
			return nil, err
		}
		webhook.Headers = headers
		webhooks = append(webhooks, webhook)
	}
	return webhooks, rows.Err()
}

// RecordDelivery updates webhook delivery metadata.
// Current schema has no delivery statistics table/columns, so this is a no-op.
func (r *WebhookRepository) RecordDelivery(ctx context.Context, webhookID string, statusCode int) error {
	_, _ = ctx, statusCode
	_, err := r.db.ExecContext(context.Background(), `
		UPDATE indusbase_queue.webhooks
		SET updated_at = NOW()
		WHERE id = $1
	`, webhookID)
	return err
}

// Helper function to parse headers
func parseWebhookHeaders(data json.RawMessage) (map[string]string, error) {
	var headers map[string]string
	if data != nil {
		if err := json.Unmarshal(data, &headers); err != nil {
			return nil, err
		}
	}
	return headers, nil
}
