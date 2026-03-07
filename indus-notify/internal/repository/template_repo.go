package repository

import (
	"context"
	"database/sql"
	"strings"

	"github.com/indusbase/indus-notify/internal/models"
	"github.com/lib/pq"
)

type TemplateRepository struct {
	db *sql.DB
}

func NewTemplateRepository(db *sql.DB) *TemplateRepository {
	return &TemplateRepository{db: db}
}

func (r *TemplateRepository) Create(ctx context.Context, template *models.Template) (*models.Template, error) {
	query := `
		INSERT INTO indusbase_notify.templates (name, channel, subject, body, whatsapp_template_name, variables, is_active, owner_id)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
		RETURNING id, created_at, updated_at`
	err := r.db.QueryRowContext(ctx, query,
		template.Name, template.Channel, template.Subject, template.Body, template.WhatsAppTemplateName,
		pq.Array(template.Variables), template.IsActive, template.OwnerID,
	).Scan(&template.ID, &template.CreatedAt, &template.UpdatedAt)
	return template, err
}

func (r *TemplateRepository) List(ctx context.Context) ([]models.Template, error) {
	rows, err := r.db.QueryContext(ctx, `
		SELECT id, name, channel, subject, body, whatsapp_template_name, variables, is_active, owner_id, created_at, updated_at
		FROM indusbase_notify.templates ORDER BY name`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	return scanTemplates(rows)
}

func (r *TemplateRepository) GetByName(ctx context.Context, name string) (*models.Template, error) {
	row := r.db.QueryRowContext(ctx, `
		SELECT id, name, channel, subject, body, whatsapp_template_name, variables, is_active, owner_id, created_at, updated_at
		FROM indusbase_notify.templates WHERE name = $1`, name)
	return scanTemplateRow(row)
}

func (r *TemplateRepository) UpdateByName(ctx context.Context, name string, req *models.TemplateCreateRequest) (*models.Template, error) {
	query := `
		UPDATE indusbase_notify.templates
		SET channel = $2, subject = $3, body = $4, whatsapp_template_name = $5, variables = $6, updated_at = NOW()
		WHERE name = $1
		RETURNING id, name, channel, subject, body, whatsapp_template_name, variables, is_active, owner_id, created_at, updated_at`
	row := r.db.QueryRowContext(ctx, query, name, req.Channel, req.Subject, req.Body, req.WhatsAppTemplateName, pq.Array(req.Variables))
	return scanTemplateRow(row)
}

func (r *TemplateRepository) DeleteByName(ctx context.Context, name string) error {
	_, err := r.db.ExecContext(ctx, `DELETE FROM indusbase_notify.templates WHERE name = $1`, name)
	return err
}

func RenderTemplate(template *models.Template, variables map[string]string) (string, *string, []string) {
	body := template.Body
	var subject *string
	if template.Subject != nil {
		rendered := *template.Subject
		subject = &rendered
	}
	missing := []string{}
	for _, variable := range template.Variables {
		value, ok := variables[variable]
		if !ok {
			missing = append(missing, variable)
			continue
		}
		needle := "{{" + variable + "}}"
		body = strings.ReplaceAll(body, needle, value)
		if subject != nil {
			rendered := strings.ReplaceAll(*subject, needle, value)
			subject = &rendered
		}
	}
	return body, subject, missing
}

type templateScanner interface {
	Scan(dest ...interface{}) error
}

func scanTemplateRow(row templateScanner) (*models.Template, error) {
	var template models.Template
	var variables pq.StringArray
	err := row.Scan(&template.ID, &template.Name, &template.Channel, &template.Subject, &template.Body, &template.WhatsAppTemplateName, &variables, &template.IsActive, &template.OwnerID, &template.CreatedAt, &template.UpdatedAt)
	if err != nil {
		return nil, err
	}
	template.Variables = variables
	return &template, nil
}

func scanTemplates(rows *sql.Rows) ([]models.Template, error) {
	var templates []models.Template
	for rows.Next() {
		template, err := scanTemplateRow(rows)
		if err != nil {
			return nil, err
		}
		templates = append(templates, *template)
	}
	return templates, rows.Err()
}
