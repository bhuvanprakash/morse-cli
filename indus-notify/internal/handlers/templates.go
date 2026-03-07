package handlers

import (
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/indusbase/indus-notify/internal/audit"
	"github.com/indusbase/indus-notify/internal/models"
	"github.com/indusbase/indus-notify/internal/repository"
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

func respondCreated(c *gin.Context, data interface{}) {
	respondJSON(c, http.StatusCreated, data)
}

func respondOK(c *gin.Context, data interface{}) {
	respondJSON(c, http.StatusOK, data)
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

type TemplateHandler struct {
	repo  *repository.TemplateRepository
	audit *audit.Client
}

func NewTemplateHandler(repo *repository.TemplateRepository, auditClient *audit.Client) *TemplateHandler {
	return &TemplateHandler{repo: repo, audit: auditClient}
}

func (h *TemplateHandler) Create(c *gin.Context) {
	var req models.TemplateCreateRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondError(c, http.StatusBadRequest, "BAD_REQUEST", err.Error())
		return
	}
	template := &models.Template{
		Name:                 req.Name,
		Channel:              req.Channel,
		Subject:              req.Subject,
		Body:                 req.Body,
		WhatsAppTemplateName: req.WhatsAppTemplateName,
		Variables:            req.Variables,
		IsActive:             true,
	}
	if userIDValue, ok := c.Get("user_id"); ok {
		if parsed, err := uuid.Parse(userIDValue.(string)); err == nil {
			template.OwnerID = &parsed
		}
	}
	created, err := h.repo.Create(c.Request.Context(), template)
	if err != nil {
		respondError(c, http.StatusConflict, "CONFLICT", err.Error())
		return
	}
	h.audit.Emit(c.Request.Context(), map[string]interface{}{
		"actor_type":    "user",
		"actor_user_id": c.GetString("user_id"),
		"actor_email":   c.GetString("email"),
		"action":        "create_notification_template",
		"resource_type": "notification_template",
		"resource_id":   created.Name,
		"severity":      "info",
	})
	respondCreated(c, created)
}

func (h *TemplateHandler) List(c *gin.Context) {
	templates, err := h.repo.List(c.Request.Context())
	if err != nil {
		respondError(c, http.StatusInternalServerError, "INTERNAL_ERROR", err.Error())
		return
	}
	respondOK(c, templates)
}

func (h *TemplateHandler) Get(c *gin.Context) {
	template, err := h.repo.GetByName(c.Request.Context(), c.Param("name"))
	if err != nil {
		respondError(c, http.StatusNotFound, "NOT_FOUND", "template not found")
		return
	}
	respondOK(c, template)
}

func (h *TemplateHandler) Update(c *gin.Context) {
	var req models.TemplateCreateRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondError(c, http.StatusBadRequest, "BAD_REQUEST", err.Error())
		return
	}
	template, err := h.repo.UpdateByName(c.Request.Context(), c.Param("name"), &req)
	if err != nil {
		respondError(c, http.StatusInternalServerError, "INTERNAL_ERROR", err.Error())
		return
	}
	h.audit.Emit(c.Request.Context(), map[string]interface{}{
		"actor_type":    "user",
		"actor_user_id": c.GetString("user_id"),
		"actor_email":   c.GetString("email"),
		"action":        "update_notification_template",
		"resource_type": "notification_template",
		"resource_id":   template.Name,
		"severity":      "info",
	})
	respondOK(c, template)
}

func (h *TemplateHandler) Delete(c *gin.Context) {
	if err := h.repo.DeleteByName(c.Request.Context(), c.Param("name")); err != nil {
		respondError(c, http.StatusInternalServerError, "INTERNAL_ERROR", err.Error())
		return
	}
	h.audit.Emit(c.Request.Context(), map[string]interface{}{
		"actor_type":    "user",
		"actor_user_id": c.GetString("user_id"),
		"actor_email":   c.GetString("email"),
		"action":        "delete_notification_template",
		"resource_type": "notification_template",
		"resource_id":   c.Param("name"),
		"severity":      "warn",
	})
	respondOK(c, gin.H{"deleted": true})
}

func (h *TemplateHandler) Preview(c *gin.Context) {
	template, err := h.repo.GetByName(c.Request.Context(), c.Param("name"))
	if err != nil {
		respondError(c, http.StatusNotFound, "NOT_FOUND", "template not found")
		return
	}
	var req models.TemplatePreviewRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondError(c, http.StatusBadRequest, "BAD_REQUEST", err.Error())
		return
	}
	body, subject, missing := repository.RenderTemplate(template, req.Variables)
	if len(missing) > 0 {
		respondError(c, http.StatusUnprocessableEntity, "VALIDATION_ERROR", "missing template variables: "+strings.Join(missing, ", "))
		return
	}
	respondOK(c, gin.H{"subject": subject, "body": body})
}
