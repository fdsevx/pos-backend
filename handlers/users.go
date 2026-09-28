package handlers

import (
	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
	"gorm.io/gorm"

	"github.com/edidev23/pos-backend/models"
)

func GetUsersHandler(db *gorm.DB) fiber.Handler {
	return func(c *fiber.Ctx) error {
		outletType, _ := c.Locals("outlet_type").(string)
		filterOutlet := c.Query("outlet_type", outletType)
		filterRole := c.Query("role")

		var users []models.User
		query := db.Model(&models.User{}).Where("is_active = ?", true)

		if filterOutlet != "" {
			query = query.Where("outlet_type = ?", filterOutlet)
		}
		if filterRole != "" {
			query = query.Where("role = ?", filterRole)
		}

		if err := query.Order("created_at desc").Find(&users).Error; err != nil {
			return c.Status(fiber.StatusInternalServerError).JSON(models.APIResponse{
				Success: false,
				Message: "Failed to fetch users",
				Error:   err.Error(),
			})
		}

		return c.JSON(models.APIResponse{
			Success: true,
			Message: "Users fetched successfully",
			Data:    users,
		})
	}
}

func DeleteUserHandler(db *gorm.DB) fiber.Handler {
	return func(c *fiber.Ctx) error {
		idStr := c.Params("id")
		userID, err := uuid.Parse(idStr)
		if err != nil {
			return c.Status(fiber.StatusBadRequest).JSON(models.APIResponse{
				Success: false,
				Message: "Invalid user ID",
			})
		}

		if err := db.Model(&models.User{}).Where("id = ?", userID).Update("is_active", false).Error; err != nil {
			return c.Status(fiber.StatusInternalServerError).JSON(models.APIResponse{
				Success: false,
				Message: "Failed to deactivate user",
				Error:   err.Error(),
			})
		}

		return c.JSON(models.APIResponse{
			Success: true,
			Message: "User deactivated successfully",
		})
	}
}
