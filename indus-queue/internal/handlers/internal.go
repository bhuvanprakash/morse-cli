package handlers

import (
	"encoding/json"
	"net/http"

	"github.com/indusbase/indus-queue/internal/models"
	"github.com/indusbase/indus-queue/internal/repository"
)

// InternalHandler handles internal service-to-service queue endpoints.
type InternalHandler struct {
	WebhookRepo *repository.WebhookRepository
	JobRepo     *repository.JobRepository
}

func NewInternalHandler(webhookRepo *repository.WebhookRepository, jobRepo *repository.JobRepository) *InternalHandler {
	return &InternalHandler{WebhookRepo: webhookRepo, JobRepo: jobRepo}
}

// HandleWALEvent handles POST /queue/internal/wal-event.
func (h *InternalHandler) HandleWALEvent(w http.ResponseWriter, r *http.Request) {
	var event struct {
		TableSchema string          `json:"table_schema"`
		TableName   string          `json:"table_name"`
		Event       string          `json:"event"`
		Record      json.RawMessage `json:"record"`
		OldRecord   json.RawMessage `json:"old_record"`
	}
	if err := ParseJSON(r, &event); err != nil {
		Error(w, http.StatusBadRequest, err.Error())
		return
	}

	ctx := r.Context()
	webhooks, err := h.WebhookRepo.FindMatchingWebhooks(ctx, event.TableSchema, event.TableName, event.Event)
	if err != nil {
		Error(w, http.StatusInternalServerError, err.Error())
		return
	}

	enqueued := 0
	for _, wh := range webhooks {
		payload, _ := json.Marshal(map[string]interface{}{
			"webhook_id": wh.ID,
			"event":      event.Event,
			"table":      event.TableSchema + "." + event.TableName,
			"record":     event.Record,
			"old_record": event.OldRecord,
			"type":       "webhook",
		})

		jobReq := models.EnqueueRequest{
			QueueName:  "webhooks",
			Payload:    payload,
			Priority:   0,
			MaxRetries: 3,
		}
		if _, err := h.JobRepo.Enqueue(ctx, jobReq); err == nil {
			enqueued++
		}
	}

	JSON(w, http.StatusAccepted, map[string]int{"enqueued": enqueued})
}
