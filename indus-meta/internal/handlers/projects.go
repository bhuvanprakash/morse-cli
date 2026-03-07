package handlers

import (
	"bytes"
	"context"
	"crypto/rand"
	"database/sql"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"regexp"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
	"github.com/indusbase/indus-meta/internal/postgres"
)

var projectSlugRe = regexp.MustCompile(`^[a-z0-9][a-z0-9-]{1,28}[a-z0-9]$`)

type ProjectsHandler struct {
	db             *postgres.DB
	auditURL       string
	internalSecret string
	httpClient     *http.Client
}

func NewProjectsHandler(db *postgres.DB) *ProjectsHandler {
	return &ProjectsHandler{
		db:             db,
		auditURL:       strings.TrimSuffix(os.Getenv("AUDIT_SERVICE_URL"), "/"),
		internalSecret: os.Getenv("INTERNAL_SECRET"),
		httpClient:     &http.Client{Timeout: 5 * time.Second},
	}
}

func (h *ProjectsHandler) CreateOrganization(c *gin.Context) {
	var req struct {
		Name       string `json:"name" binding:"required"`
		Slug       string `json:"slug" binding:"required"`
		Plan       string `json:"plan"`
		OwnerEmail string `json:"owner_email"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusUnprocessableEntity, gin.H{"data": nil, "error": gin.H{"code": "VALIDATION_ERROR", "message": err.Error()}})
		return
	}
	if !projectSlugRe.MatchString(req.Slug) {
		c.JSON(http.StatusUnprocessableEntity, gin.H{"data": nil, "error": gin.H{"code": "INVALID_SLUG", "message": "Slug must be 3-30 lowercase alphanumeric characters or hyphens"}})
		return
	}
	plan := req.Plan
	if plan == "" {
		plan = "free"
	}
	ownerEmail := strings.TrimSpace(req.OwnerEmail)
	if ownerEmail == "" {
		ownerEmail = "owner@indusbase.local"
	}

	var id string
	err := h.db.QueryRowContext(
		c.Request.Context(),
		`INSERT INTO indusbase_platform.organizations(name,slug,plan,owner_email) VALUES ($1,$2,$3,$4) RETURNING id`,
		req.Name, req.Slug, plan, ownerEmail,
	).Scan(&id)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"data": nil, "error": gin.H{"code": "DB_ERROR", "message": err.Error()}})
		return
	}
	c.JSON(http.StatusCreated, gin.H{"data": gin.H{"id": id, "name": req.Name, "slug": req.Slug, "plan": plan, "owner_email": ownerEmail}, "error": nil})
}

func (h *ProjectsHandler) ListOrganizations(c *gin.Context) {
	rows, err := h.db.QueryContext(c.Request.Context(),
		`SELECT id, name, slug, plan, owner_email, created_at FROM indusbase_platform.organizations ORDER BY created_at DESC`)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"data": nil, "error": gin.H{"code": "DB_ERROR", "message": err.Error()}})
		return
	}
	defer rows.Close()

	items := make([]gin.H, 0)
	for rows.Next() {
		var id, name, slug, plan, ownerEmail string
		var createdAt time.Time
		if err := rows.Scan(&id, &name, &slug, &plan, &ownerEmail, &createdAt); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"data": nil, "error": gin.H{"code": "DB_ERROR", "message": err.Error()}})
			return
		}
		items = append(items, gin.H{
			"id":          id,
			"name":        name,
			"slug":        slug,
			"plan":        plan,
			"owner_email": ownerEmail,
			"created_at":  createdAt,
		})
	}

	// Keep seed script compatible: if only one org, return object in `data`
	if len(items) == 1 {
		c.JSON(http.StatusOK, gin.H{"data": items[0], "error": nil})
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": items, "error": nil})
}

func (h *ProjectsHandler) CreateProject(c *gin.Context) {
	var req struct {
		Name   string `json:"name" binding:"required"`
		Slug   string `json:"slug" binding:"required"`
		Region string `json:"region"`
		OrgID  string `json:"org_id" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusUnprocessableEntity, gin.H{"data": nil, "error": gin.H{"code": "VALIDATION_ERROR", "message": err.Error()}})
		return
	}
	if !projectSlugRe.MatchString(req.Slug) {
		c.JSON(http.StatusUnprocessableEntity, gin.H{"data": nil, "error": gin.H{"code": "INVALID_SLUG", "message": "Slug must be 3-30 lowercase alphanumeric characters or hyphens"}})
		return
	}

	ctx := c.Request.Context()
	region := strings.TrimSpace(req.Region)
	if region == "" {
		region = "ap-south-1"
	}

	dbSchema := "proj_" + randomHex(4)
	jwtSecret := generateRandomBase64(32)
	anonKey, err := generateProjectKey("anon", dbSchema, jwtSecret)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"data": nil, "error": gin.H{"code": "KEY_GEN_ERROR", "message": err.Error()}})
		return
	}
	serviceKey, err := generateProjectKey("service_role", dbSchema, jwtSecret)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"data": nil, "error": gin.H{"code": "KEY_GEN_ERROR", "message": err.Error()}})
		return
	}

	tx, err := h.db.BeginTx(ctx, nil)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"data": nil, "error": gin.H{"code": "DB_ERROR", "message": err.Error()}})
		return
	}
	defer tx.Rollback()

	var projectID string
	err = tx.QueryRowContext(ctx, `
        INSERT INTO indusbase_platform.projects
          (org_id, name, slug, db_schema, jwt_secret, anon_key, service_role_key, region)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
        RETURNING id
    `, req.OrgID, req.Name, req.Slug, dbSchema, jwtSecret, anonKey, serviceKey, region).Scan(&projectID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"data": nil, "error": gin.H{"code": "DB_ERROR", "message": err.Error()}})
		return
	}

	if err := provisionProjectSchemaTx(ctx, tx, dbSchema); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"data": nil, "error": gin.H{"code": "SCHEMA_ERROR", "message": err.Error()}})
		return
	}
	if err := tx.Commit(); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"data": nil, "error": gin.H{"code": "DB_ERROR", "message": err.Error()}})
		return
	}

	c.JSON(http.StatusCreated, gin.H{"data": gin.H{
		"id":               projectID,
		"slug":             req.Slug,
		"db_schema":        dbSchema,
		"anon_key":         anonKey,
		"service_role_key": serviceKey,
		"region":           region,
		"status":           "active",
	}, "error": nil})
	h.emitAuditEvent(c.Request.Context(), map[string]interface{}{
		"project_id":    projectID,
		"actor_user_id": c.GetString("user_id"),
		"actor_email":   c.GetString("email"),
		"actor_type":    "user",
		"action":        "create_project",
		"resource_type": "project",
		"resource_id":   projectID,
		"severity":      "info",
		"metadata": map[string]interface{}{
			"slug":   req.Slug,
			"region": region,
		},
	})
}

