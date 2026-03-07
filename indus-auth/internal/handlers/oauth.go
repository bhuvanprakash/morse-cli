package handlers

import (
	"context"
	"crypto/rsa"
	"database/sql"
	"encoding/json"
	"fmt"
	"net"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/indusbase/indus-auth/internal/auth"
	"github.com/indusbase/indus-auth/internal/config"
	"github.com/indusbase/indus-auth/internal/db"
	"github.com/indusbase/indus-auth/internal/models"
	"github.com/indusbase/indus-auth/internal/repository"
	"github.com/indusbase/indus-auth/internal/response"
	"github.com/indusbase/indus-auth/pkg/crypto"
)

const oauthStateTTL = 10 * time.Minute

// OAuthDependencies holds dependencies for OAuth handlers
type OAuthDependencies struct {
	Config     *config.Config
	DB         *sql.DB
	Redis      *db.RedisClient
	PrivateKey *rsa.PrivateKey
	PublicKey  *rsa.PublicKey
}

// OAuthInitiate initiates OAuth flow
func OAuthInitiate(deps *OAuthDependencies) gin.HandlerFunc {
	return func(c *gin.Context) {
		provider := c.Param("provider")

		if !models.IsValidProvider(provider) {
			response.BadRequest(c, "Invalid provider")
			return
		}

		state, err := auth.GenerateState()
		if err != nil {
			response.InternalServerError(c, "Failed to generate state")
			return
		}

		var authURL string
		switch models.OAuthProvider(provider) {
		case models.OAuthProviderGoogle:
			config := auth.GoogleOAuthConfig(
				deps.Config.GoogleClientID,
				deps.Config.GoogleClientSecret,
				deps.Config.GoogleRedirectURL,
			)
			authURL = auth.GetGoogleAuthURL(config, state)
		case models.OAuthProviderGitHub:
			config := auth.GithubOAuthConfig(
				deps.Config.GithubClientID,
				deps.Config.GithubClientSecret,
				deps.Config.GithubRedirectURL,
			)
			authURL = auth.GetGithubAuthURL(config, state)
		}

		if err := storeOAuthState(c.Request.Context(), deps.Redis, provider, state); err != nil {
			response.InternalServerError(c, "Failed to initialize OAuth flow")
			return
		}

		c.Redirect(http.StatusTemporaryRedirect, authURL)
	}
}

