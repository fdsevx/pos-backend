package middleware

import (
	"github.com/gofiber/fiber/v2"
)

func TenantMiddleware() fiber.Handler {
	return func(c *fiber.Ctx) error {
		outletType, _ := c.Locals("outlet_type").(string)
		role, _ := c.Locals("role").(string)

		headerOutletType := c.Get("X-Outlet-Type")
		if role == "ADMIN" && headerOutletType != "" {
			outletType = headerOutletType
		}

		if outletType != "RESTORAN" && outletType != "CAFE" {
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
				"success": false,
				"error":   "Invalid outlet type",
			})
		}

		c.Locals("outlet_type", outletType)
		return c.Next()
	}
}
