package handlers

import (
	"encoding/csv"
	"encoding/json"
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
	"github.com/indusbase/indus-audit/internal/metrics"
	"github.com/indusbase/indus-audit/internal/models"
	"github.com/indusbase/indus-audit/internal/repository"
)

type ExportHandler struct {
	repo *repository.AuditRepository
}

func NewExportHandler(repo *repository.AuditRepository) *ExportHandler {
	return &ExportHandler{repo: repo}
}

func (h *ExportHandler) Export(c *gin.Context) {
	format := c.DefaultQuery("format", "json")
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "1000"))
	items, err := h.repo.List(c.Request.Context(), models.ListFilters{
		ProjectID:    c.Query("project_id"),
		Actor:        c.Query("actor"),
		Action:       c.Query("action"),
		ResourceType: c.Query("resource_type"),
		Severity:     c.Query("severity"),
		From:         c.Query("from"),
		To:           c.Query("to"),
		Limit:        limit,
		Offset:       0,
	})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"data": nil, "error": gin.H{"code": "EXPORT_FAILED", "message": err.Error()}})
		return
	}

	switch format {
	case "csv":
		metrics.EventsExportTotal.WithLabelValues("csv").Inc()
		c.Header("Content-Type", "text/csv")
		c.Header("Content-Disposition", "attachment; filename=audit_events.csv")
		writer := csv.NewWriter(c.Writer)
		_ = writer.Write([]string{"id", "project_id", "actor_email", "actor_type", "action", "resource_type", "resource_id", "severity", "ip_address", "created_at", "metadata"})
		for _, item := range items {
			_ = writer.Write([]string{
				item.ID,
				deref(item.ProjectID),
				deref(item.ActorEmail),
				item.ActorType,
				item.Action,
				item.ResourceType,
				item.ResourceID,
				item.Severity,
				deref(item.IPAddress),
				item.CreatedAt.Format("2006-01-02T15:04:05Z07:00"),
				string(item.Metadata),
			})
		}
		writer.Flush()
		return
	default:
		metrics.EventsExportTotal.WithLabelValues("json").Inc()
		c.Header("Content-Type", "application/json")
		c.Header("Content-Disposition", "attachment; filename=audit_events.json")
		payload, _ := json.Marshal(gin.H{"data": items, "error": nil})
		_, _ = c.Writer.Write(payload)
	}
}

func deref(v *string) string {
	if v == nil {
		return ""
	}
	return *v
}
