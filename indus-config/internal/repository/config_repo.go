package repository

import (
	"context"
	"database/sql"

	"github.com/google/uuid"
	"github.com/indusbase/indus-config/internal/models"
)

type ConfigRepository struct {
	db *sql.DB
}

func NewConfigRepository(db *sql.DB) *ConfigRepository {
	return &ConfigRepository{db: db}
}

func (r *ConfigRepository) Create(ctx context.Context, req *models.CreateConfigRequest, ownerID *uuid.UUID, storedValue string) (*models.ConfigEntry, error) {
	environmentID, err := uuid.Parse(req.EnvironmentID)
	if err != nil {
		return nil, err
	}
	var entry models.ConfigEntry
	err = r.db.QueryRowContext(ctx, `
		INSERT INTO indusbase_config.remote_configs (key, environment_id, value, value_type, description, is_secret, owner_id)
		VALUES ($1, $2, $3, $4, $5, $6, $7)
		RETURNING id, key, environment_id, value, value_type, description, is_secret, owner_id, created_at, updated_at`,
		req.Key, environmentID, storedValue, req.ValueType, req.Description, req.IsSecret, ownerID,
	).Scan(&entry.ID, &entry.Key, &entry.EnvironmentID, &entry.Value, &entry.ValueType, &entry.Description, &entry.IsSecret, &entry.OwnerID, &entry.CreatedAt, &entry.UpdatedAt)
	if err != nil {
		return nil, err
	}
	return &entry, nil
}

func (r *ConfigRepository) ListByEnvironmentID(ctx context.Context, environmentID uuid.UUID) ([]models.ConfigEntry, error) {
	rows, err := r.db.QueryContext(ctx, `
		SELECT id, key, environment_id, value, value_type, description, is_secret, owner_id, created_at, updated_at
		FROM indusbase_config.remote_configs
		WHERE environment_id = $1
		ORDER BY key`, environmentID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	return scanConfigEntries(rows)
}

func (r *ConfigRepository) GetByKey(ctx context.Context, environmentID uuid.UUID, key string) (*models.ConfigEntry, error) {
	var entry models.ConfigEntry
	err := r.db.QueryRowContext(ctx, `
		SELECT id, key, environment_id, value, value_type, description, is_secret, owner_id, created_at, updated_at
		FROM indusbase_config.remote_configs
		WHERE environment_id = $1 AND key = $2`, environmentID, key).
		Scan(&entry.ID, &entry.Key, &entry.EnvironmentID, &entry.Value, &entry.ValueType, &entry.Description, &entry.IsSecret, &entry.OwnerID, &entry.CreatedAt, &entry.UpdatedAt)
	if err != nil {
		return nil, err
	}
	return &entry, nil
}

func (r *ConfigRepository) Update(ctx context.Context, environmentID uuid.UUID, key, storedValue string, valueType models.ValueType, description *string, isSecret *bool) (*models.ConfigEntry, error) {
	current, err := r.GetByKey(ctx, environmentID, key)
	if err != nil {
		return nil, err
	}
	if storedValue != "" {
		current.Value = storedValue
	}
	if valueType != "" {
		current.ValueType = valueType
	}
	if description != nil {
		current.Description = *description
	}
	if isSecret != nil {
		current.IsSecret = *isSecret
	}
	err = r.db.QueryRowContext(ctx, `
		UPDATE indusbase_config.remote_configs
		SET value = $3, value_type = $4, description = $5, is_secret = $6, updated_at = NOW()
		WHERE environment_id = $1 AND key = $2
		RETURNING id, key, environment_id, value, value_type, description, is_secret, owner_id, created_at, updated_at`,
		environmentID, key, current.Value, current.ValueType, current.Description, current.IsSecret,
	).Scan(&current.ID, &current.Key, &current.EnvironmentID, &current.Value, &current.ValueType, &current.Description, &current.IsSecret, &current.OwnerID, &current.CreatedAt, &current.UpdatedAt)
	if err != nil {
		return nil, err
	}
	return current, nil
}

func (r *ConfigRepository) Delete(ctx context.Context, environmentID uuid.UUID, key string) error {
	_, err := r.db.ExecContext(ctx, `DELETE FROM indusbase_config.remote_configs WHERE environment_id = $1 AND key = $2`, environmentID, key)
	return err
}

func scanConfigEntries(rows *sql.Rows) ([]models.ConfigEntry, error) {
	entries := make([]models.ConfigEntry, 0)
	for rows.Next() {
		var entry models.ConfigEntry
		if err := rows.Scan(&entry.ID, &entry.Key, &entry.EnvironmentID, &entry.Value, &entry.ValueType, &entry.Description, &entry.IsSecret, &entry.OwnerID, &entry.CreatedAt, &entry.UpdatedAt); err != nil {
			return nil, err
		}
		entries = append(entries, entry)
	}
	return entries, rows.Err()
}
