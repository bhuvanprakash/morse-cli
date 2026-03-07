package repository

import (
	"context"
	"database/sql"
	"fmt"
	"strings"

	"github.com/indusbase/indus-audit/internal/models"
)

type AuditRepository struct {
	db *sql.DB
}

func NewAuditRepository(db *sql.DB) *AuditRepository {
	return &AuditRepository{db: db}
}

func (r *AuditRepository) Insert(ctx context.Context, event *models.AuditEvent) error {
	const q = `
INSERT INTO indusbase_audit.audit_events
  (project_id, actor_user_id, actor_email, actor_type, action, resource_type, resource_id, severity, ip_address, user_agent, metadata, created_at)
VALUES
  ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, COALESCE($11, '{}'::jsonb), NOW())
RETURNING id, created_at
`
	return r.db.QueryRowContext(ctx, q,
		event.ProjectID, event.ActorUserID, event.ActorEmail, event.ActorType, event.Action, event.ResourceType, event.ResourceID, event.Severity, event.IPAddress, event.UserAgent, event.Metadata,
	).Scan(&event.ID, &event.CreatedAt)
}

func (r *AuditRepository) GetByID(ctx context.Context, id string) (*models.AuditEvent, error) {
	const q = `
SELECT id, project_id, actor_user_id, actor_email, actor_type, action, resource_type, resource_id, severity, ip_address, user_agent, metadata, created_at
FROM indusbase_audit.audit_events
WHERE id = $1
`
	var out models.AuditEvent
	err := r.db.QueryRowContext(ctx, q, id).Scan(
		&out.ID, &out.ProjectID, &out.ActorUserID, &out.ActorEmail, &out.ActorType, &out.Action, &out.ResourceType, &out.ResourceID, &out.Severity, &out.IPAddress, &out.UserAgent, &out.Metadata, &out.CreatedAt,
	)
	if err != nil {
		return nil, err
	}
	return &out, nil
}

func (r *AuditRepository) List(ctx context.Context, filters models.ListFilters) ([]models.AuditEvent, error) {
	where := []string{"1=1"}
	args := []interface{}{}
	i := 1

	if strings.TrimSpace(filters.ProjectID) != "" {
		where = append(where, fmt.Sprintf("project_id = $%d", i))
		args = append(args, filters.ProjectID)
		i++
	}
	if strings.TrimSpace(filters.Actor) != "" {
		where = append(where, fmt.Sprintf("(actor_email ILIKE $%d OR actor_user_id::text ILIKE $%d)", i, i))
		args = append(args, "%"+filters.Actor+"%")
		i++
	}
	if strings.TrimSpace(filters.Action) != "" {
		where = append(where, fmt.Sprintf("action = $%d", i))
		args = append(args, filters.Action)
		i++
	}
	if strings.TrimSpace(filters.ResourceType) != "" {
		where = append(where, fmt.Sprintf("resource_type = $%d", i))
		args = append(args, filters.ResourceType)
		i++
	}
	if strings.TrimSpace(filters.Severity) != "" {
		where = append(where, fmt.Sprintf("severity = $%d", i))
		args = append(args, filters.Severity)
		i++
	}
	if strings.TrimSpace(filters.From) != "" {
		where = append(where, fmt.Sprintf("created_at >= $%d", i))
		args = append(args, filters.From)
		i++
	}
	if strings.TrimSpace(filters.To) != "" {
		where = append(where, fmt.Sprintf("created_at <= $%d", i))
		args = append(args, filters.To)
		i++
	}

	limit := filters.Limit
	if limit <= 0 || limit > 500 {
		limit = 100
	}
	offset := filters.Offset
	if offset < 0 {
		offset = 0
	}
	whereClause := strings.Join(where, " AND ")

	q := fmt.Sprintf(`
SELECT id, project_id, actor_user_id, actor_email, actor_type, action, resource_type, resource_id, severity, ip_address, user_agent, metadata, created_at
FROM indusbase_audit.audit_events
WHERE %s
ORDER BY created_at DESC
LIMIT %d OFFSET %d
`, whereClause, limit, offset)

	rows, err := r.db.QueryContext(ctx, q, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	out := make([]models.AuditEvent, 0)
	for rows.Next() {
		var item models.AuditEvent
		if err := rows.Scan(
			&item.ID, &item.ProjectID, &item.ActorUserID, &item.ActorEmail, &item.ActorType, &item.Action, &item.ResourceType, &item.ResourceID, &item.Severity, &item.IPAddress, &item.UserAgent, &item.Metadata, &item.CreatedAt,
		); err != nil {
			return nil, err
		}
		out = append(out, item)
	}
	return out, rows.Err()
}

func (r *AuditRepository) Summary(ctx context.Context) (map[string]interface{}, error) {
	const q = `
SELECT
  COUNT(*)::bigint AS total,
  COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '24 hours')::bigint AS last_24h,
  COUNT(*) FILTER (WHERE severity = 'critical')::bigint AS critical_count,
  COUNT(*) FILTER (WHERE severity = 'error')::bigint AS error_count
FROM indusbase_audit.audit_events
`
	var total, last24h, critical, errorCount int64
	if err := r.db.QueryRowContext(ctx, q).Scan(&total, &last24h, &critical, &errorCount); err != nil {
		return nil, err
	}
	return map[string]interface{}{
		"total_events": total,
		"last_24h":     last24h,
		"critical":     critical,
		"errors":       errorCount,
	}, nil
}
