package handlers

import (
	"database/sql"
	"encoding/json"
	"net/http"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/indusbase/indus-auth/internal/enterprise"
	"github.com/indusbase/indus-auth/internal/repository"
	"github.com/indusbase/indus-auth/pkg/crypto"
)

type SCIMHandler struct {
	DB *sql.DB
}

func NewSCIMHandler(db *sql.DB) *SCIMHandler {
	return &SCIMHandler{DB: db}
}

type createSCIMTokenRequest struct {
	Name      string `json:"name" binding:"required"`
	ProjectID string `json:"project_id"`
	ExpiresAt string `json:"expires_at"`
}

func (h *SCIMHandler) CreateToken(c *gin.Context) {
	connectionID := c.Param("id")
	var req createSCIMTokenRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"data": nil, "error": gin.H{"code": "BAD_REQUEST", "message": err.Error()}})
		return
	}
	var expiresAt *time.Time
	if strings.TrimSpace(req.ExpiresAt) != "" {
		t, err := time.Parse(time.RFC3339, strings.TrimSpace(req.ExpiresAt))
		if err != nil {
			c.JSON(http.StatusUnprocessableEntity, gin.H{"data": nil, "error": gin.H{"code": "INVALID_EXPIRY", "message": "expires_at must be RFC3339"}})
			return
		}
		expiresAt = &t
	}

	var projectID *string
	if strings.TrimSpace(req.ProjectID) != "" {
		projectID = &req.ProjectID
	}

	tokenRec, rawToken, err := enterprise.CreateSCIMToken(c.Request.Context(), h.DB, connectionID, req.Name, expiresAt)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"data": nil, "error": gin.H{"code": "TOKEN_CREATE_FAILED", "message": err.Error()}})
		return
	}
	if projectID != nil {
		_, _ = h.DB.ExecContext(c.Request.Context(), `UPDATE indusbase_auth.scim_tokens SET project_id = $2 WHERE id = $1`, tokenRec.ID, *projectID)
	}

	c.JSON(http.StatusCreated, gin.H{
		"data": gin.H{
			"token":        rawToken,
			"id":           tokenRec.ID,
			"name":         tokenRec.Name,
			"token_prefix": tokenRec.TokenPrefix,
			"project_id":   projectID,
			"expires_at":   tokenRec.ExpiresAt,
		},
		"error": nil,
	})
	emitAudit(c, map[string]interface{}{
		"actor_type":    "user",
		"action":        "create_scim_token",
		"resource_type": "scim_token",
		"resource_id":   tokenRec.ID,
		"severity":      "info",
		"metadata": map[string]interface{}{
			"connection_id": connectionID,
			"name":          req.Name,
		},
	})
}

func (h *SCIMHandler) ListTokens(c *gin.Context) {
	connectionID := c.Param("id")
	rows, err := h.DB.QueryContext(c.Request.Context(), `
SELECT id, connection_id, token_prefix, name, last_used_at, expires_at, revoked_at, created_at
FROM indusbase_auth.scim_tokens
WHERE connection_id = $1
ORDER BY created_at DESC
`, connectionID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"data": nil, "error": gin.H{"code": "DB_ERROR", "message": err.Error()}})
		return
	}
	defer rows.Close()
	items := make([]enterprise.SCIMToken, 0)
	for rows.Next() {
		var rec enterprise.SCIMToken
		if err := rows.Scan(&rec.ID, &rec.ConnectionID, &rec.TokenPrefix, &rec.Name, &rec.LastUsedAt, &rec.ExpiresAt, &rec.RevokedAt, &rec.CreatedAt); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"data": nil, "error": gin.H{"code": "SCAN_ERROR", "message": err.Error()}})
			return
		}
		items = append(items, rec)
	}
	c.JSON(http.StatusOK, gin.H{"data": items, "error": nil})
}

