package providers

import (
	"context"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"
	"time"
)

type TwilioProvider struct {
	accountSID string
	authToken  string
	fromNumber string
	httpClient *http.Client
}

func NewTwilioProvider(accountSID, authToken, fromNumber string) *TwilioProvider {
	return &TwilioProvider{
		accountSID: accountSID,
		authToken:  authToken,
		fromNumber: fromNumber,
		httpClient: &http.Client{Timeout: 10 * time.Second},
	}
}

func (t *TwilioProvider) SendSMS(ctx context.Context, to, body, _ string) (*SMSResult, error) {
	form := url.Values{
		"To":   {to},
		"From": {t.fromNumber},
		"Body": {body},
	}
	endpoint := fmt.Sprintf("https://api.twilio.com/2010-04-01/Accounts/%s/Messages.json", t.accountSID)
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, endpoint, strings.NewReader(form.Encode()))
	if err != nil {
		return nil, err
	}
	req.SetBasicAuth(t.accountSID, t.authToken)
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")

	resp, err := t.httpClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	payload, _ := io.ReadAll(resp.Body)
	if resp.StatusCode >= 400 {
		return &SMSResult{Success: false, Error: string(payload)}, nil
	}
	return &SMSResult{Success: true, MessageID: resp.Header.Get("X-Twilio-Request-Id")}, nil
}

func (t *TwilioProvider) SendWhatsApp(ctx context.Context, to, body string) (*SMSResult, error) {
	return t.SendSMS(ctx, "whatsapp:"+to, body, "")
}

func (t *TwilioProvider) Name() string { return "twilio" }
