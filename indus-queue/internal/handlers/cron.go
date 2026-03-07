package handlers

import (
	"net/http"

	"github.com/indusbase/indus-queue/internal/models"
	"github.com/indusbase/indus-queue/internal/repository"
)

// CronHandler handles cron-related HTTP requests
type CronHandler struct {
	cronRepo *repository.CronRepository
	jobRepo  *repository.JobRepository
}

// NewCronHandler creates a new cron handler
func NewCronHandler(cronRepo *repository.CronRepository, jobRepo *repository.JobRepository) *CronHandler {
	return &CronHandler{cronRepo: cronRepo, jobRepo: jobRepo}
}

// Create handles POST /queue/cron
func (h *CronHandler) Create(w http.ResponseWriter, r *http.Request) {
	var req models.CreateCronRequest
	if err := ParseJSON(r, &req); err != nil {
		Error(w, http.StatusBadRequest, "invalid request body")
		return
	}

	// Validate required fields
	if req.Name == "" || req.CronExpression == "" {
		Error(w, http.StatusBadRequest, "name and cron_expression are required")
		return
	}

	// Set default timezone if not provided
	if req.Timezone == "" {
		req.Timezone = "Asia/Kolkata"
	}

	schedule, err := h.cronRepo.Create(r.Context(), req)
	if err != nil {
		Error(w, http.StatusInternalServerError, err.Error())
		return
	}

	JSON(w, http.StatusCreated, schedule)
}

// List handles GET /queue/cron
func (h *CronHandler) List(w http.ResponseWriter, r *http.Request) {
	schedules, err := h.cronRepo.List(r.Context())
	if err != nil {
		Error(w, http.StatusInternalServerError, err.Error())
		return
	}

	JSON(w, http.StatusOK, schedules)
}

// Update handles PATCH /queue/cron/:id
func (h *CronHandler) Update(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	if id == "" {
		Error(w, http.StatusBadRequest, "cron id is required")
		return
	}

	var req models.UpdateCronRequest
	if err := ParseJSON(r, &req); err != nil {
		Error(w, http.StatusBadRequest, "invalid request body")
		return
	}

	schedule, err := h.cronRepo.Update(r.Context(), id, req)
	if err != nil {
		Error(w, http.StatusInternalServerError, err.Error())
		return
	}

	JSON(w, http.StatusOK, schedule)
}

// Delete handles DELETE /queue/cron/:id
func (h *CronHandler) Delete(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	if id == "" {
		Error(w, http.StatusBadRequest, "cron id is required")
		return
	}

	if err := h.cronRepo.Delete(r.Context(), id); err != nil {
		Error(w, http.StatusInternalServerError, err.Error())
		return
	}

	JSON(w, http.StatusOK, map[string]string{"message": "cron schedule deleted"})
}

// RunNow handles POST /queue/cron/:id/run-now
func (h *CronHandler) RunNow(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	if id == "" {
		Error(w, http.StatusBadRequest, "cron id is required")
		return
	}

	schedule, err := h.cronRepo.Get(r.Context(), id)
	if err != nil {
		Error(w, http.StatusNotFound, "cron schedule not found")
		return
	}

	// Parse job payload
	var jobPayload models.JobPayload
	if err := ParseJSON(r, &schedule.JobPayload); err != nil {
		Error(w, http.StatusInternalServerError, "invalid job payload in cron schedule")
		return
	}

	// Enqueue a job immediately
	enqueueReq := models.EnqueueRequest{
		QueueName: jobPayload.QueueName,
		Payload:   jobPayload.Payload,
		Priority:  jobPayload.Priority,
	}

	job, err := h.jobRepo.Enqueue(r.Context(), enqueueReq)
	if err != nil {
		Error(w, http.StatusInternalServerError, err.Error())
		return
	}

	JSON(w, http.StatusOK, map[string]interface{}{
		"message": "job enqueued successfully",
		"job":     job,
	})
}
