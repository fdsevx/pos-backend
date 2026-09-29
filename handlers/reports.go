package handlers

import (
	"bytes"
	"fmt"
	"strconv"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/jung-kurt/gofpdf"
	"github.com/shopspring/decimal"
	"github.com/xuri/excelize/v2"
	"gorm.io/gorm"

	"github.com/edidev23/pos-backend/models"
)

func MonthlyReportHandler(db *gorm.DB) fiber.Handler {
	return func(c *fiber.Ctx) error {
		monthStr := c.Query("month")
		yearStr := c.Query("year")

		month, err := strconv.Atoi(monthStr)
		if err != nil || month < 1 || month > 12 {
			return c.Status(fiber.StatusBadRequest).JSON(models.APIResponse{
				Success: false, Message: "Invalid month parameter",
			})
		}
		year, err := strconv.Atoi(yearStr)
		if err != nil || year < 2000 {
			return c.Status(fiber.StatusBadRequest).JSON(models.APIResponse{
				Success: false, Message: "Invalid year parameter",
			})
		}

		outletType, _ := c.Locals("outlet_type").(string)

		startDate := time.Date(year, time.Month(month), 1, 0, 0, 0, 0, time.UTC)
		endDate := startDate.AddDate(0, 1, 0)

		// Total revenue and transaction count
		var revStr string
		var transactionCount int64
		row := db.Table("transactions").
			Select("COALESCE(SUM(total_amount), 0) as total_revenue, COUNT(id) as transaction_count").
			Where("outlet_type = ? AND created_at >= ? AND created_at < ? AND deleted_at IS NULL", outletType, startDate, endDate).
			Row()
		if err := row.Scan(&revStr, &transactionCount); err != nil {
			return c.Status(fiber.StatusInternalServerError).JSON(models.APIResponse{
				Success: false, Message: "Database error", Error: err.Error(),
			})
		}
		totalRevenue, _ := decimal.NewFromString(revStr)

		// Total COGS
		var cogsStr string
		rowCogs := db.Table("transaction_items").
			Joins("JOIN transactions ON transactions.id = transaction_items.transaction_id").
			Select("COALESCE(SUM(transaction_items.cogs * transaction_items.quantity), 0) as total_cogs").
			Where("transactions.outlet_type = ? AND transactions.created_at >= ? AND transactions.created_at < ? AND transactions.deleted_at IS NULL", outletType, startDate, endDate).
			Row()
		if err := rowCogs.Scan(&cogsStr); err != nil {
			return c.Status(fiber.StatusInternalServerError).JSON(models.APIResponse{
				Success: false, Message: "Database error", Error: err.Error(),
			})
		}
		totalCogs, _ := decimal.NewFromString(cogsStr)

		// Total expenses
		var expStr string
		rowExp := db.Table("expenses").
			Select("COALESCE(SUM(amount), 0) as total_expenses").
			Where("outlet_type = ? AND expense_date >= ? AND expense_date < ? AND deleted_at IS NULL", outletType, startDate, endDate).
			Row()
		if err := rowExp.Scan(&expStr); err != nil {
			return c.Status(fiber.StatusInternalServerError).JSON(models.APIResponse{
				Success: false, Message: "Database error", Error: err.Error(),
			})
		}
		totalExpenses, _ := decimal.NewFromString(expStr)

		grossProfit := totalRevenue.Sub(totalCogs)
		netProfit := grossProfit.Sub(totalExpenses)

		var averageTransaction decimal.Decimal
		if transactionCount > 0 {
			averageTransaction = totalRevenue.Div(decimal.NewFromInt(transactionCount))
		}

		return c.JSON(models.APIResponse{
			Success: true,
			Message: "Monthly report retrieved successfully",
			Data: fiber.Map{
				"period":              fmt.Sprintf("%d/%d", month, year),
				"outlet_type":         outletType,
				"total_revenue":       totalRevenue,
				"total_cogs":          totalCogs,
				"gross_profit":        grossProfit,
				"total_expenses":      totalExpenses,
				"net_profit":          netProfit,
				"transaction_count":   transactionCount,
				"average_transaction": averageTransaction,
			},
		})
	}
}

