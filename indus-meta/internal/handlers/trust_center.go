package handlers

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/indusbase/indus-meta/internal/postgres"
	"github.com/lib/pq"
)

type TrustCenterHandler struct {
	db *postgres.DB
}

func NewTrustCenterHandler(db *postgres.DB) *TrustCenterHandler {
	return &TrustCenterHandler{db: db}
}

func (h *TrustCenterHandler) GetSettings(c *gin.Context) {
	var (
		id                   string
		statusText           string
		securityContact      string
		faqJSON              []byte
		updatedBy            sql.NullString
		updatedAt, createdAt time.Time
	)
	err := h.db.QueryRowContext(c.Request.Context(), `
SELECT id, public_status_text, security_contact_email, faq, updated_by, updated_at, created_at
FROM indusbase_platform.trust_center_settings
ORDER BY created_at ASC
LIMIT 1
`).Scan(&id, &statusText, &securityContact, &faqJSON, &updatedBy, &updatedAt, &createdAt)
	if err == sql.ErrNoRows {
		// Auto-bootstrap default row.
		var insertedID string
		if err := h.db.QueryRowContext(c.Request.Context(), `
INSERT INTO indusbase_platform.trust_center_settings (public_status_text, security_contact_email, faq, updated_by)
VALUES ('All systems operational', 'security@indusbase.com', '[]'::jsonb, 'system')
RETURNING id
`).Scan(&insertedID); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"data": nil, "error": gin.H{"code": "DB_ERROR", "message": err.Error()}})
			return
		}
		c.JSON(http.StatusOK, gin.H{"data": gin.H{
			"id":                     insertedID,
			"public_status_text":     "All systems operational",
			"security_contact_email": "security@indusbase.com",
			"faq":                    []map[string]interface{}{},
		}, "error": nil})
		return
	}
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"data": nil, "error": gin.H{"code": "DB_ERROR", "message": err.Error()}})
		return
	}
	var faq interface{}
	_ = json.Unmarshal(faqJSON, &faq)
	c.JSON(http.StatusOK, gin.H{"data": gin.H{
		"id":                     id,
		"public_status_text":     statusText,
		"security_contact_email": securityContact,
		"faq":                    faq,
		"updated_by":             updatedBy.String,
		"updated_at":             updatedAt,
		"created_at":             createdAt,
	}, "error": nil})
}

func (h *TrustCenterHandler) UpdateSettings(c *gin.Context) {
	var req struct {
		PublicStatusText     string      `json:"public_status_text"`
		SecurityContactEmail string      `json:"security_contact_email"`
		FAQ                  interface{} `json:"faq"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"data": nil, "error": gin.H{"code": "BAD_REQUEST", "message": err.Error()}})
		return
	}
	faqJSON, _ := json.Marshal(req.FAQ)
	userEmail := c.GetString("email")
	if userEmail == "" {
		userEmail = "admin@indusbase.local"
	}
	_, err := h.db.ExecContext(c.Request.Context(), `
UPDATE indusbase_platform.trust_center_settings
SET public_status_text = COALESCE(NULLIF($1,''), public_status_text),
    security_contact_email = COALESCE(NULLIF($2,''), security_contact_email),
    faq = COALESCE($3, faq),
    updated_by = $4,
    updated_at = NOW()
WHERE id = (SELECT id FROM indusbase_platform.trust_center_settings ORDER BY created_at ASC LIMIT 1)
`, req.PublicStatusText, req.SecurityContactEmail, faqJSON, userEmail)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"data": nil, "error": gin.H{"code": "UPDATE_FAILED", "message": err.Error()}})
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": gin.H{"updated": true}, "error": nil})
}

func (h *TrustCenterHandler) ListSubprocessors(c *gin.Context) {
	rows, err := h.db.QueryContext(c.Request.Context(), `
SELECT id, name, purpose, region, website, data_types, is_active, created_at, updated_at
FROM indusbase_platform.subprocessors
ORDER BY updated_at DESC
`)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"data": nil, "error": gin.H{"code": "DB_ERROR", "message": err.Error()}})
		return
	}
	defer rows.Close()
	out := make([]gin.H, 0)
	for rows.Next() {
		var id, name, purpose, region string
		var website sql.NullString
		var dataTypes []string
		var isActive bool
		var createdAt, updatedAt time.Time
		if err := rows.Scan(&id, &name, &purpose, &region, &website, pq.Array(&dataTypes), &isActive, &createdAt, &updatedAt); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"data": nil, "error": gin.H{"code": "SCAN_ERROR", "message": err.Error()}})
			return
		}
		out = append(out, gin.H{
			"id":         id,
			"name":       name,
			"purpose":    purpose,
			"region":     region,
			"website":    website.String,
			"data_types": dataTypes,
			"is_active":  isActive,
			"created_at": createdAt,
			"updated_at": updatedAt,
		})
	}
	c.JSON(http.StatusOK, gin.H{"data": out, "error": nil})
}

func (h *TrustCenterHandler) CreateSubprocessor(c *gin.Context) {
	var req struct {
		Name      string   `json:"name" binding:"required"`
		Purpose   string   `json:"purpose" binding:"required"`
		Region    string   `json:"region"`
		Website   string   `json:"website"`
		DataTypes []string `json:"data_types"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"data": nil, "error": gin.H{"code": "BAD_REQUEST", "message": err.Error()}})
		return
	}
	if req.Region == "" {
		req.Region = "ap-south-1"
	}
	var id string
	err := h.db.QueryRowContext(c.Request.Context(), `
INSERT INTO indusbase_platform.subprocessors(name,purpose,region,website,data_types,is_active,created_at,updated_at)
VALUES ($1,$2,$3,$4,$5,TRUE,NOW(),NOW())
RETURNING id
`, req.Name, req.Purpose, req.Region, req.Website, pq.Array(req.DataTypes)).Scan(&id)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"data": nil, "error": gin.H{"code": "CREATE_FAILED", "message": err.Error()}})
		return
	}
	c.JSON(http.StatusCreated, gin.H{"data": gin.H{"id": id}, "error": nil})
}