func (h *ProjectsHandler) ListProjects(c *gin.Context) {
	orgID := c.Query("org_id")
	query := `SELECT id, org_id, name, slug, db_schema, region, status, created_at FROM indusbase_platform.projects`
	args := []interface{}{}
	if orgID != "" {
		query += " WHERE org_id = $1"
		args = append(args, orgID)
	}
	query += " ORDER BY created_at DESC"

	rows, err := h.db.QueryContext(c.Request.Context(), query, args...)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"data": nil, "error": gin.H{"code": "DB_ERROR", "message": err.Error()}})
		return
	}
	defer rows.Close()

	out := make([]gin.H, 0)
	for rows.Next() {
		var id, orgIDVal, name, slug, dbSchema, region, status string
		var createdAt time.Time
		if err := rows.Scan(&id, &orgIDVal, &name, &slug, &dbSchema, &region, &status, &createdAt); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"data": nil, "error": gin.H{"code": "DB_ERROR", "message": err.Error()}})
			return
		}
		out = append(out, gin.H{
			"id":         id,
			"org_id":     orgIDVal,
			"name":       name,
			"slug":       slug,
			"db_schema":  dbSchema,
			"region":     region,
			"status":     status,
			"created_at": createdAt,
		})
	}
	c.JSON(http.StatusOK, gin.H{"data": out, "error": nil})
}

