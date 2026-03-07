//go:build integration

package integration

import "testing"

func TestStatusIncidentFlow(t *testing.T) {
	token := getAdminToken(t)
	if token == "" {
		t.Skip("admin token unavailable")
	}

	_, created := apiJSON(t, "POST", "/status/incidents", map[string]interface{}{
		"title":    "Phase8 Incident Test",
		"summary":  "Integration test incident",
		"severity": "minor",
	}, token, nil)
	if created["error"] != nil {
		t.Fatalf("create incident failed: %v", created["error"])
	}
	data, _ := created["data"].(map[string]interface{})
	id, _ := data["id"].(string)
	if id == "" {
		t.Skip("incident id not available in response")
	}

	_, resolved := apiJSON(t, "POST", "/status/incidents/"+id+"/resolve", map[string]interface{}{
		"resolution": "resolved by integration test",
	}, token, nil)
	if resolved["error"] != nil {
		t.Fatalf("resolve incident failed: %v", resolved["error"])
	}
}
