package handlers

import (
	"bytes"
	"encoding/json"
	"net/http"

	"github.com/indusbase/indus-queue/internal/models"
	"github.com/indusbase/indus-queue/internal/repository"
)

// WebhookHandler handles webhook-related HTTP requests
type WebhookHandler struct {
	repo *repository.WebhookRepository
}

// NewWebhookHandler creates a new webhook handler
func NewWebhookHandler(repo *repository.WebhookRepository) *WebhookHandler {
	return &WebhookHandler{repo: repo}
}

// Create handles POST /queue/webhooks
func (h *WebhookHandler) Create(w http.ResponseWriter, r *http.Request) {
	var req models.CreateWebhookRequest
	if err := ParseJSON(r, &req); err != nil {
		Error(w, http.StatusBadRequest, "invalid request body")
		return
	}

	// Validate required fields
	if req.Name == "" || req.URL == "" || req.Event == "" {
		Error(w, http.StatusBadRequest, "name, url, and event are required")
		return
	}

	webhook, err := h.repo.Create(r.Context(), req)
	if err != nil {
		Error(w, http.StatusInternalServerError, err.Error())
		return
	}

	JSON(w, http.StatusCreated, webhook)
}

// List handles GET /queue/webhooks
func (h *WebhookHandler) List(w http.ResponseWriter, r *http.Request) {
	webhooks, err := h.repo.List(r.Context())
	if err != nil {
		Error(w, http.StatusInternalServerError, err.Error())
		return
	}

	JSON(w, http.StatusOK, webhooks)
}

// Update handles PATCH /queue/webhooks/:id
func (h *WebhookHandler) Update(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	if id == "" {
		Error(w, http.StatusBadRequest, "webhook id is required")
		return
	}

	var req models.UpdateWebhookRequest
	if err := ParseJSON(r, &req); err != nil {
		Error(w, http.StatusBadRequest, "invalid request body")
		return
	}

	webhook, err := h.repo.Update(r.Context(), id, req)
	if err != nil {
		Error(w, http.StatusInternalServerError, err.Error())
		return
	}

	JSON(w, http.StatusOK, webhook)
}

// Delete handles DELETE /queue/webhooks/:id
func (h *WebhookHandler) Delete(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	if id == "" {
		Error(w, http.StatusBadRequest, "webhook id is required")
		return
	}

	if err := h.repo.Delete(r.Context(), id); err != nil {
		Error(w, http.StatusInternalServerError, err.Error())
		return
	}

	JSON(w, http.StatusOK, map[string]string{"message": "webhook deleted"})
}

// Test handles POST /queue/webhooks/:id/test
func (h *WebhookHandler) Test(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	if id == "" {
		Error(w, http.StatusBadRequest, "webhook id is required")
		return
	}

	webhook, err := h.repo.Get(r.Context(), id)
	if err != nil {
		Error(w, http.StatusNotFound, "webhook not found")
		return
	}

	// Parse test payload or use default
	payload := map[string]interface{}{
		"event":   webhook.Event,
		"test":    true,
		"message": "This is a test webhook",
	}

	payloadBytes, _ := json.Marshal(payload)

	// Send test request
	resp, err := http.Post(webhook.URL, "application/json", bytes.NewReader(payloadBytes))
	if err != nil {
		Error(w, http.StatusInternalServerError, "failed to send test webhook: "+err.Error())
		return
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 200 && resp.StatusCode < 300 {
		JSON(w, http.StatusOK, map[string]string{"status": "success", "message": "test webhook sent successfully"})
	} else {
		Error(w, http.StatusBadRequest, "test webhook failed with status: "+resp.Status)
	}
}
