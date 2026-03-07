package handlers

import (
	"bytes"
	"context"
	"database/sql"
	"encoding/json"
	"net/http"
	"os"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
	"github.com/indusbase/indus-meta/internal/postgres"
)

type SupportHandler struct {
	db                   *postgres.DB
	auditURL             string
	internalSecret       string
	impersonationJWTKey  []byte
	httpClient           *http.Client
}

func NewSupportHandler(db *postgres.DB) *SupportHandler {
	internal := os.Getenv("INTERNAL_SECRET")
	signing := os.Getenv("SUPPORT_IMPERSONATION_SECRET")
	if signing == "" {
		signing = internal
	}
	return &SupportHandler{
		db:                  db,
		auditURL:            strings.TrimSuffix(os.Getenv("AUDIT_SERVICE_URL"), "/"),
		internalSecret:      internal,
		impersonationJWTKey: []byte(signing),
		httpClient:          &http.Client{Timeout: 5 * time.Second},
	}
}

func (h *SupportHandler) SearchUsers(c *gin.Context) {
	if !h.requireAdmin(c) {
		return
	}
	q := strings.TrimSpace(c.Query("q"))
	if q == "" {
		c.JSON(http.StatusBadRequest, gin.H{"data": nil, "error": gin.H{"code": "QUERY_REQUIRED", "message": "q is required"}})
		return
	}
	like := "%" + strings.ToLower(q) + "%"
	rows, err := h.db.QueryContext(c.Request.Context(), `
SELECT id, email, phone, role, status, created_at
FROM indusbase_auth.users
WHERE LOWER(email) LIKE $1 OR phone LIKE $2 OR id::text = $3
ORDER BY created_at DESC
LIMIT 50
`, like, "%"+q+"%", q)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"data": nil, "error": gin.H{"code": "USER_SEARCH_FAILED", "message": err.Error()}})
		return
	}
	defer rows.Close()
	out := make([]gin.H, 0)
	for rows.Next() {
		var id string
		var email, phone, role, status sql.NullString
		var createdAt time.Time
		if err := rows.Scan(&id, &email, &phone, &role, &status, &createdAt); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"data": nil, "error": gin.H{"code": "USER_SCAN_FAILED", "message": err.Error()}})
			return
		}
		out = append(out, gin.H{
			"id":         id,
			"email":      email.String,
			"phone":      phone.String,
			"role":       role.String,
			"status":     status.String,
			"created_at": createdAt,
		})
	}
	c.JSON(http.StatusOK, gin.H{"data": out, "error": nil})
	h.emitAuditEvent(c.Request.Context(), c, "support_user_search", "support", q, "info", gin.H{"query": q, "result_count": len(out)})
}

func (h *SupportHandler) SearchProjects(c *gin.Context) {
	if !h.requireAdmin(c) {
		return
	}
	q := strings.TrimSpace(c.Query("q"))
	if q == "" {
		c.JSON(http.StatusBadRequest, gin.H{"data": nil, "error": gin.H{"code": "QUERY_REQUIRED", "message": "q is required"}})
		return
	}
	like := "%" + strings.ToLower(q) + "%"
	rows, err := h.db.QueryContext(c.Request.Context(), `
SELECT id, org_id, name, slug, db_schema, region, status, created_at
FROM indusbase_platform.projects
WHERE LOWER(slug) LIKE $1 OR id::text = $2 OR LOWER(name) LIKE $1
ORDER BY created_at DESC
LIMIT 50
`, like, q)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"data": nil, "error": gin.H{"code": "PROJECT_SEARCH_FAILED", "message": err.Error()}})
		return
	}
	defer rows.Close()
	out := make([]gin.H, 0)
	for rows.Next() {
		var id, orgID, name, slug, dbSchema, region, status string
		var createdAt time.Time
		if err := rows.Scan(&id, &orgID, &name, &slug, &dbSchema, &region, &status, &createdAt); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"data": nil, "error": gin.H{"code": "PROJECT_SCAN_FAILED", "message": err.Error()}})
			return
		}
		out = append(out, gin.H{
			"id":         id,
			"org_id":     orgID,
			"name":       name,
			"slug":       slug,
			"db_schema":  dbSchema,
			"region":     region,
			"status":     status,
			"created_at": createdAt,
		})
	}
	c.JSON(http.StatusOK, gin.H{"data": out, "error": nil})
	h.emitAuditEvent(c.Request.Context(), c, "support_project_search", "support", q, "info", gin.H{"query": q, "result_count": len(out)})
}

