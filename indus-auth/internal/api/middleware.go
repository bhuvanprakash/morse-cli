package api

import (
	"crypto/rsa"
	"database/sql"
	"fmt"
	"strings"
	"sync"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/indusbase/indus-auth/internal/auth"
	"github.com/indusbase/indus-auth/internal/enterprise"
	"github.com/indusbase/indus-auth/internal/response"
)

type rateLimitWindow struct {
	count   int
	resetAt time.Time
}

var (
	rateLimitMu      sync.Mutex
	rateLimitWindows = make(map[string]rateLimitWindow)
)

// RequestIDMiddleware adds a request ID to each request
func RequestIDMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		requestID := c.GetHeader("X-Request-ID")
		if requestID == "" {
			requestID = uuid.New().String()
		}
		c.Set("request_id", requestID)
		c.Header("X-Request-ID", requestID)
		c.Next()
	}
}

// LoggerMiddleware logs requests
func LoggerMiddleware() gin.HandlerFunc {
	return gin.LoggerWithFormatter(func(param gin.LogFormatterParams) string {
		return fmt.Sprintf("%s - [%s] \"%s %s %s %d %s \"%s\" %s\"\n",
			param.ClientIP,
			param.TimeStamp.Format(time.RFC1123),
			param.Method,
			param.Path,
			param.Request.Proto,
			param.StatusCode,
			param.Latency,
			param.Request.UserAgent(),
			param.ErrorMessage,
		)
	})
}

// CORSMiddleware handles CORS
func CORSMiddleware(allowedOrigins []string) gin.HandlerFunc {
	return func(c *gin.Context) {
		origin := c.Request.Header.Get("Origin")

		// Check if origin is allowed
		allowed := false
		for _, o := range allowedOrigins {
			if o == "*" || o == origin {
				allowed = true
				break
			}
		}

		if allowed {
			c.Writer.Header().Set("Access-Control-Allow-Origin", origin)
		}

		c.Writer.Header().Set("Access-Control-Allow-Credentials", "true")
		c.Writer.Header().Set("Access-Control-Allow-Headers", "Content-Type, Content-Length, Accept-Encoding, X-CSRF-Token, Authorization, accept, origin, Cache-Control, X-Requested-With, X-Request-ID")
		c.Writer.Header().Set("Access-Control-Allow-Methods", "POST, OPTIONS, GET, PUT, PATCH, DELETE")

		if c.Request.Method == "OPTIONS" {
			c.AbortWithStatus(204)
			return
		}

		c.Next()
	}
}

// RecoveryMiddleware recovers from panics
func RecoveryMiddleware() gin.HandlerFunc {
	return gin.Recovery()
}

// AuthMiddleware creates an authentication middleware
func AuthMiddleware(publicKey *rsa.PublicKey) gin.HandlerFunc {
	return func(c *gin.Context) {
		authHeader := c.GetHeader("Authorization")
		if authHeader == "" {
			c.Set("authenticated", false)
			c.Next()
			return
		}

		// Extract bearer token
		parts := strings.SplitN(authHeader, " ", 2)
		if len(parts) != 2 || strings.ToLower(parts[0]) != "bearer" {
			c.Set("authenticated", false)
			c.Next()
			return
		}

		tokenString := parts[1]

		// Validate token
		claims, err := auth.ValidateToken(tokenString, publicKey)
		if err != nil {
			c.Set("authenticated", false)
			c.Next()
			return
		}

		// Set user info in context
		c.Set("authenticated", true)
		c.Set("user_id", claims.UserID)
		c.Set("email", claims.Email)
		c.Set("role", claims.Role)
		c.Set("claims", claims)

		c.Next()
	}
}

// RequireAuth ensures the user is authenticated
func RequireAuth() gin.HandlerFunc {
	return func(c *gin.Context) {
		authenticated, exists := c.Get("authenticated")
		if !exists || !authenticated.(bool) {
			response.Unauthorized(c, "Authentication required")
			c.Abort()
			return
		}
		c.Next()
	}
}