func (h *SCIMHandler) RotateToken(c *gin.Context) {
	connectionID := c.Param("id")
	tokenID := c.Param("tokenID")
	var existing string
	err := h.DB.QueryRowContext(c.Request.Context(), `
SELECT id FROM indusbase_auth.scim_tokens WHERE id = $1 AND connection_id = $2
`, tokenID, connectionID).Scan(&existing)
	if err == sql.ErrNoRows {
		c.JSON(http.StatusNotFound, gin.H{"data": nil, "error": gin.H{"code": "NOT_FOUND", "message": "SCIM token not found"}})
		return
	}
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"data": nil, "error": gin.H{"code": "DB_ERROR", "message": err.Error()}})
		return
	}
	_, rawToken, hash, err := enterprise.GenerateSCIMToken()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"data": nil, "error": gin.H{"code": "TOKEN_GENERATE_FAILED", "message": err.Error()}})
		return
	}
	prefix := rawToken[:12]
	_, err = h.DB.ExecContext(c.Request.Context(), `
UPDATE indusbase_auth.scim_tokens
SET token_hash = $2, token_prefix = $3, revoked_at = NULL, last_used_at = NULL, created_at = NOW()
WHERE id = $1
`, tokenID, hash, prefix)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"data": nil, "error": gin.H{"code": "TOKEN_ROTATE_FAILED", "message": err.Error()}})
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": gin.H{"id": tokenID, "token": rawToken, "token_prefix": prefix}, "error": nil})
	emitAudit(c, map[string]interface{}{
		"actor_type":    "user",
		"action":        "rotate_scim_token",
		"resource_type": "scim_token",
		"resource_id":   tokenID,
		"severity":      "warn",
		"metadata":      map[string]interface{}{"connection_id": connectionID},
	})
}

func (h *SCIMHandler) RevokeToken(c *gin.Context) {
	connectionID := c.Param("id")
	tokenID := c.Param("tokenID")
	res, err := h.DB.ExecContext(c.Request.Context(), `
UPDATE indusbase_auth.scim_tokens
SET revoked_at = NOW()
WHERE id = $1 AND connection_id = $2
`, tokenID, connectionID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"data": nil, "error": gin.H{"code": "TOKEN_REVOKE_FAILED", "message": err.Error()}})
		return
	}
	n, _ := res.RowsAffected()
	if n == 0 {
		c.JSON(http.StatusNotFound, gin.H{"data": nil, "error": gin.H{"code": "NOT_FOUND", "message": "SCIM token not found"}})
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": gin.H{"revoked": true, "id": tokenID}, "error": nil})
	emitAudit(c, map[string]interface{}{
		"actor_type":    "user",
		"action":        "revoke_scim_token",
		"resource_type": "scim_token",
		"resource_id":   tokenID,
		"severity":      "warn",
		"metadata":      map[string]interface{}{"connection_id": connectionID},
	})
}

func (h *SCIMHandler) GetUsers(c *gin.Context) {
	projectIDAny, _ := c.Get("scim_project_id")
	projectID, _ := projectIDAny.(string)
	query := `
SELECT id, email, name, status, created_at, updated_at
FROM indusbase_auth.users
WHERE deleted_at IS NULL
`
	args := []interface{}{}
	if projectID != "" {
		query += ` AND metadata->>'project_id' = $1`
		args = append(args, projectID)
	}
	query += ` ORDER BY created_at DESC LIMIT 1000`
	rows, err := h.DB.QueryContext(c.Request.Context(), query, args...)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"data": nil, "error": gin.H{"code": "DB_ERROR", "message": err.Error()}})
		return
	}
	defer rows.Close()
	resources := make([]gin.H, 0)
	for rows.Next() {
		var id, email, name, status string
		var createdAt, updatedAt time.Time
		if err := rows.Scan(&id, &email, &name, &status, &createdAt, &updatedAt); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"data": nil, "error": gin.H{"code": "SCAN_ERROR", "message": err.Error()}})
			return
		}
		resources = append(resources, gin.H{
			"id":       id,
			"userName": email,
			"active":   status == "active",
			"name": gin.H{
				"formatted": name,
			},
			"emails": []gin.H{{"value": email, "primary": true}},
			"meta": gin.H{
				"resourceType": "User",
				"created":      createdAt.Format(time.RFC3339),
				"lastModified": updatedAt.Format(time.RFC3339),
			},
		})
	}
	c.JSON(http.StatusOK, gin.H{
		"data": gin.H{
			"schemas":      []string{"urn:ietf:params:scim:api:messages:2.0:ListResponse"},
			"totalResults": len(resources),
			"startIndex":   1,
			"itemsPerPage": len(resources),
			"Resources":    resources,
		},
		"error": nil,
	})
}

type scimUserRequest struct {
	UserName string `json:"userName"`
	Name     struct {
		Formatted  string `json:"formatted"`
		GivenName  string `json:"givenName"`
		FamilyName string `json:"familyName"`
	} `json:"name"`
	Emails []struct {
		Value string `json:"value"`
	} `json:"emails"`
	Active *bool `json:"active"`
}

