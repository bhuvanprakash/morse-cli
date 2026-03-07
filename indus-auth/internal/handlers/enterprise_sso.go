package handlers

import (
	"context"
	"crypto/rsa"
	"database/sql"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"net"
	"net/http"
	"net/url"
	"regexp"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/indusbase/indus-auth/internal/auth"
	"github.com/indusbase/indus-auth/internal/config"
	"github.com/indusbase/indus-auth/internal/enterprise"
	"github.com/indusbase/indus-auth/internal/repository"
	"github.com/indusbase/indus-auth/pkg/crypto"
)

type EnterpriseSSOHandler struct {
	DB         *sql.DB
	Config     *config.Config
	PrivateKey *rsa.PrivateKey
}

func NewEnterpriseSSOHandler(db *sql.DB, cfg *config.Config, privateKey *rsa.PrivateKey) *EnterpriseSSOHandler {
	return &EnterpriseSSOHandler{
		DB:         db,
		Config:     cfg,
		PrivateKey: privateKey,
	}
}

type createConnectionRequest struct {
	OrgID        *string                     `json:"org_id"`
	ProjectID    *string                     `json:"project_id"`
	Name         string                      `json:"name" binding:"required"`
	Slug         string                      `json:"slug" binding:"required"`
	Domain       string                      `json:"domain" binding:"required"`
	ProviderType string                      `json:"provider_type" binding:"required"`
	ProviderName string                      `json:"provider_name" binding:"required"`
	Config       enterprise.ConnectionConfig `json:"config"`
}

type updateConnectionRequest struct {
	Name         *string                      `json:"name"`
	Domain       *string                      `json:"domain"`
	ProviderName *string                      `json:"provider_name"`
	Config       *enterprise.ConnectionConfig `json:"config"`
	IsActive     *bool                        `json:"is_active"`
}

var slugRe = regexp.MustCompile(`^[a-z0-9][a-z0-9-]{1,62}[a-z0-9]$`)

func (h *EnterpriseSSOHandler) CreateConnection(c *gin.Context) {
	var req createConnectionRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"data": nil, "error": gin.H{"code": "BAD_REQUEST", "message": err.Error()}})
		return
	}
	req.Slug = strings.TrimSpace(strings.ToLower(req.Slug))
	req.ProviderType = strings.TrimSpace(strings.ToLower(req.ProviderType))
	req.Domain = enterprise.NormalizeDomain(req.Domain)
	if !slugRe.MatchString(req.Slug) {
		c.JSON(http.StatusUnprocessableEntity, gin.H{"data": nil, "error": gin.H{"code": "INVALID_SLUG", "message": "Slug must be lowercase letters, numbers, and hyphens"}})
		return
	}
	if req.ProviderType != enterprise.ProviderTypeSAML && req.ProviderType != enterprise.ProviderTypeOIDC {
		c.JSON(http.StatusUnprocessableEntity, gin.H{"data": nil, "error": gin.H{"code": "INVALID_PROVIDER_TYPE", "message": "provider_type must be saml or oidc"}})
		return
	}
	if !enterprise.IsValidDomain(req.Domain) {
		c.JSON(http.StatusUnprocessableEntity, gin.H{"data": nil, "error": gin.H{"code": "INVALID_DOMAIN", "message": "Domain must be valid"}})
		return
	}

	configJSON, _ := json.Marshal(req.Config)
	const q = `
INSERT INTO indusbase_auth.enterprise_connections
  (org_id, project_id, name, slug, domain, provider_type, provider_name, config, is_active, created_at, updated_at)
VALUES
  ($1, $2, $3, $4, $5, $6, $7, $8, TRUE, NOW(), NOW())
RETURNING id, org_id, project_id, name, slug, domain, provider_type, provider_name, config, is_active, created_at, updated_at
`
	var conn enterprise.EnterpriseConnection
	err := h.DB.QueryRowContext(c.Request.Context(), q,
		req.OrgID, req.ProjectID, strings.TrimSpace(req.Name), req.Slug, req.Domain, req.ProviderType, strings.TrimSpace(req.ProviderName), configJSON,
	).Scan(
		&conn.ID, &conn.OrgID, &conn.ProjectID, &conn.Name, &conn.Slug, &conn.Domain, &conn.ProviderType, &conn.ProviderName, &conn.Config, &conn.IsActive, &conn.CreatedAt, &conn.UpdatedAt,
	)
	if err != nil {
		c.JSON(http.StatusConflict, gin.H{"data": nil, "error": gin.H{"code": "CONNECTION_CREATE_FAILED", "message": err.Error()}})
		return
	}
	c.JSON(http.StatusCreated, gin.H{"data": conn, "error": nil})
}

