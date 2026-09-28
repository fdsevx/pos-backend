package services

import (
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/shopspring/decimal"
	"gorm.io/gorm"

	"github.com/edidev23/pos-backend/models"
)

func GetCashAccountCode(outletType, paymentMethod string) string {
	if outletType == "RESTORAN" {
		if paymentMethod == "TUNAI" {
			return "1111"
		}
		return "1112"
	}
	// CAFE
	if paymentMethod == "TUNAI" {
		return "1121"
	}
	return "1122"
}

func GetRevenueAccountCode(outletType string) string {
	if outletType == "RESTORAN" {
		return "4100"
	}
	return "4200"
}

func GetCOGSAccountCode(outletType string) string {
	if outletType == "RESTORAN" {
		return "5100"
	}
	return "5200"
}

func GetInventoryAccountCode(outletType string) string {
	if outletType == "RESTORAN" {
		return "1201"
	}
	return "1202"
}

func GetExpenseAccountCode(outletType string) string {
	if outletType == "RESTORAN" {
		return "6100"
	}
	return "6200"
}

func CreateSaleJournal(db *gorm.DB, tx models.Transaction, items []models.TransactionItem) error {
	return db.Transaction(func(dbTx *gorm.DB) error {
		totalCOGS := decimal.Zero
		for _, item := range items {
			qty := decimal.NewFromInt(int64(item.Quantity))
			totalCOGS = totalCOGS.Add(item.Cogs.Mul(qty))
		}

		journalEntry := models.JournalEntry{
			ID:            uuid.New(),
			TransactionID: &tx.ID,
			ReferenceType: "SALE",
			ReferenceID:   tx.ID,
			Description:   fmt.Sprintf("Sale %s", tx.ID.String()),
			EntryDate:     time.Now(),
			OutletType:    tx.OutletType,
		}

		if err := dbTx.Create(&journalEntry).Error; err != nil {
			return err
		}

		cashAccount := GetCashAccountCode(tx.OutletType, tx.PaymentMethod)
		revenueAccount := GetRevenueAccountCode(tx.OutletType)
		cogsAccount := GetCOGSAccountCode(tx.OutletType)
		inventoryAccount := GetInventoryAccountCode(tx.OutletType)

		lines := []models.JournalLine{
			{
				ID:             uuid.New(),
				JournalEntryID: journalEntry.ID,
				AccountCode:    cashAccount,
				Debit:          tx.TotalAmount,
				Credit:         decimal.Zero,
				Description:    "Cash/QRIS Receipt",
			},
			{
				ID:             uuid.New(),
				JournalEntryID: journalEntry.ID,
				AccountCode:    revenueAccount,
				Debit:          decimal.Zero,
				Credit:         tx.TotalAmount,
				Description:    "Sale Revenue",
			},
			{
				ID:             uuid.New(),
				JournalEntryID: journalEntry.ID,
				AccountCode:    cogsAccount,
				Debit:          totalCOGS,
				Credit:         decimal.Zero,
				Description:    "Cost of Goods Sold",
			},
			{
				ID:             uuid.New(),
				JournalEntryID: journalEntry.ID,
				AccountCode:    inventoryAccount,
				Debit:          decimal.Zero,
				Credit:         totalCOGS,
				Description:    "Inventory Deduction",
			},
		}

		if err := dbTx.Create(&lines).Error; err != nil {
			return err
		}

		return nil
	})
}

func CreateExpenseJournal(db *gorm.DB, expense models.Expense) error {
	return db.Transaction(func(dbTx *gorm.DB) error {
		journalEntry := models.JournalEntry{
			ID:            uuid.New(),
			ReferenceType: "EXPENSE",
			ReferenceID:   expense.ID,
			Description:   fmt.Sprintf("Expense: %s", expense.Description),
			EntryDate:     expense.ExpenseDate,
			OutletType:    expense.OutletType,
		}

		if err := dbTx.Create(&journalEntry).Error; err != nil {
			return err
		}

		expenseAccount := GetExpenseAccountCode(expense.OutletType)
		cashAccount := GetCashAccountCode(expense.OutletType, "TUNAI")

		lines := []models.JournalLine{
			{
				ID:             uuid.New(),
				JournalEntryID: journalEntry.ID,
				AccountCode:    expenseAccount,
				Debit:          expense.Amount,
				Credit:         decimal.Zero,
				Description:    "Expense",
			},
			{
				ID:             uuid.New(),
				JournalEntryID: journalEntry.ID,
				AccountCode:    cashAccount,
				Debit:          decimal.Zero,
				Credit:         expense.Amount,
				Description:    "Cash Payment for Expense",
			},
		}

		if err := dbTx.Create(&lines).Error; err != nil {
			return err
		}

		return nil
	})
}

func CreateStockAdjustmentJournal(db *gorm.DB, opname models.StockOpname, product models.Product) error {
	return db.Transaction(func(dbTx *gorm.DB) error {
		if opname.Difference == 0 {
			return nil
		}

		journalEntry := models.JournalEntry{
			ID:            uuid.New(),
			ReferenceType: "STOCK_OPNAME",
			ReferenceID:   opname.ID,
			Description:   fmt.Sprintf("Stock Adjustment: %s", product.Name),
			EntryDate:     time.Now(),
			OutletType:    opname.OutletType,
		}

		if err := dbTx.Create(&journalEntry).Error; err != nil {
			return err
		}

		inventoryAccount := GetInventoryAccountCode(opname.OutletType)
		expenseAccount := GetExpenseAccountCode(opname.OutletType)
		revenueAccount := GetRevenueAccountCode(opname.OutletType)

		absDiff := decimal.NewFromInt(int64(opname.Difference))
		if absDiff.IsNegative() {
			absDiff = absDiff.Neg()
		}
		adjustmentValue := product.Cogs.Mul(absDiff)

		var lines []models.JournalLine

		if opname.Difference < 0 {
			// Shrinkage: Debit Expense, Credit Inventory
			lines = []models.JournalLine{
				{
					ID:             uuid.New(),
					JournalEntryID: journalEntry.ID,
					AccountCode:    expenseAccount,
					Debit:          adjustmentValue,
					Credit:         decimal.Zero,
					Description:    "Stock Shrinkage Expense",
				},
				{
					ID:             uuid.New(),
					JournalEntryID: journalEntry.ID,
					AccountCode:    inventoryAccount,
					Debit:          decimal.Zero,
					Credit:         adjustmentValue,
					Description:    "Stock Shrinkage Deduction",
				},
			}
		} else {
			// Surplus: Debit Inventory, Credit Revenue
			lines = []models.JournalLine{
				{
					ID:             uuid.New(),
					JournalEntryID: journalEntry.ID,
					AccountCode:    inventoryAccount,
					Debit:          adjustmentValue,
					Credit:         decimal.Zero,
					Description:    "Stock Surplus Addition",
				},
				{
					ID:             uuid.New(),
					JournalEntryID: journalEntry.ID,
					AccountCode:    revenueAccount,
					Debit:          decimal.Zero,
					Credit:         adjustmentValue,
					Description:    "Stock Surplus Revenue",
				},
			}
		}

		if err := dbTx.Create(&lines).Error; err != nil {
			return err
		}

		return nil
	})
}
