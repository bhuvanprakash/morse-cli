package handlers

import (
	"bytes"
	"database/sql"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"os"
	"regexp"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	appcrypto "github.com/indusbase/indus-config/internal/crypto"
	"github.com/indusbase/indus-config/internal/models"
	"github.com/indusbase/indus-config/internal/repository"
)

var configKeyPattern = regexp.MustCompile(`^[A-Za-z0-9_.-]{1,200}$`)

type RemoteConfigHandler struct {
	repo           *repository.ConfigRepository
	envRepo        *repository.EnvironmentRepository
	encryptionKey  string
	secretsURL     string
	internalSecret string
	httpClient     *http.Client
}

func NewRemoteConfigHandler(repo *repository.ConfigRepository, envRepo *repository.EnvironmentRepository, encryptionKey string) *RemoteConfigHandler {
	return &RemoteConfigHandler{
		repo:           repo,
		envRepo:        envRepo,
		encryptionKey:  encryptionKey,
		secretsURL:     strings.TrimSuffix(os.Getenv("SECRETS_SERVICE_URL"), "/"),
		internalSecret: os.Getenv("INTERNAL_SECRET"),
		httpClient:     &http.Client{Timeout: 5 * time.Second},
	}
}

func (h *RemoteConfigHandler) Create(c *gin.Context) {
	var req models.CreateConfigRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondError(c, http.StatusBadRequest, "BAD_REQUEST", err.Error())
		return
	}
	if !configKeyPattern.MatchString(req.Key) {
		respondError(c, http.StatusUnprocessableEntity, "VALIDATION_ERROR", "invalid config key")
		return
	}
	storedValue := req.Value
	if req.IsSecret {
		encrypted, err := h.encrypt(req.Value)
		if err != nil {
			respondError(c, http.StatusInternalServerError, "INTERNAL_ERROR", err.Error())
			return
		}
		storedValue = encrypted
	}
	entry, err := h.repo.Create(c.Request.Context(), &req, userIDFromContext(c), storedValue)
	if err != nil {
		respondError(c, http.StatusConflict, "CONFLICT", err.Error())
		return
	}
	entry.Value = redactIfSecret(*entry)
	respondCreated(c, entry)
}

func (h *RemoteConfigHandler) List(c *gin.Context) {
	environment, err := h.environmentFromQuery(c)
	if err != nil {
		respondError(c, http.StatusBadRequest, "BAD_REQUEST", err.Error())
		return
	}
	entries, err := h.repo.ListByEnvironmentID(c.Request.Context(), environment.ID)
	if err != nil {
		respondError(c, http.StatusInternalServerError, "INTERNAL_ERROR", err.Error())
		return
	}
	for i := range entries {
		if entries[i].IsSecret && looksBase64(entries[i].Value) {
			decrypted, err := h.decrypt(entries[i].Value)
			if err != nil {
				entries[i].Value = "***"
				continue
			}
			entries[i].Value = decrypted
			continue
		}
		if strings.HasPrefix(entries[i].Value, "secret://") {
			if resolved, ok := h.resolveSecretRef(c, entries[i].Value); ok {
				entries[i].Value = resolved
			}
		}
		entries[i].Value = redactIfSecret(entries[i])
	}
	respondOK(c, entries)
}

func (h *RemoteConfigHandler) Get(c *gin.Context) {
	environment, err := h.environmentFromQuery(c)
	if err != nil {
		respondError(c, http.StatusBadRequest, "BAD_REQUEST", err.Error())
		return
	}
	entry, err := h.repo.GetByKey(c.Request.Context(), environment.ID, c.Param("key"))
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			respondError(c, http.StatusNotFound, "NOT_FOUND", "config not found")
			return
		}
		respondError(c, http.StatusInternalServerError, "INTERNAL_ERROR", err.Error())
		return
	}
	if entry.IsSecret && looksBase64(entry.Value) {
		value, err := h.decrypt(entry.Value)
		if err != nil {
			entry.Value = "***"
		} else {
			entry.Value = value
		}
	} else if strings.HasPrefix(entry.Value, "secret://") {
		if resolved, ok := h.resolveSecretRef(c, entry.Value); ok {
			entry.Value = resolved
		}
	}
	respondOK(c, entry)
}