func (h *EnterpriseSSOHandler) ListConnections(c *gin.Context) {
	rows, err := h.DB.QueryContext(c.Request.Context(), `
SELECT id, org_id, project_id, name, slug, domain, provider_type, provider_name, config, is_active, created_at, updated_at
FROM indusbase_auth.enterprise_connections
ORDER BY created_at DESC
`)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"data": nil, "error": gin.H{"code": "DB_ERROR", "message": err.Error()}})
		return
	}
	defer rows.Close()
	out := make([]enterprise.EnterpriseConnection, 0)
	for rows.Next() {
		var conn enterprise.EnterpriseConnection
		if err := rows.Scan(
			&conn.ID, &conn.OrgID, &conn.ProjectID, &conn.Name, &conn.Slug, &conn.Domain, &conn.ProviderType, &conn.ProviderName, &conn.Config, &conn.IsActive, &conn.CreatedAt, &conn.UpdatedAt,
		); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"data": nil, "error": gin.H{"code": "SCAN_ERROR", "message": err.Error()}})
			return
		}
		out = append(out, conn)
	}
	c.JSON(http.StatusOK, gin.H{"data": out, "error": nil})
}

func (h *EnterpriseSSOHandler) GetConnection(c *gin.Context) {
	id := c.Param("id")
	conn, err := h.getConnectionByID(c.Request.Context(), id)
	if err == sql.ErrNoRows || conn == nil {
		c.JSON(http.StatusNotFound, gin.H{"data": nil, "error": gin.H{"code": "NOT_FOUND", "message": "Connection not found"}})
		return
	}
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"data": nil, "error": gin.H{"code": "DB_ERROR", "message": err.Error()}})
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": conn, "error": nil})
}

func (h *EnterpriseSSOHandler) UpdateConnection(c *gin.Context) {
	id := c.Param("id")
	conn, err := h.getConnectionByID(c.Request.Context(), id)
	if err == sql.ErrNoRows || conn == nil {
		c.JSON(http.StatusNotFound, gin.H{"data": nil, "error": gin.H{"code": "NOT_FOUND", "message": "Connection not found"}})
		return
	}
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"data": nil, "error": gin.H{"code": "DB_ERROR", "message": err.Error()}})
		return
	}

	var req updateConnectionRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"data": nil, "error": gin.H{"code": "BAD_REQUEST", "message": err.Error()}})
		return
	}

	name := conn.Name
	if req.Name != nil {
		name = strings.TrimSpace(*req.Name)
	}
	domain := conn.Domain
	if req.Domain != nil {
		domain = enterprise.NormalizeDomain(*req.Domain)
		if !enterprise.IsValidDomain(domain) {
			c.JSON(http.StatusUnprocessableEntity, gin.H{"data": nil, "error": gin.H{"code": "INVALID_DOMAIN", "message": "Domain must be valid"}})
			return
		}
	}
	providerName := conn.ProviderName
	if req.ProviderName != nil {
		providerName = strings.TrimSpace(*req.ProviderName)
	}

	configJSON := conn.Config
	if req.Config != nil {
		configJSON, _ = json.Marshal(req.Config)
	}
	isActive := conn.IsActive
	if req.IsActive != nil {
		isActive = *req.IsActive
	}

	const q = `
UPDATE indusbase_auth.enterprise_connections
SET name = $2,
    domain = $3,
    provider_name = $4,
    config = $5,
    is_active = $6,
    updated_at = NOW()
WHERE id = $1
RETURNING id, org_id, project_id, name, slug, domain, provider_type, provider_name, config, is_active, created_at, updated_at
`
	var updated enterprise.EnterpriseConnection
	err = h.DB.QueryRowContext(c.Request.Context(), q, id, name, domain, providerName, configJSON, isActive).Scan(
		&updated.ID, &updated.OrgID, &updated.ProjectID, &updated.Name, &updated.Slug, &updated.Domain, &updated.ProviderType, &updated.ProviderName, &updated.Config, &updated.IsActive, &updated.CreatedAt, &updated.UpdatedAt,
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"data": nil, "error": gin.H{"code": "UPDATE_FAILED", "message": err.Error()}})
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": updated, "error": nil})
}

