package providers

import (
	"context"
	"encoding/base64"
	"fmt"

	"github.com/sendgrid/sendgrid-go"
	"github.com/sendgrid/sendgrid-go/helpers/mail"
)

type SendGridProvider struct {
	apiKey    string
	fromName  string
	fromEmail string
}

func NewSendGridProvider(apiKey, fromName, fromEmail string) *SendGridProvider {
	return &SendGridProvider{apiKey: apiKey, fromName: fromName, fromEmail: fromEmail}
}

func (s *SendGridProvider) SendEmail(ctx context.Context, req *EmailMessage) error {
	from := mail.NewEmail(s.fromName, s.fromEmail)
	message := mail.NewV3Mail()
	message.SetFrom(from)
	message.Subject = req.Subject

	personalization := mail.NewPersonalization()
	for _, to := range req.To {
		personalization.AddTos(mail.NewEmail("", to))
	}
	for _, cc := range req.CC {
		personalization.AddCCs(mail.NewEmail("", cc))
	}
	message.AddPersonalizations(personalization)

	if req.HTMLBody != "" {
		message.AddContent(mail.NewContent("text/html", req.HTMLBody))
	}
	if req.TextBody != "" {
		message.AddContent(mail.NewContent("text/plain", req.TextBody))
	}
	for _, attachment := range req.Attachments {
		a := mail.NewAttachment()
		a.SetContent(base64.StdEncoding.EncodeToString(attachment.Content))
		a.SetType(attachment.MimeType)
		a.SetFilename(attachment.Filename)
		message.AddAttachment(a)
	}

	client := sendgrid.NewSendClient(s.apiKey)
	resp, err := client.SendWithContext(ctx, message)
	if err != nil {
		return err
	}
	if resp.StatusCode >= 400 {
		return fmt.Errorf("sendgrid error %d: %s", resp.StatusCode, resp.Body)
	}
	return nil
}

func (s *SendGridProvider) Name() string { return "sendgrid" }
