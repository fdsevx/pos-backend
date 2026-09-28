package handlers

import (
	"strconv"

	"github.com/gofiber/fiber/v2"
	"gorm.io/gorm"

	"github.com/edidev23/pos-backend/models"
)

func GetAccountsHandler(db *gorm.DB) fiber.Handler {
	return func(c *fiber.Ctx) error {
		var accounts []models.Account
		if err := db.Order("code asc").Find(&accounts).Error; err != nil {
			return c.Status(fiber.StatusInternalServerError).JSON(models.APIResponse{
				Success: false,
				Message: "Failed to fetch accounts",
				Error:   err.Error(),
			})
		}

		return c.JSON(models.APIResponse{
			Success: true,
			Message: "Accounts fetched successfully",
			Data:    accounts,
		})
	}
}

func GetJournalsHandler(db *gorm.DB) fiber.Handler {
	return func(c *fiber.Ctx) error {
		outletType, _ := c.Locals("outlet_type").(string)
		filterOutlet := c.Query("outlet_type", outletType)

		page, _ := strconv.Atoi(c.Query("page", "1"))
		limit, _ := strconv.Atoi(c.Query("limit", "20"))
		if page < 1 {
			page = 1
		}
		if limit < 1 || limit > 100 {
			limit = 20
		}
		offset := (page - 1) * limit

		type JournalWithLines struct {
			models.JournalEntry
			Lines []models.JournalLine `json:"lines" gorm:"foreignKey:JournalEntryID"`
		}

		var entries []JournalWithLines
		query := db.Model(&models.JournalEntry{})
		if filterOutlet != "" {
			query = query.Where("outlet_type = ?", filterOutlet)
		}

		var total int64
		query.Count(&total)

		if err := query.Preload("Lines.Account").Offset(offset).Limit(limit).Order("entry_date desc").Find(&entries).Error; err != nil {
			return c.Status(fiber.StatusInternalServerError).JSON(models.APIResponse{
				Success: false,
				Message: "Failed to fetch journal entries",
				Error:   err.Error(),
			})
		}

		return c.JSON(models.APIResponse{
			Success: true,
			Message: "Journals fetched successfully",
			Data: fiber.Map{
				"items": entries,
				"total": total,
				"page":  page,
				"limit": limit,
			},
		})
	}
}
