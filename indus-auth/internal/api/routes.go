package api

import (
	"crypto/rsa"
	"database/sql"
	"net/url"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/indusbase/indus-auth/internal/config"
	"github.com/indusbase/indus-auth/internal/db"
	"github.com/indusbase/indus-auth/internal/handlers"
	"github.com/indusbase/indus-auth/internal/metrics"
	"github.com/indusbase/indus-auth/internal/repository"
	"github.com/indusbase/indus-auth/internal/response"
	"github.com/indusbase/indus-auth/pkg/email"
)

// Dependencies holds all server dependencies
type Dependencies struct {
	Config      *config.Config
	DB          *sql.DB
	Redis       *db.RedisClient
	PrivateKey  *rsa.PrivateKey
	PublicKey   *rsa.PublicKey
	EmailClient *email.Client
}

// SetupRoutes configures all routes
func SetupRoutes(r *gin.Engine, deps *Dependencies) {
	// Apply global middleware
	r.Use(RequestIDMiddleware())
	r.Use(LoggerMiddleware())
	r.Use(RecoveryMiddleware())
	r.Use(CORSMiddleware(deps.Config.AllowedOrigins))
	r.Use(SecurityHeadersMiddleware())
	r.Use(MetricsMiddleware())
	r.Use(AuthMiddleware(deps.PublicKey))

	// Health checks
	r.GET("/health", handlers.HealthCheck)
	r.GET("/metrics", gin.WrapH(metrics.Handler()))
	r.GET("/ready", handlers.ReadinessCheck(&handlers.ReadinessDependencies{
		DB:    deps.DB,
		Redis: deps.Redis,
	}))
	r.GET("/live", handlers.LivenessCheck)

	// Auth routes
	auth := r.Group("/auth")
	{
		publicAuth := auth.Group("")
		publicAuth.Use(RateLimitMiddleware(20, time.Minute))
		{
			publicAuth.POST("/signup", handlers.SignUp(&handlers.SignUpDependencies{
				Config:      deps.Config,
				DB:          deps.DB,
				Redis:       deps.Redis,
				EmailClient: deps.EmailClient,
			}))
			publicAuth.POST("/signin", handlers.SignIn(&handlers.SignInDependencies{
				Config:     deps.Config,
				DB:         deps.DB,
				Redis:      deps.Redis,
				PrivateKey: deps.PrivateKey,
			}))
			publicAuth.POST("/verify-otp", handlers.VerifyOTP(&handlers.VerifyOTPDependencies{
				DB:    deps.DB,
				Redis: deps.Redis,
			}))
			publicAuth.POST("/resend-otp", handlers.ResendOTP(&handlers.ResendOTPDependencies{
				DB:          deps.DB,
				Redis:       deps.Redis,
				EmailClient: deps.EmailClient,
				OTPLength:   deps.Config.OTPLength,
				OTPExpiry:   deps.Config.OTPExpiry,
			}))
			publicAuth.POST("/refresh", handlers.RefreshToken(&handlers.RefreshTokenDependencies{
				Config:     deps.Config,
				DB:         deps.DB,
				PrivateKey: deps.PrivateKey,
				PublicKey:  deps.PublicKey,
			}))
		}

		oauthRoutes := auth.Group("")
		oauthRoutes.Use(RateLimitMiddleware(30, time.Minute))
		{
			oauthRoutes.GET("/oauth/:provider", handlers.OAuthInitiate(&handlers.OAuthDependencies{
				Config:     deps.Config,
				DB:         deps.DB,
				Redis:      deps.Redis,
				PrivateKey: deps.PrivateKey,
				PublicKey:  deps.PublicKey,
			}))
			oauthRoutes.GET("/oauth/:provider/callback", handlers.OAuthCallback(&handlers.OAuthDependencies{
				Config:     deps.Config,
				DB:         deps.DB,
				Redis:      deps.Redis,
				PrivateKey: deps.PrivateKey,
				PublicKey:  deps.PublicKey,
			}))
		}

		// Protected routes
		auth.POST("/signout", RequireAuth(), handlers.SignOut(&handlers.SignOutDependencies{
			DB: deps.DB,
		}))

		// User routes
		auth.GET("/user", RequireAuth(), handlers.GetUser(&handlers.GetUserDependencies{
			DB: deps.DB,
		}))
		auth.PATCH("/user", RequireAuth(), handlers.UpdateUser(&handlers.UpdateUserDependencies{
			DB: deps.DB,
		}))
		auth.DELETE("/user", RequireAuth(), handlers.DeleteUser(&handlers.DeleteUserDependencies{
			DB: deps.DB,
		}))

		enterpriseSSO := handlers.NewEnterpriseSSOHandler(deps.DB, deps.Config, deps.PrivateKey)
		domainHandler := handlers.NewDomainHandler(deps.DB)
		scimHandler := handlers.NewSCIMHandler(deps.DB)

		enterpriseRoutes := auth.Group("/enterprise")
		enterpriseRoutes.Use(RequireAuth(), RequireAdmin())
		{
			enterpriseRoutes.POST("/domains/verify", domainHandler.VerifyDomain)

			enterpriseRoutes.POST("/connections", enterpriseSSO.CreateConnection)
			enterpriseRoutes.GET("/connections", enterpriseSSO.ListConnections)
			enterpriseRoutes.GET("/connections/:id", enterpriseSSO.GetConnection)
			enterpriseRoutes.PUT("/connections/:id", enterpriseSSO.UpdateConnection)
			enterpriseRoutes.DELETE("/connections/:id", enterpriseSSO.DeleteConnection)
			enterpriseRoutes.GET("/events", enterpriseSSO.ListSSOEvents)

			enterpriseRoutes.GET("/connections/:id/scim/tokens", scimHandler.ListTokens)
			enterpriseRoutes.POST("/connections/:id/scim/tokens", scimHandler.CreateToken)
			enterpriseRoutes.POST("/connections/:id/scim/tokens/:tokenID/rotate", scimHandler.RotateToken)
			enterpriseRoutes.DELETE("/connections/:id/scim/tokens/:tokenID", scimHandler.RevokeToken)
		}

		auth.GET("/sso/:slug/start", enterpriseSSO.StartSSO)
		auth.POST("/sso/:slug/acs", enterpriseSSO.HandleACS)
		auth.GET("/sso/:slug/acs", enterpriseSSO.HandleACS) // OIDC callback support
		auth.GET("/sso/:slug/metadata", enterpriseSSO.Metadata)

		// Backward-compatible admin aliases under /auth/admin/*
		// This keeps gateway-prefixed routes working without changing existing /admin routes.
		authAdmin := auth.Group("/admin")
		authAdmin.Use(RequireAdmin())
		{
			authAdmin.GET("/users", handlers.AdminListUsers(&handlers.AdminListUsersDependencies{
				DB: deps.DB,
			}))
			authAdmin.GET("/users/:id", handlers.AdminGetUser(&handlers.AdminGetUserDependencies{
				DB: deps.DB,
			}))
			authAdmin.POST("/users/:id/ban", handlers.AdminBanUser(&handlers.AdminBanUserDependencies{
				DB: deps.DB,
			}))
			authAdmin.POST("/users/:id/unban", handlers.AdminUnbanUser(&handlers.AdminUnbanUserDependencies{
				DB: deps.DB,
			}))
			authAdmin.DELETE("/users/:id", handlers.AdminDeleteUser(&handlers.AdminDeleteUserDependencies{
				DB: deps.DB,
			}))
		}
	}

	scimHandler := handlers.NewSCIMHandler(deps.DB)
	scim := r.Group("/scim/v2")
	scim.Use(SCIMTokenAuth(deps.DB))
	{
		scim.GET("/Users", scimHandler.GetUsers)
		scim.POST("/Users", scimHandler.CreateUser)
		scim.PATCH("/Users/:id", scimHandler.PatchUser)
		scim.DELETE("/Users/:id", scimHandler.DeleteUser)
	}

	// Admin routes
	admin := r.Group("/admin")
	admin.Use(RequireAdmin())
	{
		admin.GET("/users", handlers.AdminListUsers(&handlers.AdminListUsersDependencies{
			DB: deps.DB,
		}))
		admin.GET("/users/:id", handlers.AdminGetUser(&handlers.AdminGetUserDependencies{
			DB: deps.DB,
		}))
		admin.POST("/users/:id/ban", handlers.AdminBanUser(&handlers.AdminBanUserDependencies{
			DB: deps.DB,
		}))
		admin.POST("/users/:id/unban", handlers.AdminUnbanUser(&handlers.AdminUnbanUserDependencies{
			DB: deps.DB,
		}))
		admin.DELETE("/users/:id", handlers.AdminDeleteUser(&handlers.AdminDeleteUserDependencies{
			DB: deps.DB,
		}))
	}

	// Internal routes (for service-to-service communication)
	internal := r.Group("/internal")
	internal.Use(InternalOnly(deps.Config.InternalSecret))
	{
		internal.GET("/users/:id", handlers.AdminGetUser(&handlers.AdminGetUserDependencies{
			DB: deps.DB,
		}))
		internal.GET("/users/by-email/:email", func(c *gin.Context) {
			email, err := url.PathUnescape(c.Param("email"))
			if err != nil {
				response.BadRequest(c, "Invalid email path parameter")
				return
			}
			user, err := repository.NewUserRepository(deps.DB).GetByEmail(c.Request.Context(), email)
			if err != nil {
				response.InternalServerError(c, "Failed to fetch user")
				return
			}
			if user == nil {
				response.NotFound(c, "User not found")
				return
			}
			response.Success(c, user.ToPublic())
		})
	}
}
