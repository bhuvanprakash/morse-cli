package providers

import (
	"context"
	"crypto/tls"
	"fmt"
	"net/smtp"
	"strings"
)

type SMTPProvider struct {
	host      string
	port      int
	username  string
	password  string
	fromName  string
	fromEmail string
	useTLS    bool
}

func NewSMTPProvider(host string, port int, username, password, fromName, fromEmail string, useTLS bool) *SMTPProvider {
	return &SMTPProvider{
		host:      host,
		port:      port,
		username:  username,
		password:  password,
		fromName:  fromName,
		fromEmail: fromEmail,
		useTLS:    useTLS,
	}
}

func (s *SMTPProvider) SendEmail(_ context.Context, req *EmailMessage) error {
	addr := fmt.Sprintf("%s:%d", s.host, s.port)
	auth := smtp.PlainAuth("", s.username, s.password, s.host)

	var body strings.Builder
	body.WriteString("MIME-Version: 1.0\r\n")
	body.WriteString(fmt.Sprintf("From: %s <%s>\r\n", s.fromName, s.fromEmail))
	body.WriteString(fmt.Sprintf("To: %s\r\n", strings.Join(req.To, ", ")))
	if len(req.CC) > 0 {
		body.WriteString(fmt.Sprintf("Cc: %s\r\n", strings.Join(req.CC, ", ")))
	}
	body.WriteString(fmt.Sprintf("Subject: %s\r\n", req.Subject))
	if req.HTMLBody != "" {
		body.WriteString("Content-Type: text/html; charset=UTF-8\r\n\r\n")
		body.WriteString(req.HTMLBody)
	} else {
		body.WriteString("Content-Type: text/plain; charset=UTF-8\r\n\r\n")
		body.WriteString(req.TextBody)
	}

	if s.useTLS {
		conn, err := tls.Dial("tcp", addr, &tls.Config{ServerName: s.host})
		if err != nil {
			return err
		}
		defer conn.Close()
		client, err := smtp.NewClient(conn, s.host)
		if err != nil {
			return err
		}
		defer client.Close()
		if err := client.Auth(auth); err != nil {
			return err
		}
		if err := client.Mail(s.fromEmail); err != nil {
			return err
		}
		recipients := append([]string{}, req.To...)
		recipients = append(recipients, req.CC...)
		for _, recipient := range recipients {
			if err := client.Rcpt(recipient); err != nil {
				return err
			}
		}
		writer, err := client.Data()
		if err != nil {
			return err
		}
		if _, err := fmt.Fprint(writer, body.String()); err != nil {
			return err
		}
		return writer.Close()
	}

	recipients := append([]string{}, req.To...)
	recipients = append(recipients, req.CC...)
	return smtp.SendMail(addr, auth, s.fromEmail, recipients, []byte(body.String()))
}

func (s *SMTPProvider) Name() string { return "smtp" }
