package handlers

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/indusbase/indus-secrets/internal/crypto"
	"github.com/indusbase/indus-secrets/internal/metrics"
)

func (h *SecretsHandler) Rotate(c *gin.Context) {
	var req struct {
		Value string `json:"value" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"data": nil, "error": gin.H{"code": "BAD_REQUEST", "message": err.Error()}})
		return
	}
	secret, err := h.repo.GetSecret(c.Request.Context(), c.Param("name"))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"data": nil, "error": gin.H{"code": "SECRET_LOOKUP_FAILED", "message": err.Error()}})
		return
	}
	if secret == nil {
		c.JSON(http.StatusNotFound, gin.H{"data": nil, "error": gin.H{"code": "NOT_FOUND", "message": "secret not found"}})
		return
	}
	encrypted, err := crypto.Encrypt(req.Value, h.encryptionKey)
	if err != nil {
		metrics.SecretOpsTotal.WithLabelValues("rotate", secret.Scope, "error").Inc()
		c.JSON(http.StatusInternalServerError, gin.H{"data": nil, "error": gin.H{"code": "ENCRYPT_FAILED", "message": err.Error()}})
		return
	}
	nextVersion, err := h.repo.Rotate(c.Request.Context(), secret, encrypted, c.GetString("email"))
	if err != nil {
		metrics.SecretOpsTotal.WithLabelValues("rotate", secret.Scope, "error").Inc()
		c.JSON(http.StatusInternalServerError, gin.H{"data": nil, "error": gin.H{"code": "ROTATE_FAILED", "message": err.Error()}})
		return
	}
	metrics.SecretOpsTotal.WithLabelValues("rotate", secret.Scope, "ok").Inc()
	h.emitAudit(c.Request.Context(), map[string]interface{}{
		"actor_type":    "user",
		"actor_email":   c.GetString("email"),
		"action":        "rotate_secret",
		"resource_type": "secret",
		"resource_id":   secret.Name,
		"severity":      "warn",
		"metadata":      map[string]interface{}{"to_version": nextVersion},
	})
	c.JSON(http.StatusOK, gin.H{"data": gin.H{"name": secret.Name, "active_version": nextVersion}, "error": nil})
}

func (h *SecretsHandler) Rollback(c *gin.Context) {
	var req struct {
		Version int `json:"version" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"data": nil, "error": gin.H{"code": "BAD_REQUEST", "message": err.Error()}})
		return
	}
	secret, err := h.repo.GetSecret(c.Request.Context(), c.Param("name"))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"data": nil, "error": gin.H{"code": "SECRET_LOOKUP_FAILED", "message": err.Error()}})
		return
	}
	if secret == nil {
		c.JSON(http.StatusNotFound, gin.H{"data": nil, "error": gin.H{"code": "NOT_FOUND", "message": "secret not found"}})
		return
	}
	version, err := h.repo.GetVersion(c.Request.Context(), secret.ID, req.Version)
	if err != nil || version == nil {
		c.JSON(http.StatusUnprocessableEntity, gin.H{"data": nil, "error": gin.H{"code": "VERSION_NOT_FOUND", "message": "target version does not exist"}})
		return
	}
	if err := h.repo.Rollback(c.Request.Context(), secret, req.Version, c.GetString("email")); err != nil {
		metrics.SecretOpsTotal.WithLabelValues("rollback", secret.Scope, "error").Inc()
		c.JSON(http.StatusInternalServerError, gin.H{"data": nil, "error": gin.H{"code": "ROLLBACK_FAILED", "message": err.Error()}})
		return
	}
	metrics.SecretOpsTotal.WithLabelValues("rollback", secret.Scope, "ok").Inc()
	h.emitAudit(c.Request.Context(), map[string]interface{}{
		"actor_type":    "user",
		"actor_email":   c.GetString("email"),
		"action":        "rollback_secret",
		"resource_type": "secret",
		"resource_id":   secret.Name,
		"severity":      "warn",
		"metadata":      map[string]interface{}{"to_version": req.Version},
	})
	c.JSON(http.StatusOK, gin.H{"data": gin.H{"name": secret.Name, "active_version": req.Version}, "error": nil})
}