func (h *SupportHandler) Context(c *gin.Context) {
	if !h.requireAdmin(c) {
		return
	}
	ctx := c.Request.Context()
	userID := strings.TrimSpace(c.Query("user_id"))
	projectID := strings.TrimSpace(c.Query("project_id"))
	if userID == "" && projectID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"data": nil, "error": gin.H{"code": "FILTER_REQUIRED", "message": "user_id or project_id is required"}})
		return
	}

	out := gin.H{}

	if userID != "" {
		var user gin.H = gin.H{}
		var email, phone, role, status sql.NullString
		var createdAt sql.NullTime
		_ = h.db.QueryRowContext(ctx, `
SELECT email, phone, role, status, created_at
FROM indusbase_auth.users WHERE id = $1
`, userID).Scan(&email, &phone, &role, &status, &createdAt)
		user["id"] = userID
		user["email"] = email.String
		user["phone"] = phone.String
		user["role"] = role.String
		user["status"] = status.String
		user["created_at"] = createdAt.Time
		out["user"] = user

		out["recent_notifications"] = h.queryRows(ctx, `
SELECT id, channel, recipient, status, error_message, created_at
FROM indusbase_notify.notifications
WHERE user_id::text = $1
ORDER BY created_at DESC LIMIT 20
`, userID)

		out["recent_auth_events"] = h.queryRows(ctx, `
SELECT id, action, severity, metadata, created_at
FROM indusbase_audit.audit_events
WHERE actor_user_id::text = $1 OR metadata->>'user_id' = $1
ORDER BY created_at DESC LIMIT 20
`, userID)

		out["recent_queue_jobs"] = h.queryRows(ctx, `
SELECT id, queue_name, status, created_at
FROM indusbase_queue.jobs
WHERE payload->>'user_id' = $1
ORDER BY created_at DESC LIMIT 20
`, userID)
	}

	if projectID != "" {
		out["project"] = h.querySingle(ctx, `
SELECT id, org_id, name, slug, db_schema, region, status, created_at
FROM indusbase_platform.projects
WHERE id::text = $1
`, projectID)

		out["project_webhooks"] = h.queryRows(ctx, `
SELECT id, name, table_schema, table_name, events, is_active, created_at
FROM indusbase_queue.webhooks
WHERE project_id::text = $1
ORDER BY created_at DESC LIMIT 20
`, projectID)

		out["project_usage"] = h.queryRows(ctx, `
SELECT metric, quantity, period
FROM indusbase_platform.usage_events
WHERE project_id::text = $1
ORDER BY period DESC LIMIT 30
`, projectID)
	}

	c.JSON(http.StatusOK, gin.H{"data": out, "error": nil})
	h.emitAuditEvent(ctx, c, "support_context_lookup", "support", projectID+":"+userID, "info", gin.H{
		"user_id":    userID,
		"project_id": projectID,
	})
}

