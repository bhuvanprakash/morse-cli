package handlers

import (
	"net/http"
	"regexp"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/indusbase/indus-notify/internal/models"
	"github.com/indusbase/indus-notify/internal/providers"
	notifyqueue "github.com/indusbase/indus-notify/internal/queue"
	"github.com/indusbase/indus-notify/internal/repository"
)

var indianPhoneRegex = regexp.MustCompile(`^91\d{10}$`)

type SMSHandler struct {
	notifications *repository.NotificationRepository
	templates     *repository.TemplateRepository
	primary       providers.SMSProvider
	fallback      providers.SMSProvider
	queueClient   *notifyqueue.Client
}

func NewSMSHandler(notificationRepo *repository.NotificationRepository, templateRepo *repository.TemplateRepository, primary providers.SMSProvider, fallback providers.SMSProvider, queueURL, internalSecret string) *SMSHandler {
	return &SMSHandler{
		notifications: notificationRepo,
		templates:     templateRepo,
		primary:       primary,
		fallback:      fallback,
		queueClient:   notifyqueue.NewClient(queueURL, internalSecret),
	}
}

func (h *SMSHandler) Send(c *gin.Context) {
	var req models.SendSMSRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondError(c, http.StatusBadRequest, "BAD_REQUEST", err.Error())
		return
	}
	// Enforce DLT template ID — mandatory for all Indian transactional SMS
	if strings.TrimSpace(req.DLTTemplateID) == "" {
		respondError(c, http.StatusUnprocessableEntity, "DLT_TEMPLATE_REQUIRED", "DLT Template ID is required for SMS in India. Register templates at Airtel/Vodafone/Jio DLT portal before sending.")
		return
	}

	// Validate Indian phone format: 91 + 10 digits = 12 digits total
	if !indianPhoneRegex.MatchString(req.To) || len(req.To) != 12 || req.To[:2] != "91" {
		respondError(c, http.StatusUnprocessableEntity, "INVALID_PHONE", "Phone must be in format 91XXXXXXXXXX (country code 91 + 10 digits)")
		return
	}
	body := req.Body
	var templateID *string
	if req.TemplateID != nil {
		template, err := h.templates.GetByName(c.Request.Context(), *req.TemplateID)
		if err != nil {
			respondError(c, http.StatusNotFound, "NOT_FOUND", "template not found")
			return
		}
		renderedBody, _, missing := repository.RenderTemplate(template, req.Variables)
		if len(missing) > 0 {
			respondError(c, http.StatusUnprocessableEntity, "VALIDATION_ERROR", "missing template variables: "+strings.Join(missing, ", "))
			return
		}
		body = renderedBody
		templateID = req.TemplateID
	}

	result, providerName := h.sendSMS(c, req.To, body, req.DLTTemplateID)
	if !result.Success {
		respondError(c, http.StatusBadGateway, "PROVIDER_ERROR", result.Error)
		return
	}
	now := time.Now()
	provider := providerName
	providerMessageID := result.MessageID
	_ = h.notifications.Create(c.Request.Context(), &models.Notification{
		Channel:           models.ChannelSMS,
		Recipient:         req.To,
		Body:              body,
		TemplateID:        nil,
		Provider:          &provider,
		ProviderMessageID: &providerMessageID,
		Status:            models.StatusSent,
		SentAt:            &now,
	})
	_ = templateID
	respondOK(c, gin.H{"message_id": result.MessageID, "provider": providerName})
}

func (h *SMSHandler) SendBatch(c *gin.Context) {
	var req models.SendBatchRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondError(c, http.StatusBadRequest, "BAD_REQUEST", err.Error())
		return
	}
	if req.Channel != models.ChannelSMS {
		respondError(c, http.StatusBadRequest, "BAD_REQUEST", "channel must be sms")
		return
	}
	if len(req.Recipients) > 10000 {
		respondError(c, http.StatusUnprocessableEntity, "VALIDATION_ERROR", "max 10000 recipients allowed")
		return
	}
	template, err := h.templates.GetByName(c.Request.Context(), req.TemplateID)
	if err != nil {
		respondError(c, http.StatusNotFound, "NOT_FOUND", "template not found")
		return
	}
	enqueued := 0
	for _, recipient := range req.Recipients {
		if strings.TrimSpace(recipient.DLTTemplateID) == "" {
			respondError(c, http.StatusUnprocessableEntity, "DLT_TEMPLATE_REQUIRED", "DLT Template ID required for SMS in India. Register at vodafone/airtel/jio DLT portal.")
			return
		}
		body, _, missing := repository.RenderTemplate(template, recipient.Variables)
		if len(missing) > 0 {
			respondError(c, http.StatusUnprocessableEntity, "VALIDATION_ERROR", "missing template variables for "+recipient.To)
			return
		}
		payload := map[string]any{
			"channel":         req.Channel,
			"to":              recipient.To,
			"template_id":     req.TemplateID,
			"variables":       recipient.Variables,
			"dlt_template_id": recipient.DLTTemplateID,
			"user_id":         recipient.UserID,
			"body":            body,
		}
		jobType := "notify_" + string(req.Channel)
		jobReq := map[string]any{
			"queue_name": "notifications",
			"payload":    payload,
			"job_type":   jobType,
		}
		if err := h.queueClient.Enqueue(c.Request.Context(), jobReq); err == nil {
			enqueued++
		}
	}
	respondJSON(c, http.StatusAccepted, gin.H{"enqueued": enqueued})
}

func (h *SMSHandler) sendSMS(c *gin.Context, to, body, dltTemplateID string) (*providers.SMSResult, string) {
	if h.primary != nil {
		if result, err := h.primary.SendSMS(c.Request.Context(), to, body, dltTemplateID); err == nil && result.Success {
			return result, h.primary.Name()
		}
	}
	if h.fallback != nil {
		if result, err := h.fallback.SendSMS(c.Request.Context(), to, body, dltTemplateID); err == nil {
			return result, h.fallback.Name()
		}
	}
	return &providers.SMSResult{Success: false, Error: "no SMS provider configured"}, ""
}
