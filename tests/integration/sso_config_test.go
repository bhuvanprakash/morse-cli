//go:build integration

package integration

import (
	"fmt"
	"testing"
	"time"
)

func TestSSOConfigFlow(t *testing.T) {
	token := getAdminToken(t)
	if token == "" {
		t.Skip("admin token unavailable")
	}

	domain := fmt.Sprintf("phase8-%d.example.co.in", time.Now().UnixNano())
	_, verify := apiJSON(t, "POST", "/auth/enterprise/domains/verify", map[string]interface{}{
		"domain":     domain,
		"org_id":     "default",
		"project_id": "default",
	}, token, nil)
	if verify["error"] != nil {
		t.Fatalf("domain verify failed: %v", verify["error"])
	}

	slug := fmt.Sprintf("phase8-sso-%d", time.Now().Unix()%100000)
	_, created := apiJSON(t, "POST", "/auth/enterprise/connections", map[string]interface{}{
		"name":          "Phase8 SSO",
		"slug":          slug,
		"provider_type": "oidc",
		"provider_name": "Okta",
		"domain":        domain,
		"project_id":    "default",
		"config": map[string]interface{}{
			"issuer":       "https://example.okta.com",
			"client_id":    "dummy-client",
			"client_secret": "dummy-secret",
		},
	}, token, nil)
	if created["error"] != nil {
		t.Fatalf("create enterprise connection failed: %v", created["error"])
	}

	_, listed := apiJSON(t, "GET", "/auth/enterprise/connections", nil, token, nil)
	if listed["error"] != nil {
		t.Fatalf("list enterprise connections failed: %v", listed["error"])
	}
}
