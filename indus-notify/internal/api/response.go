package api

import (
	"net/http"

	"github.com/gin-gonic/gin"
)

type ErrorResponse struct {
	Code    string `json:"code"`
	Message string `json:"message"`
}

type Envelope struct {
	Data  interface{}    `json:"data"`
	Error *ErrorResponse `json:"error"`
}

func JSON(c *gin.Context, status int, data interface{}) {
	c.JSON(status, Envelope{Data: data, Error: nil})
}

func Error(c *gin.Context, status int, code, message string) {
	c.JSON(status, Envelope{
		Data: nil,
		Error: &ErrorResponse{
			Code:    code,
			Message: message,
		},
	})
}

func OK(c *gin.Context, data interface{})      { JSON(c, http.StatusOK, data) }
func Created(c *gin.Context, data interface{}) { JSON(c, http.StatusCreated, data) }
