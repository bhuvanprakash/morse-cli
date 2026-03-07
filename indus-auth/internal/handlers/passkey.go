package handlers

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/indusbase/indus-auth/internal/auth"
	"github.com/indusbase/indus-auth/internal/response"
)

// PasskeyBeginRegistration starts the passkey registration flow.
func PasskeyBeginRegistration(c *gin.Context) {
	userID, ok := c.Get("user_id")
	if !ok {
		response.Unauthorized(c, "Authentication required")
		return
	}

	options, err := auth.GeneratePasskeyRegistrationChallenge(c.Request.Context(), nil, userID.(string))
	if err != nil {
		response.InternalServerError(c, err.Error())
		return
	}
	response.Success(c, options)
}

// PasskeyFinishRegistration finishes the passkey registration flow.
func PasskeyFinishRegistration(c *gin.Context) {
	userID, ok := c.Get("user_id")
	if !ok {
		response.Unauthorized(c, "Authentication required")
		return
	}

	var payload map[string]interface{}
	if err := c.ShouldBindJSON(&payload); err != nil {
		response.BadRequest(c, "Invalid passkey registration payload")
		return
	}

	if err := auth.VerifyPasskeyRegistration(c.Request.Context(), nil, userID.(string), payload); err != nil {
		response.ValidationError(c, err.Error())
		return
	}
	response.Success(c, gin.H{"registered": true})
}

// PasskeyBeginAuthentication starts the passkey authentication flow.
func PasskeyBeginAuthentication(c *gin.Context) {
	options, err := auth.GeneratePasskeyAuthenticationChallenge(c.Request.Context(), nil)
	if err != nil {
		response.InternalServerError(c, err.Error())
		return
	}
	response.Success(c, options)
}

// PasskeyFinishAuthentication finishes the passkey authentication flow.
func PasskeyFinishAuthentication(c *gin.Context) {
	var payload map[string]interface{}
	if err := c.ShouldBindJSON(&payload); err != nil {
		response.BadRequest(c, "Invalid passkey authentication payload")
		return
	}

	userID, err := auth.VerifyPasskeyAuthentication(c.Request.Context(), nil, payload)
	if err != nil {
		response.Unauthorized(c, err.Error())
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data": gin.H{
			"user_id": userID,
		},
	})
}

// PasskeyList lists all passkeys for the current user.
func PasskeyList(c *gin.Context) {
	userID, ok := c.Get("user_id")
	if !ok {
		response.Unauthorized(c, "Authentication required")
		return
	}

	passkeys, err := auth.GetPasskeyCredentials(c.Request.Context(), nil, userID.(string))
	if err != nil {
		response.InternalServerError(c, err.Error())
		return
	}
	response.Success(c, gin.H{"passkeys": passkeys})
}

// PasskeyDelete deletes a passkey.
func PasskeyDelete(c *gin.Context) {
	userID, ok := c.Get("user_id")
	if !ok {
		response.Unauthorized(c, "Authentication required")
		return
	}

	if err := auth.DeletePasskeyCredential(c.Request.Context(), nil, userID.(string), c.Param("id")); err != nil {
		response.NotFound(c, err.Error())
		return
	}

	response.Success(c, gin.H{"deleted": true})
}
