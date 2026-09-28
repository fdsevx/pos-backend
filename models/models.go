package models

import (
	"time"

	"github.com/google/uuid"
	"github.com/shopspring/decimal"
	"gorm.io/gorm"
)

func init() {
	// Ensure shopspring/decimal serializes to string by default in JSON
	decimal.MarshalJSONWithoutQuotes = false
}

// ============================================================
// GORM Models
// ============================================================

type User struct {
	ID           uuid.UUID      `gorm:"type:uuid;primaryKey;default:gen_random_uuid()" json:"id"`
	Username     string         `gorm:"uniqueIndex;not null" json:"username"`
	PasswordHash string         `gorm:"not null" json:"-"`
	FullName     string         `json:"full_name"`
	Role         string         `gorm:"not null" json:"role"`        // ADMIN / KASIR
	OutletType   string         `gorm:"not null" json:"outlet_type"` // RESTORAN / CAFE
	IsActive     bool           `gorm:"default:true" json:"is_active"`
	CreatedAt    time.Time      `json:"created_at"`
	UpdatedAt    time.Time      `json:"updated_at"`
	DeletedAt    gorm.DeletedAt `gorm:"index" json:"-"`
}

type Product struct {
	ID            uuid.UUID       `gorm:"type:uuid;primaryKey;default:gen_random_uuid()" json:"id"`
	Name          string          `gorm:"not null" json:"name"`
	SKU           string          `gorm:"uniqueIndex;not null" json:"sku"`
	Category      string          `json:"category"`
	Price         decimal.Decimal `gorm:"type:numeric" json:"price"`
	Cogs          decimal.Decimal `gorm:"type:numeric;column:cogs" json:"cogs"`
	StockQuantity int             `gorm:"not null;default:0" json:"stock_quantity"`
	MinStock      int             `gorm:"not null;default:0" json:"min_stock"`
	Unit          string          `json:"unit"`
	OutletType    string          `gorm:"not null" json:"outlet_type"`
	IsActive      bool            `gorm:"default:true" json:"is_active"`
	CreatedAt     time.Time       `json:"created_at"`
	UpdatedAt     time.Time       `json:"updated_at"`
	DeletedAt     gorm.DeletedAt  `gorm:"index" json:"-"`
}

type Transaction struct {
	ID             uuid.UUID       `gorm:"type:uuid;primaryKey" json:"id"` // transaction_id from POS
	CashierID      uuid.UUID       `gorm:"type:uuid;not null" json:"cashier_id"`
	Cashier        User            `gorm:"foreignKey:CashierID" json:"cashier,omitempty"`
	OutletType     string          `gorm:"not null;index" json:"outlet_type"`
	PaymentMethod  string          `gorm:"not null" json:"payment_method"` // TUNAI / QRIS
	TotalAmount    decimal.Decimal `gorm:"type:numeric" json:"total_amount"`
	DiscountAmount decimal.Decimal `gorm:"type:numeric;default:0" json:"discount_amount"`
	FinalAmount    decimal.Decimal `gorm:"type:numeric;default:0" json:"final_amount"`
	Notes          string          `json:"notes"`
	SyncedAt       *time.Time      `json:"synced_at"` // pointer — nullable
	CreatedAt      time.Time       `json:"created_at"`
	UpdatedAt      time.Time       `json:"updated_at"`
	DeletedAt      gorm.DeletedAt  `gorm:"index" json:"-"`
}

type TransactionItem struct {
	ID            uuid.UUID       `gorm:"type:uuid;primaryKey" json:"id"` // item_id from POS
	TransactionID uuid.UUID       `gorm:"type:uuid;not null;index" json:"transaction_id"`
	Transaction   Transaction     `gorm:"foreignKey:TransactionID" json:"-"`
	ProductName   string          `gorm:"not null" json:"product_name"`
	Quantity      int             `gorm:"not null" json:"quantity"`
	Price         decimal.Decimal `gorm:"type:numeric" json:"price"`
	Cogs          decimal.Decimal `gorm:"type:numeric;column:cogs" json:"cogs"`
	Subtotal      decimal.Decimal `gorm:"type:numeric" json:"subtotal"`
	CreatedAt     time.Time       `json:"created_at"`
	UpdatedAt     time.Time       `json:"updated_at"`
	DeletedAt     gorm.DeletedAt  `gorm:"index" json:"-"`
}

type Account struct {
	Code          string         `gorm:"primaryKey;type:varchar(20)" json:"code"`
	Name          string         `gorm:"not null" json:"name"`
	Type          string         `gorm:"not null" json:"type"`           // ASET / PERSEDIAAN / PENDAPATAN / HPP / BEBAN
	NormalBalance string         `gorm:"not null" json:"normal_balance"` // DEBIT / CREDIT
	IsActive      bool           `gorm:"default:true" json:"is_active"`
	CreatedAt     time.Time      `json:"created_at"`
	UpdatedAt     time.Time      `json:"updated_at"`
	DeletedAt     gorm.DeletedAt `gorm:"index" json:"-"`
}

type JournalEntry struct {
	ID            uuid.UUID      `gorm:"type:uuid;primaryKey;default:gen_random_uuid()" json:"id"`
	TransactionID *uuid.UUID     `gorm:"type:uuid;index" json:"transaction_id"`
	Transaction   *Transaction   `gorm:"foreignKey:TransactionID" json:"-"`
	ReferenceType string         `gorm:"not null" json:"reference_type"` // PENJUALAN / PEMBELIAN / BEBAN / OPNAME
	ReferenceID   uuid.UUID      `gorm:"type:uuid;not null" json:"reference_id"`
	Description   string         `json:"description"`
	EntryDate     time.Time      `gorm:"not null" json:"entry_date"`
	OutletType    string         `gorm:"not null" json:"outlet_type"`
	CreatedAt     time.Time      `json:"created_at"`
	UpdatedAt     time.Time      `json:"updated_at"`
	DeletedAt     gorm.DeletedAt `gorm:"index" json:"-"`
}

