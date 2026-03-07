package providers

import "context"

type PushPayload struct {
	Token            string
	Title            string
	Body             string
	Data             map[string]string
	Badge            *int
	Sound            string
	AndroidChannelID string
}

type PushResult struct {
	Token        string
	Success      bool
	Error        string
	MessageID    string
	InvalidToken bool
}

type SMSResult struct {
	MessageID string
	Success   bool
	Error     string
}

type PushProvider interface {
	SendPush(ctx context.Context, payloads []PushPayload) ([]PushResult, error)
	Name() string
}

type SMSProvider interface {
	SendSMS(ctx context.Context, to, body, dltTemplateID string) (*SMSResult, error)
	Name() string
}

type EmailProvider interface {
	SendEmail(ctx context.Context, req *EmailMessage) error
	Name() string
}

type EmailMessage struct {
	From        string
	To          []string
	CC          []string
	Subject     string
	TextBody    string
	HTMLBody    string
	Attachments []Attachment
}

type Attachment struct {
	Filename string
	Content  []byte
	MimeType string
}
