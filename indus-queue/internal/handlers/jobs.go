package handlers

import (
	"net/http"
	"strconv"

	"github.com/indusbase/indus-queue/internal/models"
	"github.com/indusbase/indus-queue/internal/repository"
)

// JobHandler handles job-related HTTP requests
type JobHandler struct {
	repo *repository.JobRepository
}

// NewJobHandler creates a new job handler
func NewJobHandler(repo *repository.JobRepository) *JobHandler {
	return &JobHandler{repo: repo}
}

// Enqueue handles POST /queue/jobs
func (h *JobHandler) Enqueue(w http.ResponseWriter, r *http.Request) {
	var req models.EnqueueRequest
	if err := ParseJSON(r, &req); err != nil {
		Error(w, http.StatusBadRequest, "invalid request body")
		return
	}

	// Validate required fields
	if req.QueueName == "" {
		Error(w, http.StatusBadRequest, "queue_name is required")
		return
	}

	job, err := h.repo.Enqueue(r.Context(), req)
	if err != nil {
		Error(w, http.StatusInternalServerError, err.Error())
		return
	}

	JSON(w, http.StatusCreated, job)
}

// EnqueueBatch handles POST /queue/jobs/batch
func (h *JobHandler) EnqueueBatch(w http.ResponseWriter, r *http.Request) {
	var req models.BatchEnqueueRequest
	if err := ParseJSON(r, &req); err != nil {
		Error(w, http.StatusBadRequest, "invalid request body")
		return
	}

	if len(req.Jobs) == 0 {
		Error(w, http.StatusBadRequest, "jobs array is required")
		return
	}

	jobs, err := h.repo.EnqueueBatch(r.Context(), req.Jobs)
	if err != nil {
		Error(w, http.StatusInternalServerError, err.Error())
		return
	}

	JSON(w, http.StatusCreated, jobs)
}

// List handles GET /queue/jobs
func (h *JobHandler) List(w http.ResponseWriter, r *http.Request) {
	queueName := r.URL.Query().Get("queue_name")
	status := models.JobStatus(r.URL.Query().Get("status"))
	limit, _ := strconv.Atoi(r.URL.Query().Get("limit"))
	offset, _ := strconv.Atoi(r.URL.Query().Get("offset"))

	if limit == 0 {
		limit = 50
	}

	jobs, err := h.repo.List(r.Context(), queueName, status, limit, offset)
	if err != nil {
		Error(w, http.StatusInternalServerError, err.Error())
		return
	}

	JSON(w, http.StatusOK, jobs)
}

// Ack handles POST /queue/jobs/:id/ack
func (h *JobHandler) Ack(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	if id == "" {
		Error(w, http.StatusBadRequest, "job id is required")
		return
	}

	job, err := h.repo.Ack(r.Context(), id)
	if err != nil {
		Error(w, http.StatusInternalServerError, err.Error())
		return
	}

	JSON(w, http.StatusOK, job)
}

// Fail handles POST /queue/jobs/:id/fail
func (h *JobHandler) Fail(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	if id == "" {
		Error(w, http.StatusBadRequest, "job id is required")
		return
	}

	var req models.FailRequest
	if err := ParseJSON(r, &req); err != nil {
		Error(w, http.StatusBadRequest, "invalid request body")
		return
	}

	job, err := h.repo.Fail(r.Context(), id, req.ErrorMessage)
	if err != nil {
		Error(w, http.StatusInternalServerError, err.Error())
		return
	}

	JSON(w, http.StatusOK, job)
}

// Delete handles DELETE /queue/jobs/:id
func (h *JobHandler) Delete(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	if id == "" {
		Error(w, http.StatusBadRequest, "job id is required")
		return
	}

	if err := h.repo.Delete(r.Context(), id); err != nil {
		Error(w, http.StatusInternalServerError, err.Error())
		return
	}

	JSON(w, http.StatusOK, map[string]string{"message": "job deleted"})
}
