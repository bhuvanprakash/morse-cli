//go:build integration

package integration

import "testing"

func TestAuditEventsQueries(t *testing.T) {
	token := getAdminToken(t)
	if token == "" {
		t.Skip("admin token unavailable")
	}

	status, list := apiJSON(t, "GET", "/audit/events", nil, token, nil)
	if status >= 500 {
		t.Fatalf("audit events endpoint failed: %v", list)
	}
	if list["error"] != nil {
		t.Fatalf("audit events returned error: %v", list["error"])
	}

	status, summary := apiJSON(t, "GET", "/audit/summary", nil, token, nil)
	if status >= 500 {
		t.Fatalf("audit summary failed: %v", summary)
	}
	if summary["error"] != nil {
		t.Fatalf("audit summary returned error: %v", summary["error"])
	}

	status, exported := apiJSON(t, "GET", "/audit/export?format=json", nil, token, nil)
	if status >= 500 || exported["error"] != nil {
		t.Fatalf("audit export failed: %v", exported)
	}
}
