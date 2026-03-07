package handlers

import (
	"net/http"

	"github.com/indusbase/indus-queue/internal/models"
	"github.com/indusbase/indus-queue/internal/repository"
)

// QueueHandler handles queue-related HTTP requests
type QueueHandler struct {
	repo *repository.QueueRepository
}

// NewQueueHandler creates a new queue handler
func NewQueueHandler(repo *repository.QueueRepository) *QueueHandler {
	return &QueueHandler{repo: repo}
}

// Create handles POST /queue/queues
func (h *QueueHandler) Create(w http.ResponseWriter, r *http.Request) {
	var req models.CreateQueueRequest
	if err := ParseJSON(r, &req); err != nil {
		Error(w, http.StatusBadRequest, "invalid request body")
		return
	}

	// Validate required fields
	if req.Name == "" {
		Error(w, http.StatusBadRequest, "name is required")
		return
	}

	queue, err := h.repo.Create(r.Context(), req)
	if err != nil {
		Error(w, http.StatusInternalServerError, err.Error())
		return
	}

	JSON(w, http.StatusCreated, queue)
}

// List handles GET /queue/queues
func (h *QueueHandler) List(w http.ResponseWriter, r *http.Request) {
	queues, err := h.repo.List(r.Context())
	if err != nil {
		Error(w, http.StatusInternalServerError, err.Error())
		return
	}

	JSON(w, http.StatusOK, queues)
}

// Delete handles DELETE /queue/queues/:name
func (h *QueueHandler) Delete(w http.ResponseWriter, r *http.Request) {
	name := r.PathValue("name")
	if name == "" {
		Error(w, http.StatusBadRequest, "queue name is required")
		return
	}

	if err := h.repo.Delete(r.Context(), name); err != nil {
		Error(w, http.StatusInternalServerError, err.Error())
		return
	}

	JSON(w, http.StatusOK, map[string]string{"message": "queue deleted"})
}
