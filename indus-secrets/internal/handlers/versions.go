package handlers

import (
	"net/http"

	"github.com/gin-gonic/gin"
)

func (h *SecretsHandler) Versions(c *gin.Context) {
	secret, err := h.repo.GetSecret(c.Request.Context(), c.Param("name"))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"data": nil, "error": gin.H{"code": "SECRET_LOOKUP_FAILED", "message": err.Error()}})
		return
	}
	if secret == nil {
		c.JSON(http.StatusNotFound, gin.H{"data": nil, "error": gin.H{"code": "NOT_FOUND", "message": "secret not found"}})
		return
	}
	items, err := h.repo.Versions(c.Request.Context(), secret.ID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"data": nil, "error": gin.H{"code": "VERSION_LIST_FAILED", "message": err.Error()}})
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": items, "error": nil})
}
