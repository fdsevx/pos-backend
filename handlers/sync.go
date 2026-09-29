package handlers

import (
	"github.com/gofiber/fiber/v2"
	"gorm.io/gorm"

	"github.com/edidev23/pos-backend/models"
	"github.com/edidev23/pos-backend/services"
)

func SyncHandler(db *gorm.DB) fiber.Handler {
	return func(c *fiber.Ctx) error {
		var payload models.SyncPayload
		if err := c.BodyParser(&payload); err != nil {
			return c.Status(fiber.StatusBadRequest).JSON(models.APIResponse{
				Success: false,
				Message: "Invalid request payload",
				Error:   err.Error(),
			})
		}

		// Validate outlet_type
		if payload.OutletType != "RESTORAN" && payload.OutletType != "CAFE" {
			return c.Status(fiber.StatusBadRequest).JSON(models.APIResponse{
				Success: false,
				Message: "outlet_type must be RESTORAN or CAFE",
			})
		}

		if len(payload.Transactions) == 0 {
			return c.Status(fiber.StatusBadRequest).JSON(models.APIResponse{
				Success: false,
				Message: "No transactions to sync",
			})
		}

		syncLog, err := services.ProcessSyncBatch(db, payload)
		if err != nil {
			return c.Status(fiber.StatusInternalServerError).JSON(models.APIResponse{
				Success: false,
				Message: "Failed to process sync batch",
				Error:   err.Error(),
			})
		}

		return c.Status(fiber.StatusOK).JSON(models.APIResponse{
			Success: true,
			Message: "Sync completed",
			Data: fiber.Map{
				"sync_log_id":        syncLog.ID,
				"total_transactions": syncLog.TotalTransactions,
				"processed_count":    syncLog.ProcessedCount,
				"status":             syncLog.Status,
				"synced_at":          syncLog.CreatedAt,
			},
		})
	}
}