func (h *TrustCenterHandler) UpdateSubprocessor(c *gin.Context) {
	var req struct {
		Name      *string   `json:"name"`
		Purpose   *string   `json:"purpose"`
		Region    *string   `json:"region"`
		Website   *string   `json:"website"`
		DataTypes *[]string `json:"data_types"`
		IsActive  *bool     `json:"is_active"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"data": nil, "error": gin.H{"code": "BAD_REQUEST", "message": err.Error()}})
		return
	}
	updates := map[string]interface{}{}
	if req.Name != nil {
		updates["name"] = *req.Name
	}
	if req.Purpose != nil {
		updates["purpose"] = *req.Purpose
	}
	if req.Region != nil {
		updates["region"] = *req.Region
	}
	if req.Website != nil {
		updates["website"] = *req.Website
	}
	if req.DataTypes != nil {
		updates["data_types"] = pq.Array(*req.DataTypes)
	}
	if req.IsActive != nil {
		updates["is_active"] = *req.IsActive
	}
	if len(updates) == 0 {
		c.JSON(http.StatusOK, gin.H{"data": gin.H{"updated": false}, "error": nil})
		return
	}
	query := "UPDATE indusbase_platform.subprocessors SET "
	args := []interface{}{}
	i := 1
	for key, value := range updates {
		if i > 1 {
			query += ", "
		}
		query += key + " = $" + fmt.Sprintf("%d", i)
		args = append(args, value)
		i++
	}
	query += ", updated_at = NOW() WHERE id = $" + fmt.Sprintf("%d", i)
	args = append(args, c.Param("id"))
	if _, err := h.db.ExecContext(c.Request.Context(), query, args...); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"data": nil, "error": gin.H{"code": "UPDATE_FAILED", "message": err.Error()}})
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": gin.H{"updated": true}, "error": nil})
}

func (h *TrustCenterHandler) DeleteSubprocessor(c *gin.Context) {
	res, err := h.db.ExecContext(c.Request.Context(), `DELETE FROM indusbase_platform.subprocessors WHERE id = $1`, c.Param("id"))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"data": nil, "error": gin.H{"code": "DELETE_FAILED", "message": err.Error()}})
		return
	}
	n, _ := res.RowsAffected()
	if n == 0 {
		c.JSON(http.StatusNotFound, gin.H{"data": nil, "error": gin.H{"code": "NOT_FOUND", "message": "subprocessor not found"}})
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": gin.H{"deleted": true}, "error": nil})
}

func (h *TrustCenterHandler) ListMilestones(c *gin.Context) {
	rows, err := h.db.QueryContext(c.Request.Context(), `
SELECT id, framework, target_date, status, notes, created_at, updated_at
FROM indusbase_platform.compliance_milestones
ORDER BY target_date NULLS LAST, created_at DESC
`)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"data": nil, "error": gin.H{"code": "DB_ERROR", "message": err.Error()}})
		return
	}
	defer rows.Close()
	out := make([]gin.H, 0)
	for rows.Next() {
		var (
			id, framework, status string
			targetDate            sql.NullTime
			notes                 sql.NullString
			createdAt, updatedAt  time.Time
		)
		if err := rows.Scan(&id, &framework, &targetDate, &status, &notes, &createdAt, &updatedAt); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"data": nil, "error": gin.H{"code": "SCAN_ERROR", "message": err.Error()}})
			return
		}
		out = append(out, gin.H{
			"id":          id,
			"framework":   framework,
			"target_date": targetDate.Time,
			"status":      status,
			"notes":       notes.String,
			"created_at":  createdAt,
			"updated_at":  updatedAt,
		})
	}
	c.JSON(http.StatusOK, gin.H{"data": out, "error": nil})
}

func (h *TrustCenterHandler) CreateMilestone(c *gin.Context) {
	var req struct {
		Framework  string `json:"framework" binding:"required"`
		TargetDate string `json:"target_date"`
		Status     string `json:"status"`
		Notes      string `json:"notes"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"data": nil, "error": gin.H{"code": "BAD_REQUEST", "message": err.Error()}})
		return
	}
	if req.Status == "" {
		req.Status = "planned"
	}
	var id string
	err := h.db.QueryRowContext(c.Request.Context(), `
INSERT INTO indusbase_platform.compliance_milestones(framework,target_date,status,notes,created_at,updated_at)
VALUES ($1, NULLIF($2,'')::date, $3, $4, NOW(), NOW())
RETURNING id
`, req.Framework, req.TargetDate, req.Status, req.Notes).Scan(&id)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"data": nil, "error": gin.H{"code": "CREATE_FAILED", "message": err.Error()}})
		return
	}
	c.JSON(http.StatusCreated, gin.H{"data": gin.H{"id": id}, "error": nil})
}

