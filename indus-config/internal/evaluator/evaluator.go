package evaluator

import (
	"crypto/sha256"
	"encoding/binary"
	"encoding/json"
	"strings"
)

type UserContext struct {
	UserID     string
	Properties map[string]string
}

type EvaluationResult struct {
	Key    string
	Value  interface{}
	Source string
}

func EvaluateFlag(flagKey string, defaultValue string, valueType string, targetingRulesJSON []byte, ctx UserContext) EvaluationResult {
	var rules []map[string]interface{}
	if err := json.Unmarshal(targetingRulesJSON, &rules); err != nil || len(rules) == 0 {
		return EvaluationResult{Key: flagKey, Value: parseValue(defaultValue, valueType), Source: "default"}
	}

	for _, rule := range rules {
		ruleType, _ := rule["type"].(string)
		returnValue, _ := rule["return_value"].(string)
		switch ruleType {
		case "percentage":
			if ctx.UserID == "" {
				continue
			}
			percentage, _ := rule["percentage"].(float64)
			if getUserBucket(flagKey, ctx.UserID) < percentage {
				return EvaluationResult{Key: flagKey, Value: parseValue(returnValue, valueType), Source: "percentage"}
			}
		case "user_ids":
			ids, _ := rule["user_ids"].([]interface{})
			for _, candidate := range ids {
				if value, ok := candidate.(string); ok && value == ctx.UserID {
					return EvaluationResult{Key: flagKey, Value: parseValue(returnValue, valueType), Source: "user_ids"}
				}
			}
		case "user_property":
			property, _ := rule["property"].(map[string]interface{})
			if property != nil && evaluatePropertyRule(property, ctx.Properties) {
				return EvaluationResult{Key: flagKey, Value: parseValue(returnValue, valueType), Source: "user_property"}
			}
		}
	}

	return EvaluationResult{Key: flagKey, Value: parseValue(defaultValue, valueType), Source: "default"}
}

func getUserBucket(flagKey, userID string) float64 {
	if userID == "" {
		return 101
	}
	hash := sha256.Sum256([]byte(flagKey + ":" + userID))
	n := binary.BigEndian.Uint64(hash[:8])
	return float64(n % 100)
}

func evaluatePropertyRule(rule map[string]interface{}, props map[string]string) bool {
	name, _ := rule["name"].(string)
	operator, _ := rule["operator"].(string)
	value, _ := rule["value"].(string)
	userValue := props[name]
	switch operator {
	case "eq":
		return userValue == value
	case "neq":
		return userValue != value
	case "contains":
		return strings.Contains(userValue, value)
	case "gt":
		return userValue > value
	case "lt":
		return userValue < value
	}
	return false
}

func parseValue(raw string, valueType string) interface{} {
	switch valueType {
	case "boolean":
		return raw == "true"
	case "number":
		var value float64
		if err := json.Unmarshal([]byte(raw), &value); err == nil {
			return value
		}
		return 0.0
	case "json":
		var value interface{}
		if err := json.Unmarshal([]byte(raw), &value); err == nil {
			return value
		}
		return map[string]interface{}{}
	default:
		return raw
	}
}
