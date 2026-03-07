package auth

import (
	"context"
	"crypto/rand"
	"encoding/base64"
	"fmt"
	"strings"
	"sync"
	"time"

	"github.com/indusbase/indus-auth/internal/db"
)

const (
	passkeyRegistrationPrefix = "passkey:registration:"
	passkeyAuthenticationKey  = "passkey:authentication"
	passkeyChallengeTTL       = 10 * time.Minute
)

var (
	passkeyStoreMu sync.RWMutex
	passkeyStore   = map[string][]*PasskeyCredential{}

	authChallengeMu sync.RWMutex
	authChallenge   = ""
)

// PasskeyRegistrationOptions represents options for passkey registration
type PasskeyRegistrationOptions struct {
	Challenge        string `json:"challenge"`
	RpID             string `json:"rpId"`
	RpName           string `json:"rpName"`
	UserID           string `json:"userId"`
	UserName         string `json:"userName"`
	UserDisplayName  string `json:"userDisplayName"`
	PubKeyCredParams []int  `json:"pubKeyCredParams"`
	Timeout          int    `json:"timeout"`
	Attestation      string `json:"attestation"`
}

// PasskeyAuthenticationOptions represents options for passkey authentication
type PasskeyAuthenticationOptions struct {
	Challenge string `json:"challenge"`
	RpID      string `json:"rpId"`
	Timeout   int    `json:"timeout"`
}

// GeneratePasskeyRegistrationChallenge generates a challenge for passkey registration.
func GeneratePasskeyRegistrationChallenge(ctx context.Context, redis *db.RedisClient, userID string) (*PasskeyRegistrationOptions, error) {
	challenge, err := generatePasskeyChallenge()
	if err != nil {
		return nil, err
	}

	if redis != nil {
		if err := redis.SetWithTTL(ctx, passkeyRegistrationPrefix+userID, challenge, passkeyChallengeTTL); err != nil {
			return nil, fmt.Errorf("failed to store passkey registration challenge: %w", err)
		}
	}

	return &PasskeyRegistrationOptions{
		Challenge:        challenge,
		RpID:             "localhost",
		RpName:           "IndusBase",
		UserID:           userID,
		UserName:         userID,
		UserDisplayName:  userID,
		PubKeyCredParams: []int{-7, -257},
		Timeout:          int(passkeyChallengeTTL.Milliseconds()),
		Attestation:      "none",
	}, nil
}

// VerifyPasskeyRegistration verifies a passkey registration response.
func VerifyPasskeyRegistration(ctx context.Context, redis *db.RedisClient, userID string, response interface{}) error {
	payload, err := normalizePasskeyPayload(response)
	if err != nil {
		return err
	}
	if payload.Challenge == "" {
		return fmt.Errorf("missing challenge")
	}
	if payload.ID == "" {
		return fmt.Errorf("missing credential id")
	}
	if payload.PublicKey == "" {
		return fmt.Errorf("missing public key")
	}

	if redis != nil {
		expected, err := redis.Get(ctx, passkeyRegistrationPrefix+userID)
		if err != nil {
			return fmt.Errorf("registration challenge not found: %w", err)
		}
		if expected != payload.Challenge {
			return fmt.Errorf("registration challenge mismatch")
		}
		_ = redis.Delete(ctx, passkeyRegistrationPrefix+userID)
	}

	return StorePasskeyCredential(ctx, nil, &PasskeyCredential{
		ID:         payload.ID,
		UserID:     userID,
		PublicKey:  []byte(payload.PublicKey),
		SignCount:  payload.SignCount,
		Transports: payload.Transports,
		CreatedAt:  time.Now().Unix(),
		LastUsedAt: time.Now().Unix(),
	})
}

// GeneratePasskeyAuthenticationChallenge generates a challenge for passkey authentication.
func GeneratePasskeyAuthenticationChallenge(ctx context.Context, redis *db.RedisClient) (*PasskeyAuthenticationOptions, error) {
	_ = ctx
	challenge, err := generatePasskeyChallenge()
	if err != nil {
		return nil, err
	}

	authChallengeMu.Lock()
	authChallenge = challenge
	authChallengeMu.Unlock()

	if redis != nil {
		if err := redis.SetWithTTL(context.Background(), passkeyAuthenticationKey, challenge, passkeyChallengeTTL); err != nil {
			return nil, fmt.Errorf("failed to store authentication challenge: %w", err)
		}
	}

	return &PasskeyAuthenticationOptions{
		Challenge: challenge,
		RpID:      "localhost",
		Timeout:   int(passkeyChallengeTTL.Milliseconds()),
	}, nil
}