func (h *TrustCenterHandler) UpdateMilestone(c *gin.Context) {
	var req struct {
		Framework  *string `json:"framework"`
		TargetDate *string `json:"target_date"`
		Status     *string `json:"status"`
		Notes      *string `json:"notes"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"data": nil, "error": gin.H{"code": "BAD_REQUEST", "message": err.Error()}})
		return
	}
	_, err := h.db.ExecContext(c.Request.Context(), `
UPDATE indusbase_platform.compliance_milestones
SET framework = COALESCE($2, framework),
    target_date = COALESCE(NULLIF($3,'')::date, target_date),
    status = COALESCE($4, status),
    notes = COALESCE($5, notes),
    updated_at = NOW()
WHERE id = $1
`, c.Param("id"), req.Framework, req.TargetDate, req.Status, req.Notes)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"data": nil, "error": gin.H{"code": "UPDATE_FAILED", "message": err.Error()}})
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": gin.H{"updated": true}, "error": nil})
}

func (h *TrustCenterHandler) DeleteMilestone(c *gin.Context) {
	_, err := h.db.ExecContext(c.Request.Context(), `DELETE FROM indusbase_platform.compliance_milestones WHERE id = $1`, c.Param("id"))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"data": nil, "error": gin.H{"code": "DELETE_FAILED", "message": err.Error()}})
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": gin.H{"deleted": true}, "error": nil})
}

func (h *TrustCenterHandler) ListPublicIncidents(c *gin.Context) {
	rows, err := h.db.QueryContext(c.Request.Context(), `
SELECT id, title, summary, severity, impact, started_at, resolved_at, status, postmortem_url, created_at, updated_at
FROM indusbase_platform.public_incidents
ORDER BY started_at DESC
LIMIT 200
`)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"data": nil, "error": gin.H{"code": "DB_ERROR", "message": err.Error()}})
		return
	}
	defer rows.Close()
	out := make([]gin.H, 0)
	for rows.Next() {
		var (
			id, title, summary, severity, status string
			impact, postmortemURL                sql.NullString
			startedAt, createdAt, updatedAt      time.Time
			resolvedAt                           sql.NullTime
		)
		if err := rows.Scan(&id, &title, &summary, &severity, &impact, &startedAt, &resolvedAt, &status, &postmortemURL, &createdAt, &updatedAt); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"data": nil, "error": gin.H{"code": "SCAN_ERROR", "message": err.Error()}})
			return
		}
		out = append(out, gin.H{
			"id":            id,
			"title":         title,
			"summary":       summary,
			"severity":      severity,
			"impact":        impact.String,
			"started_at":    startedAt,
			"resolved_at":   resolvedAt.Time,
			"status":        status,
			"postmortem_url": postmortemURL.String,
			"created_at":    createdAt,
			"updated_at":    updatedAt,
		})
	}
	c.JSON(http.StatusOK, gin.H{"data": out, "error": nil})
}

func (h *TrustCenterHandler) CreatePublicIncident(c *gin.Context) {
	var req struct {
		Title        string `json:"title" binding:"required"`
		Summary      string `json:"summary" binding:"required"`
		Severity     string `json:"severity"`
		Impact       string `json:"impact"`
		StartedAt    string `json:"started_at"`
		Status       string `json:"status"`
		PostmortemURL string `json:"postmortem_url"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"data": nil, "error": gin.H{"code": "BAD_REQUEST", "message": err.Error()}})
		return
	}
	if req.Severity == "" {
		req.Severity = "info"
	}
	if req.Status == "" {
		req.Status = "investigating"
	}
	if req.StartedAt == "" {
		req.StartedAt = time.Now().UTC().Format(time.RFC3339)
	}
	var id string
	err := h.db.QueryRowContext(c.Request.Context(), `
INSERT INTO indusbase_platform.public_incidents
  (title, summary, severity, impact, started_at, status, postmortem_url, created_at, updated_at)
VALUES ($1,$2,$3,$4,$5::timestamptz,$6,$7,NOW(),NOW())
RETURNING id
`, req.Title, req.Summary, req.Severity, req.Impact, req.StartedAt, req.Status, req.PostmortemURL).Scan(&id)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"data": nil, "error": gin.H{"code": "CREATE_FAILED", "message": err.Error()}})
		return
	}
	c.JSON(http.StatusCreated, gin.H{"data": gin.H{"id": id}, "error": nil})
}