func ChartDataHandler(db *gorm.DB) fiber.Handler {
	return func(c *fiber.Ctx) error {
		period := c.Query("period")
		monthStr := c.Query("month")
		yearStr := c.Query("year")
		outletType, _ := c.Locals("outlet_type").(string)

		type ChartData struct {
			Label            string `json:"label"`
			Revenue          string `json:"revenue"`
			Cogs             string `json:"cogs"`
			Profit           string `json:"profit"`
			TransactionCount int64  `json:"transaction_count"`
		}

		var data []ChartData

		if period == "daily" {
			month, _ := strconv.Atoi(monthStr)
			year, _ := strconv.Atoi(yearStr)
			startDate := time.Date(year, time.Month(month), 1, 0, 0, 0, 0, time.UTC)
			endDate := startDate.AddDate(0, 1, 0)

			query := `
				SELECT 
					DATE(t.created_at) as label,
					COALESCE(SUM(t.total_amount), 0) as revenue,
					COALESCE(SUM(ti.cogs * ti.quantity), 0) as cogs,
					COUNT(DISTINCT t.id) as transaction_count
				FROM transactions t
				LEFT JOIN transaction_items ti ON t.id = ti.transaction_id
				WHERE t.outlet_type = $1 AND t.created_at >= $2 AND t.created_at < $3 AND t.deleted_at IS NULL
				GROUP BY DATE(t.created_at)
				ORDER BY label
			`
			rows, err := db.Raw(query, outletType, startDate, endDate).Rows()
			if err != nil {
				return c.Status(500).JSON(models.APIResponse{Success: false, Message: "Database error", Error: err.Error()})
			}
			defer rows.Close()

			for rows.Next() {
				var cd ChartData
				var rev, cogs decimal.Decimal
				if err := rows.Scan(&cd.Label, &rev, &cogs, &cd.TransactionCount); err != nil {
					continue
				}
				cd.Revenue = rev.StringFixed(2)
				cd.Cogs = cogs.StringFixed(2)
				cd.Profit = rev.Sub(cogs).StringFixed(2)
				data = append(data, cd)
			}
		} else if period == "monthly" {
			year, _ := strconv.Atoi(yearStr)
			startDate := time.Date(year, 1, 1, 0, 0, 0, 0, time.UTC)
			endDate := startDate.AddDate(1, 0, 0)

			query := `
				SELECT 
					TO_CHAR(t.created_at, 'YYYY-MM') as label,
					COALESCE(SUM(t.total_amount), 0) as revenue,
					COALESCE(SUM(ti.cogs * ti.quantity), 0) as cogs,
					COUNT(DISTINCT t.id) as transaction_count
				FROM transactions t
				LEFT JOIN transaction_items ti ON t.id = ti.transaction_id
				WHERE t.outlet_type = $1 AND t.created_at >= $2 AND t.created_at < $3 AND t.deleted_at IS NULL
				GROUP BY TO_CHAR(t.created_at, 'YYYY-MM')
				ORDER BY label
			`
			rows, err := db.Raw(query, outletType, startDate, endDate).Rows()
			if err != nil {
				return c.Status(500).JSON(models.APIResponse{Success: false, Message: "Database error", Error: err.Error()})
			}
			defer rows.Close()

			for rows.Next() {
				var cd ChartData
				var rev, cogs decimal.Decimal
				if err := rows.Scan(&cd.Label, &rev, &cogs, &cd.TransactionCount); err != nil {
					continue
				}
				cd.Revenue = rev.StringFixed(2)
				cd.Cogs = cogs.StringFixed(2)
				cd.Profit = rev.Sub(cogs).StringFixed(2)
				data = append(data, cd)
			}
		} else {
			return c.Status(400).JSON(models.APIResponse{Success: false, Message: "Invalid period. Use 'daily' or 'monthly'."})
		}

		return c.JSON(models.APIResponse{
			Success: true,
			Message: "Chart data retrieved successfully",
			Data:    data,
		})
	}
}

func ExportReportHandler(db *gorm.DB) fiber.Handler {
	return func(c *fiber.Ctx) error {
		format := c.Query("format")
		monthStr := c.Query("month")
		yearStr := c.Query("year")
		outletType, _ := c.Locals("outlet_type").(string)

		month, _ := strconv.Atoi(monthStr)
		year, _ := strconv.Atoi(yearStr)
		startDate := time.Date(year, time.Month(month), 1, 0, 0, 0, 0, time.UTC)
		endDate := startDate.AddDate(0, 1, 0)


		var reports []DailyReport

		query := `
			WITH sales AS (
				SELECT 
					DATE(t.created_at) as report_date,
					COALESCE(SUM(t.total_amount), 0) as revenue,
					COALESCE(SUM(ti.cogs * ti.quantity), 0) as cogs
				FROM transactions t
				LEFT JOIN transaction_items ti ON t.id = ti.transaction_id
				WHERE t.outlet_type = $1 AND t.created_at >= $2 AND t.created_at < $3 AND t.deleted_at IS NULL
				GROUP BY DATE(t.created_at)
			),
			exps AS (
				SELECT 
					DATE(expense_date) as report_date,
					COALESCE(SUM(amount), 0) as expenses
				FROM expenses
				WHERE outlet_type = $4 AND expense_date >= $5 AND expense_date < $6 AND deleted_at IS NULL
				GROUP BY DATE(expense_date)
			)
			SELECT 
				COALESCE(s.report_date, e.report_date) as date,
				COALESCE(s.revenue, 0) as revenue,
				COALESCE(s.cogs, 0) as cogs,
				COALESCE(e.expenses, 0) as expenses
			FROM sales s
			FULL OUTER JOIN exps e ON s.report_date = e.report_date
			ORDER BY date
		`

		rows, err := db.Raw(query, outletType, startDate, endDate, outletType, startDate, endDate).Rows()
		if err == nil {
			defer rows.Close()
			for rows.Next() {
				var dr DailyReport
				var date time.Time
				if err := rows.Scan(&date, &dr.Revenue, &dr.Cogs, &dr.Expenses); err != nil {
					continue
				}
				dr.Date = date.Format("2006-01-02")
				dr.Profit = dr.Revenue.Sub(dr.Cogs)
				dr.NetProfit = dr.Profit.Sub(dr.Expenses)
				reports = append(reports, dr)
			}
		}

		switch format {
		case "pdf":
			return generatePDF(c, reports, outletType, month, year)
		case "excel":
			return generateExcel(c, reports, outletType, month, year)
		default:
			return c.Status(400).JSON(models.APIResponse{
				Success: false, Message: "Invalid format. Use 'pdf' or 'excel'.",
			})
		}
	}
}

