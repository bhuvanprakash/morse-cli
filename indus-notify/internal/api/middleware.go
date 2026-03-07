package api

import (
	"context"
	"encoding/json"
	"fmt"
	"log/slog"
	"net/http"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

type AuthClient struct {
	BaseURL        string
	InternalSecret string
	HTTPClient     *http.Client
}

type AuthUser struct {
	ID    string `json:"id"`
	Email string `json:"email"`
	Role  string `json:"role"`
}

func RequestIDMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		requestID := c.GetHeader("X-Request-ID")
		if requestID == "" {
			requestID = uuid.NewString()
		}
		c.Set("request_id", requestID)
		c.Header("X-Request-ID", requestID)
		c.Next()
	}
}

func LoggerMiddleware(logger *slog.Logger) gin.HandlerFunc {
	return func(c *gin.Context) {
		start := time.Now()
		c.Next()
		logger.Info("request_complete",
			slog.String("request_id", requestIDFromContext(c)),
			slog.String("method", c.Request.Method),
			slog.String("path", c.Request.URL.Path),
			slog.Int("status", c.Writer.Status()),
			slog.Duration("latency", time.Since(start)),
			slog.String("client_ip", c.ClientIP()),
		)
	}
}

func CORSMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		c.Header("Access-Control-Allow-Origin", "*")
		c.Header("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS")
		c.Header("Access-Control-Allow-Headers", "Authorization, Content-Type, X-Request-ID")
		if c.Request.Method == http.MethodOptions {
			c.AbortWithStatus(http.StatusNoContent)
			return
		}
		c.Next()
	}
}

func RequireAuth(authClient *AuthClient) gin.HandlerFunc {
	return func(c *gin.Context) {
		user, err := authClient.Validate(c.Request.Context(), c.GetHeader("Authorization"))
		if err != nil {
			Error(c, http.StatusUnauthorized, "UNAUTHORIZED", err.Error())
			c.Abort()
			return
		}
		c.Set("user", user)
		c.Set("user_id", user.ID)
		c.Set("role", user.Role)
		c.Next()
	}
}

func RequireAdmin() gin.HandlerFunc {
	return func(c *gin.Context) {
		role, _ := c.Get("role")
		if role != "admin" {
			Error(c, http.StatusForbidden, "FORBIDDEN", "admin access required")
			c.Abort()
			return
		}
		c.Next()
	}
}

func requestIDFromContext(c *gin.Context) string {
	if value, ok := c.Get("request_id"); ok {
		if requestID, ok := value.(string); ok {
			return requestID
		}
	}
	return ""
}

func NewAuthClient(baseURL, internalSecret string) *AuthClient {
	return &AuthClient{
		BaseURL:        strings.TrimRight(baseURL, "/"),
		InternalSecret: internalSecret,
		HTTPClient:     &http.Client{Timeout: 10 * time.Second},
	}
}

func (a *AuthClient) Validate(ctx context.Context, authHeader string) (*AuthUser, error) {
	if authHeader == "" {
		return nil, fmt.Errorf("missing bearer token")
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, a.BaseURL+"/auth/user", nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("Authorization", authHeader)
	req.Header.Set("X-IndusBase-Internal", a.InternalSecret)

	resp, err := a.HTTPClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	var payload struct {
		Data  *AuthUser       `json:"data"`
		Error *ErrorResponse  `json:"error"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&payload); err != nil {
		return nil, err
	}
	if resp.StatusCode >= 400 || payload.Data == nil {
		if payload.Error != nil {
			return nil, fmt.Errorf(payload.Error.Message)
		}
		return nil, fmt.Errorf("authentication failed")
	}
	return payload.Data, nil
}
