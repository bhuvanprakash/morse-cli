package api

import (
	"net/http"

	"github.com/gin-gonic/gin"
)

func InternalAuth(secret string) gin.HandlerFunc {
	return func(c *gin.Context) {
		token := c.GetHeader("X-IndusBase-Internal")
		if token != secret {
			c.JSON(http.StatusForbidden, gin.H{
				"data":  nil,
				"error": gin.H{"code": "FORBIDDEN", "message": "internal auth failed"},
			})
			c.Abort()
			return
		}
		c.Next()
	}
}