func generatePDF(c *fiber.Ctx, reports []DailyReport, outletType string, month, year int) error {
	pdf := gofpdf.New("L", "mm", "A4", "") // Landscape for wider table
	pdf.AddPage()

	// Header
	pdf.SetFont("Arial", "B", 16)
	pdf.CellFormat(270, 10, "Laporan Bulanan - "+outletType, "", 1, "C", false, 0, "")
	pdf.SetFont("Arial", "", 12)
	pdf.CellFormat(270, 8, fmt.Sprintf("Periode: %s %d", time.Month(month).String(), year), "", 1, "C", false, 0, "")
	pdf.Ln(8)

	// Table header
	pdf.SetFont("Arial", "B", 10)
	colWidths := []float64{12, 35, 40, 40, 40, 40, 40}
	headers := []string{"No", "Tanggal", "Total Penjualan", "HPP", "Laba Kotor", "Beban", "Laba Bersih"}
	for i, h := range headers {
		pdf.CellFormat(colWidths[i], 10, h, "1", 0, "C", false, 0, "")
	}
	pdf.Ln(-1)

	// Data rows
	pdf.SetFont("Arial", "", 9)
	var totalRev, totalCogs, totalProfit, totalExp, totalNet decimal.Decimal

	for i, r := range reports {
		pdf.CellFormat(colWidths[0], 8, strconv.Itoa(i+1), "1", 0, "C", false, 0, "")
		pdf.CellFormat(colWidths[1], 8, r.Date, "1", 0, "C", false, 0, "")
		pdf.CellFormat(colWidths[2], 8, r.Revenue.StringFixed(2), "1", 0, "R", false, 0, "")
		pdf.CellFormat(colWidths[3], 8, r.Cogs.StringFixed(2), "1", 0, "R", false, 0, "")
		pdf.CellFormat(colWidths[4], 8, r.Profit.StringFixed(2), "1", 0, "R", false, 0, "")
		pdf.CellFormat(colWidths[5], 8, r.Expenses.StringFixed(2), "1", 0, "R", false, 0, "")
		pdf.CellFormat(colWidths[6], 8, r.NetProfit.StringFixed(2), "1", 0, "R", false, 0, "")
		pdf.Ln(-1)

		totalRev = totalRev.Add(r.Revenue)
		totalCogs = totalCogs.Add(r.Cogs)
		totalProfit = totalProfit.Add(r.Profit)
		totalExp = totalExp.Add(r.Expenses)
		totalNet = totalNet.Add(r.NetProfit)
	}

	// Summary row
	pdf.SetFont("Arial", "B", 10)
	pdf.CellFormat(colWidths[0]+colWidths[1], 10, "TOTAL", "1", 0, "C", false, 0, "")
	pdf.CellFormat(colWidths[2], 10, totalRev.StringFixed(2), "1", 0, "R", false, 0, "")
	pdf.CellFormat(colWidths[3], 10, totalCogs.StringFixed(2), "1", 0, "R", false, 0, "")
	pdf.CellFormat(colWidths[4], 10, totalProfit.StringFixed(2), "1", 0, "R", false, 0, "")
	pdf.CellFormat(colWidths[5], 10, totalExp.StringFixed(2), "1", 0, "R", false, 0, "")
	pdf.CellFormat(colWidths[6], 10, totalNet.StringFixed(2), "1", 0, "R", false, 0, "")

	var buf bytes.Buffer
	if err := pdf.Output(&buf); err != nil {
		return c.Status(500).JSON(models.APIResponse{Success: false, Message: "Failed to generate PDF"})
	}

	c.Set("Content-Type", "application/pdf")
	c.Set("Content-Disposition", fmt.Sprintf("attachment; filename=laporan_%s_%d_%d.pdf", outletType, month, year))
	return c.Send(buf.Bytes())
}