func (h *RemoteConfigHandler) Update(c *gin.Context) {
	environment, err := h.environmentFromQuery(c)
	if err != nil {
		respondError(c, http.StatusBadRequest, "BAD_REQUEST", err.Error())
		return
	}
	var req struct {
		Value       *string          `json:"value"`
		ValueType   models.ValueType `json:"value_type"`
		Description *string          `json:"description"`
		IsSecret    *bool            `json:"is_secret"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		respondError(c, http.StatusBadRequest, "BAD_REQUEST", err.Error())
		return
	}
	storedValue := ""
	if req.Value != nil {
		storedValue = *req.Value
		useSecret := req.IsSecret != nil && *req.IsSecret
		if !useSecret {
			current, err := h.repo.GetByKey(c.Request.Context(), environment.ID, c.Param("key"))
			if err == nil {
				useSecret = current.IsSecret
			}
		}
		if useSecret {
			encrypted, err := h.encrypt(storedValue)
			if err != nil {
				respondError(c, http.StatusInternalServerError, "INTERNAL_ERROR", err.Error())
				return
			}
			storedValue = encrypted
		}
	}
	entry, err := h.repo.Update(c.Request.Context(), environment.ID, c.Param("key"), storedValue, req.ValueType, req.Description, req.IsSecret)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			respondError(c, http.StatusNotFound, "NOT_FOUND", "config not found")
			return
		}
		respondError(c, http.StatusInternalServerError, "INTERNAL_ERROR", err.Error())
		return
	}
	entry.Value = redactIfSecret(*entry)
	respondOK(c, entry)
}

func (h *RemoteConfigHandler) Delete(c *gin.Context) {
	environment, err := h.environmentFromQuery(c)
	if err != nil {
		respondError(c, http.StatusBadRequest, "BAD_REQUEST", err.Error())
		return
	}
	if err := h.repo.Delete(c.Request.Context(), environment.ID, c.Param("key")); err != nil {
		respondError(c, http.StatusInternalServerError, "INTERNAL_ERROR", err.Error())
		return
	}
	respondOK(c, gin.H{"deleted": true})
}

func (h *RemoteConfigHandler) Export(c *gin.Context) {
	environment, err := h.environmentFromQuery(c)
	if err != nil {
		respondError(c, http.StatusBadRequest, "BAD_REQUEST", err.Error())
		return
	}
	entries, err := h.repo.ListByEnvironmentID(c.Request.Context(), environment.ID)
	if err != nil {
		respondError(c, http.StatusInternalServerError, "INTERNAL_ERROR", err.Error())
		return
	}
	var builder strings.Builder
	for _, entry := range entries {
		value := entry.Value
		if entry.IsSecret {
			value = "REDACTED_SECRET"
		}
		builder.WriteString(fmt.Sprintf("%s=%s\n", entry.Key, value))
	}
	c.Header("Content-Type", "text/plain; charset=utf-8")
	c.String(http.StatusOK, builder.String())
}

func (h *RemoteConfigHandler) environmentFromQuery(c *gin.Context) (*models.Environment, error) {
	return h.envRepo.GetByName(c.Request.Context(), c.DefaultQuery("environment", "production"))
}

func (h *RemoteConfigHandler) encrypt(value string) (string, error) {
	return appcrypto.Encrypt(value, h.encryptionKey)
}

func (h *RemoteConfigHandler) decrypt(value string) (string, error) {
	return appcrypto.Decrypt(value, h.encryptionKey)
}

func redactIfSecret(entry models.ConfigEntry) string {
	if entry.IsSecret {
		return "***"
	}
	return entry.Value
}

func (h *RemoteConfigHandler) DecryptValue(value string) (string, error) {
	return h.decrypt(value)
}

func looksBase64(v string) bool {
	if len(v) < 16 {
		return false
	}
	_, err := base64.StdEncoding.DecodeString(v)
	return err == nil
}

func configOwnerID(c *gin.Context) *uuid.UUID {
	return userIDFromContext(c)
}

func (h *RemoteConfigHandler) resolveSecretRef(c *gin.Context, value string) (string, bool) {
	// Resolve only for trusted internal requests.
	if c.GetHeader("X-IndusBase-Internal") != h.internalSecret {
		return value, false
	}
	if h.secretsURL == "" {
		return value, false
	}
	secretName := strings.TrimPrefix(value, "secret://")
	if secretName == "" {
		return value, false
	}
	payload, _ := json.Marshal(map[string]string{"name": secretName})
	req, err := http.NewRequestWithContext(c.Request.Context(), http.MethodPost, h.secretsURL+"/secrets/internal/fetch", bytes.NewReader(payload))
	if err != nil {
		return value, false
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-IndusBase-Internal", h.internalSecret)
	resp, err := h.httpClient.Do(req)
	if err != nil {
		return value, false
	}
	defer resp.Body.Close()
	if resp.StatusCode >= 300 {
		return value, false
	}
	raw, _ := io.ReadAll(resp.Body)
	var body struct {
		Data struct {
			Value string `json:"value"`
		} `json:"data"`
	}
	if err := json.Unmarshal(raw, &body); err != nil || body.Data.Value == "" {
		return value, false
	}
	return body.Data.Value, true
}
