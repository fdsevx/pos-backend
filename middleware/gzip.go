package middleware

import (
	"bytes"
	"compress/gzip"
	"io"
	"log"

	"github.com/gofiber/fiber/v2"
)

func GzipDecompress() fiber.Handler {
	return func(c *fiber.Ctx) error {
		if c.Get("Content-Encoding") != "gzip" {
			return c.Next()
		}

		body := c.Body()
		originalSize := len(body)

		reader, err := gzip.NewReader(bytes.NewReader(body))
		if err != nil {
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
				"success": false,
				"error":   "Failed to create gzip reader",
			})
		}
		defer reader.Close()

		decompressedBody, err := io.ReadAll(reader)
		if err != nil {
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
				"success": false,
				"error":   "Failed to decompress body",
			})
		}

		decompressedSize := len(decompressedBody)
		log.Printf("GZIP Decompression: Original size: %d bytes, Decompressed size: %d bytes", originalSize, decompressedSize)

		c.Request().SetBody(decompressedBody)
		c.Request().Header.Del("Content-Encoding")

		return c.Next()
	}
}
