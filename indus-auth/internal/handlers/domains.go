package handlers

import (
	"database/sql"
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/indusbase/indus-auth/internal/enterprise"
)

type DomainHandler struct {
	DB *sql.DB
}

func NewDomainHandler(db *sql.DB) *DomainHandler {
	return &DomainHandler{DB: db}
}

type verifyDomainRequest struct {
	Domain            string  `json:"domain" binding:"required"`
	OrgID             *string `json:"org_id"`
	ProjectID         *string `json:"project_id"`
	VerificationToken string  `json:"verification_token"`
}

func (h *DomainHandler) VerifyDomain(c *gin.Context) {
	var req verifyDomainRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"data":  nil,
			"error": gin.H{"code": "BAD_REQUEST", "message": err.Error()},
		})
		return
	}

	domain := enterprise.NormalizeDomain(req.Domain)
	if !enterprise.IsValidDomain(domain) {
		c.JSON(http.StatusUnprocessableEntity, gin.H{
			"data":  nil,
			"error": gin.H{"code": "INVALID_DOMAIN", "message": "Domain must be a valid hostname"},
		})
		return
	}

	ctx := c.Request.Context()
	if strings.TrimSpace(req.VerificationToken) == "" {
		token, err := enterprise.GenerateVerificationToken()
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"data": nil, "error": gin.H{"code": "TOKEN_GENERATION_FAILED", "message": err.Error()}})
			return
		}
		const upsert = `
INSERT INTO indusbase_auth.verified_domains (org_id, project_id, domain, verification_token, verified_at, created_at, updated_at)
VALUES ($1, $2, $3, $4, NULL, NOW(), NOW())
ON CONFLICT (domain) DO UPDATE
SET org_id = EXCLUDED.org_id,
    project_id = EXCLUDED.project_id,
    verification_token = EXCLUDED.verification_token,
    verified_at = NULL,
    updated_at = NOW()
RETURNING id, verification_token
`
		var id string
		var verificationToken string
		if err := h.DB.QueryRowContext(ctx, upsert, req.OrgID, req.ProjectID, domain, token).Scan(&id, &verificationToken); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"data": nil, "error": gin.H{"code": "DB_ERROR", "message": err.Error()}})
			return
		}
		c.JSON(http.StatusOK, gin.H{
			"data": gin.H{
				"id":                 id,
				"domain":             domain,
				"verification_token": verificationToken,
				"txt_record":         "_indusbase-verify." + domain + " TXT " + verificationToken,
				"verified":           false,
			},
			"error": nil,
		})
		return
	}

	const verifyQ = `
UPDATE indusbase_auth.verified_domains
SET verified_at = NOW(), updated_at = NOW()
WHERE domain = $1 AND verification_token = $2
RETURNING id, domain, verified_at
`
	var (
		id         string
		outDomain  string
		verifiedAt sql.NullTime
	)
	err := h.DB.QueryRowContext(ctx, verifyQ, domain, strings.TrimSpace(req.VerificationToken)).Scan(&id, &outDomain, &verifiedAt)
	if err == sql.ErrNoRows {
		c.JSON(http.StatusUnauthorized, gin.H{
			"data":  nil,
			"error": gin.H{"code": "VERIFICATION_FAILED", "message": "Invalid verification token for domain"},
		})
		return
	}
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"data": nil, "error": gin.H{"code": "DB_ERROR", "message": err.Error()}})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"data": gin.H{
			"id":          id,
			"domain":      outDomain,
			"verified":    true,
			"verified_at": verifiedAt.Time,
		},
		"error": nil,
	})
}
