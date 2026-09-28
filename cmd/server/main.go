package main

import (
    "log"
    "os"
    "os/signal"
    "syscall"

    "github.com/gofiber/fiber/v2"
    "github.com/gofiber/fiber/v2/middleware/cors"
    "github.com/gofiber/fiber/v2/middleware/logger"
    "github.com/gofiber/fiber/v2/middleware/recover"
    
    "github.com/edidev23/pos-backend/config"
    "github.com/edidev23/pos-backend/database"
    "github.com/edidev23/pos-backend/routes"
)

func main() {
    // Load config
    cfg := config.LoadConfig()
    
    // Connect database
    db, err := database.Connect(cfg)
    if err != nil {
        log.Fatalf("Failed to connect to database: %v", err)
    }
    
    // Run migrations
    if err := database.Migrate(db); err != nil {
        log.Fatalf("Failed to run migrations: %v", err)
    }
    
    // Seed COA accounts
    if err := database.SeedAccounts(db); err != nil {
        log.Fatalf("Failed to seed accounts: %v", err)
    }

    // Seed default admin (username: admin, password: admin123)
    if err := database.SeedDefaultAdmin(db); err != nil {
        log.Printf("Warning: failed to seed default admin: %v", err)
    }

    // Seed sample products for testing
    if err := database.SeedDefaultProducts(db); err != nil {
        log.Printf("Warning: failed to seed default products: %v", err)
    }
    
    // Create Fiber app
    app := fiber.New(fiber.Config{
        AppName:      "POS Backend API v1.0",
        BodyLimit:    50 * 1024 * 1024, // 50MB for large sync batches
        ErrorHandler: customErrorHandler,
    })
    
    // Global middleware
    app.Use(recover.New())
    app.Use(logger.New(logger.Config{
        Format:     "${time} | ${status} | ${latency} | ${method} | ${path}\n",
        TimeFormat: "2006-01-02 15:04:05",
    }))
    app.Use(cors.New(cors.Config{
        AllowOrigins: "*",
        AllowHeaders: "Origin, Content-Type, Accept, Authorization, X-Outlet-Type, Content-Encoding",
        AllowMethods: "GET, POST, PUT, DELETE, OPTIONS",
    }))
    
    // Setup routes
    routes.SetupRoutes(app, db, cfg)
    
    // Graceful shutdown
    go func() {
        sigChan := make(chan os.Signal, 1)
        signal.Notify(sigChan, syscall.SIGINT, syscall.SIGTERM)
        <-sigChan
        log.Println("Shutting down server...")
        app.Shutdown()
    }()
    
    // Start server
    // Reads PORT from env (Back4app, Render, etc.), fallback to SERVER_PORT, then 8080
    port := os.Getenv("PORT")
    if port == "" {
        port = cfg.ServerPort
    }
    if port == "" {
        port = "8080"
    }
    log.Printf("🚀 POS Backend API starting on port %s", port)
    if err := app.Listen(":" + port); err != nil {
        log.Fatalf("Failed to start server: %v", err)
    }
}

func customErrorHandler(c *fiber.Ctx, err error) error {
    code := fiber.StatusInternalServerError
    if e, ok := err.(*fiber.Error); ok {
        code = e.Code
    }
    return c.Status(code).JSON(fiber.Map{
        "success": false,
        "message": "Internal Server Error",
        "error":   err.Error(),
    })
}
