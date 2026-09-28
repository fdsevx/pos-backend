package handlers

import (
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
	"golang.org/x/crypto/bcrypt"
	"gorm.io/gorm"

	"github.com/edidev23/pos-backend/middleware"
	"github.com/edidev23/pos-backend/models"
)

type LoginRequest struct {
	Username string `json:"username"`
	Password string `json:"password"`
}

type RegisterRequest struct {
	Username   string `json:"username"`
	Password   string `json:"password"`
	FullName   string `json:"full_name"`
	Role       string `json:"role"`
	OutletType string `json:"outlet_type"`
}

func LoginHandler(db *gorm.DB, jwtSecret string, jwtExpiry int) fiber.Handler {
	return func(c *fiber.Ctx) error {
		var req LoginRequest
		if err := c.BodyParser(&req); err != nil {
			return c.Status(fiber.StatusBadRequest).JSON(models.APIResponse{
				Success: false,
				Message: "Invalid request body",
				Error:   err.Error(),
			})
		}

		if req.Username == "" || req.Password == "" {
			return c.Status(fiber.StatusBadRequest).JSON(models.APIResponse{
				Success: false,
				Message: "Username and password are required",
			})
		}

		var user models.User
		if err := db.Where("username = ?", req.Username).First(&user).Error; err != nil {
			return c.Status(fiber.StatusUnauthorized).JSON(models.APIResponse{
				Success: false,
				Message: "Invalid username or password",
			})
		}

		if !user.IsActive {
			return c.Status(fiber.StatusUnauthorized).JSON(models.APIResponse{
				Success: false,
				Message: "Account is deactivated",
			})
		}

		if err := bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(req.Password)); err != nil {
			return c.Status(fiber.StatusUnauthorized).JSON(models.APIResponse{
				Success: false,
				Message: "Invalid username or password",
			})
		}

		expiresAt := time.Now().Add(time.Duration(jwtExpiry) * time.Hour)
		claims := middleware.JWTClaims{
			UserID:     user.ID.String(),
			Username:   user.Username,
			Role:       user.Role,
			OutletType: user.OutletType,
			RegisteredClaims: jwt.RegisteredClaims{
				ExpiresAt: jwt.NewNumericDate(expiresAt),
				IssuedAt:  jwt.NewNumericDate(time.Now()),
			},
		}

		token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
		tokenString, err := token.SignedString([]byte(jwtSecret))
		if err != nil {
			return c.Status(fiber.StatusInternalServerError).JSON(models.APIResponse{
				Success: false,
				Message: "Failed to generate token",
				Error:   err.Error(),
			})
		}

		return c.JSON(models.APIResponse{
			Success: true,
			Message: "Login successful",
			Data: fiber.Map{
				"token": tokenString,
				"user": fiber.Map{
					"id":          user.ID,
					"username":    user.Username,
					"full_name":   user.FullName,
					"role":        user.Role,
					"outlet_type": user.OutletType,
				},
				"expires_at": expiresAt.Format(time.RFC3339),
			},
		})
	}
}

func RegisterHandler(db *gorm.DB) fiber.Handler {
	return func(c *fiber.Ctx) error {
		var req RegisterRequest
		if err := c.BodyParser(&req); err != nil {
			return c.Status(fiber.StatusBadRequest).JSON(models.APIResponse{
				Success: false,
				Message: "Invalid request body",
				Error:   err.Error(),
			})
		}

		if req.Username == "" || req.Password == "" || req.Role == "" || req.OutletType == "" {
			return c.Status(fiber.StatusBadRequest).JSON(models.APIResponse{
				Success: false,
				Message: "Username, password, role, and outlet_type are required",
			})
		}

		if req.Role != "ADMIN" && req.Role != "KASIR" {
			return c.Status(fiber.StatusBadRequest).JSON(models.APIResponse{
				Success: false,
				Message: "Role must be ADMIN or KASIR",
			})
		}

		if req.OutletType != "RESTORAN" && req.OutletType != "CAFE" {
			return c.Status(fiber.StatusBadRequest).JSON(models.APIResponse{
				Success: false,
				Message: "Outlet type must be RESTORAN or CAFE",
			})
		}

		hash, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
		if err != nil {
			return c.Status(fiber.StatusInternalServerError).JSON(models.APIResponse{
				Success: false,
				Message: "Failed to hash password",
				Error:   err.Error(),
			})
		}

		user := models.User{
			ID:           uuid.New(),
			Username:     req.Username,
			PasswordHash: string(hash),
			FullName:     req.FullName,
			Role:         req.Role,
			OutletType:   req.OutletType,
			IsActive:     true,
		}

		if err := db.Create(&user).Error; err != nil {
			return c.Status(fiber.StatusConflict).JSON(models.APIResponse{
				Success: false,
				Message: "Failed to create user (username may already exist)",
				Error:   err.Error(),
			})
		}

		return c.Status(fiber.StatusCreated).JSON(models.APIResponse{
			Success: true,
			Message: "User registered successfully",
			Data: fiber.Map{
				"id":          user.ID,
				"username":    user.Username,
				"full_name":   user.FullName,
				"role":        user.Role,
				"outlet_type": user.OutletType,
				"is_active":   user.IsActive,
				"created_at":  user.CreatedAt,
			},
		})
	}
}

func ProfileHandler(db *gorm.DB) fiber.Handler {
	return func(c *fiber.Ctx) error {
		userIDStr, ok := c.Locals("user_id").(string)
		if !ok {
			return c.Status(fiber.StatusUnauthorized).JSON(models.APIResponse{
				Success: false,
				Message: "Unauthorized",
				Error:   "User ID not found in context",
			})
		}

		userID, err := uuid.Parse(userIDStr)
		if err != nil {
			return c.Status(fiber.StatusBadRequest).JSON(models.APIResponse{
				Success: false,
				Message: "Invalid user ID format",
				Error:   err.Error(),
			})
		}

		var user models.User
		if err := db.Select("id", "username", "full_name", "role", "outlet_type", "is_active", "created_at", "updated_at").
			Where("id = ?", userID).First(&user).Error; err != nil {
			return c.Status(fiber.StatusNotFound).JSON(models.APIResponse{
				Success: false,
				Message: "User not found",
				Error:   err.Error(),
			})
		}

		return c.JSON(models.APIResponse{
			Success: true,
			Message: "Profile retrieved successfully",
			Data:    user,
		})
	}
}
