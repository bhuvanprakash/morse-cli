package enterprise

import (
	"bytes"
	"encoding/base64"
	"encoding/xml"
	"fmt"
	"html/template"
	"strings"
	"time"
)

type samlResponse struct {
	XMLName   xml.Name `xml:"Response"`
	Assertion struct {
		Subject struct {
			NameID string `xml:"NameID"`
		} `xml:"Subject"`
		AttributeStatement struct {
			Attributes []struct {
				Name   string   `xml:"Name,attr"`
				Values []string `xml:"AttributeValue"`
			} `xml:"Attribute"`
		} `xml:"AttributeStatement"`
	} `xml:"Assertion"`
}

func ParseSAMLResponse(encoded string) (map[string]string, error) {
	if strings.TrimSpace(encoded) == "" {
		return nil, fmt.Errorf("empty saml response")
	}
	raw, err := base64.StdEncoding.DecodeString(encoded)
	if err != nil {
		raw, err = base64.RawStdEncoding.DecodeString(encoded)
		if err != nil {
			return nil, fmt.Errorf("failed to decode SAMLResponse: %w", err)
		}
	}

	var parsed samlResponse
	if err := xml.Unmarshal(raw, &parsed); err != nil {
		return nil, fmt.Errorf("failed to parse SAMLResponse xml: %w", err)
	}

	attrs := map[string]string{
		"nameid": parsed.Assertion.Subject.NameID,
		"sub":    parsed.Assertion.Subject.NameID,
	}
	for _, attr := range parsed.Assertion.AttributeStatement.Attributes {
		if len(attr.Values) == 0 {
			continue
		}
		attrs[strings.ToLower(strings.TrimSpace(attr.Name))] = strings.TrimSpace(attr.Values[0])
	}

	// Common fallbacks.
	if attrs["email"] == "" {
		for _, key := range []string{"mail", "emailaddress", "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress"} {
			if attrs[key] != "" {
				attrs["email"] = attrs[key]
				break
			}
		}
	}
	if attrs["name"] == "" {
		first := attrs["givenname"]
		last := attrs["surname"]
		attrs["name"] = strings.TrimSpace(first + " " + last)
	}
	return attrs, nil
}

func BuildSPMetadataXML(entityID, acsURL string) (string, error) {
	if entityID == "" || acsURL == "" {
		return "", fmt.Errorf("entity id and ACS URL are required")
	}
	const metadataTpl = `<?xml version="1.0" encoding="UTF-8"?>
<EntityDescriptor xmlns="urn:oasis:names:tc:SAML:2.0:metadata" entityID="{{.EntityID}}">
  <SPSSODescriptor protocolSupportEnumeration="urn:oasis:names:tc:SAML:2.0:protocol">
    <NameIDFormat>urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress</NameIDFormat>
    <AssertionConsumerService
      Binding="urn:oasis:names:tc:SAML:2.0:bindings:HTTP-POST"
      Location="{{.ACSURL}}"
      index="0"
      isDefault="true" />
  </SPSSODescriptor>
</EntityDescriptor>`
	tpl, err := template.New("metadata").Parse(metadataTpl)
	if err != nil {
		return "", err
	}
	var buf bytes.Buffer
	if err := tpl.Execute(&buf, map[string]string{
		"EntityID": entityID,
		"ACSURL":   acsURL,
	}); err != nil {
		return "", err
	}
	return buf.String(), nil
}

func BuildSAMLRequestRelayState(slug string) string {
	return fmt.Sprintf("%s:%d", slug, time.Now().Unix())
}
