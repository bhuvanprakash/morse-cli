package auth

import (
	"bytes"
	"context"
	"crypto"
	"crypto/rand"
	"crypto/rsa"
	"crypto/sha256"
	"crypto/x509"
	"encoding/base64"
	"encoding/pem"
	"encoding/xml"
	"fmt"
	"io"
	"net/http"
	"regexp"
	"time"

	"github.com/indusbase/indus-auth/internal/db"
)

// AadhaarConfig holds configuration for Aadhaar eKYC via UIDAI API
type AadhaarConfig struct {
	AUACode       string          // AUA Code (Agency Unique Authentication Code)
	SubAUACode    string          // Sub-AUA Code
	ASALicenseKey string          // ASA License Key
	PrivateKey    *rsa.PrivateKey // AUA's private key for signing
	UIDPublicKey  *rsa.PublicKey  // UIDAI's public key for encryption
	Production    bool            // Use production or staging endpoint
}

// AadhaarOTPResponse represents the response from UIDAI OTP request
type AadhaarOTPResponse struct {
	TransactionID string `json:"transaction_id"`
	Success       bool   `json:"success"`
	ErrorCode     string `json:"error_code,omitempty"`
	Message       string `json:"message"`
	Timestamp     string `json:"timestamp"`
}

// AadhaarKYCData represents the KYC data returned after successful verification
type AadhaarKYCData struct {
	Name        string `json:"name"`
	DOB         string `json:"dob"`
	Gender      string `json:"gender"`
	AddressFull string `json:"address_full"`
	PinCode     string `json:"pin_code"`
	State       string `json:"state"`
	District    string `json:"district"`
	Phone       string `json:"phone,omitempty"`
	Email       string `json:"email,omitempty"`
	Photo       string `json:"photo,omitempty"` // Base64 encoded photo
	AadhaarHash string `json:"aadhaar_hash"`    // Masked Aadhaar
}

// AadhaarVerifyResponse represents the final verification response
type AadhaarVerifyResponse struct {
	Success    bool            `json:"success"`
	KYCData    *AadhaarKYCData `json:"kyc_data,omitempty"`
	ErrorCode  string          `json:"error_code,omitempty"`
	Message    string          `json:"message"`
	VerifiedAt time.Time       `json:"verified_at"`
}

// UIDAI OTP Request/Response structures
// These follow the UIDAI eKYC API 2.5 specification

type uidaiOtpRequest struct {
	XMLName      xml.Name  `xml:"OTP"`
	Xmlns        string    `xml:"xmlns,attr"`
	UID          string    `xml:"uid,attr"`
	TID          string    `xml:"tid,attr"`
	AC           string    `xml:"ac,attr"`  // AUA Code
	SA           string    `xml:"sa,attr"`  // Sub-AUA Code
	Ver          string    `xml:"ver,attr"` // API Version
	Txn          string    `xml:"txn,attr"` // Transaction ID
	LK           string    `xml:"lk,attr"`  // License Key
	Type         string    `xml:"type,attr"`
	Opts         uidaiOpts `xml:"Opts"`
	CaptchaToken string    `xml:"captchaToken,omitempty"`
}

type uidaiOpts struct {
	Challenge string `xml:"chid,attr"` // Challenge ID
}

type uidaiOtpResponse struct {
	XMLName xml.Name `xml:"OTPRes"`
	Ret     string   `xml:"ret,attr"`  // Y/N - success/failure
	Code    string   `xml:"code,attr"` // Error code
	Txn     string   `xml:"txn,attr"`  // Transaction ID
	Ts      string   `xml:"ts,attr"`   // Timestamp
	Info    string   `xml:"info,attr"` // Additional info
	Err     string   `xml:"err,attr"`  // Error message
}

type uidaiKycRequest struct {
	XMLName xml.Name `xml:"Kyc"`
	Xmlns   string   `xml:"xmlns,attr"`
	UID     string   `xml:"uid,attr"`
	TID     string   `xml:"tid,attr"`
	AC      string   `xml:"ac,attr"`
	SA      string   `xml:"sa,attr"`
	Ver     string   `xml:"ver,attr"`
	Txn     string   `xml:"txn,attr"`
	LK      string   `xml:"lk,attr"`
	Otp     string   `xml:"otp,attr"`    // Encrypted OTP
	Expiry  string   `xml:"expiry,attr"` // OTP expiry
}

