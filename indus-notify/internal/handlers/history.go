package handlers

import (
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
	"github.com/indusbase/indus-notify/internal/repository"
)

type HistoryHandler struct {
	repo *repository.NotificationRepository
}

func NewHistoryHandler(repo *repository.NotificationRepository) *HistoryHandler {
	return &HistoryHandler{repo: repo}
}

func (h *HistoryHandler) List(c *gin.Context) {
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "50"))
	offset, _ := strconv.Atoi(c.DefaultQuery("offset", "0"))
	items, err := h.repo.List(c.Request.Context(), repository.HistoryFilters{
		Channel: c.Query("channel"),
		Status:  c.Query("status"),
		UserID:  c.Query("user_id"),
		Limit:   limit,
		Offset:  offset,
	})
	if err != nil {
		respondError(c, http.StatusInternalServerError, "INTERNAL_ERROR", err.Error())
		return
	}
	respondOK(c, items)
}

func (h *HistoryHandler) Stats(c *gin.Context) {
	stats, err := h.repo.Stats(c.Request.Context())
	if err != nil {
		respondError(c, http.StatusInternalServerError, "INTERNAL_ERROR", err.Error())
		return
	}
	respondOK(c, stats)
}
