package database

import (
	"fmt"
	"time"

	"github.com/edidev23/pos-backend/config"
	"github.com/edidev23/pos-backend/models"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
)

func Connect(cfg *config.Config) (*gorm.DB, error) {
	dsn := fmt.Sprintf("host=%s user=%s password=%s dbname=%s port=%s sslmode=%s TimeZone=UTC",
		cfg.DBHost, cfg.DBUser, cfg.DBPassword, cfg.DBName, cfg.DBPort, cfg.DBSSLMode)

	db, err := gorm.Open(postgres.Open(dsn), &gorm.Config{})
	if err != nil {
		return nil, err
	}

	sqlDB, err := db.DB()
	if err != nil {
		return nil, err
	}

	sqlDB.SetMaxIdleConns(3)
	sqlDB.SetMaxOpenConns(10)
	sqlDB.SetConnMaxLifetime(30 * time.Minute)

	return db, nil
}

func Migrate(db *gorm.DB) error {
	return db.AutoMigrate(
		&models.User{},
		&models.Product{},
		&models.Transaction{},
		&models.TransactionItem{},
		&models.Account{},
		&models.JournalEntry{},
		&models.JournalLine{},
		&models.StockOpname{},
		&models.Expense{},
		&models.SyncLog{},
	)
}

func SeedAccounts(db *gorm.DB) error {
	accounts := []models.Account{
		{Code: "1111", Name: "Kas Restoran", Type: "ASET", NormalBalance: "DEBIT", IsActive: true},
		{Code: "1112", Name: "QRIS Restoran", Type: "ASET", NormalBalance: "DEBIT", IsActive: true},
		{Code: "1121", Name: "Kas Cafe", Type: "ASET", NormalBalance: "DEBIT", IsActive: true},
		{Code: "1122", Name: "QRIS Cafe", Type: "ASET", NormalBalance: "DEBIT", IsActive: true},
		{Code: "1201", Name: "Stok Restoran", Type: "PERSEDIAAN", NormalBalance: "DEBIT", IsActive: true},
		{Code: "1202", Name: "Stok Cafe", Type: "PERSEDIAAN", NormalBalance: "DEBIT", IsActive: true},
		{Code: "4100", Name: "Pendapatan Restoran", Type: "PENDAPATAN", NormalBalance: "CREDIT", IsActive: true},
		{Code: "4200", Name: "Pendapatan Cafe", Type: "PENDAPATAN", NormalBalance: "CREDIT", IsActive: true},
		{Code: "5100", Name: "HPP Restoran", Type: "HPP", NormalBalance: "DEBIT", IsActive: true},
		{Code: "5200", Name: "HPP Cafe", Type: "HPP", NormalBalance: "DEBIT", IsActive: true},
		{Code: "6100", Name: "Beban Restoran", Type: "BEBAN", NormalBalance: "DEBIT", IsActive: true},
		{Code: "6200", Name: "Beban Cafe", Type: "BEBAN", NormalBalance: "DEBIT", IsActive: true},
	}

	for _, account := range accounts {
		if err := db.Where(models.Account{Code: account.Code}).FirstOrCreate(&account).Error; err != nil {
			return err
		}
	}

	return nil
}
