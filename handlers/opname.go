package handlers

import (
	"strconv"

	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
	"gorm.io/gorm"

	"github.com/edidev23/pos-backend/models"
	"github.com/edidev23/pos-backend/services"
)

type OpnameRequest struct {
	ProductID   string `json:"product_id"`
	ActualStock int    `json:"actual_stock"`
	Notes       string `json:"notes"`
}

func CreateOpnameHandler(db *gorm.DB) fiber.Handler {
	return func(c *fiber.Ctx) error {
		var req OpnameRequest
		if err := c.BodyParser(&req); err != nil {
			return c.Status(fiber.StatusBadRequest).JSON(models.APIResponse{
				Success: false,
				Message: "Invalid request payload",
				Error:   err.Error(),
			})
		}

		outletType, _ := c.Locals("outlet_type").(string)
		userIDStr, _ := c.Locals("user_id").(string)

		var approvedBy *uuid.UUID
		if userIDStr != "" {
			uid, err := uuid.Parse(userIDStr)
			if err == nil {
				approvedBy = &uid
			}
		}

		productID, err := uuid.Parse(req.ProductID)
		if err != nil {
			return c.Status(fiber.StatusBadRequest).JSON(models.APIResponse{
				Success: false,
				Message: "Invalid product_id",
				Error:   err.Error(),
			})
		}

		var product models.Product
		if err := db.First(&product, "id = ?", productID).Error; err != nil {
			return c.Status(fiber.StatusNotFound).JSON(models.APIResponse{
				Success: false,
				Message: "Product not found",
				Error:   err.Error(),
			})
		}

		difference := req.ActualStock - product.StockQuantity

		opname := models.StockOpname{
			ID:          uuid.New(),
			ProductID:   product.ID,
			SystemStock: product.StockQuantity,
			ActualStock: req.ActualStock,
			Difference:  difference,
			Notes:       req.Notes,
			OutletType:  outletType,
			ApprovedBy:  approvedBy,
			Status:      "COMPLETED",
		}

		err = db.Transaction(func(dbTx *gorm.DB) error {
			if err := dbTx.Create(&opname).Error; err != nil {
				return err
			}

			if err := dbTx.Model(&product).Update("stock_quantity", req.ActualStock).Error; err != nil {
				return err
			}

			return nil
		})

		if err != nil {
			return c.Status(fiber.StatusInternalServerError).JSON(models.APIResponse{
				Success: false,
				Message: "Failed to process stock opname",
				Error:   err.Error(),
			})
		}

		// Create stock adjustment journal asynchronously
		if difference != 0 {
			go func(op models.StockOpname, p models.Product) {
				_ = services.CreateStockAdjustmentJournal(db, op, p)
			}(opname, product)
		}

		return c.Status(fiber.StatusCreated).JSON(models.APIResponse{
			Success: true,
			Message: "Stock opname created successfully",
			Data:    opname,
		})
	}
}

func GetOpnameListHandler(db *gorm.DB) fiber.Handler {
	return func(c *fiber.Ctx) error {
		outletType, _ := c.Locals("outlet_type").(string)

		page, _ := strconv.Atoi(c.Query("page", "1"))
		limit, _ := strconv.Atoi(c.Query("limit", "20"))
		if page < 1 {
			page = 1
		}
		if limit < 1 || limit > 100 {
			limit = 20
		}
		offset := (page - 1) * limit

		var opnames []models.StockOpname
		query := db.Model(&models.StockOpname{}).Preload("Product")
		if outletType != "" {
			query = query.Where("outlet_type = ?", outletType)
		}

		var total int64
		query.Count(&total)

		if err := query.Offset(offset).Limit(limit).Order("created_at desc").Find(&opnames).Error; err != nil {
			return c.Status(fiber.StatusInternalServerError).JSON(models.APIResponse{
				Success: false,
				Message: "Failed to fetch stock opnames",
				Error:   err.Error(),
			})
		}

		return c.Status(fiber.StatusOK).JSON(models.APIResponse{
			Success: true,
			Message: "Success",
			Data: fiber.Map{
				"items": opnames,
				"total": total,
				"page":  page,
				"limit": limit,
			},
		})
	}
}
