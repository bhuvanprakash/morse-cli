package handlers

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/indusbase/indus-config/internal/repository"
)

type EnvironmentHandler struct {
	repo *repository.EnvironmentRepository
}

func NewEnvironmentHandler(repo *repository.EnvironmentRepository) *EnvironmentHandler {
	return &EnvironmentHandler{repo: repo}
}

func (h *EnvironmentHandler) List(c *gin.Context) {
	environments, err := h.repo.List(c.Request.Context())
	if err != nil {
		respondError(c, http.StatusInternalServerError, "INTERNAL_ERROR", err.Error())
		return
	}
	respondOK(c, environments)
}