type uidaiKycResponse struct {
	XMLName   xml.Name `xml:"KycRes"`
	Ret       string   `xml:"ret,attr"`
	Code      string   `xml:"code,attr"`
	Txn       string   `xml:"txn,attr"`
	Ts        string   `xml:"ts,attr"`
	KycInfo   string   `xml:"kycInfo,attr"` // Encrypted KYC data
	Signature string   `xml:"signature,attr"`
}

// UIDAI API endpoints
const (
	uidaiStagingURL    = "https://developer.uidai.gov.in/auth/otp/2.5/public"
	uidaiProductionURL = "https://auth.uidai.gov.in/otp/2.5/public"
	kycStagingURL      = "https://developer.uidai.gov.in/kyc/2.5/public"
	kycProductionURL   = "https://ekyc.uidai.gov.in/kyc/2.5/public"
	uidaiAPIVersion    = "2.5"
)

// Aadhaar error codes mapping
var aadhaarErrorCodes = map[string]string{
	"100": "OTP generated successfully",
	"101": "OTP generation failed",
	"200": "OTP validated successfully",
	"300": "Aadhaar suspended",
	"400": "Invalid Aadhaar number",
	"401": "Invalid OTP",
	"402": "Expired OTP",
	"403": "Maximum OTP attempts exceeded",
	"404": "Aadhaar not found",
	"500": "Internal server error",
	"501": "Service unavailable",
	"502": "Invalid license key",
	"503": "Invalid AUA code",
	"504": "Invalid transaction ID",
	"505": "Invalid request format",
	"600": "KYC successful",
	"601": "KYC failed",
}

// ValidateAadhaar validates Aadhaar number format and checksum
type AadhaarValidator struct{}

// ValidateAadhaar validates Aadhaar number format
func (v *AadhaarValidator) ValidateAadhaar(aadhaar string) error {
	// Remove spaces
	re := regexp.MustCompile(`\s`)
	aadhaar = re.ReplaceAllString(aadhaar, "")

	// Check length
	if len(aadhaar) != 12 {
		return fmt.Errorf("aadhaar number must be 12 digits")
	}

	// Check if all characters are digits
	digitRe := regexp.MustCompile(`^\d{12}$`)
	if !digitRe.MatchString(aadhaar) {
		return fmt.Errorf("aadhaar number must contain only digits")
	}

	// Check first digit (should not be 0 or 1)
	if aadhaar[0] == '0' || aadhaar[0] == '1' {
		return fmt.Errorf("invalid aadhaar number format")
	}

	// Validate Verhoeff checksum
	if !validateAadhaarChecksum(aadhaar) {
		return fmt.Errorf("invalid aadhaar number (checksum failed)")
	}

	return nil
}

// validateAadhaarChecksum validates Aadhaar number using Verhoeff algorithm
func validateAadhaarChecksum(uid string) bool {
	if len(uid) != 12 {
		return false
	}

	// Verhoeff algorithm multiplication table
	var d = [][]int{
		{0, 1, 2, 3, 4, 5, 6, 7, 8, 9},
		{1, 2, 3, 4, 0, 6, 7, 8, 9, 5},
		{2, 3, 4, 0, 1, 7, 8, 9, 5, 6},
		{3, 4, 0, 1, 2, 8, 9, 5, 6, 7},
		{4, 0, 1, 2, 3, 9, 5, 6, 7, 8},
		{5, 9, 8, 7, 6, 0, 4, 3, 2, 1},
		{6, 5, 9, 8, 7, 1, 0, 4, 3, 2},
		{7, 6, 5, 9, 8, 2, 1, 0, 4, 3},
		{8, 7, 6, 5, 9, 3, 2, 1, 0, 4},
		{9, 8, 7, 6, 5, 4, 3, 2, 1, 0},
	}

	// Verhoeff algorithm permutation table
	var p = [][]int{
		{0, 1, 2, 3, 4, 5, 6, 7, 8, 9},
		{1, 5, 7, 6, 2, 8, 3, 0, 9, 4},
		{5, 8, 0, 3, 7, 9, 6, 1, 4, 2},
		{8, 9, 1, 6, 0, 4, 3, 5, 2, 7},
		{9, 4, 5, 3, 1, 2, 6, 8, 7, 0},
		{4, 2, 8, 6, 5, 7, 3, 9, 0, 1},
		{2, 7, 9, 3, 8, 0, 6, 4, 1, 5},
		{7, 0, 4, 6, 9, 1, 3, 5, 2, 8},
	}

	c := 0
	for i := len(uid) - 1; i >= 0; i-- {
		digit := int(uid[i] - '0')
		c = d[c][p[(len(uid)-i-1)%8][digit]]
	}

	return c == 0
}

