package handlers

import (
	"database/sql"
	"encoding/json"
	"errors"
	"net/http"
	"regexp"
	"sync"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/indusbase/indus-config/internal/audit"
	"github.com/indusbase/indus-config/internal/evaluator"
	"github.com/indusbase/indus-config/internal/models"
	"github.com/indusbase/indus-config/internal/repository"
)

var flagKeyPattern = regexp.MustCompile(`^[a-z0-9_-]{1,200}$`)

type cachedEvaluationData struct {
	expiresAt time.Time
	flags     []models.Flag
	configs   []models.ConfigEntry
}

type FlagsHandler struct {
	flagsRepo   *repository.FlagRepository
	configRepo  *repository.ConfigRepository
	envRepo     *repository.EnvironmentRepository
	cacheTTL    time.Duration
	cache       map[string]cachedEvaluationData
	cacheMu     sync.RWMutex
	decryptFunc func(string) (string, error)
	auditClient *audit.Client
}

func NewFlagsHandler(flagsRepo *repository.FlagRepository, configRepo *repository.ConfigRepository, envRepo *repository.EnvironmentRepository, cacheTTL time.Duration, decryptFunc func(string) (string, error), auditClient *audit.Client) *FlagsHandler {
	return &FlagsHandler{
		flagsRepo:   flagsRepo,
		configRepo:  configRepo,
		envRepo:     envRepo,
		cacheTTL:    cacheTTL,
		cache:       make(map[string]cachedEvaluationData),
		decryptFunc: decryptFunc,
		auditClient: auditClient,
	}
}

func (h *FlagsHandler) Create(c *gin.Context) {
	var req models.CreateFlagRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondError(c, http.StatusBadRequest, "BAD_REQUEST", err.Error())
		return
	}
	if !flagKeyPattern.MatchString(req.Key) {
		respondError(c, http.StatusUnprocessableEntity, "VALIDATION_ERROR", "key must be lowercase alphanumeric with underscores or hyphens, max 200 chars")
		return
	}
	if req.DefaultValue == "" {
		respondError(c, http.StatusUnprocessableEntity, "VALIDATION_ERROR", "default_value is required")
		return
	}
	ownerID := userIDFromContext(c)
	flag, err := h.flagsRepo.Create(c.Request.Context(), &req, ownerID)
	if err != nil {
		respondError(c, http.StatusConflict, "CONFLICT", err.Error())
		return
	}
	h.invalidateEnvironment(flag.EnvironmentID)
	h.auditClient.Emit(c.Request.Context(), map[string]interface{}{
		"actor_type":    "user",
		"actor_user_id": userIDString(c),
		"action":        "create_flag",
		"resource_type": "feature_flag",
		"resource_id":   flag.Key,
		"severity":      "info",
		"metadata": map[string]interface{}{
			"environment_id": flag.EnvironmentID.String(),
		},
	})
	respondCreated(c, flag)
}

func (h *FlagsHandler) List(c *gin.Context) {
	environment, err := h.environmentFromQuery(c)
	if err != nil {
		respondError(c, http.StatusBadRequest, "BAD_REQUEST", err.Error())
		return
	}
	flags, err := h.flagsRepo.ListByEnvironmentID(c.Request.Context(), environment.ID)
	if err != nil {
		respondError(c, http.StatusInternalServerError, "INTERNAL_ERROR", err.Error())
		return
	}
	respondOK(c, flags)
}

func (h *FlagsHandler) Get(c *gin.Context) {
	environment, err := h.environmentFromQuery(c)
	if err != nil {
		respondError(c, http.StatusBadRequest, "BAD_REQUEST", err.Error())
		return
	}
	flag, err := h.flagsRepo.GetByKey(c.Request.Context(), environment.ID, c.Param("key"))
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			respondError(c, http.StatusNotFound, "NOT_FOUND", "flag not found")
			return
		}
		respondError(c, http.StatusInternalServerError, "INTERNAL_ERROR", err.Error())
		return
	}
	respondOK(c, flag)
}