func generateExcel(c *fiber.Ctx, reports []DailyReport, outletType string, month, year int) error {
	f := excelize.NewFile()
	defer f.Close()

	sheet := "Laporan Bulanan"
	f.SetSheetName("Sheet1", sheet)

	// Header style
	headerStyle, _ := f.NewStyle(&excelize.Style{
		Font: &excelize.Font{Bold: true, Color: "#FFFFFF"},
		Fill: excelize.Fill{Type: "pattern", Color: []string{"#4472C4"}, Pattern: 1},
		Alignment: &excelize.Alignment{
			Horizontal: "center",
			Vertical:   "center",
		},
	})

	// Title
	f.MergeCell(sheet, "A1", "G1")
	f.SetCellValue(sheet, "A1", fmt.Sprintf("Laporan Bulanan %s — %s %d", outletType, time.Month(month).String(), year))
	titleStyle, _ := f.NewStyle(&excelize.Style{
		Font:      &excelize.Font{Bold: true, Size: 14},
		Alignment: &excelize.Alignment{Horizontal: "center"},
	})
	f.SetCellStyle(sheet, "A1", "G1", titleStyle)

	// Column headers
	headers := []string{"No", "Tanggal", "Total Penjualan", "HPP", "Laba Kotor", "Beban", "Laba Bersih"}
	for i, h := range headers {
		cell, _ := excelize.CoordinatesToCellName(i+1, 3)
		f.SetCellValue(sheet, cell, h)
	}
	f.SetCellStyle(sheet, "A3", "G3", headerStyle)

	// Column widths
	f.SetColWidth(sheet, "A", "A", 6)
	f.SetColWidth(sheet, "B", "B", 14)
	f.SetColWidth(sheet, "C", "G", 18)

	// Number format for currency
	numStyle, _ := f.NewStyle(&excelize.Style{
		NumFmt: 4, // #,##0.00
	})

	// Data rows
	for i, r := range reports {
		row := i + 4
		f.SetCellValue(sheet, fmt.Sprintf("A%d", row), i+1)
		f.SetCellValue(sheet, fmt.Sprintf("B%d", row), r.Date)

		revF, _ := r.Revenue.Float64()
		f.SetCellValue(sheet, fmt.Sprintf("C%d", row), revF)
		cogsF, _ := r.Cogs.Float64()
		f.SetCellValue(sheet, fmt.Sprintf("D%d", row), cogsF)
		profitF, _ := r.Profit.Float64()
		f.SetCellValue(sheet, fmt.Sprintf("E%d", row), profitF)
		expF, _ := r.Expenses.Float64()
		f.SetCellValue(sheet, fmt.Sprintf("F%d", row), expF)
		netF, _ := r.NetProfit.Float64()
		f.SetCellValue(sheet, fmt.Sprintf("G%d", row), netF)

		f.SetCellStyle(sheet, fmt.Sprintf("C%d", row), fmt.Sprintf("G%d", row), numStyle)
	}

	// Summary row with SUM formulas
	lastDataRow := len(reports) + 3
	sumRow := lastDataRow + 1

	sumStyle, _ := f.NewStyle(&excelize.Style{
		Font: &excelize.Font{Bold: true},
		Fill: excelize.Fill{Type: "pattern", Color: []string{"#DDDDDD"}, Pattern: 1},
		NumFmt: 4,
	})

	f.SetCellValue(sheet, fmt.Sprintf("A%d", sumRow), "TOTAL")
	for _, col := range []string{"C", "D", "E", "F", "G"} {
		f.SetCellFormula(sheet, fmt.Sprintf("%s%d", col, sumRow),
			fmt.Sprintf("SUM(%s4:%s%d)", col, col, lastDataRow))
	}
	f.SetCellStyle(sheet, fmt.Sprintf("A%d", sumRow), fmt.Sprintf("G%d", sumRow), sumStyle)

	var buf bytes.Buffer
	if err := f.Write(&buf); err != nil {
		return c.Status(500).JSON(models.APIResponse{Success: false, Message: "Failed to generate Excel"})
	}

	c.Set("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
	c.Set("Content-Disposition", fmt.Sprintf("attachment; filename=laporan_%s_%d_%d.xlsx", outletType, month, year))
	return c.Send(buf.Bytes())
}

// DailyReport is a local type used by report generation.
type DailyReport struct {
	Date      string
	Revenue   decimal.Decimal
	Cogs      decimal.Decimal
	Profit    decimal.Decimal
	Expenses  decimal.Decimal
	NetProfit decimal.Decimal
}