// GenerateTransactionID generates a unique transaction ID for UIDAI requests
func GenerateTransactionID(auaCode string) string {
	timestamp := time.Now().Format("20060102150405")
	randomBytes := make([]byte, 4)
	rand.Read(randomBytes)
	randomStr := fmt.Sprintf("%x", randomBytes)
	return fmt.Sprintf("%s:%s:%s", auaCode, timestamp, randomStr[:8])
}

// RequestAadhaarOTP requests an OTP from UIDAI for the given Aadhaar number
func RequestAadhaarOTP(ctx context.Context, cfg *AadhaarConfig, aadhaarNumber, transactionID string) (*AadhaarOTPResponse, error) {
	validator := &AadhaarValidator{}
	if err := validator.ValidateAadhaar(aadhaarNumber); err != nil {
		return nil, err
	}

	if cfg == nil {
		return nil, fmt.Errorf("aadhaar config is nil")
	}

	// Generate transaction ID if not provided
	if transactionID == "" {
		transactionID = GenerateTransactionID(cfg.AUACode)
	}

	// Select endpoint
	endpoint := uidaiStagingURL
	if cfg.Production {
		endpoint = uidaiProductionURL
	}

	// Build request
	reqData := uidaiOtpRequest{
		Xmlns: "http://www.uidai.gov.in/authentication/otp/1.0",
		UID:   aadhaarNumber,
		TID:   "",
		AC:    cfg.AUACode,
		SA:    cfg.SubAUACode,
		Ver:   uidaiAPIVersion,
		Txn:   transactionID,
		LK:    cfg.ASALicenseKey,
		Type:  "A",
		Opts: uidaiOpts{
			Challenge: generateChallenge(),
		},
	}

	// Marshal to XML
	xmlData, err := xml.Marshal(reqData)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal OTP request: %w", err)
	}

	// Sign the request
	signature, err := signRequest(xmlData, cfg.PrivateKey)
	if err != nil {
		return nil, fmt.Errorf("failed to sign request: %w", err)
	}

	// Build full SOAP-like request
	fullRequest := fmt.Sprintf(`<?xml version="1.0" encoding="UTF-8"?>
%s
<Signature xmlns="http://www.w3.org/2000/09/xmldsig#">%s</Signature>`,
		string(xmlData), signature)

	// Make HTTP request
	resp, err := makeUIDAIRequest(ctx, endpoint, fullRequest)
	if err != nil {
		return nil, err
	}

	// Parse response
	var otpResp uidaiOtpResponse
	if err := xml.Unmarshal(resp, &otpResp); err != nil {
		return nil, fmt.Errorf("failed to unmarshal OTP response: %w", err)
	}

	// Build result
	result := &AadhaarOTPResponse{
		TransactionID: otpResp.Txn,
		Success:       otpResp.Ret == "Y",
		ErrorCode:     otpResp.Code,
		Timestamp:     otpResp.Ts,
	}

	if msg, ok := aadhaarErrorCodes[otpResp.Code]; ok {
		result.Message = msg
	} else if otpResp.Err != "" {
		result.Message = otpResp.Err
	} else if result.Success {
		result.Message = "OTP sent successfully"
	} else {
		result.Message = "Failed to send OTP"
	}

	return result, nil
}

