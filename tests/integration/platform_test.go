//go:build integration

package integration

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"testing"
	"time"
)

const baseURL = "http://localhost:8000"

var httpClient = &http.Client{Timeout: 10 * time.Second}

func TestMain(m *testing.M) {
	for i := 0; i < 30; i++ {
		resp, err := httpClient.Get(baseURL + "/health")
		if err == nil && resp.StatusCode == 200 {
			break
		}
		time.Sleep(2 * time.Second)
		if i == 29 {
			fmt.Println("Platform not ready after 60s")
			os.Exit(1)
		}
	}
	os.Exit(m.Run())
}

func apiPost(t *testing.T, path string, body interface{}, token string) map[string]interface{} {
	t.Helper()
	b, _ := json.Marshal(body)
	req, _ := http.NewRequest("POST", baseURL+path, bytes.NewReader(b))
	req.Header.Set("Content-Type", "application/json")
	if token != "" {
		req.Header.Set("Authorization", "Bearer "+token)
	}
	resp, err := httpClient.Do(req)
	if err != nil {
		t.Fatalf("POST %s failed: %v", path, err)
	}
	defer resp.Body.Close()
	raw, _ := io.ReadAll(resp.Body)
	var result map[string]interface{}
	_ = json.Unmarshal(raw, &result)
	return result
}

func TestHealthAllServices(t *testing.T) {
	ports := []int{8000, 8001, 8002, 8003, 8004, 8005, 8006, 8007, 8008, 8009, 8010, 8011, 8012, 8013, 8014}
	for _, port := range ports {
		t.Run(fmt.Sprintf("port_%d", port), func(t *testing.T) {
			resp, err := httpClient.Get(fmt.Sprintf("http://localhost:%d/health", port))
			if err != nil {
				t.Errorf("service on port %d unreachable: %v", port, err)
				return
			}
			if resp.StatusCode != 200 {
				t.Errorf("service on port %d returned %d", port, resp.StatusCode)
			}
		})
	}
}

func TestFeatureFlagEvaluation(t *testing.T) {
	r := apiPost(t, "/config/evaluate", map[string]interface{}{
		"environment": "production",
		"user_id":     "test-user-integration",
	}, "")
	if r["error"] != nil {
		t.Fatalf("feature flag eval failed: %v", r["error"])
	}
	data, _ := r["data"].(map[string]interface{})
	if data["flags"] == nil {
		t.Fatal("expected 'flags' key in evaluate response")
	}
}

func TestGraphQL(t *testing.T) {
	r := apiPost(t, "/auth/signin", map[string]interface{}{
		"email": "admin@example.com", "password": "AdminPass123!",
	}, "")
	data, _ := r["data"].(map[string]interface{})
	token, _ := data["access_token"].(string)
	if token == "" {
		t.Skip("admin user not set up, skipping GraphQL test")
	}

	r = apiPost(t, "/graphql", map[string]interface{}{
		"query": "{ tables }",
	}, token)
	if r["errors"] != nil {
		t.Fatalf("GraphQL query failed: %v", r["errors"])
	}
}
