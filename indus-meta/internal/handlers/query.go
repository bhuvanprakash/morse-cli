package handlers

import (
	"database/sql"
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/indusbase/indus-meta/internal/postgres"
)

// QueryRequest represents a raw SQL query request
type QueryRequest struct {
	Query string `json:"query" binding:"required"`
}

// QueryResult represents the result of a query
type QueryResult struct {
	Columns []string        `json:"columns"`
	Rows    [][]interface{} `json:"rows"`
	Count   int             `json:"count"`
}

// QueryHandler handles raw SQL query requests
type QueryHandler struct {
	db *postgres.DB
}

// NewQueryHandler creates a new query handler
func NewQueryHandler(db *postgres.DB) *QueryHandler {
	return &QueryHandler{db: db}
}

// Execute handles POST /meta/query (admin only, run arbitrary SQL)
func (h *QueryHandler) Execute(c *gin.Context) {
	var req QueryRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "error": "Invalid request body"})
		return
	}

	// Basic validation - reject dangerous operations
	upperQuery := strings.ToUpper(strings.TrimSpace(req.Query))
	if strings.HasPrefix(upperQuery, "DROP DATABASE") ||
		strings.HasPrefix(upperQuery, "DROP ROLE") ||
		strings.HasPrefix(upperQuery, "DROP USER") {
		c.JSON(http.StatusForbidden, gin.H{"success": false, "error": "Dangerous operation not allowed"})
		return
	}

	// Execute query
	rows, err := h.db.QueryContext(c.Request.Context(), req.Query)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "error": err.Error()})
		return
	}
	defer rows.Close()

	// Get column names
	columns, err := rows.Columns()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "error": err.Error()})
		return
	}

	// Fetch rows
	var resultRows [][]interface{}
	for rows.Next() {
		values := make([]interface{}, len(columns))
		valuePtrs := make([]interface{}, len(columns))
		for i := range values {
			valuePtrs[i] = &values[i]
		}

		if err := rows.Scan(valuePtrs...); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"success": false, "error": err.Error()})
			return
		}

		// Convert []byte to string for JSON serialization
		for i, v := range values {
			if b, ok := v.([]byte); ok {
				values[i] = string(b)
			}
		}

		resultRows = append(resultRows, values)
	}

	if err := rows.Err(); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "error": err.Error()})
		return
	}

	result := QueryResult{
		Columns: columns,
		Rows:    resultRows,
		Count:   len(resultRows),
	}

	c.JSON(http.StatusOK, gin.H{"success": true, "result": result})
}

// ExecuteWrite handles write operations (INSERT, UPDATE, DELETE)
func (h *QueryHandler) ExecuteWrite(c *gin.Context) {
	var req QueryRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "error": "Invalid request body"})
		return
	}

	// Basic validation - only allow DML operations
	upperQuery := strings.ToUpper(strings.TrimSpace(req.Query))
	if !strings.HasPrefix(upperQuery, "INSERT") &&
		!strings.HasPrefix(upperQuery, "UPDATE") &&
		!strings.HasPrefix(upperQuery, "DELETE") {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "error": "Only INSERT, UPDATE, DELETE operations allowed"})
		return
	}

	// Execute query
	result, err := h.db.ExecContext(c.Request.Context(), req.Query)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "error": err.Error()})
		return
	}

	rowsAffected, _ := result.RowsAffected()
	lastID, _ := result.LastInsertId()

	c.JSON(http.StatusOK, gin.H{
		"success":        true,
		"rows_affected":  rowsAffected,
		"last_insert_id": lastID,
	})
}

// QueryRow handles single row queries
func (h *QueryHandler) QueryRow(c *gin.Context) {
	var req QueryRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "error": "Invalid request body"})
		return
	}

	row := h.db.QueryRowContext(c.Request.Context(), req.Query)

	// Try to get column count by using a dummy scan
	var result interface{}
	err := row.Scan(&result)
	if err == sql.ErrNoRows {
		c.JSON(http.StatusNotFound, gin.H{"success": false, "error": "No rows returned"})
		return
	}
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"success": true, "result": result})
}
