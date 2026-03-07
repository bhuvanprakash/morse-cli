package signing

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"strconv"
	"strings"
	"time"
)

// GenerateSignedToken creates an HMAC-SHA256 signature for a path
func GenerateSignedToken(path string, expiryUnix int64, secret string) string {
	expiryStr := strconv.FormatInt(expiryUnix, 10)
	data := fmt.Sprintf("%s:%s:%s", path, expiryStr, secret)

	h := hmac.New(sha256.New, []byte(secret))
	h.Write([]byte(data))
	return hex.EncodeToString(h.Sum(nil))
}

// ValidateSignedToken validates an HMAC-SHA256 signature
func ValidateSignedToken(path, token string, expiryUnix int64, secret string) bool {
	// Check expiry
	if time.Now().Unix() > expiryUnix {
		return false
	}

	// Recreate expected signature
	expected := GenerateSignedToken(path, expiryUnix, secret)

	// Constant-time comparison
	return hmac.Equal([]byte(token), []byte(expected))
}

// UploadToken represents a token for upload authorization
type UploadToken struct {
	Bucket    string `json:"bucket"`
	Filename  string `json:"filename"`
	Expires   int64  `json:"expires"`
	MaxSize   int64  `json:"max_size"`
	Signature string `json:"sig"`
}

// GenerateUploadToken creates an upload authorization token
func GenerateUploadToken(bucket, filename string, expirySeconds int, maxSizeBytes int64, secret string) (token, url string, err error) {
	if expirySeconds <= 0 {
		expirySeconds = 3600
	}

	expiry := time.Now().Add(time.Duration(expirySeconds) * time.Second).Unix()
	expiryStr := strconv.FormatInt(expiry, 10)
	maxSizeStr := strconv.FormatInt(maxSizeBytes, 10)

	// Create signature
	data := fmt.Sprintf("upload:%s:%s:%s:%s:%s", bucket, filename, expiryStr, maxSizeStr, secret)
	h := hmac.New(sha256.New, []byte(secret))
	h.Write([]byte(data))
	signature := hex.EncodeToString(h.Sum(nil))

	// Build token
	token = fmt.Sprintf("%s:%s:%s:%s:%s",
		hex.EncodeToString([]byte(bucket)),
		hex.EncodeToString([]byte(filename)),
		expiryStr,
		maxSizeStr,
		signature,
	)

	// Build URL
	url = fmt.Sprintf("/storage/v1/object/upload/%s/%s?token=%s&expires=%s",
		bucket, filename, signature, expiryStr)

	return token, url, nil
}

// ValidateUploadToken validates an upload token
func ValidateUploadToken(token, bucket, filename string, fileSize int64, secret string) bool {
	parts := strings.Split(token, ":")
	if len(parts) != 5 {
		return false
	}

	// Decode bucket and filename
	bucketBytes, err := hex.DecodeString(parts[0])
	if err != nil {
		return false
	}
	expectedBucket := string(bucketBytes)

	filenameBytes, err := hex.DecodeString(parts[1])
	if err != nil {
		return false
	}
	expectedFilename := string(filenameBytes)

	expiryStr := parts[2]
	maxSizeStr := parts[3]
	signature := parts[4]

	// Parse expiry
	expiry, err := strconv.ParseInt(expiryStr, 10, 64)
	if err != nil {
		return false
	}

	// Check expiry
	if time.Now().Unix() > expiry {
		return false
	}

	// Parse max size
	maxSize, err := strconv.ParseInt(maxSizeStr, 10, 64)
	if err != nil {
		return false
	}

	// Check file size
	if fileSize > maxSize {
		return false
	}

	// Verify bucket and filename match
	if expectedBucket != bucket || expectedFilename != filename {
		return false
	}

	// Recreate and verify signature
	data := fmt.Sprintf("upload:%s:%s:%s:%s:%s", bucket, filename, expiryStr, maxSizeStr, secret)
	h := hmac.New(sha256.New, []byte(secret))
	h.Write([]byte(data))
	expectedSig := hex.EncodeToString(h.Sum(nil))

	return hmac.Equal([]byte(signature), []byte(expectedSig))
}

// GenerateDownloadURL creates a signed download URL
func GenerateDownloadURL(bucket, filepath string, expirySeconds int, secret string) (string, error) {
	if expirySeconds <= 0 {
		expirySeconds = 3600
	}

	expiry := time.Now().Add(time.Duration(expirySeconds) * time.Second).Unix()
	path := fmt.Sprintf("%s/%s", bucket, filepath)
	token := GenerateSignedToken(path, expiry, secret)

	url := fmt.Sprintf("/storage/v1/object/authenticated/%s/%s?token=%s&expires=%d",
		bucket, filepath, token, expiry)

	return url, nil
}
