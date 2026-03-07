package enterprise

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"
	"strings"

	"golang.org/x/oauth2"
)

func BuildOIDCAuthURL(cfg ConnectionConfig, state, nonce string) (string, error) {
	redirectURL := strings.TrimSpace(cfg.RedirectURL)
	if redirectURL == "" {
		return "", fmt.Errorf("oidc redirect_url is required")
	}
	if strings.TrimSpace(cfg.ClientID) == "" {
		return "", fmt.Errorf("oidc client_id is required")
	}
	authURL := strings.TrimSpace(cfg.AuthURL)
	if authURL == "" {
		return "", fmt.Errorf("oidc auth_url is required")
	}
	scopeParts := []string{"openid", "profile", "email"}
	if strings.TrimSpace(cfg.Scopes) != "" {
		scopeParts = strings.Fields(cfg.Scopes)
	}
	oauthCfg := &oauth2.Config{
		ClientID:     cfg.ClientID,
		ClientSecret: cfg.ClientSecret,
		RedirectURL:  redirectURL,
		Scopes:       scopeParts,
		Endpoint: oauth2.Endpoint{
			AuthURL:  authURL,
			TokenURL: cfg.TokenURL,
		},
	}

	return oauthCfg.AuthCodeURL(state,
		oauth2.SetAuthURLParam("nonce", nonce),
		oauth2.SetAuthURLParam("prompt", "login"),
	), nil
}

func ExchangeOIDCCode(ctx context.Context, cfg ConnectionConfig, code string) (map[string]string, error) {
	scopeParts := []string{"openid", "profile", "email"}
	if strings.TrimSpace(cfg.Scopes) != "" {
		scopeParts = strings.Fields(cfg.Scopes)
	}
	oauthCfg := &oauth2.Config{
		ClientID:     cfg.ClientID,
		ClientSecret: cfg.ClientSecret,
		RedirectURL:  cfg.RedirectURL,
		Scopes:       scopeParts,
		Endpoint: oauth2.Endpoint{
			AuthURL:  cfg.AuthURL,
			TokenURL: cfg.TokenURL,
		},
	}
	token, err := oauthCfg.Exchange(ctx, code)
	if err != nil {
		return nil, fmt.Errorf("oidc token exchange failed: %w", err)
	}

	userInfoURL := strings.TrimSpace(cfg.UserInfoURL)
	if userInfoURL == "" {
		if strings.TrimSpace(cfg.IssuerURL) != "" {
			userInfoURL = strings.TrimSuffix(cfg.IssuerURL, "/") + "/userinfo"
		} else {
			return nil, fmt.Errorf("oidc userinfo_url is required")
		}
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, userInfoURL, nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("Authorization", "Bearer "+token.AccessToken)
	req.Header.Set("Accept", "application/json")
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("userinfo request failed: %w", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode >= 300 {
		return nil, fmt.Errorf("userinfo returned status %d", resp.StatusCode)
	}

	var raw map[string]interface{}
	if err := json.NewDecoder(resp.Body).Decode(&raw); err != nil {
		return nil, fmt.Errorf("invalid userinfo payload: %w", err)
	}
	out := map[string]string{}
	for key, value := range raw {
		out[key] = fmt.Sprintf("%v", value)
	}
	return out, nil
}

func BuildOIDCLogoutURL(issuerURL, postLogoutRedirectURI string) string {
	if issuerURL == "" {
		return ""
	}
	u := strings.TrimSuffix(issuerURL, "/") + "/logout"
	if postLogoutRedirectURI == "" {
		return u
	}
	q := url.Values{}
	q.Set("post_logout_redirect_uri", postLogoutRedirectURI)
	return u + "?" + q.Encode()
}
