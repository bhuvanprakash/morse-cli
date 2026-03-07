package handlers

import (
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/indusbase/indus-notify/internal/models"
	"github.com/indusbase/indus-notify/internal/providers"
	"github.com/indusbase/indus-notify/internal/repository"
)

type WhatsAppHandler struct {
	notifications *repository.NotificationRepository
	templates     *repository.TemplateRepository
	twilio        *providers.TwilioProvider
}

func NewWhatsAppHandler(notificationRepo *repository.NotificationRepository, templateRepo *repository.TemplateRepository, twilio *providers.TwilioProvider) *WhatsAppHandler {
	return &WhatsAppHandler{notifications: notificationRepo, templates: templateRepo, twilio: twilio}
}

func (h *WhatsAppHandler) Send(c *gin.Context) {
	var req struct {
		To         string            `json:"to"`
		Body       string            `json:"body"`
		TemplateID *string           `json:"template_id"`
		Variables  map[string]string `json:"variables"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		respondError(c, http.StatusBadRequest, "BAD_REQUEST", err.Error())
		return
	}
	body := req.Body
	if req.TemplateID != nil {
		template, err := h.templates.GetByName(c.Request.Context(), *req.TemplateID)
		if err != nil {
			respondError(c, http.StatusNotFound, "NOT_FOUND", "template not found")
			return
		}
		renderedBody, _, missing := repository.RenderTemplate(template, req.Variables)
		if len(missing) > 0 {
			respondError(c, http.StatusUnprocessableEntity, "VALIDATION_ERROR", "missing template variables")
			return
		}
		body = renderedBody
	}
	if h.twilio == nil {
		respondError(c, http.StatusBadGateway, "PROVIDER_ERROR", "whatsapp provider not configured")
		return
	}
	result, err := h.twilio.SendWhatsApp(c.Request.Context(), req.To, body)
	if err != nil || !result.Success {
		message := "whatsapp send failed"
		if err != nil {
			message = err.Error()
		} else if result != nil {
			message = result.Error
		}
		respondError(c, http.StatusBadGateway, "PROVIDER_ERROR", message)
		return
	}
	now := time.Now()
	provider := h.twilio.Name()
	messageID := result.MessageID
	_ = h.notifications.Create(c.Request.Context(), &models.Notification{
		Channel:           models.ChannelWhatsApp,
		Recipient:         req.To,
		Body:              body,
		Provider:          &provider,
		ProviderMessageID: &messageID,
		Status:            models.StatusSent,
		SentAt:            &now,
	})
	respondOK(c, gin.H{"message_id": messageID, "provider": provider})
}