// VerifyAadhaarOTP verifies the OTP and returns KYC data
func VerifyAadhaarOTP(ctx context.Context, cfg *AadhaarConfig, aadhaarNumber, transactionID, otp string) (*AadhaarVerifyResponse, error) {
	validator := &AadhaarValidator{}
	if err := validator.ValidateAadhaar(aadhaarNumber); err != nil {
		return nil, err
	}

	if cfg == nil {
		return nil, fmt.Errorf("aadhaar config is nil")
	}

	if len(otp) != 6 {
		return nil, fmt.Errorf("OTP must be 6 digits")
	}

	// Select endpoint
	endpoint := kycStagingURL
	if cfg.Production {
		endpoint = kycProductionURL
	}

	// Encrypt OTP with UIDAI public key
	encryptedOTP, err := encryptWithPublicKey(otp, cfg.UIDPublicKey)
	if err != nil {
		return nil, fmt.Errorf("failed to encrypt OTP: %w", err)
	}

	// Build KYC request
	reqData := uidaiKycRequest{
		Xmlns:  "http://www.uidai.gov.in/kyc/uid-kyc-request/2.0",
		UID:    aadhaarNumber,
		TID:    "",
		AC:     cfg.AUACode,
		SA:     cfg.SubAUACode,
		Ver:    uidaiAPIVersion,
		Txn:    transactionID,
		LK:     cfg.ASALicenseKey,
		Otp:    encryptedOTP,
		Expiry: "10", // OTP expiry in minutes
	}

	// Marshal to XML
	xmlData, err := xml.Marshal(reqData)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal KYC request: %w", err)
	}

	// Sign the request
	signature, err := signRequest(xmlData, cfg.PrivateKey)
	if err != nil {
		return nil, fmt.Errorf("failed to sign request: %w", err)
	}

	// Build full request
	fullRequest := fmt.Sprintf(`<?xml version="1.0" encoding="UTF-8"?>
%s
<Signature xmlns="http://www.w3.org/2000/09/xmldsig#">%s</Signature>`,
		string(xmlData), signature)

	// Make HTTP request
	resp, err := makeUIDAIRequest(ctx, endpoint, fullRequest)
	if err != nil {
		return nil, err
	}

	// Parse response
	var kycResp uidaiKycResponse
	if err := xml.Unmarshal(resp, &kycResp); err != nil {
		return nil, fmt.Errorf("failed to unmarshal KYC response: %w", err)
	}

	result := &AadhaarVerifyResponse{
		VerifiedAt: time.Now(),
	}

	if kycResp.Ret == "Y" {
		result.Success = true
		result.Message = "KYC successful"

		// Decrypt and parse KYC data
		if kycResp.KycInfo != "" {
			kycData, err := decryptKYCData(kycResp.KycInfo, cfg.PrivateKey)
			if err == nil {
				result.KYCData = kycData
			}
		}
	} else {
		result.Success = false
		result.ErrorCode = kycResp.Code
		if msg, ok := aadhaarErrorCodes[kycResp.Code]; ok {
			result.Message = msg
		} else {
			result.Message = "KYC verification failed"
		}
	}

	return result, nil
}

// Helper functions

func generateChallenge() string {
	b := make([]byte, 16)
	rand.Read(b)
	return fmt.Sprintf("%x", b)
}

func signRequest(data []byte, privateKey *rsa.PrivateKey) (string, error) {
	if privateKey == nil {
		return "", fmt.Errorf("private key is nil")
	}

	hash := sha256.Sum256(data)
	signature, err := rsa.SignPKCS1v15(rand.Reader, privateKey, crypto.SHA256, hash[:])
	if err != nil {
		return "", err
	}

	return base64.StdEncoding.EncodeToString(signature), nil
}

func encryptWithPublicKey(data string, publicKey *rsa.PublicKey) (string, error) {
	if publicKey == nil {
		return "", fmt.Errorf("public key is nil")
	}

	encrypted, err := rsa.EncryptPKCS1v15(rand.Reader, publicKey, []byte(data))
	if err != nil {
		return "", err
	}

	return base64.StdEncoding.EncodeToString(encrypted), nil
}

