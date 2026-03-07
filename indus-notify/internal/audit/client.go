package audit

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"time"
)

type Client struct {
	baseURL    string
	secret     string
	httpClient *http.Client
}

func NewClient(baseURL, secret string) *Client {
	return &Client{
		baseURL: baseURL,
		secret:  secret,
		httpClient: &http.Client{
			Timeout: 5 * time.Second,
		},
	}
}

func (c *Client) Emit(ctx context.Context, event map[string]interface{}) {
	if c == nil || c.baseURL == "" || c.secret == "" {
		return
	}
	payload, _ := json.Marshal(event)
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, c.baseURL+"/audit/internal/events", bytes.NewReader(payload))
	if err != nil {
		return
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-IndusBase-Internal", c.secret)
	resp, err := c.httpClient.Do(req)
	if err != nil {
		return
	}
	_ = resp.Body.Close()
}
