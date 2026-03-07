package api

import (
	"github.com/gin-gonic/gin"
	"github.com/indusbase/indus-meta/internal/handlers"
	"github.com/indusbase/indus-meta/internal/metrics"
	"github.com/indusbase/indus-meta/internal/postgres"
)

// RegisterRoutes registers all API routes
func RegisterRoutes(router *gin.Engine, db *postgres.DB) {
	router.Use(MetricsMiddleware())
	router.GET("/metrics", gin.WrapH(metrics.Handler()))

	// Initialize handlers
	schemaHandler := handlers.NewSchemaHandler(db)
	tableHandler := handlers.NewTableHandler(db)
	columnHandler := handlers.NewColumnHandler(db)
	indexHandler := handlers.NewIndexHandler(db)
	roleHandler := handlers.NewRoleHandler(db)
	extensionHandler := handlers.NewExtensionHandler(db)
	functionHandler := handlers.NewFunctionHandler(db)
	policyHandler := handlers.NewPolicyHandler(db)
	migrationHandler := handlers.NewMigrationHandler(db)
	queryHandler := handlers.NewQueryHandler(db)
	projectsHandler := handlers.NewProjectsHandler(db)
	trustCenterHandler := handlers.NewTrustCenterHandler(db)
	securityScansHandler := handlers.NewSecurityScansHandler(db)
	supportHandler := handlers.NewSupportHandler(db)

	// API group
	meta := router.Group("/meta")
	{
		// Schemas
		meta.GET("/schemas", schemaHandler.List)
		meta.POST("/schemas", schemaHandler.Create)
		meta.DELETE("/schemas/:name", schemaHandler.Drop)

		// Tables
		meta.GET("/tables", tableHandler.List)
		meta.GET("/tables/:id", tableHandler.Get)
		meta.POST("/tables", tableHandler.Create)
		meta.PATCH("/tables/:id", tableHandler.Alter)
		meta.DELETE("/tables/:id", tableHandler.Drop)
		meta.POST("/tables/:id/enable-rls", tableHandler.EnableRLS)
		meta.POST("/tables/:id/disable-rls", tableHandler.DisableRLS)

		// Columns
		meta.GET("/columns", columnHandler.List)
		meta.GET("/columns/:id", columnHandler.Get)
		meta.POST("/columns", columnHandler.Add)
		meta.PATCH("/columns/:id", columnHandler.Alter)
		meta.DELETE("/columns/:id", columnHandler.Drop)

		// Indexes
		meta.GET("/indexes", indexHandler.List)
		meta.POST("/indexes", indexHandler.Create)
		meta.DELETE("/indexes/:id", indexHandler.Drop)

		// Roles
		meta.GET("/roles", roleHandler.List)
		meta.POST("/roles", roleHandler.Create)
		meta.PATCH("/roles/:name", roleHandler.Alter)
		meta.DELETE("/roles/:name", roleHandler.Drop)
		meta.POST("/roles/:name/grant", roleHandler.Grant)

		// Extensions
		meta.GET("/extensions", extensionHandler.List)
		meta.POST("/extensions/:name", extensionHandler.Enable)
		meta.DELETE("/extensions/:name", extensionHandler.Disable)

		// Functions
		meta.GET("/functions", functionHandler.List)
		meta.POST("/functions", functionHandler.Create)
		meta.DELETE("/functions/:id", functionHandler.Drop)

		// Policies
		meta.GET("/policies", policyHandler.List)
		meta.POST("/policies", policyHandler.Create)
		meta.DELETE("/policies/:id", policyHandler.Drop)

		// Migrations
		meta.GET("/migrations", migrationHandler.History)
		meta.POST("/migrations/run", migrationHandler.Run)
		meta.POST("/migrations/rollback", migrationHandler.Rollback)

		// Query
		meta.POST("/query", queryHandler.Execute)

		// Organizations (platform)
		meta.POST("/organizations", projectsHandler.CreateOrganization)
		meta.GET("/organizations", projectsHandler.ListOrganizations)

		// Projects (platform multi-tenancy)
		meta.POST("/projects", projectsHandler.CreateProject)
		meta.GET("/projects", projectsHandler.ListProjects)
		meta.GET("/projects/:id", projectsHandler.GetProject)
		meta.DELETE("/projects/:id", projectsHandler.DeleteProject)
		meta.POST("/projects/:id/pause", projectsHandler.PauseProject)
		meta.POST("/projects/:id/resume", projectsHandler.ResumeProject)

		// Trust Center (public admin-managed metadata)
		meta.GET("/trust-center", trustCenterHandler.GetSettings)
		meta.PUT("/trust-center", trustCenterHandler.UpdateSettings)
		meta.GET("/subprocessors", trustCenterHandler.ListSubprocessors)
		meta.POST("/subprocessors", trustCenterHandler.CreateSubprocessor)
		meta.PUT("/subprocessors/:id", trustCenterHandler.UpdateSubprocessor)
		meta.DELETE("/subprocessors/:id", trustCenterHandler.DeleteSubprocessor)
		meta.GET("/compliance-milestones", trustCenterHandler.ListMilestones)
		meta.POST("/compliance-milestones", trustCenterHandler.CreateMilestone)
		meta.PUT("/compliance-milestones/:id", trustCenterHandler.UpdateMilestone)
		meta.DELETE("/compliance-milestones/:id", trustCenterHandler.DeleteMilestone)
		meta.GET("/public-incidents", trustCenterHandler.ListPublicIncidents)
		meta.POST("/public-incidents", trustCenterHandler.CreatePublicIncident)
		meta.PUT("/public-incidents/:id", trustCenterHandler.UpdatePublicIncident)
		meta.DELETE("/public-incidents/:id", trustCenterHandler.DeletePublicIncident)

		// Security scans (CI ingestion + Studio dashboard)
		meta.GET("/security/scans/summary", securityScansHandler.Summary)
		meta.GET("/security/scans", securityScansHandler.ListRuns)
		meta.POST("/security/scans", securityScansHandler.CreateRun)

		// Enterprise support tooling
		meta.GET("/support/users/search", supportHandler.SearchUsers)
		meta.GET("/support/projects/search", supportHandler.SearchProjects)
		meta.GET("/support/context", supportHandler.Context)
		meta.POST("/support/notes", supportHandler.CreateNote)
		meta.GET("/support/notes", supportHandler.ListNotes)
		meta.POST("/support/impersonation/request", supportHandler.RequestImpersonation)
	}
}
