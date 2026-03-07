package handlers

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/indusbase/indus-secrets/internal/crypto"
	"github.com/indusbase/indus-secrets/internal/metrics"
	"github.com/indusbase/indus-secrets/internal/models"
	"github.com/indusbase/indus-secrets/internal/repository"
)

type SecretsHandler struct {
	repo           *repository.SecretRepository
	encryptionKey  string
	internalSecret string
	auditURL       string
	httpClient     *http.Client
}

func NewSecretsHandler(repo *repository.SecretRepository, encryptionKey, internalSecret, auditURL string) *SecretsHandler {
	return &SecretsHandler{
		repo:           repo,
		encryptionKey:  encryptionKey,
		internalSecret: internalSecret,
		auditURL:       strings.TrimSuffix(auditURL, "/"),
		httpClient:     &http.Client{Timeout: 5 * time.Second},
	}
}

func (h *SecretsHandler) Create(c *gin.Context) {
	var req struct {
		Name           string  `json:"name" binding:"required"`
		Value          string  `json:"value" binding:"required"`
		Scope          string  `json:"scope" binding:"required"`
		OrganizationID *string `json:"organization_id"`
		ProjectID      *string `json:"project_id"`
		FunctionID     *string `json:"function_id"`
		Description    *string `json:"description"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"data": nil, "error": gin.H{"code": "BAD_REQUEST", "message": err.Error()}})
		return
	}
	encrypted, err := crypto.Encrypt(req.Value, h.encryptionKey)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"data": nil, "error": gin.H{"code": "ENCRYPT_FAILED", "message": err.Error()}})
		metrics.SecretOpsTotal.WithLabelValues("create", req.Scope, "error").Inc()
		return
	}
	secret := &models.Secret{
		Name:           req.Name,
		Scope:          req.Scope,
		OrganizationID: req.OrganizationID,
		ProjectID:      req.ProjectID,
		FunctionID:     req.FunctionID,
		ActiveVersion:  1,
		Description:    req.Description,
	}
	actor := c.GetString("email")
	if actor == "" {
		actor = "system"
	}
	if err := h.repo.CreateSecret(c.Request.Context(), secret, encrypted, actor); err != nil {
		c.JSON(http.StatusConflict, gin.H{"data": nil, "error": gin.H{"code": "SECRET_CREATE_FAILED", "message": err.Error()}})
		metrics.SecretOpsTotal.WithLabelValues("create", req.Scope, "error").Inc()
		return
	}
	metrics.SecretOpsTotal.WithLabelValues("create", req.Scope, "ok").Inc()
	h.emitAudit(c.Request.Context(), map[string]interface{}{
		"actor_type":    "user",
		"actor_email":   actor,
		"action":        "create_secret",
		"resource_type": "secret",
		"resource_id":   secret.Name,
		"severity":      "info",
		"metadata": map[string]interface{}{
			"scope": secret.Scope,
		},
	})
	c.JSON(http.StatusCreated, gin.H{"data": gin.H{
		"id":             secret.ID,
		"name":           secret.Name,
		"scope":          secret.Scope,
		"active_version": secret.ActiveVersion,
		"created_at":     secret.CreatedAt,
	}, "error": nil})
}

func (h *SecretsHandler) List(c *gin.Context) {
	scope := c.Query("scope")
	projectID := c.Query("project_id")
	items, err := h.repo.ListSecrets(c.Request.Context(), scope, projectID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"data": nil, "error": gin.H{"code": "SECRETS_LIST_FAILED", "message": err.Error()}})
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": items, "error": nil})
}

func (h *SecretsHandler) Get(c *gin.Context) {
	item, err := h.repo.GetSecret(c.Request.Context(), c.Param("name"))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"data": nil, "error": gin.H{"code": "SECRET_GET_FAILED", "message": err.Error()}})
		return
	}
	if item == nil {
		c.JSON(http.StatusNotFound, gin.H{"data": nil, "error": gin.H{"code": "NOT_FOUND", "message": "secret not found"}})
		return
	}
	version, err := h.repo.ActiveVersion(c.Request.Context(), item.ID, item.ActiveVersion)
	if err != nil || version == nil {
		c.JSON(http.StatusInternalServerError, gin.H{"data": nil, "error": gin.H{"code": "VERSION_LOOKUP_FAILED", "message": "active version missing"}})
		return
	}
	metrics.SecretOpsTotal.WithLabelValues("get", item.Scope, "ok").Inc()
	h.emitAudit(c.Request.Context(), map[string]interface{}{
		"actor_type":    "user",
		"actor_email":   c.GetString("email"),
		"action":        "read_secret_metadata",
		"resource_type": "secret",
		"resource_id":   item.Name,
		"severity":      "info",
	})
	c.JSON(http.StatusOK, gin.H{"data": gin.H{
		"id":             item.ID,
		"name":           item.Name,
		"scope":          item.Scope,
		"active_version": item.ActiveVersion,
		"value_preview":  "****",
		"updated_at":     item.UpdatedAt,
	}, "error": nil})
}

func (h *SecretsHandler) InternalFetch(c *gin.Context) {
	if c.GetHeader("X-IndusBase-Internal") != h.internalSecret {
		c.JSON(http.StatusForbidden, gin.H{"data": nil, "error": gin.H{"code": "FORBIDDEN", "message": "internal access only"}})
		return
	}
	var req struct {
		Name           string  `json:"name" binding:"required"`
		ProjectID      *string `json:"project_id"`
		FunctionID     *string `json:"function_id"`
		OrganizationID *string `json:"organization_id"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"data": nil, "error": gin.H{"code": "BAD_REQUEST", "message": err.Error()}})
		return
	}
	secret, err := h.repo.GetSecretForContext(c.Request.Context(), req.Name, req.ProjectID, req.FunctionID, req.OrganizationID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"data": nil, "error": gin.H{"code": "SECRET_FETCH_FAILED", "message": err.Error()}})
		return
	}
	if secret == nil {
		// Backward-compatible fallback for older callers that only persisted global names.
		secret, err = h.repo.GetSecret(c.Request.Context(), req.Name)
	}
	if err != nil || secret == nil {
		c.JSON(http.StatusNotFound, gin.H{"data": nil, "error": gin.H{"code": "NOT_FOUND", "message": "secret not found"}})
		return
	}
	version, err := h.repo.ActiveVersion(c.Request.Context(), secret.ID, secret.ActiveVersion)
	if err != nil || version == nil {
		c.JSON(http.StatusInternalServerError, gin.H{"data": nil, "error": gin.H{"code": "VERSION_LOOKUP_FAILED", "message": "active version missing"}})
		return
	}
	plain, err := crypto.Decrypt(version.EncryptedValue, h.encryptionKey)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"data": nil, "error": gin.H{"code": "DECRYPT_FAILED", "message": err.Error()}})
		metrics.SecretOpsTotal.WithLabelValues("fetch", secret.Scope, "error").Inc()
		return
	}
	metrics.SecretOpsTotal.WithLabelValues("fetch", secret.Scope, "ok").Inc()
	h.emitAudit(c.Request.Context(), map[string]interface{}{
		"actor_type":    "service",
		"action":        "fetch_secret",
		"resource_type": "secret",
		"resource_id":   secret.Name,
		"severity":      "info",
	})
	c.JSON(http.StatusOK, gin.H{"data": gin.H{
		"name":    secret.Name,
		"value":   plain,
		"version": secret.ActiveVersion,
		"scope":   secret.Scope,
	}, "error": nil})
}

func (h *SecretsHandler) emitAudit(ctx context.Context, payload map[string]interface{}) {
	if h.auditURL == "" || h.internalSecret == "" {
		return
	}
	raw, err := json.Marshal(payload)
	if err != nil {
		return
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, h.auditURL+"/audit/internal/events", bytes.NewReader(raw))
	if err != nil {
		return
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-IndusBase-Internal", h.internalSecret)
	resp, err := h.httpClient.Do(req)
	if err != nil {
		return
	}
	_ = resp.Body.Close()
}