// VerifyPasskeyAuthentication verifies a passkey authentication response and returns the user ID.
func VerifyPasskeyAuthentication(ctx context.Context, redis *db.RedisClient, response interface{}) (string, error) {
	payload, err := normalizePasskeyPayload(response)
	if err != nil {
		return "", err
	}
	if payload.UserID == "" {
		return "", fmt.Errorf("missing user id")
	}
	if payload.Challenge == "" {
		return "", fmt.Errorf("missing challenge")
	}

	expected := ""
	if redis != nil {
		expected, _ = redis.Get(ctx, passkeyAuthenticationKey)
	}
	if expected == "" {
		authChallengeMu.RLock()
		expected = authChallenge
		authChallengeMu.RUnlock()
	}
	if expected == "" || expected != payload.Challenge {
		return "", fmt.Errorf("authentication challenge mismatch")
	}

	credentials, err := GetPasskeyCredentials(ctx, nil, payload.UserID)
	if err != nil {
		return "", err
	}
	for _, credential := range credentials {
		if credential.ID == payload.ID {
			credential.LastUsedAt = time.Now().Unix()
			return payload.UserID, nil
		}
	}
	return "", fmt.Errorf("credential not found")
}

// PasskeyCredential represents a stored passkey credential.
type PasskeyCredential struct {
	ID         string   `json:"id"`
	UserID     string   `json:"userId"`
	PublicKey  []byte   `json:"publicKey"`
	SignCount  uint32   `json:"signCount"`
	Transports []string `json:"transports"`
	CreatedAt  int64    `json:"createdAt"`
	LastUsedAt int64    `json:"lastUsedAt"`
}

// StorePasskeyCredential stores a passkey credential.
func StorePasskeyCredential(ctx context.Context, db interface{}, credential *PasskeyCredential) error {
	_ = ctx
	_ = db
	if credential == nil {
		return fmt.Errorf("credential is required")
	}
	if credential.ID == "" || credential.UserID == "" {
		return fmt.Errorf("credential id and user id are required")
	}

	passkeyStoreMu.Lock()
	defer passkeyStoreMu.Unlock()

	entries := passkeyStore[credential.UserID]
	for idx, existing := range entries {
		if existing.ID == credential.ID {
			entries[idx] = credential
			passkeyStore[credential.UserID] = entries
			return nil
		}
	}
	passkeyStore[credential.UserID] = append(entries, credential)
	return nil
}

// GetPasskeyCredentials gets all passkey credentials for a user.
func GetPasskeyCredentials(ctx context.Context, db interface{}, userID string) ([]*PasskeyCredential, error) {
	_ = ctx
	_ = db
	passkeyStoreMu.RLock()
	defer passkeyStoreMu.RUnlock()

	entries := passkeyStore[userID]
	result := make([]*PasskeyCredential, 0, len(entries))
	for _, credential := range entries {
		copyCredential := *credential
		result = append(result, &copyCredential)
	}
	return result, nil
}

// DeletePasskeyCredential deletes a passkey credential.
func DeletePasskeyCredential(ctx context.Context, db interface{}, userID, credentialID string) error {
	_ = ctx
	_ = db
	passkeyStoreMu.Lock()
	defer passkeyStoreMu.Unlock()

	entries := passkeyStore[userID]
	filtered := entries[:0]
	found := false
	for _, credential := range entries {
		if credential.ID == credentialID {
			found = true
			continue
		}
		filtered = append(filtered, credential)
	}
	if !found {
		return fmt.Errorf("credential not found")
	}
	passkeyStore[userID] = filtered
	return nil
}

type passkeyPayload struct {
	ID         string
	UserID     string
	Challenge  string
	PublicKey  string
	Transports []string
	SignCount  uint32
}

func generatePasskeyChallenge() (string, error) {
	challengeBytes := make([]byte, 32)
	if _, err := rand.Read(challengeBytes); err != nil {
		return "", fmt.Errorf("failed to generate challenge: %w", err)
	}
	return base64.RawURLEncoding.EncodeToString(challengeBytes), nil
}

func normalizePasskeyPayload(response interface{}) (*passkeyPayload, error) {
	payload := &passkeyPayload{}
	switch v := response.(type) {
	case map[string]interface{}:
		payload.ID = stringField(v, "id", "credential_id")
		payload.UserID = stringField(v, "user_id", "userId")
		payload.Challenge = stringField(v, "challenge")
		payload.PublicKey = stringField(v, "public_key", "publicKey")
		payload.Transports = stringSliceField(v, "transports")
		payload.SignCount = uint32(numberField(v, "sign_count", "signCount"))
	case *passkeyPayload:
		*payload = *v
	default:
		return nil, fmt.Errorf("unsupported passkey payload")
	}
	return payload, nil
}

func stringField(data map[string]interface{}, keys ...string) string {
	for _, key := range keys {
		if value, ok := data[key].(string); ok {
			return strings.TrimSpace(value)
		}
	}
	return ""
}

func stringSliceField(data map[string]interface{}, key string) []string {
	raw, ok := data[key]
	if !ok {
		return nil
	}
	items, ok := raw.([]interface{})
	if !ok {
		return nil
	}
	result := make([]string, 0, len(items))
	for _, item := range items {
		if value, ok := item.(string); ok {
			result = append(result, value)
		}
	}
	return result
}

func numberField(data map[string]interface{}, keys ...string) float64 {
	for _, key := range keys {
		if value, ok := data[key].(float64); ok {
			return value
		}
	}
	return 0
}