func (h *SupportHandler) CreateNote(c *gin.Context) {
	if !h.requireAdmin(c) {
		return
	}
	var req struct {
		ProjectID string                 `json:"project_id"`
		UserID    string                 `json:"user_id"`
		Severity  string                 `json:"severity"`
		Note      string                 `json:"note" binding:"required"`
		Metadata  map[string]interface{} `json:"metadata"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"data": nil, "error": gin.H{"code": "BAD_REQUEST", "message": err.Error()}})
		return
	}
	if req.Severity == "" {
		req.Severity = "low"
	}
	rawMeta, _ := json.Marshal(req.Metadata)
	var id string
	err := h.db.QueryRowContext(c.Request.Context(), `
INSERT INTO indusbase_platform.support_notes
  (project_id, user_id, actor_user_id, actor_email, severity, note, metadata, created_at)
VALUES (NULLIF($1,'')::uuid, NULLIF($2,'')::uuid, NULLIF($3,'')::uuid, $4, $5, $6, $7, NOW())
RETURNING id
`, req.ProjectID, req.UserID, c.GetString("user_id"), c.GetString("email"), req.Severity, req.Note, rawMeta).Scan(&id)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"data": nil, "error": gin.H{"code": "NOTE_CREATE_FAILED", "message": err.Error()}})
		return
	}
	c.JSON(http.StatusCreated, gin.H{"data": gin.H{"id": id}, "error": nil})
	h.emitAuditEvent(c.Request.Context(), c, "support_note_create", "support_note", id, "warn", gin.H{
		"project_id": req.ProjectID,
		"user_id":    req.UserID,
		"severity":   req.Severity,
	})
}

func (h *SupportHandler) ListNotes(c *gin.Context) {
	if !h.requireAdmin(c) {
		return
	}
	projectID := c.Query("project_id")
	userID := c.Query("user_id")
	rows, err := h.db.QueryContext(c.Request.Context(), `
SELECT id, project_id, user_id, actor_user_id, actor_email, severity, note, metadata, created_at
FROM indusbase_platform.support_notes
WHERE ($1 = '' OR project_id::text = $1)
  AND ($2 = '' OR user_id::text = $2)
ORDER BY created_at DESC
LIMIT 100
`, projectID, userID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"data": nil, "error": gin.H{"code": "NOTES_LIST_FAILED", "message": err.Error()}})
		return
	}
	defer rows.Close()
	out := make([]gin.H, 0)
	for rows.Next() {
		var (
			id, actorEmail, severity, note string
			projectID, userID, actorUserID sql.NullString
			metadata                       []byte
			createdAt                      time.Time
		)
		if err := rows.Scan(&id, &projectID, &userID, &actorUserID, &actorEmail, &severity, &note, &metadata, &createdAt); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"data": nil, "error": gin.H{"code": "NOTES_SCAN_FAILED", "message": err.Error()}})
			return
		}
		var parsed interface{}
		_ = json.Unmarshal(metadata, &parsed)
		out = append(out, gin.H{
			"id":            id,
			"project_id":    projectID.String,
			"user_id":       userID.String,
			"actor_user_id": actorUserID.String,
			"actor_email":   actorEmail,
			"severity":      severity,
			"note":          note,
			"metadata":      parsed,
			"created_at":    createdAt,
		})
	}
	c.JSON(http.StatusOK, gin.H{"data": out, "error": nil})
	h.emitAuditEvent(c.Request.Context(), c, "support_notes_list", "support_note", projectID+":"+userID, "info", gin.H{
		"project_id": projectID,
		"user_id":    userID,
	})
}

func (h *SupportHandler) RequestImpersonation(c *gin.Context) {
	if !h.requireAdmin(c) {
		return
	}
	var req struct {
		TargetUserID    string `json:"target_user_id" binding:"required"`
		TargetProjectID string `json:"target_project_id"`
		Reason          string `json:"reason" binding:"required"`
		DurationMinutes int    `json:"duration_minutes"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"data": nil, "error": gin.H{"code": "BAD_REQUEST", "message": err.Error()}})
		return
	}
	if req.DurationMinutes <= 0 || req.DurationMinutes > 60 {
		req.DurationMinutes = 15
	}
	expiresAt := time.Now().UTC().Add(time.Duration(req.DurationMinutes) * time.Minute)

	claims := jwt.MapClaims{
		"typ":        "support_impersonation_approval",
		"sub":        req.TargetUserID,
		"project_id": req.TargetProjectID,
		"reason":     req.Reason,
		"requester":  c.GetString("email"),
		"iat":        time.Now().Unix(),
		"exp":        expiresAt.Unix(),
	}
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	signed, err := token.SignedString(h.impersonationJWTKey)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"data": nil, "error": gin.H{"code": "TOKEN_SIGN_FAILED", "message": err.Error()}})
		return
	}

	var id string
	err = h.db.QueryRowContext(c.Request.Context(), `
INSERT INTO indusbase_platform.impersonation_requests
  (requester_user_id, requester_email, target_user_id, target_project_id, reason, approval_token, status, expires_at, created_at)
VALUES (NULLIF($1,'')::uuid, $2, $3::uuid, NULLIF($4,'')::uuid, $5, $6, 'pending', $7, NOW())
RETURNING id
`, c.GetString("user_id"), c.GetString("email"), req.TargetUserID, req.TargetProjectID, req.Reason, signed, expiresAt).Scan(&id)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"data": nil, "error": gin.H{"code": "REQUEST_CREATE_FAILED", "message": err.Error()}})
		return
	}

	c.JSON(http.StatusCreated, gin.H{"data": gin.H{
		"request_id":      id,
		"status":          "pending",
		"approval_token":  signed,
		"expires_at":      expiresAt,
		"target_user_id":  req.TargetUserID,
		"target_project":  req.TargetProjectID,
		"requires_review": true,
	}, "error": nil})
	h.emitAuditEvent(c.Request.Context(), c, "support_impersonation_request", "support_impersonation", id, "critical", gin.H{
		"target_user_id":    req.TargetUserID,
		"target_project_id": req.TargetProjectID,
		"reason":            req.Reason,
		"expires_at":        expiresAt,
	})
}

