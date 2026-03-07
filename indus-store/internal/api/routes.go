package api

import (
	"github.com/gin-gonic/gin"
	"github.com/indusbase/indus-store/internal/handlers"
	"github.com/indusbase/indus-store/internal/metrics"
)

// SetupRoutes configures all API routes
func SetupRoutes(
	router *gin.Engine,
	authMiddleware *AuthMiddleware,
	bucketHandler *handlers.BucketHandler,
	objectHandler *handlers.ObjectHandler,
	signedURLHandler *handlers.SignedURLHandler,
) {
	router.Use(MetricsMiddleware())

	// Health check
	router.GET("/health", func(c *gin.Context) {
		c.JSON(200, gin.H{"status": "ok"})
	})
	router.GET("/metrics", gin.WrapH(metrics.Handler()))

	// API v1 group
	v1 := router.Group("/storage/v1")

	// Public routes (signed URLs, public downloads)
	public := v1.Group("")
	public.Use(authMiddleware.OptionalAuth())
	{
		// Public object access
		public.GET("/object/public/:bucket/*filepath", objectHandler.DownloadPublicObject)

		// Signed URL download
		public.GET("/object/authenticated/:bucket/*filepath", signedURLHandler.ServeSignedDownload)
	}

	// Protected routes (require authentication)
	protected := v1.Group("")
	protected.Use(authMiddleware.RequireAuth())
	{
		// Buckets
		protected.POST("/bucket", bucketHandler.CreateBucket)
		protected.GET("/bucket", bucketHandler.ListBuckets)
		protected.GET("/bucket/:id", bucketHandler.GetBucket)
		protected.PATCH("/bucket/:id", bucketHandler.UpdateBucket)
		protected.DELETE("/bucket/:id", bucketHandler.DeleteBucket)
		protected.GET("/bucket/name/:name", bucketHandler.GetBucketByName)

		// Objects
		protected.POST("/object/:bucket/*filepath", objectHandler.UploadObject)
		protected.GET("/object/:bucket/*filepath", objectHandler.DownloadObject)
		protected.DELETE("/object/:bucket/*filepath", objectHandler.DeleteObject)
		protected.GET("/object/list/:bucket", objectHandler.ListObjects)

		// Signed URLs
		protected.POST("/object/sign/:bucket/*filepath", signedURLHandler.CreateSignedDownloadURL)
		protected.POST("/object/sign/upload/:bucket/*filepath", signedURLHandler.CreateSignedUploadURL)
	}
}