// RequireAdmin ensures the user is an admin
func RequireAdmin() gin.HandlerFunc {
	return func(c *gin.Context) {
		authenticated, exists := c.Get("authenticated")
		if !exists || !authenticated.(bool) {
			response.Unauthorized(c, "Authentication required")
			c.Abort()
			return
		}

		role, exists := c.Get("role")
		if !exists || role != "admin" {
			response.Forbidden(c, "Admin access required")
			c.Abort()
			return
		}

		c.Next()
	}
}

// InternalOnly ensures the request is from an internal service
func InternalOnly(internalSecret string) gin.HandlerFunc {
	return func(c *gin.Context) {
		secret := c.GetHeader("X-IndusBase-Internal")
		if secret == "" {
			secret = c.GetHeader("X-Internal-Secret")
		}
		if secret != internalSecret {
			response.Forbidden(c, "Internal access only")
			c.Abort()
			return
		}
		c.Next()
	}
}

// SCIMTokenAuth validates SCIM bearer tokens independent of regular JWT auth.
func SCIMTokenAuth(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		token, ok := enterprise.ParseBearerToken(c.GetHeader("Authorization"))
		if !ok {
			c.JSON(401, gin.H{
				"data":  nil,
				"error": gin.H{"code": "SCIM_UNAUTHORIZED", "message": "Missing SCIM bearer token"},
			})
			c.Abort()
			return
		}

		tokenCtx, err := enterprise.ValidateSCIMToken(c.Request.Context(), db, token)
		if err != nil {
			c.JSON(500, gin.H{
				"data":  nil,
				"error": gin.H{"code": "SCIM_AUTH_FAILED", "message": err.Error()},
			})
			c.Abort()
			return
		}
		if tokenCtx == nil {
			c.JSON(401, gin.H{
				"data":  nil,
				"error": gin.H{"code": "SCIM_UNAUTHORIZED", "message": "Invalid or expired SCIM token"},
			})
			c.Abort()
			return
		}

		c.Set("scim_token_id", tokenCtx.TokenID)
		c.Set("scim_connection_id", tokenCtx.ConnectionID)
		if tokenCtx.ProjectID != nil {
			c.Set("scim_project_id", *tokenCtx.ProjectID)
		}
		c.Next()
	}
}

// RateLimitMiddleware creates a rate limiting middleware
func RateLimitMiddleware(requests int, per time.Duration) gin.HandlerFunc {
	return func(c *gin.Context) {
		key := c.ClientIP() + ":" + c.FullPath()
		now := time.Now()

		rateLimitMu.Lock()
		window, ok := rateLimitWindows[key]
		if !ok || now.After(window.resetAt) {
			window = rateLimitWindow{
				count:   0,
				resetAt: now.Add(per),
			}
		}

		window.count++
		rateLimitWindows[key] = window
		remaining := requests - window.count
		retryAfter := int(time.Until(window.resetAt).Seconds())
		if retryAfter < 1 {
			retryAfter = 1
		}
		rateLimitMu.Unlock()

		c.Header("X-RateLimit-Limit", fmt.Sprintf("%d", requests))
		if remaining < 0 {
			remaining = 0
		}
		c.Header("X-RateLimit-Remaining", fmt.Sprintf("%d", remaining))
		c.Header("X-RateLimit-Reset", fmt.Sprintf("%d", window.resetAt.Unix()))

		if window.count > requests {
			c.Header("Retry-After", fmt.Sprintf("%d", retryAfter))
			response.Error(c, 429, "RATE_LIMITED", "Too many requests")
			c.Abort()
			return
		}

		c.Next()
	}
}

// SecurityHeadersMiddleware adds security headers
func SecurityHeadersMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		c.Header("X-Content-Type-Options", "nosniff")
		c.Header("X-Frame-Options", "DENY")
		c.Header("X-XSS-Protection", "1; mode=block")
		c.Header("Strict-Transport-Security", "max-age=31536000; includeSubDomains")
		c.Header("Content-Security-Policy", "default-src 'self'")
		c.Next()
	}
}
