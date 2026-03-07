package handlers

import (
	"database/sql"
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
	"github.com/indusbase/indus-audit/internal/metrics"
	"github.com/indusbase/indus-audit/internal/models"
	"github.com/indusbase/indus-audit/internal/repository"
)

type AuditHandler struct {
	repo *repository.AuditRepository
}

func NewAuditHandler(repo *repository.AuditRepository) *AuditHandler {
	return &AuditHandler{repo: repo}
}

func (h *AuditHandler) IngestInternal(c *gin.Context) {
	var req models.AuditEvent
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"data": nil, "error": gin.H{"code": "BAD_REQUEST", "message": err.Error()}})
		return
	}
	if req.Action == "" || req.ResourceType == "" || req.ResourceID == "" {
		c.JSON(http.StatusUnprocessableEntity, gin.H{"data": nil, "error": gin.H{"code": "VALIDATION_ERROR", "message": "action, resource_type and resource_id are required"}})
		return
	}
	if req.ActorType == "" {
		req.ActorType = "service"
	}
	if req.Severity == "" {
		req.Severity = "info"
	}
	if err := h.repo.Insert(c.Request.Context(), &req); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"data": nil, "error": gin.H{"code": "INSERT_FAILED", "message": err.Error()}})
		return
	}
	metrics.EventsIngestedTotal.WithLabelValues(req.Severity, req.ActorType, req.Action).Inc()
	c.JSON(http.StatusAccepted, gin.H{"data": req, "error": nil})
}

func (h *AuditHandler) List(c *gin.Context) {
	metrics.EventsQueryTotal.Inc()
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "100"))
	offset, _ := strconv.Atoi(c.DefaultQuery("offset", "0"))
	items, err := h.repo.List(c.Request.Context(), models.ListFilters{
		ProjectID:    c.Query("project_id"),
		Actor:        c.Query("actor"),
		Action:       c.Query("action"),
		ResourceType: c.Query("resource_type"),
		Severity:     c.Query("severity"),
		From:         c.Query("from"),
		To:           c.Query("to"),
		Limit:        limit,
		Offset:       offset,
	})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"data": nil, "error": gin.H{"code": "QUERY_FAILED", "message": err.Error()}})
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": items, "error": nil})
}

func (h *AuditHandler) Get(c *gin.Context) {
	metrics.EventsQueryTotal.Inc()
	item, err := h.repo.GetByID(c.Request.Context(), c.Param("id"))
	if err == sql.ErrNoRows {
		c.JSON(http.StatusNotFound, gin.H{"data": nil, "error": gin.H{"code": "NOT_FOUND", "message": "Audit event not found"}})
		return
	}
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"data": nil, "error": gin.H{"code": "QUERY_FAILED", "message": err.Error()}})
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": item, "error": nil})
}

func (h *AuditHandler) Summary(c *gin.Context) {
	metrics.EventsQueryTotal.Inc()
	data, err := h.repo.Summary(c.Request.Context())
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"data": nil, "error": gin.H{"code": "SUMMARY_FAILED", "message": err.Error()}})
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": data, "error": nil})
}
