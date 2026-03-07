package providers

import (
	"bytes"
	"context"
	"crypto/ecdsa"
	"crypto/rand"
	"crypto/sha256"
	"crypto/x509"
	"encoding/asn1"
	"encoding/base64"
	"encoding/json"
	"encoding/pem"
	"fmt"
	"math/big"
	"net/http"
	"time"
)

type APNSProvider struct {
	privateKey   *ecdsa.PrivateKey
	keyID        string
	teamID       string
	bundleID     string
	isProduction bool
	httpClient   *http.Client
}

type ecdsaSignature struct{ R, S *big.Int }

func NewAPNSProvider(p8Key []byte, keyID, teamID, bundleID string, production bool) (*APNSProvider, error) {
	block, _ := pem.Decode(p8Key)
	if block == nil {
		return nil, fmt.Errorf("failed to decode APNs p8 key PEM block")
	}
	key, err := x509.ParsePKCS8PrivateKey(block.Bytes)
	if err != nil {
		return nil, fmt.Errorf("failed to parse APNs private key: %w", err)
	}
	ecKey, ok := key.(*ecdsa.PrivateKey)
	if !ok {
		return nil, fmt.Errorf("APNs key is not ECDSA")
	}
	return &APNSProvider{
		privateKey:   ecKey,
		keyID:        keyID,
		teamID:       teamID,
		bundleID:     bundleID,
		isProduction: production,
		httpClient:   &http.Client{Timeout: 10 * time.Second},
	}, nil
}

func (a *APNSProvider) SendPush(ctx context.Context, payloads []PushPayload) ([]PushResult, error) {
	results := make([]PushResult, len(payloads))
	if len(payloads) == 0 {
		return results, nil
	}
	host := "https://api.sandbox.push.apple.com"
	if a.isProduction {
		host = "https://api.push.apple.com"
	}
	token, err := a.generateJWT()
	if err != nil {
		return nil, err
	}
	for i, payload := range payloads {
		result, sendErr := a.sendOne(ctx, host, token, payload)
		if sendErr != nil {
			results[i] = PushResult{Token: payload.Token, Success: false, Error: sendErr.Error()}
			continue
		}
		results[i] = *result
	}
	return results, nil
}

func (a *APNSProvider) sendOne(ctx context.Context, host, token string, payload PushPayload) (*PushResult, error) {
	body := map[string]interface{}{
		"aps": map[string]interface{}{
			"alert": map[string]string{
				"title": payload.Title,
				"body":  payload.Body,
			},
			"sound": "default",
		},
	}
	if payload.Sound != "" {
		body["aps"].(map[string]interface{})["sound"] = payload.Sound
	}
	if payload.Badge != nil {
		body["aps"].(map[string]interface{})["badge"] = *payload.Badge
	}
	for key, value := range payload.Data {
		body[key] = value
	}
	rawBody, _ := json.Marshal(body)
	url := fmt.Sprintf("%s/3/device/%s", host, payload.Token)
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, url, bytes.NewReader(rawBody))
	if err != nil {
		return nil, err
	}
	req.Header.Set("Authorization", "bearer "+token)
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("apns-push-type", "alert")
	req.Header.Set("apns-topic", a.bundleID)

	resp, err := a.httpClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	if resp.StatusCode == http.StatusOK {
		return &PushResult{
			Token:     payload.Token,
			Success:   true,
			MessageID: resp.Header.Get("apns-id"),
		}, nil
	}
	var errResp struct {
		Reason string `json:"reason"`
	}
	_ = json.NewDecoder(resp.Body).Decode(&errResp)
	return &PushResult{
		Token:        payload.Token,
		Success:      false,
		Error:        errResp.Reason,
		InvalidToken: errResp.Reason == "BadDeviceToken" || errResp.Reason == "Unregistered",
	}, nil
}

func (a *APNSProvider) generateJWT() (string, error) {
	now := time.Now().Unix()

	headerJSON, _ := json.Marshal(map[string]string{
		"alg": "ES256",
		"kid": a.keyID,
	})
	claimsJSON, _ := json.Marshal(map[string]interface{}{
		"iss": a.teamID,
		"iat": now,
	})

	header := base64.RawURLEncoding.EncodeToString(headerJSON)
	claims := base64.RawURLEncoding.EncodeToString(claimsJSON)
	signingInput := header + "." + claims

	h := sha256.Sum256([]byte(signingInput))
	r, s, err := ecdsa.Sign(rand.Reader, a.privateKey, h[:])
	if err != nil {
		return "", fmt.Errorf("APNs JWT signing failed: %w", err)
	}
	sig, err := asn1.Marshal(ecdsaSignature{R: r, S: s})
	if err != nil {
		return "", fmt.Errorf("APNs JWT signature encoding failed: %w", err)
	}
	signature := base64.RawURLEncoding.EncodeToString(sig)
	return header + "." + claims + "." + signature, nil
}

func mustJSON(v interface{}) []byte {
	data, _ := json.Marshal(v)
	return data
}

func (a *APNSProvider) Name() string { return "apns" }
