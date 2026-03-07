package models

import (
	"encoding/json"
	"time"

	"github.com/google/uuid"
)

type NotificationChannel string

const (
	ChannelPush     NotificationChannel = "push"
	ChannelSMS      NotificationChannel = "sms"
	ChannelEmail    NotificationChannel = "email"
	ChannelWhatsApp NotificationChannel = "whatsapp"
)

type NotificationStatus string

const (
	StatusQueued    NotificationStatus = "queued"
	StatusSent      NotificationStatus = "sent"
	StatusDelivered NotificationStatus = "delivered"
	StatusFailed    NotificationStatus = "failed"
)

type Notification struct {
	ID                uuid.UUID           `json:"id" db:"id"`
	UserID            *uuid.UUID          `json:"user_id,omitempty" db:"user_id"`
	Channel           NotificationChannel `json:"channel" db:"channel"`
	Recipient         string              `json:"recipient" db:"recipient"`
	Subject           *string             `json:"subject,omitempty" db:"subject"`
	Body              string              `json:"body" db:"body"`
	Data              json.RawMessage     `json:"data" db:"data"`
	TemplateID        *uuid.UUID          `json:"template_id,omitempty" db:"template_id"`
	Provider          *string             `json:"provider,omitempty" db:"provider"`
	ProviderMessageID *string             `json:"provider_message_id,omitempty" db:"provider_message_id"`
	Status            NotificationStatus  `json:"status" db:"status"`
	ErrorMessage      *string             `json:"error_message,omitempty" db:"error_message"`
	SentAt            *time.Time          `json:"sent_at,omitempty" db:"sent_at"`
	DeliveredAt       *time.Time          `json:"delivered_at,omitempty" db:"delivered_at"`
	CreatedAt         time.Time           `json:"created_at" db:"created_at"`
}

type SendPushRequest struct {
	UserID           *string            `json:"user_id"`
	Tokens           []string           `json:"tokens"`
	Title            string             `json:"title" validate:"required"`
	Body             string             `json:"body" validate:"required"`
	Data             map[string]string  `json:"data"`
	TemplateID       *string            `json:"template_id"`
	Variables        map[string]string  `json:"variables"`
	AndroidChannelID string             `json:"android_channel_id"`
	Badge            *int               `json:"badge"`
	Sound            string             `json:"sound"`
}

type SendSMSRequest struct {
	To            string            `json:"to" validate:"required"`
	Body          string            `json:"body" validate:"required,max=160"`
	TemplateID    *string           `json:"template_id"`
	Variables     map[string]string `json:"variables"`
	DLTTemplateID string            `json:"dlt_template_id"`
}

type SendEmailRequest struct {
	To          []string           `json:"to" validate:"required,min=1"`
	CC          []string           `json:"cc"`
	Subject     string             `json:"subject" validate:"required"`
	Body        string             `json:"body" validate:"required"`
	IsHTML      bool               `json:"is_html"`
	TemplateID  *string            `json:"template_id"`
	Variables   map[string]string  `json:"variables"`
	Attachments []EmailAttachment  `json:"attachments"`
}

type EmailAttachment struct {
	Filename string `json:"filename"`
	Content  string `json:"content"`
	MimeType string `json:"mime_type"`
}

type SendBatchRequest struct {
	Channel    NotificationChannel `json:"channel" validate:"required"`
	Recipients []BatchRecipient    `json:"recipients" validate:"required,min=1,max=10000"`
	TemplateID string              `json:"template_id" validate:"required"`
}

type BatchRecipient struct {
	To        string            `json:"to" validate:"required"`
	UserID    *string           `json:"user_id"`
	Variables map[string]string `json:"variables"`
	DLTTemplateID string        `json:"dlt_template_id"`
}
