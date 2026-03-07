package worker

import (
	"bytes"
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"time"

	"github.com/indusbase/indus-queue/internal/models"
	"github.com/indusbase/indus-queue/internal/repository"
)

// Executor executes jobs
type Executor struct {
	jobRepo      *repository.JobRepository
	webhookRepo  *repository.WebhookRepository
	httpClient   *http.Client
}

// NewExecutor creates a new executor
func NewExecutor(jobRepo *repository.JobRepository, webhookRepo *repository.WebhookRepository) *Executor {
	return &Executor{
		jobRepo:     jobRepo,
		webhookRepo: webhookRepo,
		httpClient: &http.Client{
			Timeout: 30 * time.Second,
		},
	}
}

// Execute executes a job
func (e *Executor) Execute(ctx context.Context, job *models.Job) error {
	// Parse job payload to determine job type
	var payload map[string]interface{}
	if err := json.Unmarshal(job.Payload, &payload); err != nil {
		return e.failJob(ctx, job, fmt.Sprintf("failed to parse payload: %v", err))
	}

	// Determine job type from payload
	jobType, ok := payload["type"].(string)
	if !ok {
		jobType = "default"
	}

	switch jobType {
	case "http_request":
		return e.executeHTTPRequest(ctx, job, payload)
	case "webhook":
		return e.executeWebhook(ctx, job, payload)
	default:
		return e.executeDefaultJob(ctx, job, payload)
	}
}

// executeHTTPRequest executes an HTTP request job
func (e *Executor) executeHTTPRequest(ctx context.Context, job *models.Job, payload map[string]interface{}) error {
	url, ok := payload["url"].(string)
	if !ok {
		return e.failJob(ctx, job, "missing url in payload")
	}

	method, _ := payload["method"].(string)
	if method == "" {
		method = "POST"
	}

	body, _ := json.Marshal(payload["body"])

	req, err := http.NewRequestWithContext(ctx, method, url, bytes.NewReader(body))
	if err != nil {
		return e.failJob(ctx, job, fmt.Sprintf("failed to create request: %v", err))
	}

	// Add headers
	if headers, ok := payload["headers"].(map[string]interface{}); ok {
		for k, v := range headers {
			req.Header.Add(k, fmt.Sprintf("%v", v))
		}
	}

	resp, err := e.httpClient.Do(req)
	if err != nil {
		return e.failJob(ctx, job, fmt.Sprintf("request failed: %v", err))
	}
	defer resp.Body.Close()

	bodyBytes, _ := io.ReadAll(resp.Body)

	if resp.StatusCode >= 200 && resp.StatusCode < 300 {
		// Success - acknowledge job
		_, err = e.jobRepo.Ack(ctx, job.ID)
		return err
	}

	return e.failJob(ctx, job, fmt.Sprintf("request failed with status %d: %s", resp.StatusCode, string(bodyBytes)))
}

// executeWebhook executes a webhook job
func (e *Executor) executeWebhook(ctx context.Context, job *models.Job, payload map[string]interface{}) error {
	var parsed struct {
		WebhookID string          `json:"webhook_id"`
		Event     string          `json:"event"`
		Table     string          `json:"table"`
		Record    json.RawMessage `json:"record"`
		OldRecord json.RawMessage `json:"old_record,omitempty"`
	}
	if err := json.Unmarshal(job.Payload, &parsed); err != nil {
		return e.failJob(ctx, job, fmt.Sprintf("invalid webhook job payload: %v", err))
	}
	if parsed.WebhookID == "" {
		return e.failJob(ctx, job, "invalid webhook job payload: missing webhook_id")
	}
	if e.webhookRepo == nil {
		return e.failJob(ctx, job, "webhook repository unavailable")
	}

	webhook, err := e.webhookRepo.GetByID(ctx, parsed.WebhookID)
	if err != nil {
		return e.failJob(ctx, job, fmt.Sprintf("webhook not found: %v", err))
	}
	if !webhook.Enabled {
		_, ackErr := e.jobRepo.Ack(ctx, job.ID)
		return ackErr
	}

	deliveryBody, _ := json.Marshal(map[string]interface{}{
		"webhook_id": webhook.ID,
		"event":      parsed.Event,
		"table":      parsed.Table,
		"record":     parsed.Record,
		"old_record": parsed.OldRecord,
		"timestamp":  time.Now().UTC().Format(time.RFC3339),
	})
	timestamp := time.Now().Unix()

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, webhook.URL, bytes.NewReader(deliveryBody))
	if err != nil {
		return e.failJob(ctx, job, fmt.Sprintf("failed to create webhook request: %v", err))
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-IndusBase-Delivery", job.ID)
	req.Header.Set("X-IndusBase-Timestamp", fmt.Sprintf("%d", timestamp))
	req.Header.Set("X-IndusBase-Webhook-ID", webhook.ID)
	var customHeaders map[string]string
	if len(webhook.Headers) > 0 {
		_ = json.Unmarshal(webhook.Headers, &customHeaders)
		for key, value := range customHeaders {
			req.Header.Set(key, value)
		}
	}
	if webhook.Secret != "" {
		req.Header.Set("X-IndusBase-Signature", generateSignature(webhook.Secret, deliveryBody, timestamp))
	}

	resp, err := e.httpClient.Do(req)
	if err != nil {
		return e.failJob(ctx, job, fmt.Sprintf("webhook delivery failed (network): %v", err))
	}
	defer resp.Body.Close()

	_ = e.webhookRepo.RecordDelivery(context.Background(), webhook.ID, resp.StatusCode)

	if resp.StatusCode >= 400 && resp.StatusCode < 500 && resp.StatusCode != 429 {
		responseBody, _ := io.ReadAll(resp.Body)
		return e.failJob(ctx, job, fmt.Sprintf("webhook rejected with %d: %s (non-retryable)", resp.StatusCode, string(responseBody)))
	}
	if resp.StatusCode >= 500 || resp.StatusCode == 429 {
		responseBody, _ := io.ReadAll(resp.Body)
		return e.failJob(ctx, job, fmt.Sprintf("webhook server error %d: %s", resp.StatusCode, string(responseBody)))
	}

	_, err = e.jobRepo.Ack(ctx, job.ID)
	return err
}

// executeDefaultJob executes a default job
func (e *Executor) executeDefaultJob(ctx context.Context, job *models.Job, payload map[string]interface{}) error {
	// For default jobs, we just log and acknowledge
	log.Printf("Executing default job %s with payload: %+v", job.ID, payload)

	_, err := e.jobRepo.Ack(ctx, job.ID)
	return err
}

// failJob marks a job as failed
func (e *Executor) failJob(ctx context.Context, job *models.Job, errorMsg string) error {
	log.Printf("Job %s failed: %s", job.ID, errorMsg)
	_, err := e.jobRepo.Fail(ctx, job.ID, errorMsg)
	return err
}

func generateSignature(secret string, body []byte, timestamp int64) string {
	mac := hmac.New(sha256.New, []byte(secret))
	mac.Write([]byte(fmt.Sprintf("%d.", timestamp)))
	mac.Write(body)
	return "sha256=" + hex.EncodeToString(mac.Sum(nil))
}
