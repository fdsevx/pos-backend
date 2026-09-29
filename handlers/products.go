package handlers

import (
	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
	"github.com/shopspring/decimal"
	"gorm.io/gorm"

	"github.com/edidev23/pos-backend/models"
)

type ProductRequest struct {
	Name          string `json:"name"`
	SKU           string `json:"sku"`
	Category      string `json:"category"`
	Price         string `json:"price"`
	Cogs          string `json:"cogs"`
	StockQuantity int    `json:"stock_quantity"`
	MinStock      int    `json:"min_stock"`
	Unit          string `json:"unit"`
	OutletType    string `json:"outlet_type"`
}

func GetProductsHandler(db *gorm.DB) fiber.Handler {
	return func(c *fiber.Ctx) error {
		outletType, _ := c.Locals("outlet_type").(string)
		filterOutlet := c.Query("outlet_type", outletType)

		var products []models.Product
		query := db.Model(&models.Product{}).Where("is_active = ?", true)

		if filterOutlet != "" {
			query = query.Where("outlet_type = ?", filterOutlet)
		}

		if category := c.Query("category"); category != "" {
			query = query.Where("category = ?", category)
		}

		if err := query.Order("name asc").Find(&products).Error; err != nil {
			return c.Status(fiber.StatusInternalServerError).JSON(models.APIResponse{
				Success: false,
				Message: "Failed to fetch products",
				Error:   err.Error(),
			})
		}

		return c.JSON(models.APIResponse{
			Success: true,
			Message: "Products fetched successfully",
			Data:    products,
		})
	}
}

func CreateProductHandler(db *gorm.DB) fiber.Handler {
	return func(c *fiber.Ctx) error {
		var req ProductRequest
		if err := c.BodyParser(&req); err != nil {
			return c.Status(fiber.StatusBadRequest).JSON(models.APIResponse{
				Success: false,
				Message: "Invalid request payload",
				Error:   err.Error(),
			})
		}

		if req.Name == "" || req.SKU == "" || req.OutletType == "" {
			return c.Status(fiber.StatusBadRequest).JSON(models.APIResponse{
				Success: false,
				Message: "Name, SKU, and OutletType are required",
			})
		}

		price, err := decimal.NewFromString(req.Price)
		if err != nil {
			price = decimal.Zero
		}

		cogs, err := decimal.NewFromString(req.Cogs)
		if err != nil {
			cogs = decimal.Zero
		}

		product := models.Product{
			ID:            uuid.New(),
			Name:          req.Name,
			SKU:           req.SKU,
			Category:      req.Category,
			Price:         price,
			Cogs:          cogs,
			StockQuantity: req.StockQuantity,
			MinStock:      req.MinStock,
			Unit:          req.Unit,
			OutletType:    req.OutletType,
			IsActive:      true,
		}

		if err := db.Create(&product).Error; err != nil {
			return c.Status(fiber.StatusConflict).JSON(models.APIResponse{
				Success: false,
				Message: "Failed to create product (SKU may already exist)",
				Error:   err.Error(),
			})
		}

		return c.Status(fiber.StatusCreated).JSON(models.APIResponse{
			Success: true,
			Message: "Product created successfully",
			Data:    product,
		})
	}
}

func UpdateProductHandler(db *gorm.DB) fiber.Handler {
	return func(c *fiber.Ctx) error {
		idStr := c.Params("id")
		productID, err := uuid.Parse(idStr)
		if err != nil {
			return c.Status(fiber.StatusBadRequest).JSON(models.APIResponse{
				Success: false,
				Message: "Invalid product ID",
			})
		}

		var product models.Product
		if err := db.First(&product, "id = ?", productID).Error; err != nil {
			return c.Status(fiber.StatusNotFound).JSON(models.APIResponse{
				Success: false,
				Message: "Product not found",
			})
		}

		var req ProductRequest
		if err := c.BodyParser(&req); err != nil {
			return c.Status(fiber.StatusBadRequest).JSON(models.APIResponse{
				Success: false,
				Message: "Invalid request payload",
			})
		}

		if req.Name != "" {
			product.Name = req.Name
		}
		if req.Category != "" {
			product.Category = req.Category
		}
		if req.Unit != "" {
			product.Unit = req.Unit
		}
		if req.Price != "" {
			if p, err := decimal.NewFromString(req.Price); err == nil {
				product.Price = p
			}
		}
		if req.Cogs != "" {
			if cg, err := decimal.NewFromString(req.Cogs); err == nil {
				product.Cogs = cg
			}
		}
		product.StockQuantity = req.StockQuantity
		product.MinStock = req.MinStock

		if err := db.Save(&product).Error; err != nil {
			return c.Status(fiber.StatusInternalServerError).JSON(models.APIResponse{
				Success: false,
				Message: "Failed to update product",
				Error:   err.Error(),
			})
		}

		return c.JSON(models.APIResponse{
			Success: true,
			Message: "Product updated successfully",
			Data:    product,
		})
	}
}

func DeleteProductHandler(db *gorm.DB) fiber.Handler {
	return func(c *fiber.Ctx) error {
		idStr := c.Params("id")
		productID, err := uuid.Parse(idStr)
		if err != nil {
			return c.Status(fiber.StatusBadRequest).JSON(models.APIResponse{
				Success: false,
				Message: "Invalid product ID",
			})
		}

		if err := db.Model(&models.Product{}).Where("id = ?", productID).Update("is_active", false).Error; err != nil {
			return c.Status(fiber.StatusInternalServerError).JSON(models.APIResponse{
				Success: false,
				Message: "Failed to delete product",
				Error:   err.Error(),
			})
		}

		return c.JSON(models.APIResponse{
			Success: true,
			Message: "Product deleted successfully",
		})
	}
}
