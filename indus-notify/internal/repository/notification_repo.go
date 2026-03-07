package repository

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"strings"

	"github.com/google/uuid"
	"github.com/indusbase/indus-notify/internal/models"
)

type NotificationRepository struct {
	db *sql.DB
}

type HistoryFilters struct {
	Channel string
	Status  string
	UserID  string
	Limit   int
	Offset  int
}

func NewNotificationRepository(db *sql.DB) *NotificationRepository {
	return &NotificationRepository{db: db}
}

func (r *NotificationRepository) Create(ctx context.Context, notification *models.Notification) error {
	var notificationID interface{}
	if notification.ID != uuid.Nil {
		notificationID = notification.ID
	}
	query := `
		INSERT INTO indusbase_notify.notifications (
			id, user_id, channel, recipient, subject, body, data, template_id, provider, provider_message_id,
			status, error_message, sent_at, delivered_at
		) VALUES (
			COALESCE($1, gen_random_uuid()), $2, $3, $4, $5, $6, COALESCE($7, '{}'::jsonb), $8, $9, $10, $11, $12, $13, $14
		) RETURNING id, created_at`
	if len(notification.Data) == 0 {
		notification.Data = json.RawMessage(`{}`)
	}
	return r.db.QueryRowContext(ctx, query,
		notificationID, notification.UserID, notification.Channel, notification.Recipient, notification.Subject, notification.Body,
		notification.Data, notification.TemplateID, notification.Provider, notification.ProviderMessageID, notification.Status,
		notification.ErrorMessage, notification.SentAt, notification.DeliveredAt,
	).Scan(&notification.ID, &notification.CreatedAt)
}

func (r *NotificationRepository) List(ctx context.Context, filters HistoryFilters) ([]map[string]interface{}, error) {
	where := []string{"1=1"}
	args := []interface{}{}
	argPos := 1
	if filters.Channel != "" {
		where = append(where, fmt.Sprintf("channel = $%d", argPos))
		args = append(args, filters.Channel)
		argPos++
	}
	if filters.Status != "" {
		where = append(where, fmt.Sprintf("status = $%d", argPos))
		args = append(args, filters.Status)
		argPos++
	}
	if filters.UserID != "" {
		where = append(where, fmt.Sprintf("user_id = $%d", argPos))
		args = append(args, filters.UserID)
		argPos++
	}
	args = append(args, filters.Limit, filters.Offset)
	query := fmt.Sprintf(`
		SELECT id, channel, recipient, status, sent_at, error_message
		FROM indusbase_notify.notifications
		WHERE %s
		ORDER BY created_at DESC
		LIMIT $%d OFFSET $%d`, strings.Join(where, " AND "), argPos, argPos+1)
	rows, err := r.db.QueryContext(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var items []map[string]interface{}
	for rows.Next() {
		var id uuid.UUID
		var channel, recipient, status string
		var sentAt sql.NullTime
		var errorMessage sql.NullString
		if err := rows.Scan(&id, &channel, &recipient, &status, &sentAt, &errorMessage); err != nil {
			return nil, err
		}
		item := map[string]interface{}{
			"id":        id.String(),
			"channel":   channel,
			"recipient": recipient,
			"status":    status,
			"sent_at":   nil,
			"error_message": func() interface{} {
				if errorMessage.Valid {
					return errorMessage.String
				}
				return nil
			}(),
		}
		if sentAt.Valid {
			item["sent_at"] = sentAt.Time
		}
		items = append(items, item)
	}
	return items, rows.Err()
}

func (r *NotificationRepository) Stats(ctx context.Context) (map[string]interface{}, error) {
	query := `
		SELECT channel, status, COUNT(*)::bigint
		FROM indusbase_notify.notifications
		GROUP BY channel, status`
	rows, err := r.db.QueryContext(ctx, query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	stats := map[string]interface{}{
		"total_sent": int64(0),
		"push":       map[string]int64{"sent": 0, "failed": 0},
		"sms":        map[string]int64{"sent": 0, "failed": 0},
		"email":      map[string]int64{"sent": 0, "failed": 0},
		"last_24h":   map[string]int64{"sent": 0, "failed": 0},
	}
	for rows.Next() {
		var channel, status string
		var count int64
		if err := rows.Scan(&channel, &status, &count); err != nil {
			return nil, err
		}
		if status == "sent" || status == "delivered" {
			stats["total_sent"] = stats["total_sent"].(int64) + count
		}
		if bucket, ok := stats[channel].(map[string]int64); ok {
			if status == "failed" {
				bucket["failed"] += count
			} else {
				bucket["sent"] += count
			}
		}
	}

	last24hQuery := `
		SELECT status, COUNT(*)::bigint
		FROM indusbase_notify.notifications
		WHERE created_at >= NOW() - INTERVAL '24 hours'
		GROUP BY status`
	lastRows, err := r.db.QueryContext(ctx, last24hQuery)
	if err != nil {
		return nil, err
	}
	defer lastRows.Close()
	last24h := stats["last_24h"].(map[string]int64)
	for lastRows.Next() {
		var status string
		var count int64
		if err := lastRows.Scan(&status, &count); err != nil {
			return nil, err
		}
		if status == "failed" {
			last24h["failed"] += count
		} else {
			last24h["sent"] += count
		}
	}
	return stats, nil
}