func (h *EnterpriseSSOHandler) DeleteConnection(c *gin.Context) {
	id := c.Param("id")
	res, err := h.DB.ExecContext(c.Request.Context(), `DELETE FROM indusbase_auth.enterprise_connections WHERE id = $1`, id)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"data": nil, "error": gin.H{"code": "DELETE_FAILED", "message": err.Error()}})
		return
	}
	rows, _ := res.RowsAffected()
	if rows == 0 {
		c.JSON(http.StatusNotFound, gin.H{"data": nil, "error": gin.H{"code": "NOT_FOUND", "message": "Connection not found"}})
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": gin.H{"deleted": true, "id": id}, "error": nil})
}

func (h *EnterpriseSSOHandler) StartSSO(c *gin.Context) {
	slug := strings.TrimSpace(c.Param("slug"))
	conn, err := h.getConnectionBySlug(c.Request.Context(), slug)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"data": nil, "error": gin.H{"code": "CONNECTION_NOT_FOUND", "message": "SSO connection not found"}})
		return
	}
	if !conn.IsActive {
		c.JSON(http.StatusServiceUnavailable, gin.H{"data": nil, "error": gin.H{"code": "CONNECTION_INACTIVE", "message": "SSO connection is inactive"}})
		return
	}

	var cfg enterprise.ConnectionConfig
	_ = json.Unmarshal(conn.Config, &cfg)
	switch conn.ProviderType {
	case enterprise.ProviderTypeOIDC:
		stateObj := map[string]string{
			"slug": conn.Slug,
			"ts":   fmt.Sprintf("%d", time.Now().Unix()),
		}
		stateRaw, _ := json.Marshal(stateObj)
		state := base64.RawURLEncoding.EncodeToString(stateRaw)
		nonce := uuid.New().String()
		redirectURL, err := enterprise.BuildOIDCAuthURL(cfg, state, nonce)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"data": nil, "error": gin.H{"code": "OIDC_CONFIG_INVALID", "message": err.Error()}})
			return
		}
		c.Redirect(http.StatusFound, redirectURL)
	case enterprise.ProviderTypeSAML:
		if strings.TrimSpace(cfg.SSOURL) == "" {
			c.JSON(http.StatusBadRequest, gin.H{"data": nil, "error": gin.H{"code": "SAML_CONFIG_INVALID", "message": "Missing SSO URL in connection config"}})
			return
		}
		relay := url.QueryEscape(enterprise.BuildSAMLRequestRelayState(slug))
		target := cfg.SSOURL
		if strings.Contains(target, "?") {
			target += "&RelayState=" + relay
		} else {
			target += "?RelayState=" + relay
		}
		c.Redirect(http.StatusFound, target)
	default:
		c.JSON(http.StatusBadRequest, gin.H{"data": nil, "error": gin.H{"code": "UNSUPPORTED_PROVIDER", "message": "Unsupported enterprise provider type"}})
	}
}

func (h *EnterpriseSSOHandler) Metadata(c *gin.Context) {
	slug := c.Param("slug")
	conn, err := h.getConnectionBySlug(c.Request.Context(), slug)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"data": nil, "error": gin.H{"code": "CONNECTION_NOT_FOUND", "message": "SSO connection not found"}})
		return
	}
	var cfg enterprise.ConnectionConfig
	_ = json.Unmarshal(conn.Config, &cfg)
	entityID := cfg.EntityID
	if entityID == "" {
		entityID = fmt.Sprintf("indusbase:%s", conn.Slug)
	}
	acsURL := cfg.ACSURL
	if acsURL == "" {
		acsURL = fmt.Sprintf("/auth/sso/%s/acs", conn.Slug)
	}
	xmlBody, err := enterprise.BuildSPMetadataXML(entityID, acsURL)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"data": nil, "error": gin.H{"code": "METADATA_BUILD_FAILED", "message": err.Error()}})
		return
	}
	c.Header("Content-Type", "application/samlmetadata+xml")
	c.String(http.StatusOK, xmlBody)
}

