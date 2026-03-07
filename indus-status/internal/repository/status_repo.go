package repository

import (
	"context"
	"database/sql"
	"encoding/json"

	"github.com/indusbase/indus-status/internal/models"
)

type StatusRepository struct {
	db *sql.DB
}

func NewStatusRepository(db *sql.DB) *StatusRepository {
	return &StatusRepository{db: db}
}

func (r *StatusRepository) Components(ctx context.Context) ([]map[string]interface{}, error) {
	rows, err := r.db.QueryContext(ctx, `
SELECT id, name, slug, status, description, updated_at
FROM indusbase_status.components
ORDER BY name ASC
`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := make([]map[string]interface{}, 0)
	for rows.Next() {
		row := map[string]interface{}{}
		var id, name, slug, status string
		var description sql.NullString
		var updatedAt string
		if err := rows.Scan(&id, &name, &slug, &status, &description, &updatedAt); err != nil {
			return nil, err
		}
		row["id"] = id
		row["name"] = name
		row["slug"] = slug
		row["status"] = status
		row["description"] = description.String
		row["updated_at"] = updatedAt
		out = append(out, row)
	}
	return out, rows.Err()
}

func (r *StatusRepository) ListIncidents(ctx context.Context, onlyPublic bool) ([]models.Incident, error) {
	query := `
SELECT id, title, summary, severity, impact, status, started_at, resolved_at, timeline, created_at, updated_at
FROM indusbase_status.incidents
`
	if onlyPublic {
		query += " WHERE status <> 'internal'"
	}
	query += " ORDER BY started_at DESC LIMIT 100"
	rows, err := r.db.QueryContext(ctx, query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := make([]models.Incident, 0)
	for rows.Next() {
		var i models.Incident
		if err := rows.Scan(&i.ID, &i.Title, &i.Summary, &i.Severity, &i.Impact, &i.Status, &i.StartedAt, &i.ResolvedAt, &i.Timeline, &i.CreatedAt, &i.UpdatedAt); err != nil {
			return nil, err
		}
		out = append(out, i)
	}
	return out, rows.Err()
}

func (r *StatusRepository) CreateIncident(ctx context.Context, i *models.Incident) error {
	timeline := i.Timeline
	if len(timeline) == 0 {
		timeline, _ = json.Marshal([]map[string]interface{}{
			{"timestamp": i.StartedAt, "message": "Incident created", "status": i.Status},
		})
	}
	return r.db.QueryRowContext(ctx, `
INSERT INTO indusbase_status.incidents (title, summary, severity, impact, status, started_at, timeline, created_at, updated_at)
VALUES ($1,$2,$3,$4,$5,$6,$7,NOW(),NOW())
RETURNING id, created_at, updated_at
`, i.Title, i.Summary, i.Severity, i.Impact, i.Status, i.StartedAt, timeline).Scan(&i.ID, &i.CreatedAt, &i.UpdatedAt)
}

func (r *StatusRepository) UpdateIncident(ctx context.Context, id string, fields map[string]interface{}) error {
	_, err := r.db.ExecContext(ctx, `
UPDATE indusbase_status.incidents
SET title = COALESCE($2, title),
    summary = COALESCE($3, summary),
    severity = COALESCE($4, severity),
    impact = COALESCE($5, impact),
    status = COALESCE($6, status),
    timeline = COALESCE($7, timeline),
    updated_at = NOW()
WHERE id = $1
`, id, fields["title"], fields["summary"], fields["severity"], fields["impact"], fields["status"], fields["timeline"])
	return err
}

func (r *StatusRepository) ResolveIncident(ctx context.Context, id string, timeline []byte) error {
	_, err := r.db.ExecContext(ctx, `
UPDATE indusbase_status.incidents
SET status = 'resolved',
    resolved_at = NOW(),
    timeline = COALESCE($2, timeline),
    updated_at = NOW()
WHERE id = $1
`, id, timeline)
	return err
}

func (r *StatusRepository) CreateMaintenance(ctx context.Context, title, description, startsAt, endsAt string) error {
	_, err := r.db.ExecContext(ctx, `
INSERT INTO indusbase_status.maintenance_windows (title, description, starts_at, ends_at, status, created_at)
VALUES ($1,$2,$3::timestamptz,$4::timestamptz,'scheduled',NOW())
`, title, description, startsAt, endsAt)
	return err
}

func (r *StatusRepository) ListMaintenance(ctx context.Context) ([]map[string]interface{}, error) {
	rows, err := r.db.QueryContext(ctx, `
SELECT id, title, description, starts_at, ends_at, status, created_at
FROM indusbase_status.maintenance_windows
ORDER BY starts_at DESC
LIMIT 100
`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := make([]map[string]interface{}, 0)
	for rows.Next() {
		var (
			id, title, status, createdAt, startsAt, endsAt string
			description sql.NullString
		)
		if err := rows.Scan(&id, &title, &description, &startsAt, &endsAt, &status, &createdAt); err != nil {
			return nil, err
		}
		out = append(out, map[string]interface{}{
			"id":          id,
			"title":       title,
			"description": description.String,
			"starts_at":   startsAt,
			"ends_at":     endsAt,
			"status":      status,
			"created_at":  createdAt,
		})
	}
	return out, rows.Err()
}

func (r *StatusRepository) Subscribe(ctx context.Context, email string) error {
	_, err := r.db.ExecContext(ctx, `
INSERT INTO indusbase_status.subscribers (email, verified, created_at)
VALUES ($1, TRUE, NOW())
ON CONFLICT(email) DO NOTHING
`, email)
	return err
}

func (r *StatusRepository) SubscriberCount(ctx context.Context) (int64, error) {
	var count int64
	err := r.db.QueryRowContext(ctx, `SELECT COUNT(*) FROM indusbase_status.subscribers`).Scan(&count)
	return count, err
}
