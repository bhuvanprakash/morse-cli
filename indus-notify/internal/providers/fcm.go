package providers

import (
	"context"

	firebase "firebase.google.com/go/v4"
	"firebase.google.com/go/v4/messaging"
	"google.golang.org/api/option"
)

type FCMProvider struct {
	client *messaging.Client
}

func NewFCMProvider(ctx context.Context, credentialsJSON []byte) (*FCMProvider, error) {
	app, err := firebase.NewApp(ctx, nil, option.WithCredentialsJSON(credentialsJSON))
	if err != nil {
		return nil, err
	}
	client, err := app.Messaging(ctx)
	if err != nil {
		return nil, err
	}
	return &FCMProvider{client: client}, nil
}

func (f *FCMProvider) SendPush(ctx context.Context, payloads []PushPayload) ([]PushResult, error) {
	results := make([]PushResult, len(payloads))
	if len(payloads) == 0 {
		return results, nil
	}

	messages := make([]*messaging.Message, len(payloads))
	for i, payload := range payloads {
		message := &messaging.Message{
			Token: payload.Token,
			Notification: &messaging.Notification{
				Title: payload.Title,
				Body:  payload.Body,
			},
			Data: payload.Data,
		}
		if payload.AndroidChannelID != "" || payload.Sound != "" {
			message.Android = &messaging.AndroidConfig{
				Notification: &messaging.AndroidNotification{
					ChannelID: payload.AndroidChannelID,
					Sound:     payload.Sound,
				},
			}
		}
		messages[i] = message
	}

	const batchSize = 500
	for start := 0; start < len(messages); start += batchSize {
		end := start + batchSize
		if end > len(messages) {
			end = len(messages)
		}
		response, err := f.client.SendEach(ctx, messages[start:end])
		if err != nil {
			return nil, err
		}
		for j, resp := range response.Responses {
			idx := start + j
			results[idx] = PushResult{
				Token:     payloads[idx].Token,
				Success:   resp.Success,
				MessageID: resp.MessageID,
			}
			if resp.Error != nil {
				results[idx].Error = resp.Error.Error()
				results[idx].InvalidToken = messaging.IsUnregistered(resp.Error)
			}
		}
	}
	return results, nil
}

func (f *FCMProvider) Name() string { return "fcm" }