func (h *EnterpriseSSOHandler) HandleACS(c *gin.Context) {
	slug := c.Param("slug")
	conn, err := h.getConnectionBySlug(c.Request.Context(), slug)
	if err != nil {
		h.recordSSOEvent(c.Request.Context(), nil, "failed", "CONNECTION_NOT_FOUND", "SSO connection not found", "", "", c.ClientIP(), c.GetHeader("User-Agent"))
		c.JSON(http.StatusNotFound, gin.H{"data": nil, "error": gin.H{"code": "CONNECTION_NOT_FOUND", "message": "SSO connection not found"}})
		return
	}

	var cfg enterprise.ConnectionConfig
	_ = json.Unmarshal(conn.Config, &cfg)

	source := map[string]string{}
	switch conn.ProviderType {
	case enterprise.ProviderTypeSAML:
		samlResponse := c.PostForm("SAMLResponse")
		attrs, err := enterprise.ParseSAMLResponse(samlResponse)
		if err != nil {
			h.recordSSOEvent(c.Request.Context(), &conn.ID, "failed", "SAML_PARSE_FAILED", err.Error(), conn.Domain, "", c.ClientIP(), c.GetHeader("User-Agent"))
			c.JSON(http.StatusUnauthorized, gin.H{"data": nil, "error": gin.H{"code": "SAML_PARSE_FAILED", "message": err.Error()}})
			return
		}
		source = attrs
	case enterprise.ProviderTypeOIDC:
		code := c.Query("code")
		if code == "" {
			h.recordSSOEvent(c.Request.Context(), &conn.ID, "failed", "OIDC_CODE_MISSING", "Missing authorization code", conn.Domain, "", c.ClientIP(), c.GetHeader("User-Agent"))
			c.JSON(http.StatusUnauthorized, gin.H{"data": nil, "error": gin.H{"code": "OIDC_CODE_MISSING", "message": "Authorization code is required"}})
			return
		}
		attrs, err := enterprise.ExchangeOIDCCode(c.Request.Context(), cfg, code)
		if err != nil {
			h.recordSSOEvent(c.Request.Context(), &conn.ID, "failed", "OIDC_EXCHANGE_FAILED", err.Error(), conn.Domain, "", c.ClientIP(), c.GetHeader("User-Agent"))
			c.JSON(http.StatusUnauthorized, gin.H{"data": nil, "error": gin.H{"code": "OIDC_EXCHANGE_FAILED", "message": err.Error()}})
			return
		}
		source = attrs
	default:
		c.JSON(http.StatusBadRequest, gin.H{"data": nil, "error": gin.H{"code": "UNSUPPORTED_PROVIDER", "message": "Unsupported SSO provider"}})
		return
	}

	attrs := enterprise.ApplyIdentityMappings(nil, source)
	email := strings.ToLower(strings.TrimSpace(attrs.Email))
	if email == "" {
		h.recordSSOEvent(c.Request.Context(), &conn.ID, "failed", "EMAIL_MISSING", "Provider did not return email", conn.Domain, "", c.ClientIP(), c.GetHeader("User-Agent"))
		c.JSON(http.StatusUnauthorized, gin.H{"data": nil, "error": gin.H{"code": "EMAIL_MISSING", "message": "SSO provider did not return an email"}})
		return
	}

	emailDomain := enterprise.EmailDomain(email)
	if emailDomain == "" || !strings.EqualFold(emailDomain, conn.Domain) {
		h.recordSSOEvent(c.Request.Context(), &conn.ID, "failed", "DOMAIN_MISMATCH", "Email domain does not match connection domain", conn.Domain, email, c.ClientIP(), c.GetHeader("User-Agent"))
		c.JSON(http.StatusUnauthorized, gin.H{"data": nil, "error": gin.H{"code": "DOMAIN_MISMATCH", "message": "Email domain is not allowed for this enterprise connection"}})
		return
	}

	verified, err := h.isDomainVerified(c.Request.Context(), conn.Domain)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"data": nil, "error": gin.H{"code": "DOMAIN_LOOKUP_FAILED", "message": err.Error()}})
		return
	}
	if !verified {
		h.recordSSOEvent(c.Request.Context(), &conn.ID, "failed", "DOMAIN_NOT_VERIFIED", "Enterprise domain not verified", conn.Domain, email, c.ClientIP(), c.GetHeader("User-Agent"))
		c.JSON(http.StatusForbidden, gin.H{"data": nil, "error": gin.H{"code": "DOMAIN_NOT_VERIFIED", "message": "Enterprise domain is not verified"}})
		return
	}

	userRepo := repository.NewUserRepository(h.DB)
	user, err := userRepo.GetByEmail(c.Request.Context(), email)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"data": nil, "error": gin.H{"code": "USER_LOOKUP_FAILED", "message": err.Error()}})
		return
	}
	if user == nil {
		password, hashErr := crypto.HashPassword(uuid.New().String(), h.Config.BCryptCost)
		if hashErr != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"data": nil, "error": gin.H{"code": "USER_CREATE_FAILED", "message": hashErr.Error()}})
			return
		}
		meta, _ := json.Marshal(map[string]interface{}{
			"project_id":            conn.ProjectID,
			"enterprise_connection": conn.ID,
			"sso_provider_type":     conn.ProviderType,
		})
		displayName := attrs.Name
		if displayName == "" {
			displayName = strings.Split(email, "@")[0]
		}
		user, err = userRepo.CreateUser(c.Request.Context(), email, password, displayName, meta)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"data": nil, "error": gin.H{"code": "USER_CREATE_FAILED", "message": err.Error()}})
			return
		}
	}
	_ = userRepo.UpdateEmailVerified(c.Request.Context(), user.ID, true)
	_ = userRepo.UpdateLastSignIn(c.Request.Context(), user.ID)
	_ = h.upsertProviderMapping(c.Request.Context(), conn.ID, attrs, user.ID, email)

	authPayload, err := h.issueSessionForUser(c, user.ID, email, user.Role)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"data": nil, "error": gin.H{"code": "TOKEN_ISSUE_FAILED", "message": err.Error()}})
		return
	}

	h.recordSSOEvent(c.Request.Context(), &conn.ID, "success", "", "", conn.Domain, email, c.ClientIP(), c.GetHeader("User-Agent"))
	c.JSON(http.StatusOK, gin.H{
		"data": gin.H{
			"provider": conn.ProviderType,
			"domain":   conn.Domain,
			"user": gin.H{
				"id":    user.ID,
				"email": email,
				"name":  user.Name,
				"role":  user.Role,
			},
			"session": authPayload,
		},
		"error": nil,
	})
}

