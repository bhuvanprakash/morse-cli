package email

import (
	"crypto/tls"
	"fmt"
	"net/smtp"
	"strconv"

	"github.com/jordan-wright/email"
)

// Client represents an SMTP client
type Client struct {
	host     string
	port     int
	username string
	password string
	from     string
	addr     string
}

// NewClient creates a new SMTP client
func NewClient(host string, port int, username, password, from string) *Client {
	return &Client{
		host:     host,
		port:     port,
		username: username,
		password: password,
		from:     from,
		addr:     host + ":" + strconv.Itoa(port),
	}
}

// SendEmail sends an email
func (c *Client) SendEmail(to []string, subject, textBody, htmlBody string) error {
	e := email.NewEmail()
	e.From = c.from
	e.To = to
	e.Subject = subject
	e.Text = []byte(textBody)
	e.HTML = []byte(htmlBody)

	var err error
	if c.port == 465 {
		// SSL/TLS connection
		err = e.SendWithTLS(c.addr, smtp.PlainAuth("", c.username, c.password, c.host), &tls.Config{ServerName: c.host})
	} else {
		// STARTTLS or plain
		err = e.Send(c.addr, smtp.PlainAuth("", c.username, c.password, c.host))
	}

	if err != nil {
		return fmt.Errorf("failed to send email: %w", err)
	}

	return nil
}

// SendOTPEmail sends an OTP email
func (c *Client) SendOTPEmail(to, otp, otpType string) error {
	subject := "Your Verification Code"
	if otpType == "password_reset" {
		subject = "Password Reset Code"
	}

	textBody := fmt.Sprintf("Your verification code is: %s\n\nThis code will expire in 10 minutes.", otp)
	htmlBody := fmt.Sprintf(`
<!DOCTYPE html>
<html>
<head>
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .code { 
            font-size: 32px; 
            font-weight: bold; 
            letter-spacing: 8px; 
            background: #f4f4f4; 
            padding: 20px; 
            text-align: center; 
            margin: 20px 0;
            border-radius: 8px;
        }
        .footer { color: #666; font-size: 12px; margin-top: 30px; }
    </style>
</head>
<body>
    <div class="container">
        <h2>%s</h2>
        <p>Use the following code to complete your request:</p>
        <div class="code">%s</div>
        <p>This code will expire in 10 minutes.</p>
        <p>If you didn't request this code, please ignore this email.</p>
        <div class="footer">
            <p>This is an automated message. Please do not reply to this email.</p>
        </div>
    </div>
</body>
</html>
`, subject, otp)

	return c.SendEmail([]string{to}, subject, textBody, htmlBody)
}

// IsConfigured checks if the SMTP client is properly configured
func (c *Client) IsConfigured() bool {
	return c.host != "" && c.username != "" && c.password != "" && c.from != ""
}
