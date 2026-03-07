package handlers

import (
	"database/sql"
	"encoding/json"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/indusbase/indus-meta/internal/postgres"
)

type SecurityScansHandler struct {
	db *postgres.DB
}

func NewSecurityScansHandler(db *postgres.DB) *SecurityScansHandler {
	return &SecurityScansHandler{db: db}
}

func (h *SecurityScansHandler) Summary(c *gin.Context) {
	ctx := c.Request.Context()
	out := gin.H{
		"last_run":        nil,
		"dependency":      gin.H{"status": "unknown", "issues": 0},
		"container":       gin.H{"status": "unknown", "issues": 0},
		"secret_scan":     gin.H{"status": "unknown", "issues": 0},
		"sbom":            gin.H{"status": "unknown", "issues": 0},
		"remediation_tips": []string{
			"Prioritize critical and high findings first.",
			"Patch internet-facing services before internal tools.",
			"Pin dependencies and rerun scans after each patch release.",
		},
	}

	var (
		id        string
		scanType  string
		toolName  string
		status    string
		summary   []byte
		createdAt time.Time
	)
	err := h.db.QueryRowContext(ctx, `
SELECT id, scan_type, tool_name, status, summary, created_at
FROM indusbase_platform.security_scan_runs
ORDER BY created_at DESC
LIMIT 1
`).Scan(&id, &scanType, &toolName, &status, &summary, &createdAt)
	if err != nil && err != sql.ErrNoRows {
		c.JSON(http.StatusInternalServerError, gin.H{"data": nil, "error": gin.H{"code": "SCAN_SUMMARY_FAILED", "message": err.Error()}})
		return
	}
	if err == nil {
		var s interface{}
		_ = json.Unmarshal(summary, &s)
		out["last_run"] = gin.H{
			"id":         id,
			"scan_type":  scanType,
			"tool_name":  toolName,
			"status":     status,
			"summary":    s,
			"created_at": createdAt,
		}
	}

	rows, err := h.db.QueryContext(ctx, `
SELECT scan_type, status, COALESCE((summary->>'issues')::int, 0) AS issues
FROM indusbase_platform.security_scan_runs
WHERE created_at >= NOW() - INTERVAL '14 days'
ORDER BY created_at DESC
`)
	if err == nil {
		defer rows.Close()
		seen := map[string]bool{}
		for rows.Next() {
			var t, s string
			var issues int
			if scanErr := rows.Scan(&t, &s, &issues); scanErr != nil {
				continue
			}
			if seen[t] {
				continue
			}
			seen[t] = true
			out[t] = gin.H{"status": s, "issues": issues}
		}
	}

	c.JSON(http.StatusOK, gin.H{"data": out, "error": nil})
}

func (h *SecurityScansHandler) ListRuns(c *gin.Context) {
	rows, err := h.db.QueryContext(c.Request.Context(), `
SELECT id, scan_type, tool_name, status, summary, report_url, started_at, completed_at, created_at
FROM indusbase_platform.security_scan_runs
ORDER BY created_at DESC
LIMIT 100
`)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"data": nil, "error": gin.H{"code": "SCAN_LIST_FAILED", "message": err.Error()}})
		return
	}
	defer rows.Close()
	out := make([]gin.H, 0)
	for rows.Next() {
		var (
			id, scanType, toolName, status string
			summary                        []byte
			reportURL                      sql.NullString
			startedAt, createdAt           time.Time
			completedAt                    sql.NullTime
		)
		if err := rows.Scan(&id, &scanType, &toolName, &status, &summary, &reportURL, &startedAt, &completedAt, &createdAt); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"data": nil, "error": gin.H{"code": "SCAN_ROW_FAILED", "message": err.Error()}})
			return
		}
		var parsed interface{}
		_ = json.Unmarshal(summary, &parsed)
		out = append(out, gin.H{
			"id":           id,
			"scan_type":    scanType,
			"tool_name":    toolName,
			"status":       status,
			"summary":      parsed,
			"report_url":   reportURL.String,
			"started_at":   startedAt,
			"completed_at": completedAt.Time,
			"created_at":   createdAt,
		})
	}
	c.JSON(http.StatusOK, gin.H{"data": out, "error": nil})
}

func (h *SecurityScansHandler) CreateRun(c *gin.Context) {
	var req struct {
		ScanType    string                 `json:"scan_type" binding:"required"`
		ToolName    string                 `json:"tool_name" binding:"required"`
		Status      string                 `json:"status" binding:"required"`
		Summary     map[string]interface{} `json:"summary"`
		ReportURL   string                 `json:"report_url"`
		StartedAt   *time.Time             `json:"started_at"`
		CompletedAt *time.Time             `json:"completed_at"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"data": nil, "error": gin.H{"code": "BAD_REQUEST", "message": err.Error()}})
		return
	}
	rawSummary, _ := json.Marshal(req.Summary)
	startedAt := time.Now().UTC()
	if req.StartedAt != nil {
		startedAt = req.StartedAt.UTC()
	}
	var id string
	err := h.db.QueryRowContext(c.Request.Context(), `
INSERT INTO indusbase_platform.security_scan_runs
  (scan_type, tool_name, status, summary, report_url, started_at, completed_at, created_at)
VALUES ($1,$2,$3,$4,$5,$6,$7,NOW())
RETURNING id
`, req.ScanType, req.ToolName, req.Status, rawSummary, req.ReportURL, startedAt, req.CompletedAt).Scan(&id)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"data": nil, "error": gin.H{"code": "SCAN_CREATE_FAILED", "message": err.Error()}})
		return
	}
	c.JSON(http.StatusCreated, gin.H{"data": gin.H{"id": id}, "error": nil})
}