func (h *EnterpriseSSOHandler) ListSSOEvents(c *gin.Context) {
	limit := 100
	rows, err := h.DB.QueryContext(c.Request.Context(), `
SELECT id, connection_id, provider_type, provider_name, domain, email, status, failure_code, failure_message, ip_address, user_agent, created_at
FROM indusbase_auth.sso_login_events
ORDER BY created_at DESC
LIMIT $1
`, limit)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"data": nil, "error": gin.H{"code": "DB_ERROR", "message": err.Error()}})
		return
	}
	defer rows.Close()
	out := make([]enterprise.SSOLoginEvent, 0)
	for rows.Next() {
		var ev enterprise.SSOLoginEvent
		if err := rows.Scan(&ev.ID, &ev.ConnectionID, &ev.ProviderType, &ev.ProviderName, &ev.Domain, &ev.Email, &ev.Status, &ev.FailureCode, &ev.FailureMsg, &ev.IPAddress, &ev.UserAgent, &ev.CreatedAt); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"data": nil, "error": gin.H{"code": "SCAN_ERROR", "message": err.Error()}})
			return
		}
		out = append(out, ev)
	}
	c.JSON(http.StatusOK, gin.H{"data": out, "error": nil})
}

func (h *EnterpriseSSOHandler) issueSessionForUser(c *gin.Context, userID, email, role string) (gin.H, error) {
	sessionRepo := repository.NewSessionRepository(h.DB)
	userAgent := c.GetHeader("User-Agent")
	ipAddress := net.ParseIP(c.ClientIP())
	refreshExpiry := time.Now().Add(h.Config.JWTRefreshExpiry)
	tempSession, err := sessionRepo.CreateSession(c.Request.Context(), userID, "temp", &userAgent, ipAddress, refreshExpiry)
	if err != nil {
		return nil, err
	}

	accessToken, err := auth.GenerateAccessToken(userID, email, role, h.Config.JWTAccessExpiry, h.PrivateKey)
	if err != nil {
		return nil, err
	}
	refreshToken, err := auth.GenerateRefreshToken(userID, tempSession.ID, h.Config.JWTRefreshExpiry, h.PrivateKey)
	if err != nil {
		return nil, err
	}
	_ = sessionRepo.UpdateRefreshToken(c.Request.Context(), tempSession.ID, refreshToken, refreshExpiry)

	return gin.H{
		"access_token":  accessToken,
		"refresh_token": refreshToken,
		"token_type":    "Bearer",
		"expires_in":    int(h.Config.JWTAccessExpiry.Seconds()),
	}, nil
}

