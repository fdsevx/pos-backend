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

	// Protected routes (require valid JWT)
	protected := api.Group("", middleware.JWTProtected(cfg.JWTSecret))

	// User Profile
	protected.Get("/auth/profile", handlers.ProfileHandler(db))

	// User & Cashier Management (Admin only)
	users := protected.Group("/users", middleware.AdminOnly())
	users.Get("", handlers.GetUsersHandler(db))
	users.Post("", handlers.RegisterHandler(db))
	users.Delete("/:id", handlers.DeleteUserHandler(db))
	// Backward compatible register route
	protected.Post("/auth/register", middleware.AdminOnly(), handlers.RegisterHandler(db))

	// Products CRUD (POS reads, Admin creates/updates/deletes)
	products := protected.Group("/products")
	products.Get("", handlers.GetProductsHandler(db))
	products.Post("", middleware.AdminOnly(), handlers.CreateProductHandler(db))
	products.Put("/:id", middleware.AdminOnly(), handlers.UpdateProductHandler(db))
	products.Delete("/:id", middleware.AdminOnly(), handlers.DeleteProductHandler(db))

	// Sync (with GZIP decompression from Flutter POS)
	protected.Post("/sync", middleware.GzipDecompress(), handlers.SyncHandler(db))

	// Stock Opname
	protected.Post("/opname", handlers.CreateOpnameHandler(db))
	protected.Get("/opname", handlers.GetOpnameListHandler(db))

	// Accounting COA & Ledger (Admin only)
	accounting := protected.Group("", middleware.AdminOnly())
	accounting.Get("/accounts", handlers.GetAccountsHandler(db))
	accounting.Get("/journals", handlers.GetJournalsHandler(db))

	// Reports (Admin only)
	reports := protected.Group("/reports", middleware.AdminOnly())
	reports.Get("/monthly", handlers.MonthlyReportHandler(db))
	reports.Get("/chart", handlers.ChartDataHandler(db))
	reports.Get("/export", handlers.ExportReportHandler(db))
}