func decryptKYCData(encryptedData string, privateKey *rsa.PrivateKey) (*AadhaarKYCData, error) {
	// In production, this would decrypt the actual KYC XML from UIDAI
	// For now, return a placeholder structure
	return &AadhaarKYCData{}, nil
}

func makeUIDAIRequest(ctx context.Context, endpoint, body string) ([]byte, error) {
	req, err := http.NewRequestWithContext(ctx, "POST", endpoint, bytes.NewBufferString(body))
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	req.Header.Set("Content-Type", "application/xml")
	req.Header.Set("Accept", "application/xml")

	client := &http.Client{Timeout: 30 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("failed to make UIDAI request: %w", err)
	}
	defer resp.Body.Close()

	respBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("failed to read response: %w", err)
	}

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("UIDAI API returned status %d: %s", resp.StatusCode, string(respBody))
	}

	return respBody, nil
}

// MaskAadhaar masks an Aadhaar number for display (existing function preserved)
func MaskAadhaar(aadhaar string) string {
	re := regexp.MustCompile(`\s`)
	aadhaar = re.ReplaceAllString(aadhaar, "")

	if len(aadhaar) != 12 {
		return "****"
	}
	return "XXXX-XXXX-" + aadhaar[8:12]
}

// ValidateAadhaar validates Aadhaar number format (existing function preserved)
func ValidateAadhaar(aadhaar string) error {
	validator := &AadhaarValidator{}
	return validator.ValidateAadhaar(aadhaar)
}

// ParsePrivateKey parses a PEM-encoded private key
func ParsePrivateKey(pemData []byte) (*rsa.PrivateKey, error) {
	block, _ := pem.Decode(pemData)
	if block == nil {
		return nil, fmt.Errorf("failed to decode PEM block")
	}

	key, err := x509.ParsePKCS8PrivateKey(block.Bytes)
	if err != nil {
		key, err = x509.ParsePKCS1PrivateKey(block.Bytes)
		if err != nil {
			return nil, fmt.Errorf("failed to parse private key: %w", err)
		}
	}

	rsaKey, ok := key.(*rsa.PrivateKey)
	if !ok {
		return nil, fmt.Errorf("private key is not RSA")
	}

	return rsaKey, nil
}

// ParsePublicKey parses a PEM-encoded public key
func ParsePublicKey(pemData []byte) (*rsa.PublicKey, error) {
	block, _ := pem.Decode(pemData)
	if block == nil {
		return nil, fmt.Errorf("failed to decode PEM block")
	}

	key, err := x509.ParsePKIXPublicKey(block.Bytes)
	if err != nil {
		return nil, fmt.Errorf("failed to parse public key: %w", err)
	}

	rsaKey, ok := key.(*rsa.PublicKey)
	if !ok {
		return nil, fmt.Errorf("public key is not RSA")
	}

	return rsaKey, nil
}

// GenerateAadhaarOTP generates an OTP for Aadhaar verification (existing function preserved)
func GenerateAadhaarOTP(ctx context.Context, redis *db.RedisClient, aadhaarNumber string) (string, error) {
	// This is a placeholder - actual OTP generation is done via UIDAI API
	// through the RequestAadhaarOTP function
	return "", fmt.Errorf("use RequestAadhaarOTP function instead")
}

// AadhaarRequest represents an Aadhaar OTP request (existing type preserved)
type AadhaarRequest struct {
	AadhaarNumber string `json:"aadhaar_number"`
}

// AadhaarVerifyRequest represents an Aadhaar OTP verification request (existing type preserved)
type AadhaarVerifyRequest struct {
	AadhaarNumber string `json:"aadhaar_number"`
	OTP           string `json:"otp"`
}

// GetAadhaarStatus gets the Aadhaar verification status for a user (existing function preserved)
func GetAadhaarStatus(ctx context.Context, db interface{}, userID string) (map[string]interface{}, error) {
	_ = ctx
	_ = db
	if userID == "" {
		return nil, fmt.Errorf("user id is required")
	}
	return map[string]interface{}{
		"user_id":  userID,
		"verified": false,
		"status":   "unknown",
		"message":  "No Aadhaar verification record found",
	}, nil
}
