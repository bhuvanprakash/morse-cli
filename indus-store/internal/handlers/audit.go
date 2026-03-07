package handlers

import (
	"bytes"
	"encoding/json"
	"net/http"
	"os"
	"strings"
	"sync"
	"time"

	"github.com/gin-gonic/gin"
)

var (
	auditInit   sync.Once
	auditURL    string
	auditSecret string
	auditHTTP   *http.Client
)

func initAudit() {
	auditURL = strings.TrimSuffix(os.Getenv("AUDIT_SERVICE_URL"), "/")
	auditSecret = os.Getenv("INTERNAL_SECRET")
	auditHTTP = &http.Client{Timeout: 5 * time.Second}
}

func emitAudit(c *gin.Context, payload map[string]interface{}) {
	auditInit.Do(initAudit)
	if auditURL == "" || auditSecret == "" {
		return
	}
	if _, ok := payload["actor_user_id"]; !ok {
		if userID, exists := c.Get("user_id"); exists {
			payload["actor_user_id"] = userID
		}
	}
	if _, ok := payload["actor_email"]; !ok {
		if email, exists := c.Get("email"); exists {
			payload["actor_email"] = email
		}
	}
	payload["actor_type"] = "user"
	payload["ip_address"] = c.ClientIP()
	payload["user_agent"] = c.GetHeader("User-Agent")
	body, _ := json.Marshal(payload)
	req, err := http.NewRequestWithContext(c.Request.Context(), http.MethodPost, auditURL+"/audit/internal/events", bytes.NewReader(body))
	if err != nil {
		return
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-IndusBase-Internal", auditSecret)
	resp, err := auditHTTP.Do(req)
	if err != nil {
		return
	}
	_ = resp.Body.Close()
}
