package handlers

import (
	"encoding/base64"
	"fmt"
	"net/http"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/indusbase/indus-notify/internal/models"
	"github.com/indusbase/indus-notify/internal/providers"
	notifyqueue "github.com/indusbase/indus-notify/internal/queue"
	"github.com/indusbase/indus-notify/internal/repository"
)

type EmailHandler struct {
	notifications  *repository.NotificationRepository
	templates      *repository.TemplateRepository
	provider       providers.EmailProvider
	fromName       string
	fromAddress    string
	queueClient    *notifyqueue.Client
}

func NewEmailHandler(notificationRepo *repository.NotificationRepository, templateRepo *repository.TemplateRepository, provider providers.EmailProvider, fromName, fromAddress, queueURL, internalSecret string) *EmailHandler {
	return &EmailHandler{
		notifications:  notificationRepo,
		templates:      templateRepo,
		provider:       provider,
		fromName:       fromName,
		fromAddress:    fromAddress,
		queueClient:    notifyqueue.NewClient(queueURL, internalSecret),
	}
}

func (h *EmailHandler) Send(c *gin.Context) {
	var req models.SendEmailRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondError(c, http.StatusBadRequest, "BAD_REQUEST", err.Error())
		return
	}
	subject := req.Subject
	body := req.Body
	if req.TemplateID != nil {
		template, err := h.templates.GetByName(c.Request.Context(), *req.TemplateID)
		if err != nil {
			respondError(c, http.StatusNotFound, "NOT_FOUND", "template not found")
			return
		}
		renderedBody, renderedSubject, missing := repository.RenderTemplate(template, req.Variables)
		if len(missing) > 0 {
			respondError(c, http.StatusUnprocessableEntity, "VALIDATION_ERROR", "missing template variables: "+strings.Join(missing, ", "))
			return
		}
		body = renderedBody
		if renderedSubject != nil {
			subject = *renderedSubject
		}
	}
	message, err := h.buildMessage(subject, body, req)
	if err != nil {
		respondError(c, http.StatusBadRequest, "BAD_REQUEST", err.Error())
		return
	}
	if h.provider == nil {
		respondError(c, http.StatusBadGateway, "PROVIDER_ERROR", "email provider not configured")
		return
	}
	if err := h.provider.SendEmail(c.Request.Context(), message); err != nil {
		respondError(c, http.StatusBadGateway, "PROVIDER_ERROR", err.Error())
		return
	}
	now := time.Now()
	provider := h.provider.Name()
	msgID := fmt.Sprintf("%s-%d", provider, now.UnixNano())
	for _, recipient := range req.To {
		_ = h.notifications.Create(c.Request.Context(), &models.Notification{
			Channel:           models.ChannelEmail,
			Recipient:         recipient,
			Subject:           &subject,
			Body:              body,
			Provider:          &provider,
			ProviderMessageID: &msgID,
			Status:            models.StatusSent,
			SentAt:            &now,
		})
	}
	respondOK(c, gin.H{"message_id": msgID})
}

func (h *EmailHandler) SendBatch(c *gin.Context) {
	var req models.SendBatchRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondError(c, http.StatusBadRequest, "BAD_REQUEST", err.Error())
		return
	}
	if req.Channel != models.ChannelEmail {
		respondError(c, http.StatusBadRequest, "BAD_REQUEST", "channel must be email")
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
		body, subject, missing := repository.RenderTemplate(template, recipient.Variables)
		if len(missing) > 0 {
			respondError(c, http.StatusUnprocessableEntity, "VALIDATION_ERROR", "missing template variables for "+recipient.To)
			return
		}
		payload := map[string]any{
			"channel":     req.Channel,
			"to":          recipient.To,
			"template_id": req.TemplateID,
			"variables":   recipient.Variables,
			"user_id":     recipient.UserID,
			"subject":     derefString(subject),
			"body":        body,
			"is_html":     false,
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

func (h *EmailHandler) buildMessage(subject, body string, req models.SendEmailRequest) (*providers.EmailMessage, error) {
	message := &providers.EmailMessage{
		From:     fmt.Sprintf("%s <%s>", h.fromName, h.fromAddress),
		To:       req.To,
		CC:       req.CC,
		Subject:  subject,
		TextBody: body,
	}
	if req.IsHTML {
		message.HTMLBody = body
		message.TextBody = stripHTML(body)
	}
	for _, attachment := range req.Attachments {
		content, err := base64.StdEncoding.DecodeString(attachment.Content)
		if err != nil {
			return nil, fmt.Errorf("invalid attachment %s", attachment.Filename)
		}
		message.Attachments = append(message.Attachments, providers.Attachment{
			Filename: attachment.Filename,
			Content:  content,
			MimeType: attachment.MimeType,
		})
	}
	return message, nil
}

func stripHTML(value string) string {
	replacer := strings.NewReplacer("<br>", "\n", "<br/>", "\n", "<p>", "", "</p>", "\n")
	return replacer.Replace(value)
}

func derefString(value *string) string {
	if value == nil {
		return ""
	}
	return *value
}