func (h *SupportHandler) requireAdmin(c *gin.Context) bool {
	role := strings.ToLower(strings.TrimSpace(c.GetString("role")))
	if role == "" {
		role = strings.ToLower(strings.TrimSpace(c.GetHeader("X-IndusBase-Role")))
	}
	isServiceRole := strings.EqualFold(c.GetHeader("X-IndusBase-Is-Service-Role"), "true")
	if isServiceRole || role == "admin" || role == "owner" {
		return true
	}
	c.JSON(http.StatusForbidden, gin.H{"data": nil, "error": gin.H{"code": "ADMIN_REQUIRED", "message": "Admin role required"}})
	return false
}

func (h *SupportHandler) queryRows(ctx context.Context, query string, arg string) []gin.H {
	rows, err := h.db.QueryContext(ctx, query, arg)
	if err != nil {
		return []gin.H{}
	}
	defer rows.Close()
	cols, err := rows.Columns()
	if err != nil {
		return []gin.H{}
	}
	out := make([]gin.H, 0)
	for rows.Next() {
		values := make([]interface{}, len(cols))
		ptrs := make([]interface{}, len(cols))
		for i := range values {
			ptrs[i] = &values[i]
		}
		if err := rows.Scan(ptrs...); err != nil {
			continue
		}
		row := gin.H{}
		for i, col := range cols {
			v := values[i]
			if b, ok := v.([]byte); ok {
				row[col] = string(b)
			} else {
				row[col] = v
			}
		}
		out = append(out, row)
	}
	return out
}

func (h *SupportHandler) querySingle(ctx context.Context, query string, arg string) gin.H {
	rows := h.queryRows(ctx, query, arg)
	if len(rows) == 0 {
		return gin.H{}
	}
	return rows[0]
}

func (h *SupportHandler) emitAuditEvent(ctx context.Context, c *gin.Context, action, resourceType, resourceID, severity string, metadata gin.H) {
	if h.auditURL == "" || h.internalSecret == "" {
		return
	}
	payload := map[string]interface{}{
		"project_id":    c.GetHeader("X-IndusBase-Project-ID"),
		"actor_user_id": c.GetString("user_id"),
		"actor_email":   c.GetString("email"),
		"actor_type":    "user",
		"action":        action,
		"resource_type": resourceType,
		"resource_id":   resourceID,
		"severity":      severity,
		"ip_address":    c.ClientIP(),
		"user_agent":    c.Request.UserAgent(),
		"metadata":      metadata,
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