func (h *ProjectsHandler) GetProject(c *gin.Context) {
	var out struct {
		ID        string    `json:"id"`
		OrgID     string    `json:"org_id"`
		Name      string    `json:"name"`
		Slug      string    `json:"slug"`
		DBSchema  string    `json:"db_schema"`
		Region    string    `json:"region"`
		Status    string    `json:"status"`
		CreatedAt time.Time `json:"created_at"`
	}
	err := h.db.QueryRowContext(c.Request.Context(),
		`SELECT id, org_id, name, slug, db_schema, region, status, created_at
         FROM indusbase_platform.projects WHERE id = $1`, c.Param("id")).
		Scan(&out.ID, &out.OrgID, &out.Name, &out.Slug, &out.DBSchema, &out.Region, &out.Status, &out.CreatedAt)
	if err != nil {
		code := http.StatusInternalServerError
		msg := err.Error()
		if err == sql.ErrNoRows {
			code = http.StatusNotFound
			msg = "project not found"
		}
		c.JSON(code, gin.H{"data": nil, "error": gin.H{"code": "NOT_FOUND", "message": msg}})
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": out, "error": nil})
}

func (h *ProjectsHandler) DeleteProject(c *gin.Context) {
	h.updateStatus(c, "deleted")
}

func (h *ProjectsHandler) PauseProject(c *gin.Context) {
	h.updateStatus(c, "paused")
}

func (h *ProjectsHandler) ResumeProject(c *gin.Context) {
	h.updateStatus(c, "active")
}

func (h *ProjectsHandler) updateStatus(c *gin.Context, status string) {
	projectID := c.Param("id")
	res, err := h.db.ExecContext(c.Request.Context(),
		`UPDATE indusbase_platform.projects SET status = $2 WHERE id = $1`, projectID, status)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"data": nil, "error": gin.H{"code": "DB_ERROR", "message": err.Error()}})
		return
	}
	n, _ := res.RowsAffected()
	if n == 0 {
		c.JSON(http.StatusNotFound, gin.H{"data": nil, "error": gin.H{"code": "NOT_FOUND", "message": "project not found"}})
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": gin.H{"id": projectID, "status": status}, "error": nil})
	action := "update_project_status"
	severity := "info"
	switch status {
	case "paused":
		action = "pause_project"
		severity = "warn"
	case "active":
		action = "resume_project"
	case "deleted":
		action = "delete_project"
		severity = "warn"
	}
	h.emitAuditEvent(c.Request.Context(), map[string]interface{}{
		"project_id":    projectID,
		"actor_user_id": c.GetString("user_id"),
		"actor_email":   c.GetString("email"),
		"actor_type":    "user",
		"action":        action,
		"resource_type": "project",
		"resource_id":   projectID,
		"severity":      severity,
		"metadata":      map[string]interface{}{"status": status},
	})
}

func (h *ProjectsHandler) emitAuditEvent(ctx context.Context, payload map[string]interface{}) {
	if h.auditURL == "" || h.internalSecret == "" {
		return
	}
	raw, err := json.Marshal(payload)
	if err != nil {
		return
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, h.auditURL+"/audit/internal/events", bytes.NewReader(raw))
	if err != nil {
		return
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-IndusBase-Internal", h.internalSecret)
	resp, err := h.httpClient.Do(req)
	if err != nil {
		return
	}
	_ = resp.Body.Close()
}

func provisionProjectSchemaTx(ctx context.Context, tx *sql.Tx, schema string) error {
	statements := []string{
		fmt.Sprintf("CREATE SCHEMA IF NOT EXISTS %s", quoteIdent(schema)),
		fmt.Sprintf(`CREATE TABLE IF NOT EXISTS %s.users (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            email TEXT UNIQUE,
            phone TEXT UNIQUE,
            encrypted_password TEXT,
            email_confirmed_at TIMESTAMPTZ,
            phone_confirmed_at TIMESTAMPTZ,
            raw_user_meta_data JSONB DEFAULT '{}',
            created_at TIMESTAMPTZ DEFAULT NOW(),
            updated_at TIMESTAMPTZ DEFAULT NOW()
        )`, quoteIdent(schema)),
		fmt.Sprintf(`CREATE TABLE IF NOT EXISTS %s.sessions (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            user_id UUID NOT NULL REFERENCES %s.users(id) ON DELETE CASCADE,
            refresh_token TEXT UNIQUE NOT NULL,
            user_agent TEXT,
            ip TEXT,
            created_at TIMESTAMPTZ DEFAULT NOW(),
            expires_at TIMESTAMPTZ NOT NULL
        )`, quoteIdent(schema), quoteIdent(schema)),
	}
	for _, stmt := range statements {
		if _, err := tx.ExecContext(ctx, stmt); err != nil {
			return fmt.Errorf("schema provision failed: %w", err)
		}
	}
	return nil
}

func generateProjectKey(role, schema, secret string) (string, error) {
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, jwt.MapClaims{
		"role":      role,
		"db_schema": schema,
		"iss":       "indusbase",
		"iat":       time.Now().Unix(),
	})
	return token.SignedString([]byte(secret))
}

func randomHex(n int) string {
	b := make([]byte, n)
	_, _ = rand.Read(b)
	return hex.EncodeToString(b)
}

func generateRandomBase64(n int) string {
	b := make([]byte, n)
	_, _ = rand.Read(b)
	return base64.RawStdEncoding.EncodeToString(b)
}

func quoteIdent(s string) string {
	return `"` + strings.ReplaceAll(s, `"`, `""`) + `"`
}
