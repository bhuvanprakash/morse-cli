package api

import (
	"net/http"

	"github.com/gin-gonic/gin"
)

// Response represents a standard API response
type Response struct {
	Success bool        `json:"success"`
	Data    interface{} `json:"data,omitempty"`
	Error   string      `json:"error,omitempty"`
	Meta    *Meta       `json:"meta,omitempty"`
}

// Meta represents pagination metadata
type Meta struct {
	TotalCount int `json:"total_count"`
	Limit      int `json:"limit"`
	Offset     int `json:"offset"`
}

// JSON sends a JSON response
func JSON(c *gin.Context, status int, data interface{}) {
	c.JSON(status, Response{
		Success: status < 400,
		Data:    data,
	})
}

// Error sends an error response
func Error(c *gin.Context, status int, message string) {
	c.JSON(status, Response{
		Success: false,
		Error:   message,
	})
}

// ErrorWithData sends an error response with partial data
func ErrorWithData(c *gin.Context, status int, message string, data interface{}) {
	c.JSON(status, Response{
		Success: false,
		Error:   message,
		Data:    data,
	})
}

// Paginated sends a paginated response
func Paginated(c *gin.Context, status int, data interface{}, total, limit, offset int) {
	c.JSON(status, Response{
		Success: true,
		Data:    data,
		Meta: &Meta{
			TotalCount: total,
			Limit:      limit,
			Offset:     offset,
		},
	})
}

// OK sends a 200 OK response
func OK(c *gin.Context, data interface{}) {
	JSON(c, http.StatusOK, data)
}

// Created sends a 201 Created response
func Created(c *gin.Context, data interface{}) {
	JSON(c, http.StatusCreated, data)
}

// NoContent sends a 204 No Content response
func NoContent(c *gin.Context) {
	c.Status(http.StatusNoContent)
}

// BadRequest sends a 400 Bad Request response
func BadRequest(c *gin.Context, message string) {
	if message == "" {
		message = "bad request"
	}
	Error(c, http.StatusBadRequest, message)
}

// Unauthorized sends a 401 Unauthorized response
func Unauthorized(c *gin.Context, message string) {
	if message == "" {
		message = "unauthorized"
	}
	Error(c, http.StatusUnauthorized, message)
}

// Forbidden sends a 403 Forbidden response
func Forbidden(c *gin.Context, message string) {
	if message == "" {
		message = "forbidden"
	}
	Error(c, http.StatusForbidden, message)
}

// NotFound sends a 404 Not Found response
func NotFound(c *gin.Context, message string) {
	if message == "" {
		message = "not found"
	}
	Error(c, http.StatusNotFound, message)
}

// Conflict sends a 409 Conflict response
func Conflict(c *gin.Context, message string) {
	if message == "" {
		message = "conflict"
	}
	Error(c, http.StatusConflict, message)
}

// InternalError sends a 500 Internal Server Error response
func InternalError(c *gin.Context, message string) {
	if message == "" {
		message = "internal server error"
	}
	Error(c, http.StatusInternalServerError, message)
}
