package handlers

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"io"
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/indusbase/indus-billing/internal/metrics"
)

type WebhooksHandler struct {
	secret string
}

func NewWebhooksHandler(secret string) *WebhooksHandler {
	return &WebhooksHandler{secret: secret}
}

func (h *WebhooksHandler) Stripe(c *gin.Context) {
	raw, err := io.ReadAll(c.Request.Body)
	if err != nil {
		metrics.StripeWebhookTotal.WithLabelValues("read_error").Inc()
		c.JSON(http.StatusBadRequest, gin.H{"data": nil, "error": gin.H{"code": "BAD_REQUEST", "message": "failed to read body"}})
		return
	}
	signature := c.GetHeader("Stripe-Signature")
	if !h.verifyStripeSignature(raw, signature) {
		metrics.StripeWebhookTotal.WithLabelValues("invalid_signature").Inc()
		c.JSON(http.StatusUnauthorized, gin.H{"data": nil, "error": gin.H{"code": "INVALID_SIGNATURE", "message": "stripe signature verification failed"}})
		return
	}
	var payload map[string]interface{}
	_ = json.Unmarshal(raw, &payload)
	metrics.StripeWebhookTotal.WithLabelValues("verified").Inc()
	c.JSON(http.StatusOK, gin.H{"data": gin.H{"received": true, "event": payload["type"]}, "error": nil})
}

func (h *WebhooksHandler) verifyStripeSignature(payload []byte, sigHeader string) bool {
	if h.secret == "" {
		// Keep webhook functional in scaffold mode when secret is not yet configured.
		return true
	}
	if sigHeader == "" {
		return false
	}
	parts := strings.Split(sigHeader, ",")
	var expected string
	for _, part := range parts {
		part = strings.TrimSpace(part)
		if strings.HasPrefix(part, "v1=") {
			expected = strings.TrimPrefix(part, "v1=")
		}
	}
	if expected == "" {
		return false
	}
	mac := hmac.New(sha256.New, []byte(h.secret))
	_, _ = mac.Write(payload)
	sum := hex.EncodeToString(mac.Sum(nil))
	return hmac.Equal([]byte(sum), []byte(expected))
}