func (h *FlagsHandler) Update(c *gin.Context) {
	environment, err := h.environmentFromQuery(c)
	if err != nil {
		respondError(c, http.StatusBadRequest, "BAD_REQUEST", err.Error())
		return
	}
	var req struct {
		DefaultValue   *string                `json:"default_value"`
		TargetingRules []models.TargetingRule `json:"targeting_rules"`
		IsActive       *bool                  `json:"is_active"`
		Description    *string                `json:"description"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		respondError(c, http.StatusBadRequest, "BAD_REQUEST", err.Error())
		return
	}
	updates := map[string]interface{}{}
	if req.DefaultValue != nil {
		updates["default_value"] = *req.DefaultValue
	}
	if req.Description != nil {
		updates["description"] = *req.Description
	}
	if req.IsActive != nil {
		updates["is_active"] = *req.IsActive
	}
	if req.TargetingRules != nil {
		updates["targeting_rules"] = req.TargetingRules
	}
	flag, err := h.flagsRepo.Update(c.Request.Context(), environment.ID, c.Param("key"), updates)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			respondError(c, http.StatusNotFound, "NOT_FOUND", "flag not found")
			return
		}
		respondError(c, http.StatusInternalServerError, "INTERNAL_ERROR", err.Error())
		return
	}
	h.invalidateEnvironment(environment.ID)
	h.auditClient.Emit(c.Request.Context(), map[string]interface{}{
		"actor_type":    "user",
		"actor_user_id": userIDString(c),
		"action":        "update_flag",
		"resource_type": "feature_flag",
		"resource_id":   flag.Key,
		"severity":      "info",
		"metadata": map[string]interface{}{
			"environment_id": environment.ID.String(),
		},
	})
	respondOK(c, flag)
}

func (h *FlagsHandler) Delete(c *gin.Context) {
	environment, err := h.environmentFromQuery(c)
	if err != nil {
		respondError(c, http.StatusBadRequest, "BAD_REQUEST", err.Error())
		return
	}
	if err := h.flagsRepo.Delete(c.Request.Context(), environment.ID, c.Param("key")); err != nil {
		respondError(c, http.StatusInternalServerError, "INTERNAL_ERROR", err.Error())
		return
	}
	h.invalidateEnvironment(environment.ID)
	h.auditClient.Emit(c.Request.Context(), map[string]interface{}{
		"actor_type":    "user",
		"actor_user_id": userIDString(c),
		"action":        "delete_flag",
		"resource_type": "feature_flag",
		"resource_id":   c.Param("key"),
		"severity":      "warn",
		"metadata": map[string]interface{}{
			"environment_id": environment.ID.String(),
		},
	})
	respondOK(c, gin.H{"deleted": true})
}

func (h *FlagsHandler) Evaluate(c *gin.Context) {
	var req models.EvaluateRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondError(c, http.StatusBadRequest, "BAD_REQUEST", err.Error())
		return
	}
	if req.Environment == "" {
		respondError(c, http.StatusUnprocessableEntity, "VALIDATION_ERROR", "environment is required")
		return
	}
	useAnonymousCache := req.UserID == nil || *req.UserID == ""
	var flags []models.Flag
	var configs []models.ConfigEntry
	var err error
	if useAnonymousCache {
		flags, configs, err = h.loadEnvironmentData(c, req.Environment)
	} else {
		flags, configs, err = h.loadEnvironmentDataUncached(c, req.Environment)
	}
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			respondError(c, http.StatusNotFound, "NOT_FOUND", "environment not found")
			return
		}
		respondError(c, http.StatusInternalServerError, "INTERNAL_ERROR", err.Error())
		return
	}

	selected := make(map[string]struct{})
	for _, key := range req.Keys {
		selected[key] = struct{}{}
	}
	useSelection := len(selected) > 0
	context := evaluator.UserContext{Properties: req.UserProps}
	if req.UserID != nil {
		context.UserID = *req.UserID
	}

	response := models.EvaluateResponse{
		Flags:  make(map[string]interface{}),
		Config: make(map[string]interface{}),
	}
	for _, flag := range flags {
		if useSelection {
			if _, ok := selected[flag.Key]; !ok {
				continue
			}
		}
		result := evaluator.EvaluateFlag(flag.Key, flag.DefaultValue, string(flag.ValueType), flag.TargetingRules, context)
		response.Flags[flag.Key] = result.Value
	}
	for _, entry := range configs {
		if entry.IsSecret {
			continue
		}
		if useSelection {
			if _, ok := selected[entry.Key]; !ok {
				continue
			}
		}
		response.Config[entry.Key] = parseConfigValue(entry.Value, entry.ValueType)
	}
	respondOK(c, response)
}

func (h *FlagsHandler) environmentFromQuery(c *gin.Context) (*models.Environment, error) {
	environmentName := c.DefaultQuery("environment", "production")
	return h.envRepo.GetByName(c.Request.Context(), environmentName)
}

func (h *FlagsHandler) loadEnvironmentData(c *gin.Context, environmentName string) ([]models.Flag, []models.ConfigEntry, error) {
	h.cacheMu.RLock()
	cached, ok := h.cache[environmentName]
	if ok && time.Now().Before(cached.expiresAt) {
		h.cacheMu.RUnlock()
		return cached.flags, cached.configs, nil
	}
	h.cacheMu.RUnlock()

	environment, err := h.envRepo.GetByName(c.Request.Context(), environmentName)
	if err != nil {
		return nil, nil, err
	}
	flags, err := h.flagsRepo.ListActiveByEnvironmentID(c.Request.Context(), environment.ID)
	if err != nil {
		return nil, nil, err
	}
	configs, err := h.configRepo.ListByEnvironmentID(c.Request.Context(), environment.ID)
	if err != nil {
		return nil, nil, err
	}
	for i := range configs {
		if configs[i].IsSecret {
			value, err := h.decryptFunc(configs[i].Value)
			if err != nil {
				return nil, nil, err
			}
			configs[i].Value = value
		}
	}

	h.cacheMu.Lock()
	h.cache[environmentName] = cachedEvaluationData{
		expiresAt: time.Now().Add(h.cacheTTL),
		flags:     flags,
		configs:   configs,
	}
	h.cacheMu.Unlock()
	return flags, configs, nil
}

func (h *FlagsHandler) loadEnvironmentDataUncached(c *gin.Context, environmentName string) ([]models.Flag, []models.ConfigEntry, error) {
	environment, err := h.envRepo.GetByName(c.Request.Context(), environmentName)
	if err != nil {
		return nil, nil, err
	}
	flags, err := h.flagsRepo.ListActiveByEnvironmentID(c.Request.Context(), environment.ID)
	if err != nil {
		return nil, nil, err
	}
	configs, err := h.configRepo.ListByEnvironmentID(c.Request.Context(), environment.ID)
	if err != nil {
		return nil, nil, err
	}
	for i := range configs {
		if configs[i].IsSecret {
			value, err := h.decryptFunc(configs[i].Value)
			if err != nil {
				return nil, nil, err
			}
			configs[i].Value = value
		}
	}
	return flags, configs, nil
}

func (h *FlagsHandler) invalidateEnvironment(environmentID uuid.UUID) {
	environments := []string{"development", "staging", "production"}
	h.cacheMu.Lock()
	defer h.cacheMu.Unlock()
	for _, key := range environments {
		delete(h.cache, key)
	}
	_ = environmentID
}

func userIDFromContext(c *gin.Context) *uuid.UUID {
	userIDValue, ok := c.Get("user_id")
	if !ok {
		return nil
	}
	value, ok := userIDValue.(string)
	if !ok {
		return nil
	}
	parsed, err := uuid.Parse(value)
	if err != nil {
		return nil
	}
	return &parsed
}

func userIDString(c *gin.Context) string {
	if id := userIDFromContext(c); id != nil {
		return id.String()
	}
	return ""
}

func parseConfigValue(raw string, valueType models.ValueType) interface{} {
	switch valueType {
	case models.ValueTypeBoolean:
		return raw == "true"
	case models.ValueTypeNumber:
		var value float64
		if err := json.Unmarshal([]byte(raw), &value); err == nil {
			return value
		}
		return 0.0
	case models.ValueTypeJSON:
		var value interface{}
		if err := json.Unmarshal([]byte(raw), &value); err == nil {
			return value
		}
		return map[string]interface{}{}
	default:
		return raw
	}
}
