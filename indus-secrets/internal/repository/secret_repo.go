package repository

import (
	"context"
	"database/sql"
	"fmt"
	"time"

	"github.com/indusbase/indus-secrets/internal/models"
)

type SecretRepository struct {
	db *sql.DB
}

func NewSecretRepository(db *sql.DB) *SecretRepository {
	return &SecretRepository{db: db}
}

func (r *SecretRepository) CreateSecret(ctx context.Context, secret *models.Secret, encryptedValue string, actor string) error {
	tx, err := r.db.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()
	err = tx.QueryRowContext(ctx, `
INSERT INTO indusbase_secrets.secrets (name, scope, organization_id, project_id, function_id, active_version, description, created_at, updated_at)
VALUES ($1,$2,$3,$4,$5,1,$6,NOW(),NOW())
RETURNING id, created_at, updated_at
`, secret.Name, secret.Scope, secret.OrganizationID, secret.ProjectID, secret.FunctionID, secret.Description).Scan(&secret.ID, &secret.CreatedAt, &secret.UpdatedAt)
	if err != nil {
		return err
	}
	_, err = tx.ExecContext(ctx, `
INSERT INTO indusbase_secrets.secret_versions (secret_id, version, encrypted_value, created_by, created_at)
VALUES ($1,1,$2,$3,NOW())
`, secret.ID, encryptedValue, actor)
	if err != nil {
		return err
	}
	return tx.Commit()
}

