package models

import (
	"time"

	"github.com/google/uuid"
)

type Template struct {
	ID                   uuid.UUID           `json:"id" db:"id"`
	Name                 string              `json:"name" db:"name"`
	Channel              NotificationChannel `json:"channel" db:"channel"`
	Subject              *string             `json:"subject,omitempty" db:"subject"`
	Body                 string              `json:"body" db:"body"`
	WhatsAppTemplateName *string             `json:"whatsapp_template_name,omitempty" db:"whatsapp_template_name"`
	Variables            []string            `json:"variables" db:"variables"`
	IsActive             bool                `json:"is_active" db:"is_active"`
	OwnerID              *uuid.UUID          `json:"owner_id,omitempty" db:"owner_id"`
	CreatedAt            time.Time           `json:"created_at" db:"created_at"`
	UpdatedAt            time.Time           `json:"updated_at" db:"updated_at"`
}

type TemplateCreateRequest struct {
	Name                 string              `json:"name" validate:"required"`
	Channel              NotificationChannel `json:"channel" validate:"required"`
	Subject              *string             `json:"subject"`
	Body                 string              `json:"body" validate:"required"`
	WhatsAppTemplateName *string             `json:"whatsapp_template_name"`
	Variables            []string            `json:"variables"`
}

type TemplatePreviewRequest struct {
	Variables map[string]string `json:"variables"`
}
