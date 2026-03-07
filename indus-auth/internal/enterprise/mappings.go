package enterprise

import (
	"encoding/json"
	"strings"
)

type IdentityAttributes struct {
	Email      string
	ExternalID string
	FirstName  string
	LastName   string
	Name       string
	Phone      string
}

// ApplyIdentityMappings translates provider attributes to core identity attributes.
// Mapping JSON format:
// {"email":"mail","external_id":"sub","first_name":"given_name","last_name":"family_name","name":"name","phone":"phone_number"}
func ApplyIdentityMappings(mappingRaw []byte, source map[string]string) IdentityAttributes {
	defaults := map[string]string{
		"email":       "email",
		"external_id": "sub",
		"first_name":  "given_name",
		"last_name":   "family_name",
		"name":        "name",
		"phone":       "phone_number",
	}

	if len(mappingRaw) > 0 {
		var custom map[string]string
		if err := json.Unmarshal(mappingRaw, &custom); err == nil {
			for key, value := range custom {
				if strings.TrimSpace(value) != "" {
					defaults[key] = strings.TrimSpace(value)
				}
			}
		}
	}

	get := func(field string) string {
		return strings.TrimSpace(source[defaults[field]])
	}

	attrs := IdentityAttributes{
		Email:      strings.ToLower(get("email")),
		ExternalID: get("external_id"),
		FirstName:  get("first_name"),
		LastName:   get("last_name"),
		Name:       get("name"),
		Phone:      get("phone"),
	}
	if attrs.Name == "" {
		attrs.Name = strings.TrimSpace(strings.TrimSpace(attrs.FirstName) + " " + strings.TrimSpace(attrs.LastName))
	}
	if attrs.Name == "" && attrs.Email != "" {
		attrs.Name = strings.Split(attrs.Email, "@")[0]
	}
	return attrs
}