func (r *SecretRepository) ListSecrets(ctx context.Context, scope string, projectID string) ([]models.Secret, error) {
	query := `
SELECT id, name, scope, organization_id, project_id, function_id, active_version, description, created_at, updated_at
FROM indusbase_secrets.secrets
WHERE 1=1
`
	args := []interface{}{}
	i := 1
	if scope != "" {
		query += fmt.Sprintf(" AND scope = $%d", i)
		args = append(args, scope)
		i++
	}
	if projectID != "" {
		query += fmt.Sprintf(" AND project_id::text = $%d", i)
		args = append(args, projectID)
		i++
	}
	query += " ORDER BY updated_at DESC"
	rows, err := r.db.QueryContext(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := make([]models.Secret, 0)
	for rows.Next() {
		var item models.Secret
		if err := rows.Scan(
			&item.ID, &item.Name, &item.Scope, &item.OrganizationID, &item.ProjectID, &item.FunctionID, &item.ActiveVersion, &item.Description, &item.CreatedAt, &item.UpdatedAt,
		); err != nil {
			return nil, err
		}
		out = append(out, item)
	}
	return out, rows.Err()
}

func (r *SecretRepository) GetSecret(ctx context.Context, name string) (*models.Secret, error) {
	var item models.Secret
	err := r.db.QueryRowContext(ctx, `
SELECT id, name, scope, organization_id, project_id, function_id, active_version, description, created_at, updated_at
FROM indusbase_secrets.secrets
WHERE name = $1
`, name).Scan(
		&item.ID, &item.Name, &item.Scope, &item.OrganizationID, &item.ProjectID, &item.FunctionID, &item.ActiveVersion, &item.Description, &item.CreatedAt, &item.UpdatedAt,
	)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return &item, nil
}

func (r *SecretRepository) GetSecretForContext(
	ctx context.Context,
	name string,
	projectID *string,
	functionID *string,
	organizationID *string,
) (*models.Secret, error) {
	var item models.Secret
	err := r.db.QueryRowContext(ctx, `
WITH ranked AS (
    SELECT
        s.id, s.name, s.scope, s.organization_id, s.project_id, s.function_id,
        s.active_version, s.description, s.created_at, s.updated_at,
        CASE
            WHEN s.scope = 'function' AND $3::text IS NOT NULL AND s.function_id = $3 THEN 1
            WHEN s.scope = 'project'  AND $2::uuid IS NOT NULL AND s.project_id = $2::uuid THEN 2
            WHEN s.scope = 'organization' AND $4::uuid IS NOT NULL AND s.organization_id = $4::uuid THEN 3
            WHEN s.scope = 'platform' THEN 4
            ELSE 100
        END AS scope_rank
    FROM indusbase_secrets.secrets s
    WHERE s.name = $1
)
SELECT id, name, scope, organization_id, project_id, function_id, active_version, description, created_at, updated_at
FROM ranked
WHERE scope_rank < 100
ORDER BY scope_rank ASC
LIMIT 1
`, name, projectID, functionID, organizationID).Scan(
		&item.ID, &item.Name, &item.Scope, &item.OrganizationID, &item.ProjectID, &item.FunctionID, &item.ActiveVersion, &item.Description, &item.CreatedAt, &item.UpdatedAt,
	)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return &item, nil
}

func (r *SecretRepository) GetVersion(ctx context.Context, secretID string, version int) (*models.SecretVersion, error) {
	var item models.SecretVersion
	err := r.db.QueryRowContext(ctx, `
SELECT id, secret_id, version, encrypted_value, created_by, created_at, rotated_at
FROM indusbase_secrets.secret_versions
WHERE secret_id = $1 AND version = $2
`, secretID, version).Scan(&item.ID, &item.SecretID, &item.Version, &item.EncryptedValue, &item.CreatedBy, &item.CreatedAt, &item.RotatedAt)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	item.ValuePreview = "****"
	return &item, nil
}

func (r *SecretRepository) ActiveVersion(ctx context.Context, secretID string, activeVersion int) (*models.SecretVersion, error) {
	return r.GetVersion(ctx, secretID, activeVersion)
}

func (r *SecretRepository) Rotate(ctx context.Context, secret *models.Secret, encryptedValue string, actor string) (int, error) {
	nextVersion := secret.ActiveVersion + 1
	tx, err := r.db.BeginTx(ctx, nil)
	if err != nil {
		return 0, err
	}
	defer tx.Rollback()
	_, err = tx.ExecContext(ctx, `
INSERT INTO indusbase_secrets.secret_versions(secret_id, version, encrypted_value, created_by, created_at, rotated_at)
VALUES ($1,$2,$3,$4,NOW(),NOW())
`, secret.ID, nextVersion, encryptedValue, actor)
	if err != nil {
		return 0, err
	}
	_, err = tx.ExecContext(ctx, `
UPDATE indusbase_secrets.secrets
SET active_version = $2, updated_at = NOW()
WHERE id = $1
`, secret.ID, nextVersion)
	if err != nil {
		return 0, err
	}
	_, _ = tx.ExecContext(ctx, `
INSERT INTO indusbase_secrets.rotation_events(secret_id, from_version, to_version, action, actor, created_at)
VALUES ($1,$2,$3,'rotate',$4,NOW())
`, secret.ID, secret.ActiveVersion, nextVersion, actor)
	if err := tx.Commit(); err != nil {
		return 0, err
	}
	return nextVersion, nil
}

func (r *SecretRepository) Rollback(ctx context.Context, secret *models.Secret, targetVersion int, actor string) error {
	tx, err := r.db.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()
	_, err = tx.ExecContext(ctx, `
UPDATE indusbase_secrets.secrets
SET active_version = $2, updated_at = NOW()
WHERE id = $1
`, secret.ID, targetVersion)
	if err != nil {
		return err
	}
	_, _ = tx.ExecContext(ctx, `
INSERT INTO indusbase_secrets.rotation_events(secret_id, from_version, to_version, action, actor, created_at)
VALUES ($1,$2,$3,'rollback',$4,NOW())
`, secret.ID, secret.ActiveVersion, targetVersion, actor)
	return tx.Commit()
}

func (r *SecretRepository) Versions(ctx context.Context, secretID string) ([]models.SecretVersion, error) {
	rows, err := r.db.QueryContext(ctx, `
SELECT id, secret_id, version, encrypted_value, created_by, created_at, rotated_at
FROM indusbase_secrets.secret_versions
WHERE secret_id = $1
ORDER BY version DESC
`, secretID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := make([]models.SecretVersion, 0)
	for rows.Next() {
		var item models.SecretVersion
		if err := rows.Scan(&item.ID, &item.SecretID, &item.Version, &item.EncryptedValue, &item.CreatedBy, &item.CreatedAt, &item.RotatedAt); err != nil {
			return nil, err
		}
		item.ValuePreview = "****"
		out = append(out, item)
	}
	return out, rows.Err()
}

func (r *SecretRepository) RecordRotationEvent(ctx context.Context, secretID string, fromVersion, toVersion int, action, actor string, metadata []byte) error {
	_, err := r.db.ExecContext(ctx, `
INSERT INTO indusbase_secrets.rotation_events(secret_id, from_version, to_version, action, actor, metadata, created_at)
VALUES ($1,$2,$3,$4,$5,$6,NOW())
`, secretID, fromVersion, toVersion, action, actor, metadata)
	return err
}

func (r *SecretRepository) DueForRotation(ctx context.Context, days int) ([]map[string]interface{}, error) {
	rows, err := r.db.QueryContext(ctx, `
SELECT s.id, s.name, s.scope, MAX(v.created_at) AS last_rotated
FROM indusbase_secrets.secrets s
JOIN indusbase_secrets.secret_versions v ON v.secret_id = s.id
GROUP BY s.id, s.name, s.scope
HAVING MAX(v.created_at) < NOW() - ($1 || ' days')::interval
ORDER BY last_rotated ASC
`, days)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := make([]map[string]interface{}, 0)
	for rows.Next() {
		var id, name, scope string
		var lastRotated time.Time
		if err := rows.Scan(&id, &name, &scope, &lastRotated); err != nil {
			return nil, err
		}
		out = append(out, map[string]interface{}{
			"id":           id,
			"name":         name,
			"scope":        scope,
			"last_rotated": lastRotated,
		})
	}
	return out, rows.Err()
}
