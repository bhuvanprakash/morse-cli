//go:build integration

package integration

import (
	"bytes"
	"encoding/json"
	"io"
	"net/http"
	"testing"
)

func getAdminToken(t *testing.T) string {
	t.Helper()
	candidates := []map[string]string{
		{"email": "admin@indusbase.local", "password": "AdminPass123!"},
		{"email": "admin@example.com", "password": "AdminPass123!"},
	}
	for _, c := range candidates {
		r := apiPost(t, "/auth/signin", c, "")
		if data, ok := r["data"].(map[string]interface{}); ok {
			if token, ok := data["access_token"].(string); ok && token != "" {
				return token
			}
		}
	}
	return ""
}

func apiJSON(t *testing.T, method, path string, body interface{}, token string, headers map[string]string) (int, map[string]interface{}) {
	t.Helper()
	var reader io.Reader
	if body != nil {
		b, _ := json.Marshal(body)
		reader = bytes.NewReader(b)
	}
	req, _ := http.NewRequest(method, baseURL+path, reader)
	req.Header.Set("Content-Type", "application/json")
	if token != "" {
		req.Header.Set("Authorization", "Bearer "+token)
	}
	for k, v := range headers {
		req.Header.Set(k, v)
	}
	resp, err := httpClient.Do(req)
	if err != nil {
		t.Fatalf("%s %s failed: %v", method, path, err)
	}
	defer resp.Body.Close()
	raw, _ := io.ReadAll(resp.Body)
	result := map[string]interface{}{}
	_ = json.Unmarshal(raw, &result)
	return resp.StatusCode, result
}
