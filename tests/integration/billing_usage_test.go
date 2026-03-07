//go:build integration

package integration

import "testing"

func TestBillingUsageEndpoints(t *testing.T) {
	token := getAdminToken(t)
	if token == "" {
		t.Skip("admin token unavailable")
	}

	if _, r := apiJSON(t, "GET", "/billing/plans", nil, token, nil); r["error"] != nil {
		t.Fatalf("billing plans failed: %v", r["error"])
	}

	if _, r := apiJSON(t, "GET", "/billing/usage/summary", nil, token, nil); r["error"] != nil {
		t.Fatalf("billing usage summary failed: %v", r["error"])
	}

	if _, r := apiJSON(t, "GET", "/billing/invoices/preview", nil, token, nil); r["error"] != nil {
		t.Fatalf("billing invoice preview failed: %v", r["error"])
	}
}
