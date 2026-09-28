package routes

import (
    "github.com/gofiber/fiber/v2"
    "gorm.io/gorm"
    
    "github.com/edidev23/pos-backend/config"
    "github.com/edidev23/pos-backend/handlers"
    "github.com/edidev23/pos-backend/middleware"
)

func SetupRoutes(app *fiber.App, db *gorm.DB, cfg *config.Config) {
    // Health check
    app.Get("/health", func(c *fiber.Ctx) error {
        return c.JSON(fiber.Map{"status": "healthy", "service": "POS Backend API"})
    })
    
    api := app.Group("/api/v1")
    
    // Auth routes (public)
    auth := api.Group("/auth")
    auth.Post("/login", handlers.LoginHandler(db, cfg.JWTSecret, cfg.JWTExpiryHours))
    
    // Protected routes
    protected := api.Group("", middleware.JWTProtected(cfg.JWTSecret))
    
    // Auth protected
    protected.Get("/auth/profile", handlers.ProfileHandler(db))
    protected.Post("/auth/register", middleware.AdminOnly(), handlers.RegisterHandler(db))
    
    // Sync (with GZIP decompression)
    protected.Post("/sync", middleware.GzipDecompress(), handlers.SyncHandler(db))
    
    // Stock Opname
    protected.Post("/opname", handlers.CreateOpnameHandler(db))
    protected.Get("/opname", handlers.GetOpnameListHandler(db))
    
    // Reports (Admin only)
    reports := protected.Group("/reports", middleware.AdminOnly())
    reports.Get("/monthly", handlers.MonthlyReportHandler(db))
    reports.Get("/chart", handlers.ChartDataHandler(db))
    reports.Get("/export", handlers.ExportReportHandler(db))
}
