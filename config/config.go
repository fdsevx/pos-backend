package config

import (
	"log"
	"os"
	"strconv"

	"github.com/joho/godotenv"
)

type Config struct {
	DBHost         string
	DBPort         string
	DBUser         string
	DBPassword     string
	DBName         string
	DBSSLMode      string
	JWTSecret      string
	JWTExpiryHours int
	ServerPort     string
	AppEnv         string
}

// LoadConfig loads configuration from environment variables.
// It panics if required database variables are missing.
func LoadConfig() *Config {
	// Best-effort load from .env file (ignored if missing)
	_ = godotenv.Load()

	cfg := &Config{
		DBHost:     os.Getenv("DB_HOST"),
		DBPort:     os.Getenv("DB_PORT"),
		DBUser:     os.Getenv("DB_USER"),
		DBPassword: os.Getenv("DB_PASSWORD"),
		DBName:     os.Getenv("DB_NAME"),
		DBSSLMode:  os.Getenv("DB_SSLMODE"),
		JWTSecret:  os.Getenv("JWT_SECRET"),
		ServerPort: os.Getenv("SERVER_PORT"),
		AppEnv:     os.Getenv("APP_ENV"),
	}

	// Defaults
	if cfg.DBSSLMode == "" {
		cfg.DBSSLMode = "require"
	}
	if cfg.JWTSecret == "" {
		cfg.JWTSecret = "default-secret-change-me"
	}
	if cfg.ServerPort == "" {
		cfg.ServerPort = "3000"
	}
	if cfg.AppEnv == "" {
		cfg.AppEnv = "development"
	}

	expiryStr := os.Getenv("JWT_EXPIRY_HOURS")
	if expiryStr != "" {
		expiry, err := strconv.Atoi(expiryStr)
		if err == nil {
			cfg.JWTExpiryHours = expiry
		}
	}
	if cfg.JWTExpiryHours == 0 {
		cfg.JWTExpiryHours = 24
	}

	if cfg.DBHost == "" || cfg.DBPort == "" || cfg.DBUser == "" || cfg.DBPassword == "" || cfg.DBName == "" {
		log.Fatal("Missing required database environment variables (DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, DB_NAME)")
	}

	return cfg
}
