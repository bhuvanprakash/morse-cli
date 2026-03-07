package api

import (
	"net/http"

	"github.com/gin-gonic/gin"
)

func internalAuth(secret string) gin.HandlerFunc {
	return func(c *gin.Context) {
		token := c.GetHeader("X-IndusBase-Internal")
		if token == "" {
			token = c.GetHeader("X-Internal-Secret")
		}
		if token == "" || token != secret {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{
				"data": nil,
				"error": gin.H{"code": "UNAUTHORIZED_INTERNAL", "message": "Invalid internal secret"},
			})
			return
		}
		c.Next()
	}
}
