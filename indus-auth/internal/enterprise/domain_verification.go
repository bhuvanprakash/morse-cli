package enterprise

import (
	"crypto/rand"
	"encoding/hex"
	"regexp"
	"strings"
)

var domainRe = regexp.MustCompile(`^(?i)[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$`)

func NormalizeDomain(domain string) string {
	return strings.ToLower(strings.TrimSpace(strings.TrimPrefix(strings.TrimPrefix(domain, "https://"), "http://")))
}

func IsValidDomain(domain string) bool {
	normalized := NormalizeDomain(domain)
	if len(normalized) < 3 || len(normalized) > 253 {
		return false
	}
	return domainRe.MatchString(normalized)
}

func GenerateVerificationToken() (string, error) {
	seed := make([]byte, 16)
	if _, err := rand.Read(seed); err != nil {
		return "", err
	}
	return "indusbase-verify-" + hex.EncodeToString(seed), nil
}

func EmailDomain(email string) string {
	email = strings.TrimSpace(strings.ToLower(email))
	parts := strings.Split(email, "@")
	if len(parts) != 2 {
		return ""
	}
	return parts[1]
}