// OAuthCallback handles OAuth callback
func OAuthCallback(deps *OAuthDependencies) gin.HandlerFunc {
	return func(c *gin.Context) {
		provider := c.Param("provider")
		code := c.Query("code")
		state := c.Query("state")

		if code == "" {
			response.BadRequest(c, "Authorization code not provided")
			return
		}
		if state == "" {
			response.BadRequest(c, "OAuth state not provided")
			return
		}

		if !models.IsValidProvider(provider) {
			response.BadRequest(c, "Invalid provider")
			return
		}

		if err := consumeOAuthState(c.Request.Context(), deps.Redis, provider, state); err != nil {
			response.Unauthorized(c, "Invalid or expired OAuth state")
			return
		}

		ctx := c.Request.Context()
		userRepo := repository.NewUserRepository(deps.DB)
		oauthRepo := repository.NewOAuthRepository(deps.DB)
		sessionRepo := repository.NewSessionRepository(deps.DB)

		var user *models.User
		var oauthEmail, oauthName, oauthAvatar string
		var providerUserID string

		switch models.OAuthProvider(provider) {
		case models.OAuthProviderGoogle:
			config := auth.GoogleOAuthConfig(
				deps.Config.GoogleClientID,
				deps.Config.GoogleClientSecret,
				deps.Config.GoogleRedirectURL,
			)
			userInfo, err := auth.ExchangeGoogleCode(ctx, config, code)
			if err != nil {
				response.BadRequest(c, "Failed to exchange code: "+err.Error())
				return
			}
			oauthEmail = userInfo.Email
			oauthName = userInfo.Name
			oauthAvatar = userInfo.Picture
			providerUserID = userInfo.ID

		case models.OAuthProviderGitHub:
			config := auth.GithubOAuthConfig(
				deps.Config.GithubClientID,
				deps.Config.GithubClientSecret,
				deps.Config.GithubRedirectURL,
			)
			userInfo, err := auth.ExchangeGithubCode(ctx, config, code)
			if err != nil {
				response.BadRequest(c, "Failed to exchange code: "+err.Error())
				return
			}
			oauthEmail = userInfo.Email
			oauthName = userInfo.Name
			oauthAvatar = userInfo.AvatarURL
			providerUserID = strconv.FormatInt(userInfo.ID, 10)
		}

		// Check if OAuth account exists
		existingAccount, err := oauthRepo.GetByProvider(ctx, provider, providerUserID)
		if err != nil {
			response.InternalServerError(c, "Failed to check OAuth account")
			return
		}

		if existingAccount != nil {
			// Existing user - get user details
			user, err = userRepo.GetByID(ctx, existingAccount.UserID)
			if err != nil {
				response.InternalServerError(c, "Failed to fetch user")
				return
			}
			if user == nil {
				response.InternalServerError(c, "User not found")
				return
			}
		} else {
			// New OAuth user - check if email exists
			existingUser, err := userRepo.GetByEmail(ctx, oauthEmail)
			if err != nil {
				response.InternalServerError(c, "Failed to check existing user")
				return
			}

			if existingUser != nil {
				// Link OAuth to existing user
				user = existingUser
			} else {
				// Create new user
				randomPassword, _ := crypto.GenerateSecureToken(32)
				passwordHash, _ := crypto.HashPassword(randomPassword, deps.Config.BCryptCost)

				metadata, _ := json.Marshal(map[string]string{
					"provider": provider,
				})

				user, err = userRepo.CreateUser(ctx, oauthEmail, passwordHash, oauthName, metadata)
				if err != nil {
					response.InternalServerError(c, "Failed to create user")
					return
				}

				// Mark email as verified since OAuth verified it
				_ = userRepo.UpdateEmailVerified(ctx, user.ID, true)
				user.EmailVerified = true
			}

			// Create OAuth account
			_, err = oauthRepo.UpsertOAuthAccount(
				ctx,
				user.ID,
				provider,
				providerUserID,
				&oauthEmail,
				&oauthName,
				&oauthAvatar,
				nil, nil, nil,
			)
			if err != nil {
				response.InternalServerError(c, "Failed to link OAuth account")
				return
			}
		}

		// Check if user is active
		if !user.IsActive() {
			response.Forbidden(c, "Account is not active")
			return
		}

		// Update last sign in
		_ = userRepo.UpdateLastSignIn(ctx, user.ID)

		// Create session
		userAgent := c.GetHeader("User-Agent")
		ipAddress := net.ParseIP(c.ClientIP())
		refreshTokenExpiry := time.Now().Add(deps.Config.JWTRefreshExpiry)

		session, err := sessionRepo.CreateSession(
			ctx,
			user.ID,
			"temp",
			&userAgent,
			ipAddress,
			refreshTokenExpiry,
		)
		if err != nil {
			response.InternalServerError(c, "Failed to create session")
			return
		}

		// Generate tokens
		accessToken, err := auth.GenerateAccessToken(
			user.ID,
			user.Email,
			user.Role,
			deps.Config.JWTAccessExpiry,
			deps.PrivateKey,
		)
		if err != nil {
			response.InternalServerError(c, "Failed to generate access token")
			return
		}

		refreshToken, err := auth.GenerateRefreshToken(
			user.ID,
			session.ID,
			deps.Config.JWTRefreshExpiry,
			deps.PrivateKey,
		)
		if err != nil {
			response.InternalServerError(c, "Failed to generate refresh token")
			return
		}

		// Update session with refresh token
		_ = sessionRepo.UpdateRefreshToken(ctx, session.ID, refreshToken, refreshTokenExpiry)

		response.Success(c, gin.H{
			"access_token":  accessToken,
			"refresh_token": refreshToken,
			"token_type":    "Bearer",
			"expires_in":    int(deps.Config.JWTAccessExpiry.Seconds()),
			"user":          user.ToPublic(),
		})
	}
}

func oauthStateKey(provider, state string) string {
	return "oauth_state:" + strings.ToLower(provider) + ":" + state
}

func storeOAuthState(ctx context.Context, redisClient *db.RedisClient, provider, state string) error {
	if redisClient == nil {
		return nil
	}
	return redisClient.SetWithTTL(ctx, oauthStateKey(provider, state), "1", oauthStateTTL)
}

func consumeOAuthState(ctx context.Context, redisClient *db.RedisClient, provider, state string) error {
	if redisClient == nil {
		return nil
	}
	key := oauthStateKey(provider, state)
	exists, err := redisClient.Exists(ctx, key)
	if err != nil {
		return err
	}
	if !exists {
		return fmt.Errorf("state not found")
	}
	return redisClient.Delete(ctx, key)
}
