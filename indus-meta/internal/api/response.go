package api

import (
	"net/http"

	"github.com/gin-gonic/gin"
)

// Response is a standard API response
type Response struct {
	Success bool        `json:"success"`
	Data    interface{} `json:"data,omitempty"`
	Error   string      `json:"error,omitempty"`
	Message string      `json:"message,omitempty"`
}

// JSONSuccess returns a successful JSON response
func JSONSuccess(c *gin.Context, data interface{}) {
	c.JSON(http.StatusOK, Response{
		Success: true,
		Data:    data,
	})
}

// JSONError returns an error JSON response
func JSONError(c *gin.Context, status int, message string) {
	c.JSON(status, Response{
		Success: false,
		Error:   message,
	})
}

// JSONMessage returns a JSON response with a message
func JSONMessage(c *gin.Context, status int, message string) {
	c.JSON(status, Response{
		Success: status < 400,
		Message: message,
	})
}

// JSONCreated returns a 201 Created response
func JSONCreated(c *gin.Context, data interface{}) {
	c.JSON(http.StatusCreated, Response{
		Success: true,
		Data:    data,
	})
}

// JSONNoContent returns a 204 No Content response
func JSONNoContent(c *gin.Context) {
	c.Status(http.StatusNoContent)
}

// JSONBadRequest returns a 400 Bad Request response
func JSONBadRequest(c *gin.Context, message string) {
	JSONError(c, http.StatusBadRequest, message)
}

// JSONUnauthorized returns a 401 Unauthorized response
func JSONUnauthorized(c *gin.Context, message string) {
	JSONError(c, http.StatusUnauthorized, message)
}

// JSONForbidden returns a 403 Forbidden response
func JSONForbidden(c *gin.Context, message string) {
	JSONError(c, http.StatusForbidden, message)
}

// JSONNotFound returns a 404 Not Found response
func JSONNotFound(c *gin.Context, message string) {
	JSONError(c, http.StatusNotFound, message)
}

// JSONInternalError returns a 500 Internal Server Error response
func JSONInternalError(c *gin.Context, message string) {
	JSONError(c, http.StatusInternalServerError, message)
}
