package services

import (
	"fmt"
	"log"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/shopspring/decimal"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"

	"github.com/edidev23/pos-backend/models"
)

// ProcessSyncBatch processes a batch of transactions from the POS app.
// It uses UPSERT (ON CONFLICT DO NOTHING) to handle duplicate sends gracefully.
// Accounting journals are created asynchronously via goroutines.
func ProcessSyncBatch(db *gorm.DB, payload models.SyncPayload) (*models.SyncLog, error) {
	syncTime, err := time.Parse(time.RFC3339, payload.BatchSyncTime)
	if err != nil {
		syncTime = time.Now()
	}

	syncLog := models.SyncLog{
		ID:                uuid.New(),
		OutletType:        payload.OutletType,
		BatchSyncTime:     syncTime,
		TotalTransactions: len(payload.Transactions),
		ProcessedCount:    0,
		Status:            "PENDING",
	}

	if err := db.Create(&syncLog).Error; err != nil {
		return nil, fmt.Errorf("failed to create sync log: %w", err)
	}

	successCount := 0
	var errorsList []string

	for _, txPayload := range payload.Transactions {
		// Parse UUIDs
		txID, err := uuid.Parse(txPayload.TransactionID)
		if err != nil {
			errorsList = append(errorsList, fmt.Sprintf("invalid transaction_id %s: %v", txPayload.TransactionID, err))
			continue
		}

		cashierID, err := uuid.Parse(txPayload.CashierID)
		if err != nil {
			errorsList = append(errorsList, fmt.Sprintf("invalid cashier_id %s: %v", txPayload.CashierID, err))
			continue
		}

		// Parse money as decimal (NOT float64)
		totalAmount, err := decimal.NewFromString(txPayload.TotalAmount)
		if err != nil {
			errorsList = append(errorsList, fmt.Sprintf("invalid total_amount %s: %v", txPayload.TotalAmount, err))
			continue
		}

		// Parse transaction timestamp
		txTimestamp, err := time.Parse(time.RFC3339, txPayload.Timestamp)
		if err != nil {
			txTimestamp = time.Now()
		}

		now := time.Now()
		tx := models.Transaction{
			ID:            txID,
			CashierID:     cashierID,
			OutletType:    payload.OutletType, // from top-level payload, not per-item
			PaymentMethod: txPayload.PaymentMethod,
			TotalAmount:   totalAmount,
			FinalAmount:   totalAmount, // default final = total (no discount in sync payload)
			SyncedAt:      &now,
			CreatedAt:     txTimestamp,
		}

		// Parse items
		var items []models.TransactionItem
		itemErrs := false
		for _, itemPayload := range txPayload.Items {
			itemID, err := uuid.Parse(itemPayload.ItemID)
			if err != nil {
				errorsList = append(errorsList, fmt.Sprintf("invalid item_id %s: %v", itemPayload.ItemID, err))
				itemErrs = true
				break
			}

			price, err := decimal.NewFromString(itemPayload.Price)
			if err != nil {
				errorsList = append(errorsList, fmt.Sprintf("invalid price %s: %v", itemPayload.Price, err))
				itemErrs = true
				break
			}

			cogs, err := decimal.NewFromString(itemPayload.Cogs)
			if err != nil {
				errorsList = append(errorsList, fmt.Sprintf("invalid cogs %s: %v", itemPayload.Cogs, err))
				itemErrs = true
				break
			}

			qty := decimal.NewFromInt(int64(itemPayload.Quantity))
			subtotal := price.Mul(qty)

			items = append(items, models.TransactionItem{
				ID:            itemID,
				TransactionID: txID,
				ProductName:   itemPayload.ProductName,
				Quantity:      itemPayload.Quantity,
				Price:         price,
				Cogs:          cogs,
				Subtotal:      subtotal,
			})
		}

		if itemErrs {
			continue
		}

		// UPSERT: ON CONFLICT DO NOTHING (idempotent sync)
		err = db.Transaction(func(dbTx *gorm.DB) error {
			if err := dbTx.Clauses(clause.OnConflict{
				Columns:   []clause.Column{{Name: "id"}},
				DoNothing: true,
			}).Create(&tx).Error; err != nil {
				return err
			}

			for i := range items {
				if err := dbTx.Clauses(clause.OnConflict{
					Columns:   []clause.Column{{Name: "id"}},
					DoNothing: true,
				}).Create(&items[i]).Error; err != nil {
					return err
				}
			}

			return nil
		})

		if err != nil {
			errorsList = append(errorsList, fmt.Sprintf("failed to save transaction %s: %v", txID, err))
			continue
		}

		successCount++

		// Create accounting journal asynchronously (goroutine)
		go func(txCopy models.Transaction, itemsCopy []models.TransactionItem) {
			if err := CreateSaleJournal(db, txCopy, itemsCopy); err != nil {
				log.Printf("ERROR creating sale journal for tx %s: %v", txCopy.ID, err)
			}
		}(tx, items)
	}

	// Update SyncLog
	if successCount == len(payload.Transactions) && len(payload.Transactions) > 0 {
		syncLog.Status = "SUCCESS"
	} else if successCount > 0 {
		syncLog.Status = "PARTIAL"
	} else {
		syncLog.Status = "FAILED"
	}

	syncLog.ProcessedCount = successCount
	if len(errorsList) > 0 {
		syncLog.ErrorMessage = strings.Join(errorsList, "; ")
	}

	db.Save(&syncLog)

	return &syncLog, nil
}
