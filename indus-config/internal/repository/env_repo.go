package repository

import (
	"context"
	"database/sql"

	"github.com/indusbase/indus-config/internal/models"
)

type EnvironmentRepository struct {
	db *sql.DB
}

func NewEnvironmentRepository(db *sql.DB) *EnvironmentRepository {
	return &EnvironmentRepository{db: db}
}

func (r *EnvironmentRepository) List(ctx context.Context) ([]models.Environment, error) {
	rows, err := r.db.QueryContext(ctx, `
		SELECT id, name, description, is_production, created_at
		FROM indusbase_config.environments
		ORDER BY is_production, name`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	environments := make([]models.Environment, 0)
	for rows.Next() {
		var environment models.Environment
		if err := rows.Scan(&environment.ID, &environment.Name, &environment.Description, &environment.IsProduction, &environment.CreatedAt); err != nil {
			return nil, err
		}
		environments = append(environments, environment)
	}
	return environments, rows.Err()
}

func (r *EnvironmentRepository) GetByName(ctx context.Context, name string) (*models.Environment, error) {
	var environment models.Environment
	err := r.db.QueryRowContext(ctx, `
		SELECT id, name, description, is_production, created_at
		FROM indusbase_config.environments
		WHERE name = $1`, name).
		Scan(&environment.ID, &environment.Name, &environment.Description, &environment.IsProduction, &environment.CreatedAt)
	if err != nil {
		return nil, err
	}
	return &environment, nil
}