func (h *SCIMHandler) CreateUser(c *gin.Context) {
	var req scimUserRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"data": nil, "error": gin.H{"code": "BAD_REQUEST", "message": err.Error()}})
		return
	}
	email := strings.ToLower(strings.TrimSpace(req.UserName))
	if email == "" && len(req.Emails) > 0 {
		email = strings.ToLower(strings.TrimSpace(req.Emails[0].Value))
	}
	if email == "" {
		c.JSON(http.StatusUnprocessableEntity, gin.H{"data": nil, "error": gin.H{"code": "EMAIL_REQUIRED", "message": "SCIM user requires userName/email"}})
		return
	}

	name := strings.TrimSpace(req.Name.Formatted)
	if name == "" {
		name = strings.TrimSpace(req.Name.GivenName + " " + req.Name.FamilyName)
	}
	if name == "" {
		name = strings.Split(email, "@")[0]
	}
	projectIDAny, _ := c.Get("scim_project_id")
	projectID, _ := projectIDAny.(string)

	repo := repository.NewUserRepository(h.DB)
	existing, err := repo.GetByEmail(c.Request.Context(), email)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"data": nil, "error": gin.H{"code": "USER_LOOKUP_FAILED", "message": err.Error()}})
		return
	}

	if existing == nil {
		passwordHash, err := crypto.HashPassword(uuid.New().String(), 12)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"data": nil, "error": gin.H{"code": "PASSWORD_GEN_FAILED", "message": err.Error()}})
			return
		}
		meta, _ := json.Marshal(map[string]string{"project_id": projectID, "source": "scim"})
		existing, err = repo.CreateUser(c.Request.Context(), email, passwordHash, name, meta)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"data": nil, "error": gin.H{"code": "USER_CREATE_FAILED", "message": err.Error()}})
			return
		}
	}
	_ = repo.UpdateEmailVerified(c.Request.Context(), existing.ID, true)

	c.JSON(http.StatusCreated, gin.H{
		"data": gin.H{
			"schemas":  []string{"urn:ietf:params:scim:schemas:core:2.0:User"},
			"id":       existing.ID,
			"userName": existing.Email,
			"active":   true,
			"name": gin.H{
				"formatted": existing.Name,
			},
			"emails": []gin.H{{"value": existing.Email, "primary": true}},
		},
		"error": nil,
	})
	emitAuditRaw(c.Request.Context(), map[string]interface{}{
		"actor_type":    "scim",
		"action":        "scim_create_user",
		"resource_type": "user",
		"resource_id":   existing.ID,
		"severity":      "info",
		"metadata": map[string]interface{}{
			"email": email,
		},
	})
}

type scimPatchRequest struct {
	Operations []struct {
		Op    string      `json:"op"`
		Path  string      `json:"path"`
		Value interface{} `json:"value"`
	} `json:"Operations"`
}

func (h *SCIMHandler) PatchUser(c *gin.Context) {
	userID := c.Param("id")
	var req scimPatchRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"data": nil, "error": gin.H{"code": "BAD_REQUEST", "message": err.Error()}})
		return
	}
	updates := map[string]interface{}{}
	for _, op := range req.Operations {
		path := strings.ToLower(strings.TrimSpace(op.Path))
		switch path {
		case "username", "emails":
			if str, ok := op.Value.(string); ok {
				updates["email"] = strings.ToLower(strings.TrimSpace(str))
			}
		case "name.formatted", "name":
			if str, ok := op.Value.(string); ok {
				updates["name"] = strings.TrimSpace(str)
			}
		case "active":
			if active, ok := op.Value.(bool); ok {
				if active {
					updates["status"] = "active"
				} else {
					updates["status"] = "disabled"
				}
			}
		}
	}
	if len(updates) == 0 {
		c.JSON(http.StatusOK, gin.H{"data": gin.H{"updated": false}, "error": nil})
		return
	}
	repo := repository.NewUserRepository(h.DB)
	if err := repo.UpdateUser(c.Request.Context(), userID, updates); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"data": nil, "error": gin.H{"code": "UPDATE_FAILED", "message": err.Error()}})
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": gin.H{"updated": true, "id": userID}, "error": nil})
	emitAuditRaw(c.Request.Context(), map[string]interface{}{
		"actor_type":    "scim",
		"action":        "scim_patch_user",
		"resource_type": "user",
		"resource_id":   userID,
		"severity":      "info",
	})
}

func (h *SCIMHandler) DeleteUser(c *gin.Context) {
	userID := c.Param("id")
	repo := repository.NewUserRepository(h.DB)
	if err := repo.DeleteUser(c.Request.Context(), userID); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"data": nil, "error": gin.H{"code": "DELETE_FAILED", "message": err.Error()}})
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": gin.H{"deleted": true, "id": userID}, "error": nil})
	emitAuditRaw(c.Request.Context(), map[string]interface{}{
		"actor_type":    "scim",
		"action":        "scim_delete_user",
		"resource_type": "user",
		"resource_id":   userID,
		"severity":      "warn",
	})
}
