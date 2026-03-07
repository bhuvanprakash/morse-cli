package enterprise

import "time"

const (
	ProviderTypeSAML = "saml"
	ProviderTypeOIDC = "oidc"
)

type VerifiedDomain struct {
	ID                string     `json:"id"`
	OrgID             *string    `json:"org_id,omitempty"`
	ProjectID         *string    `json:"project_id,omitempty"`
	Domain            string     `json:"domain"`
	VerificationToken string     `json:"verification_token"`
	VerifiedAt        *time.Time `json:"verified_at,omitempty"`
	CreatedAt         time.Time  `json:"created_at"`
	UpdatedAt         time.Time  `json:"updated_at"`
}

type EnterpriseConnection struct {
	ID           string    `json:"id"`
	OrgID        *string   `json:"org_id,omitempty"`
	ProjectID    *string   `json:"project_id,omitempty"`
	Name         string    `json:"name"`
	Slug         string    `json:"slug"`
	Domain       string    `json:"domain"`
	ProviderType string    `json:"provider_type"`
	ProviderName string    `json:"provider_name"`
	Config       []byte    `json:"config"`
	IsActive     bool      `json:"is_active"`
	CreatedAt    time.Time `json:"created_at"`
	UpdatedAt    time.Time `json:"updated_at"`
}

type SCIMToken struct {
	ID           string     `json:"id"`
	ConnectionID string     `json:"connection_id"`
	TokenPrefix  string     `json:"token_prefix"`
	Name         string     `json:"name"`
	LastUsedAt   *time.Time `json:"last_used_at,omitempty"`
	ExpiresAt    *time.Time `json:"expires_at,omitempty"`
	RevokedAt    *time.Time `json:"revoked_at,omitempty"`
	CreatedAt    time.Time  `json:"created_at"`
}

type SSOLoginEvent struct {
	ID           string    `json:"id"`
	ConnectionID *string   `json:"connection_id,omitempty"`
	ProviderType string    `json:"provider_type"`
	ProviderName string    `json:"provider_name"`
	Domain       string    `json:"domain"`
	Email        string    `json:"email"`
	Status       string    `json:"status"`
	FailureCode  *string   `json:"failure_code,omitempty"`
	FailureMsg   *string   `json:"failure_message,omitempty"`
	IPAddress    *string   `json:"ip_address,omitempty"`
	UserAgent    *string   `json:"user_agent,omitempty"`
	CreatedAt    time.Time `json:"created_at"`
}

type ConnectionConfig struct {
	// OIDC settings.
	IssuerURL    string `json:"issuer_url,omitempty"`
	ClientID     string `json:"client_id,omitempty"`
	ClientSecret string `json:"client_secret,omitempty"`
	AuthURL      string `json:"auth_url,omitempty"`
	TokenURL     string `json:"token_url,omitempty"`
	UserInfoURL  string `json:"userinfo_url,omitempty"`
	RedirectURL  string `json:"redirect_url,omitempty"`
	Scopes       string `json:"scopes,omitempty"`

	// SAML settings.
	SSOURL      string `json:"sso_url,omitempty"`
	EntityID    string `json:"entity_id,omitempty"`
	ACSURL      string `json:"acs_url,omitempty"`
	Certificate string `json:"certificate,omitempty"`
}
