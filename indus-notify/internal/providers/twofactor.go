package providers

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"
	"time"
)

const twoFactorBaseURL = "https://2factor.in/API/V1"

type TwoFactorProvider struct {
	apiKey     string
	senderID   string
	httpClient *http.Client
}

func NewTwoFactorProvider(apiKey, senderID string) *TwoFactorProvider {
	return &TwoFactorProvider{
		apiKey:     apiKey,
		senderID:   senderID,
		httpClient: &http.Client{Timeout: 10 * time.Second},
	}
}

func (t *TwoFactorProvider) SendSMS(ctx context.Context, to, body, dltTemplateID string) (*SMSResult, error) {
	apiURL := fmt.Sprintf("%s/%s/SMS/ADDSMS2", twoFactorBaseURL, t.apiKey)
	formData := url.Values{
		"To":         {to},
		"From":       {t.senderID},
		"Msg":        {body},
		"TemplateID": {dltTemplateID},
	}
	req, err := http.NewRequestWithContext(
		ctx,
		http.MethodPost,
		apiURL,
		strings.NewReader(formData.Encode()),
	)
	if err != nil {
		return nil, err
	}
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")

	resp, err := t.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("2factor.in request failed: %w", err)
	}
	defer resp.Body.Close()

	rawBody, _ := io.ReadAll(resp.Body)
	var result struct {
		Status  string `json:"Status"`
		Details string `json:"Details"`
	}
	if err := json.Unmarshal(rawBody, &result); err != nil {
		return nil, fmt.Errorf("failed to parse 2factor.in response: %w", err)
	}
	if result.Status != "Success" {
		return &SMSResult{Success: false, Error: result.Details}, nil
	}
	return &SMSResult{MessageID: result.Details, Success: true}, nil
}

func (t *TwoFactorProvider) Name() string { return "2factor" }
