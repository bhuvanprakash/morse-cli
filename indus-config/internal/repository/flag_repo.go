package repository

import (
	"context"
	"database/sql"
	"encoding/json"

	"github.com/google/uuid"
	"github.com/indusbase/indus-config/internal/models"
)

type FlagRepository struct {
	db *sql.DB
}

func NewFlagRepository(db *sql.DB) *FlagRepository {
	return &FlagRepository{db: db}
}

func (r *FlagRepository) Create(ctx context.Context, req *models.CreateFlagRequest, ownerID *uuid.UUID) (*models.Flag, error) {
	environmentID, err := uuid.Parse(req.EnvironmentID)
	if err != nil {
		return nil, err
	}
	rules, err := json.Marshal(req.TargetingRules)
	if err != nil {
		return nil, err
	}
	var flag models.Flag
	err = r.db.QueryRowContext(ctx, `
		INSERT INTO indusbase_config.flags (key, environment_id, description, value_type, default_value, targeting_rules, owner_id)
		VALUES ($1, $2, $3, $4, $5, $6, $7)
		RETURNING id, key, environment_id, description, value_type, default_value, targeting_rules, is_active, owner_id, created_at, updated_at`,
		req.Key, environmentID, req.Description, req.ValueType, req.DefaultValue, rules, ownerID,
	).Scan(
		&flag.ID, &flag.Key, &flag.EnvironmentID, &flag.Description, &flag.ValueType, &flag.DefaultValue,
		&flag.TargetingRules, &flag.IsActive, &flag.OwnerID, &flag.CreatedAt, &flag.UpdatedAt,
	)
	if err != nil {
		return nil, err
	}
	return &flag, nil
}

func (r *FlagRepository) ListByEnvironmentID(ctx context.Context, environmentID uuid.UUID) ([]models.Flag, error) {
	rows, err := r.db.QueryContext(ctx, `
		SELECT id, key, environment_id, description, value_type, default_value, targeting_rules, is_active, owner_id, created_at, updated_at
		FROM indusbase_config.flags
		WHERE environment_id = $1
		ORDER BY key`, environmentID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	return scanFlags(rows)
}

func (r *FlagRepository) ListActiveByEnvironmentID(ctx context.Context, environmentID uuid.UUID) ([]models.Flag, error) {
	rows, err := r.db.QueryContext(ctx, `
		SELECT id, key, environment_id, description, value_type, default_value, targeting_rules, is_active, owner_id, created_at, updated_at
		FROM indusbase_config.flags
		WHERE environment_id = $1 AND is_active = TRUE
		ORDER BY key`, environmentID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	return scanFlags(rows)
}

func (r *FlagRepository) GetByKey(ctx context.Context, environmentID uuid.UUID, key string) (*models.Flag, error) {
	var flag models.Flag
	err := r.db.QueryRowContext(ctx, `
		SELECT id, key, environment_id, description, value_type, default_value, targeting_rules, is_active, owner_id, created_at, updated_at
		FROM indusbase_config.flags
		WHERE environment_id = $1 AND key = $2`, environmentID, key).
		Scan(&flag.ID, &flag.Key, &flag.EnvironmentID, &flag.Description, &flag.ValueType, &flag.DefaultValue, &flag.TargetingRules, &flag.IsActive, &flag.OwnerID, &flag.CreatedAt, &flag.UpdatedAt)
	if err != nil {
		return nil, err
	}
	return &flag, nil
}

func (r *FlagRepository) Update(ctx context.Context, environmentID uuid.UUID, key string, updates map[string]interface{}) (*models.Flag, error) {
	current, err := r.GetByKey(ctx, environmentID, key)
	if err != nil {
		return nil, err
	}
	if value, ok := updates["description"].(string); ok {
		current.Description = value
	}
	if value, ok := updates["default_value"].(string); ok {
		current.DefaultValue = value
	}
	if value, ok := updates["is_active"].(bool); ok {
		current.IsActive = value
	}
	if value, ok := updates["targeting_rules"]; ok {
		payload, err := json.Marshal(value)
		if err != nil {
			return nil, err
		}
		current.TargetingRules = payload
	}
	err = r.db.QueryRowContext(ctx, `
		UPDATE indusbase_config.flags
		SET description = $3, default_value = $4, targeting_rules = $5, is_active = $6, updated_at = NOW()
		WHERE environment_id = $1 AND key = $2
		RETURNING id, key, environment_id, description, value_type, default_value, targeting_rules, is_active, owner_id, created_at, updated_at`,
		environmentID, key, current.Description, current.DefaultValue, current.TargetingRules, current.IsActive,
	).Scan(&current.ID, &current.Key, &current.EnvironmentID, &current.Description, &current.ValueType, &current.DefaultValue, &current.TargetingRules, &current.IsActive, &current.OwnerID, &current.CreatedAt, &current.UpdatedAt)
	if err != nil {
		return nil, err
	}
	return current, nil
}

func (r *FlagRepository) Delete(ctx context.Context, environmentID uuid.UUID, key string) error {
	_, err := r.db.ExecContext(ctx, `DELETE FROM indusbase_config.flags WHERE environment_id = $1 AND key = $2`, environmentID, key)
	return err
}

type rowScanner interface {
	Scan(dest ...interface{}) error
}

func scanFlag(row rowScanner) (*models.Flag, error) {
	var flag models.Flag
	if err := row.Scan(&flag.ID, &flag.Key, &flag.EnvironmentID, &flag.Description, &flag.ValueType, &flag.DefaultValue, &flag.TargetingRules, &flag.IsActive, &flag.OwnerID, &flag.CreatedAt, &flag.UpdatedAt); err != nil {
		return nil, err
	}
	return &flag, nil
}

func scanFlags(rows *sql.Rows) ([]models.Flag, error) {
	flags := make([]models.Flag, 0)
	for rows.Next() {
		flag, err := scanFlag(rows)
		if err != nil {
			return nil, err
		}
		flags = append(flags, *flag)
	}
	return flags, rows.Err()
}