type JournalLine struct {
	ID             uuid.UUID       `gorm:"type:uuid;primaryKey;default:gen_random_uuid()" json:"id"`
	JournalEntryID uuid.UUID       `gorm:"type:uuid;not null;index" json:"journal_entry_id"`
	JournalEntry   JournalEntry    `gorm:"foreignKey:JournalEntryID" json:"-"`
	AccountCode    string          `gorm:"type:varchar(20);not null" json:"account_code"`
	Account        Account         `gorm:"foreignKey:AccountCode" json:"account,omitempty"`
	Debit          decimal.Decimal `gorm:"type:numeric;default:0" json:"debit"`
	Credit         decimal.Decimal `gorm:"type:numeric;default:0" json:"credit"`
	Description    string          `json:"description"`
	CreatedAt      time.Time       `json:"created_at"`
	UpdatedAt      time.Time       `json:"updated_at"`
	DeletedAt      gorm.DeletedAt  `gorm:"index" json:"-"`
}

type StockOpname struct {
	ID           uuid.UUID      `gorm:"type:uuid;primaryKey;default:gen_random_uuid()" json:"id"`
	ProductID    uuid.UUID      `gorm:"type:uuid;not null" json:"product_id"`
	Product      Product        `gorm:"foreignKey:ProductID" json:"product,omitempty"`
	SystemStock  int            `gorm:"not null" json:"system_stock"`
	ActualStock  int            `gorm:"not null" json:"actual_stock"`
	Difference   int            `gorm:"not null" json:"difference"`
	Notes        string         `json:"notes"`
	OutletType   string         `gorm:"not null" json:"outlet_type"`
	ApprovedBy   *uuid.UUID     `gorm:"type:uuid" json:"approved_by"`
	Approver     *User          `gorm:"foreignKey:ApprovedBy" json:"approver,omitempty"`
	Status       string         `gorm:"not null" json:"status"` // PENDING / APPROVED / REJECTED / COMPLETED
	CreatedAt    time.Time      `json:"created_at"`
	UpdatedAt    time.Time      `json:"updated_at"`
	DeletedAt    gorm.DeletedAt `gorm:"index" json:"-"`
}

type Expense struct {
	ID          uuid.UUID       `gorm:"type:uuid;primaryKey;default:gen_random_uuid()" json:"id"`
	Category    string          `gorm:"not null" json:"category"`
	Description string          `json:"description"`
	Amount      decimal.Decimal `gorm:"type:numeric" json:"amount"`
	OutletType  string          `gorm:"not null" json:"outlet_type"`
	RecordedBy  uuid.UUID       `gorm:"type:uuid;not null" json:"recorded_by"`
	Recorder    User            `gorm:"foreignKey:RecordedBy" json:"recorder,omitempty"`
	ExpenseDate time.Time       `gorm:"not null" json:"expense_date"`
	CreatedAt   time.Time       `json:"created_at"`
	UpdatedAt   time.Time       `json:"updated_at"`
	DeletedAt   gorm.DeletedAt  `gorm:"index" json:"-"`
}

type SyncLog struct {
	ID                uuid.UUID      `gorm:"type:uuid;primaryKey;default:gen_random_uuid()" json:"id"`
	OutletType        string         `gorm:"not null" json:"outlet_type"`
	BatchSyncTime     time.Time      `gorm:"not null" json:"batch_sync_time"`
	TotalTransactions int            `gorm:"not null" json:"total_transactions"`
	ProcessedCount    int            `gorm:"not null;default:0" json:"processed_count"`
	Status            string         `gorm:"not null" json:"status"` // SUCCESS / PARTIAL / FAILED
	ErrorMessage      string         `json:"error_message"`
	CreatedAt         time.Time      `json:"created_at"`
	UpdatedAt         time.Time      `json:"updated_at"`
	DeletedAt         gorm.DeletedAt `gorm:"index" json:"-"`
}

// ============================================================
// Sync Payload DTOs (not GORM models — JSON contract with Flutter POS)
// ============================================================

type SyncPayload struct {
	OutletType    string            `json:"outlet_type" validate:"required,oneof=RESTORAN CAFE"`
	BatchSyncTime string            `json:"batch_sync_time" validate:"required"`
	Transactions  []SyncTransaction `json:"transactions" validate:"required,dive"`
}

type SyncTransaction struct {
	TransactionID string     `json:"transaction_id" validate:"required,uuid"`
	CashierID     string     `json:"cashier_id" validate:"required,uuid"`
	Timestamp     string     `json:"timestamp" validate:"required"`
	PaymentMethod string     `json:"payment_method" validate:"required,oneof=TUNAI QRIS"`
	TotalAmount   string     `json:"total_amount" validate:"required"`
	Items         []SyncItem `json:"items" validate:"required,dive"`
}

type SyncItem struct {
	ItemID      string `json:"item_id" validate:"required,uuid"`
	ProductName string `json:"product_name" validate:"required"`
	Quantity    int    `json:"quantity" validate:"required,gt=0"`
	Price       string `json:"price" validate:"required"`
	Cogs        string `json:"cogs" validate:"required"`
}

// ============================================================
// Common API Response
// ============================================================

type APIResponse struct {
	Success bool        `json:"success"`
	Message string      `json:"message"`
	Data    interface{} `json:"data,omitempty"`
	Error   string      `json:"error,omitempty"`
}
