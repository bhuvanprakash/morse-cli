package handlers

import (
	"encoding/json"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/indusbase/indus-status/internal/metrics"
	"github.com/indusbase/indus-status/internal/models"
	"github.com/indusbase/indus-status/internal/repository"
)

type IncidentsHandler struct {
	repo *repository.StatusRepository
}

func NewIncidentsHandler(repo *repository.StatusRepository) *IncidentsHandler {
	return &IncidentsHandler{repo: repo}
}

func (h *IncidentsHandler) List(c *gin.Context) {
	items, err := h.repo.ListIncidents(c.Request.Context(), false)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"data": nil, "error": gin.H{"code": "INCIDENT_LIST_FAILED", "message": err.Error()}})
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": items, "error": nil})
}

func (h *IncidentsHandler) Create(c *gin.Context) {
	var req struct {
		Title    string `json:"title" binding:"required"`
		Summary  string `json:"summary" binding:"required"`
		Severity string `json:"severity"`
		Impact   string `json:"impact"`
		Status   string `json:"status"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"data": nil, "error": gin.H{"code": "BAD_REQUEST", "message": err.Error()}})
		return
	}
	incident := &models.Incident{
		Title:     req.Title,
		Summary:   req.Summary,
		Severity:  defaultIfEmpty(req.Severity, "minor"),
		Impact:    nullable(req.Impact),
		Status:    defaultIfEmpty(req.Status, "investigating"),
		StartedAt: time.Now().UTC(),
	}
	if err := h.repo.CreateIncident(c.Request.Context(), incident); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"data": nil, "error": gin.H{"code": "INCIDENT_CREATE_FAILED", "message": err.Error()}})
		return
	}
	metrics.IncidentsTotal.WithLabelValues(incident.Status, incident.Severity).Inc()
	c.JSON(http.StatusCreated, gin.H{"data": incident, "error": nil})
}

func (h *IncidentsHandler) Update(c *gin.Context) {
	var req map[string]interface{}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"data": nil, "error": gin.H{"code": "BAD_REQUEST", "message": err.Error()}})
		return
	}
	if timeline, ok := req["timeline"]; ok {
		raw, _ := json.Marshal(timeline)
		req["timeline"] = raw
	}
	if err := h.repo.UpdateIncident(c.Request.Context(), c.Param("id"), req); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"data": nil, "error": gin.H{"code": "INCIDENT_UPDATE_FAILED", "message": err.Error()}})
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": gin.H{"updated": true, "id": c.Param("id")}, "error": nil})
}

func (h *IncidentsHandler) Resolve(c *gin.Context) {
	var req struct {
		Resolution string `json:"resolution"`
	}
	_ = c.ShouldBindJSON(&req)
	timeline, _ := json.Marshal([]map[string]interface{}{
		{"timestamp": time.Now().UTC().Format(time.RFC3339), "status": "resolved", "message": defaultIfEmpty(req.Resolution, "Resolved by operations team")},
	})
	if err := h.repo.ResolveIncident(c.Request.Context(), c.Param("id"), timeline); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"data": nil, "error": gin.H{"code": "INCIDENT_RESOLVE_FAILED", "message": err.Error()}})
		return
	}
	metrics.IncidentsTotal.WithLabelValues("resolved", "info").Inc()
	c.JSON(http.StatusOK, gin.H{"data": gin.H{"resolved": true, "id": c.Param("id")}, "error": nil})
}

func (h *IncidentsHandler) AlertmanagerWebhook(c *gin.Context) {
	var payload struct {
		Alerts []struct {
			Status      string            `json:"status"`
			Labels      map[string]string `json:"labels"`
			Annotations map[string]string `json:"annotations"`
			StartsAt    string            `json:"startsAt"`
		} `json:"alerts"`
	}
	if err := c.ShouldBindJSON(&payload); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"data": nil, "error": gin.H{"code": "BAD_REQUEST", "message": err.Error()}})
		return
	}
	created := 0
	for _, alert := range payload.Alerts {
		if alert.Status != "firing" {
			continue
		}
		sev := defaultIfEmpty(alert.Labels["severity"], "minor")
		title := defaultIfEmpty(alert.Annotations["summary"], alert.Labels["alertname"])
		summary := defaultIfEmpty(alert.Annotations["description"], "Alertmanager incident")
		incident := &models.Incident{
			Title:     title,
			Summary:   summary,
			Severity:  sev,
			Status:    "investigating",
			StartedAt: time.Now().UTC(),
		}
		if err := h.repo.CreateIncident(c.Request.Context(), incident); err == nil {
			created++
			metrics.IncidentsTotal.WithLabelValues("investigating", sev).Inc()
		}
	}
	c.JSON(http.StatusAccepted, gin.H{"data": gin.H{"created": created}, "error": nil})
}

func defaultIfEmpty(v, fallback string) string {
	if v == "" {
		return fallback
	}
	return v
}

func nullable(v string) *string {
	if v == "" {
		return nil
	}
	return &v
}
