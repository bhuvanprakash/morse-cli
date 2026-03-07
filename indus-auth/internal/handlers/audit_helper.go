package handlers

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"os"
	"strings"
	"sync"
	"time"

	"github.com/gin-gonic/gin"
)

var (
	auditInitOnce       sync.Once
	auditURL            string
	internalAuditSecret string
	auditHTTPClient     *http.Client
)

func initAuditClient() {
	auditURL = strings.TrimSuffix(os.Getenv("AUDIT_SERVICE_URL"), "/")
	internalAuditSecret = os.Getenv("INTERNAL_SECRET")
	auditHTTPClient = &http.Client{Timeout: 5 * time.Second}
}

func emitAudit(c *gin.Context, payload map[string]interface{}) {
	auditInitOnce.Do(initAuditClient)
	if auditURL == "" || internalAuditSecret == "" {
		return
	}
	if _, ok := payload["actor_user_id"]; !ok {
		if v, exists := c.Get("user_id"); exists {
			payload["actor_user_id"] = v
		}
	}
	if _, ok := payload["actor_email"]; !ok {
		if v, exists := c.Get("email"); exists {
			payload["actor_email"] = v
		}
	}
	if _, ok := payload["ip_address"]; !ok {
		payload["ip_address"] = c.ClientIP()
	}
	if _, ok := payload["user_agent"]; !ok {
		payload["user_agent"] = c.GetHeader("User-Agent")
	}
	if _, ok := payload["actor_type"]; !ok {
		payload["actor_type"] = "user"
	}
	if _, ok := payload["severity"]; !ok {
		payload["severity"] = "info"
	}
	emitAuditRaw(c.Request.Context(), payload)
}

func emitAuditRaw(ctx context.Context, payload map[string]interface{}) {
	auditInitOnce.Do(initAuditClient)
	if auditURL == "" || internalAuditSecret == "" {
		return
	}
	raw, err := json.Marshal(payload)
	if err != nil {
		return
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, auditURL+"/audit/internal/events", bytes.NewReader(raw))
	if err != nil {
		return
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-IndusBase-Internal", internalAuditSecret)
	resp, err := auditHTTPClient.Do(req)
	if err != nil {
		return
	}
	_ = resp.Body.Close()
}