func (h *EnterpriseSSOHandler) getConnectionByID(ctx context.Context, id string) (*enterprise.EnterpriseConnection, error) {
	const q = `
SELECT id, org_id, project_id, name, slug, domain, provider_type, provider_name, config, is_active, created_at, updated_at
FROM indusbase_auth.enterprise_connections
WHERE id = $1
`
	var conn enterprise.EnterpriseConnection
	err := h.DB.QueryRowContext(ctx, q, id).Scan(
		&conn.ID, &conn.OrgID, &conn.ProjectID, &conn.Name, &conn.Slug, &conn.Domain, &conn.ProviderType, &conn.ProviderName, &conn.Config, &conn.IsActive, &conn.CreatedAt, &conn.UpdatedAt,
	)
	if err != nil {
		return nil, err
	}
	return &conn, nil
}

func (h *EnterpriseSSOHandler) getConnectionBySlug(ctx context.Context, slug string) (*enterprise.EnterpriseConnection, error) {
	const q = `
SELECT id, org_id, project_id, name, slug, domain, provider_type, provider_name, config, is_active, created_at, updated_at
FROM indusbase_auth.enterprise_connections
WHERE slug = $1
`
	var conn enterprise.EnterpriseConnection
	err := h.DB.QueryRowContext(ctx, q, slug).Scan(
		&conn.ID, &conn.OrgID, &conn.ProjectID, &conn.Name, &conn.Slug, &conn.Domain, &conn.ProviderType, &conn.ProviderName, &conn.Config, &conn.IsActive, &conn.CreatedAt, &conn.UpdatedAt,
	)
	if err != nil {
		return nil, err
	}
	return &conn, nil
}

func (h *EnterpriseSSOHandler) isDomainVerified(ctx context.Context, domain string) (bool, error) {
	var count int
	err := h.DB.QueryRowContext(ctx, `
SELECT COUNT(*)
FROM indusbase_auth.verified_domains
WHERE domain = $1 AND verified_at IS NOT NULL
`, domain).Scan(&count)
	return count > 0, err
}

func (h *EnterpriseSSOHandler) upsertProviderMapping(ctx context.Context, connectionID string, attrs enterprise.IdentityAttributes, userID, email string) error {
	extID := attrs.ExternalID
	if extID == "" {
		extID = email
	}
	rawAttrs, _ := json.Marshal(attrs)
	_, err := h.DB.ExecContext(ctx, `
INSERT INTO indusbase_auth.identity_provider_mappings
  (connection_id, external_user_id, user_id, email, attributes, created_at, updated_at)
VALUES
  ($1, $2, $3, $4, $5, NOW(), NOW())
ON CONFLICT (connection_id, external_user_id) DO UPDATE
SET user_id = EXCLUDED.user_id,
    email = EXCLUDED.email,
    attributes = EXCLUDED.attributes,
    updated_at = NOW()
`, connectionID, extID, userID, email, rawAttrs)
	return err
}

func (h *EnterpriseSSOHandler) recordSSOEvent(ctx context.Context, connectionID *string, status, failureCode, failureMessage, domain, email, ip, ua string) {
	metadata, _ := json.Marshal(map[string]interface{}{"source": "enterprise_sso"})
	_, _ = h.DB.ExecContext(ctx, `
INSERT INTO indusbase_auth.sso_login_events
  (connection_id, provider_type, provider_name, domain, email, status, failure_code, failure_message, ip_address, user_agent, metadata, created_at)
VALUES
  ($1, COALESCE((SELECT provider_type FROM indusbase_auth.enterprise_connections WHERE id = $1), 'unknown'),
      COALESCE((SELECT provider_name FROM indusbase_auth.enterprise_connections WHERE id = $1), 'unknown'),
      $2, $3, $4, NULLIF($5,''), NULLIF($6,''), NULLIF($7,''), NULLIF($8,''), $9, NOW())
`, connectionID, domain, email, status, failureCode, failureMessage, ip, ua, metadata)
	resourceID := domain
	if email != "" {
		resourceID = email
	}
	severity := "info"
	if status != "success" {
		severity = "warn"
	}
	emitAuditRaw(ctx, map[string]interface{}{
		"actor_type":    "user",
		"actor_email":   email,
		"action":        "sso_login_" + status,
		"resource_type": "sso_connection",
		"resource_id":   resourceID,
		"severity":      severity,
		"ip_address":    ip,
		"user_agent":    ua,
		"metadata": map[string]interface{}{
			"failure_code":    failureCode,
			"failure_message": failureMessage,
			"domain":          domain,
			"connection_id":   connectionID,
		},
	})
}
