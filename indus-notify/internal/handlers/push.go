package handlers

import (
	"encoding/json"
	"net/http"
	"slices"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/indusbase/indus-notify/internal/models"
	"github.com/indusbase/indus-notify/internal/providers"
	"github.com/indusbase/indus-notify/internal/repository"
)

type PushHandler struct {
	devices       *repository.DeviceRepository
	notifications *repository.NotificationRepository
	templates     *repository.TemplateRepository
	fcm           providers.PushProvider
	apns          providers.PushProvider
}

func NewPushHandler(deviceRepo *repository.DeviceRepository, notificationRepo *repository.NotificationRepository, templateRepo *repository.TemplateRepository, fcm providers.PushProvider, apns providers.PushProvider) *PushHandler {
	return &PushHandler{
		devices:       deviceRepo,
		notifications: notificationRepo,
		templates:     templateRepo,
		fcm:           fcm,
		apns:          apns,
	}
}

func (h *PushHandler) Send(c *gin.Context) {
	var req models.SendPushRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondError(c, http.StatusBadRequest, "BAD_REQUEST", err.Error())
		return
	}

	body := req.Body
	title := req.Title
	var templateID *uuid.UUID
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
			title = *renderedSubject
		}
		templateID = &template.ID
	}

	deviceTokens := req.Tokens
	var userID *uuid.UUID
	if req.UserID != nil {
		parsed, err := uuid.Parse(*req.UserID)
		if err != nil {
			respondError(c, http.StatusBadRequest, "BAD_REQUEST", "invalid user_id")
			return
		}
		userID = &parsed
		devices, err := h.devices.ListByUser(c.Request.Context(), parsed)
		if err != nil {
			respondError(c, http.StatusInternalServerError, "INTERNAL_ERROR", err.Error())
			return
		}
		for _, device := range devices {
			if !slices.Contains(deviceTokens, device.Token) {
				deviceTokens = append(deviceTokens, device.Token)
			}
		}
	}
	if len(deviceTokens) == 0 {
		respondError(c, http.StatusBadRequest, "BAD_REQUEST", "user_id or tokens required")
		return
	}

	deviceMap := map[string]models.DevicePlatform{}
	if userID != nil {
		devices, _ := h.devices.ListByUser(c.Request.Context(), *userID)
		for _, device := range devices {
			deviceMap[device.Token] = device.Platform
		}
	}
	for _, token := range req.Tokens {
		if _, ok := deviceMap[token]; !ok {
			deviceMap[token] = models.PlatformFCM
		}
	}

	var fcmPayloads []providers.PushPayload
	var apnsPayloads []providers.PushPayload
	for _, token := range deviceTokens {
		payload := providers.PushPayload{
			Token:            token,
			Title:            title,
			Body:             body,
			Data:             req.Data,
			Badge:            req.Badge,
			Sound:            req.Sound,
			AndroidChannelID: req.AndroidChannelID,
		}
		if deviceMap[token] == models.PlatformAPNS {
			apnsPayloads = append(apnsPayloads, payload)
		} else {
			fcmPayloads = append(fcmPayloads, payload)
		}
	}

	results := []providers.PushResult{}
	if h.fcm != nil && len(fcmPayloads) > 0 {
		res, err := h.fcm.SendPush(c.Request.Context(), fcmPayloads)
		if err != nil {
			respondError(c, http.StatusBadGateway, "PROVIDER_ERROR", err.Error())
			return
		}
		results = append(results, res...)
	}
	if h.apns != nil && len(apnsPayloads) > 0 {
		res, err := h.apns.SendPush(c.Request.Context(), apnsPayloads)
		if err != nil {
			respondError(c, http.StatusBadGateway, "PROVIDER_ERROR", err.Error())
			return
		}
		results = append(results, res...)
	}

	invalidTokens := []string{}
	sent := 0
	failed := 0
	for _, result := range results {
		now := time.Now()
		providerName := "fcm"
		if deviceMap[result.Token] == models.PlatformAPNS {
			providerName = "apns"
		}
		status := models.StatusSent
		if !result.Success {
			status = models.StatusFailed
			failed++
		} else {
			sent++
		}
		if result.InvalidToken {
			invalidTokens = append(invalidTokens, result.Token)
		}
		var errorMessage *string
		if result.Error != "" {
			errorMessage = &result.Error
		}
		providerMessageID := result.MessageID
		provider := providerName
		payload, _ := json.Marshal(req.Data)
		_ = h.notifications.Create(c.Request.Context(), &models.Notification{
			UserID:            userID,
			Channel:           models.ChannelPush,
			Recipient:         result.Token,
			Subject:           &title,
			Body:              body,
			Data:              payload,
			TemplateID:        templateID,
			Provider:          &provider,
			ProviderMessageID: &providerMessageID,
			Status:            status,
			ErrorMessage:      errorMessage,
			SentAt:            &now,
		})
	}
	_ = h.devices.DeactivateInvalid(c.Request.Context(), invalidTokens)

	respondOK(c, gin.H{
		"sent":           sent,
		"failed":         failed,
		"invalid_tokens": invalidTokens,
	})
}

func (h *PushHandler) Register(c *gin.Context) {
	var req models.RegisterDeviceRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondError(c, http.StatusBadRequest, "BAD_REQUEST", err.Error())
		return
	}
	userIDValue, _ := c.Get("user_id")
	userID, err := uuid.Parse(userIDValue.(string))
	if err != nil {
		respondError(c, http.StatusUnauthorized, "UNAUTHORIZED", "invalid user context")
		return
	}
	device, err := h.devices.Upsert(c.Request.Context(), userID, &req)
	if err != nil {
		respondError(c, http.StatusInternalServerError, "INTERNAL_ERROR", err.Error())
		return
	}
	respondOK(c, gin.H{"token_id": device.ID.String()})
}

func (h *PushHandler) Deactivate(c *gin.Context) {
	userIDValue, _ := c.Get("user_id")
	userID, _ := uuid.Parse(userIDValue.(string))
	if err := h.devices.Deactivate(c.Request.Context(), c.Param("token"), &userID); err != nil {
		respondError(c, http.StatusInternalServerError, "INTERNAL_ERROR", err.Error())
		return
	}
	respondOK(c, gin.H{"deactivated": true})
}

func (h *PushHandler) ListTokens(c *gin.Context) {
	userID := c.Query("user_id")
	devices, err := h.devices.ListByUserString(c.Request.Context(), userID)
	if err != nil {
		respondError(c, http.StatusBadRequest, "BAD_REQUEST", err.Error())
		return
	}
	respondOK(c, devices)
}
