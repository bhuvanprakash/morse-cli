//go:build integration

package integration

import (
	"fmt"
	"testing"
	"time"
)

func TestSecretsCreateRotate(t *testing.T) {
	token := getAdminToken(t)
	if token == "" {
		t.Skip("admin token unavailable")
	}
	name := fmt.Sprintf("PHASE8_IT_SECRET_%d", time.Now().UnixNano()%1000000)

	_, created := apiJSON(t, "POST", "/secrets", map[string]interface{}{
		"name":       name,
		"scope":      "platform",
		"value":      "initial-value",
		"project_id": "",
	}, token, nil)
	if created["error"] != nil {
		t.Fatalf("create secret failed: %v", created["error"])
	}

	_, rotated := apiJSON(t, "POST", "/secrets/"+name+"/rotate", map[string]interface{}{
		"value": "rotated-value",
	}, token, nil)
	if rotated["error"] != nil {
		t.Fatalf("rotate secret failed: %v", rotated["error"])
	}

	_, versions := apiJSON(t, "GET", "/secrets/"+name+"/versions", nil, token, nil)
	if versions["error"] != nil {
		t.Fatalf("versions lookup failed: %v", versions["error"])
	}
}