func (h *TrustCenterHandler) UpdatePublicIncident(c *gin.Context) {
	var req struct {
		Title         *string `json:"title"`
		Summary       *string `json:"summary"`
		Severity      *string `json:"severity"`
		Impact        *string `json:"impact"`
		StartedAt     *string `json:"started_at"`
		ResolvedAt    *string `json:"resolved_at"`
		Status        *string `json:"status"`
		PostmortemURL *string `json:"postmortem_url"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"data": nil, "error": gin.H{"code": "BAD_REQUEST", "message": err.Error()}})
		return
	}
	_, err := h.db.ExecContext(c.Request.Context(), `
UPDATE indusbase_platform.public_incidents
SET title = COALESCE($2, title),
    summary = COALESCE($3, summary),
    severity = COALESCE($4, severity),
    impact = COALESCE($5, impact),
    started_at = COALESCE(NULLIF($6,'')::timestamptz, started_at),
    resolved_at = COALESCE(NULLIF($7,'')::timestamptz, resolved_at),
    status = COALESCE($8, status),
    postmortem_url = COALESCE($9, postmortem_url),
    updated_at = NOW()
WHERE id = $1
`, c.Param("id"), req.Title, req.Summary, req.Severity, req.Impact, req.StartedAt, req.ResolvedAt, req.Status, req.PostmortemURL)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"data": nil, "error": gin.H{"code": "UPDATE_FAILED", "message": err.Error()}})
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": gin.H{"updated": true}, "error": nil})
}

func (h *TrustCenterHandler) DeletePublicIncident(c *gin.Context) {
	_, err := h.db.ExecContext(c.Request.Context(), `DELETE FROM indusbase_platform.public_incidents WHERE id = $1`, c.Param("id"))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"data": nil, "error": gin.H{"code": "DELETE_FAILED", "message": err.Error()}})
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": gin.H{"deleted": true}, "error": nil})
}
