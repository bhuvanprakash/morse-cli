package handlers

import (
	"log/slog"
	"net/http"

	"github.com/gin-gonic/gin"
)

type errorResponse struct {
	Code    string `json:"code"`
	Message string `json:"message"`
}

type envelope struct {
	Data  interface{}    `json:"data"`
	Error *errorResponse `json:"error"`
}

func respondJSON(c *gin.Context, status int, data interface{}) {
	c.JSON(status, envelope{Data: data, Error: nil})
}

func respondOK(c *gin.Context, data interface{}) {
	respondJSON(c, http.StatusOK, data)
}

func respondCreated(c *gin.Context, data interface{}) {
	respondJSON(c, http.StatusCreated, data)
}

func respondError(c *gin.Context, status int, code, message string) {
	c.JSON(status, envelope{
		Data: nil,
		Error: &errorResponse{
			Code:    code,
			Message: message,
		},
	})
}

type HealthHandler struct {
	logger *slog.Logger
}

func NewHealthHandler(logger *slog.Logger) *HealthHandler {
	return &HealthHandler{logger: logger}
}

func (h *HealthHandler) Health(c *gin.Context) {
	_ = h.logger
	respondOK(c, gin.H{"status": "ok"})
}
