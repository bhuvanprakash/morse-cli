//go:build integration

package integration

import "testing"

func TestSupportConsoleEndpoints(t *testing.T) {
	token := getAdminToken(t)
	if token == "" {
		t.Skip("admin token unavailable")
	}
	adminHeaders := map[string]string{"X-IndusBase-Is-Service-Role": "true"}

	if _, r := apiJSON(t, "GET", "/meta/support/users/search?q=admin", nil, token, adminHeaders); r["error"] != nil {
		t.Fatalf("support user search failed: %v", r["error"])
	}
	if _, r := apiJSON(t, "GET", "/meta/support/projects/search?q=default", nil, token, adminHeaders); r["error"] != nil {
		t.Fatalf("support project search failed: %v", r["error"])
	}
	if _, r := apiJSON(t, "GET", "/meta/support/context?user_id=00000000-0000-0000-0000-000000000000", nil, token, adminHeaders); r["error"] != nil {
		t.Fatalf("support context lookup failed: %v", r["error"])
	}
}
