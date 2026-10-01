import { eq, and, inArray, gte, lt, lte, isNull, sql } from 'drizzle-orm';
import { transactions, transaction_items, expenses, products, outlets, payments } from '../../db/schema';
import Decimal from 'decimal.js-light';

export async function getMonthlySummary(db: any, outletId: string, month: string) {
  const start = new Date(`${month}-01T00:00:00Z`);
  const end = new Date(start);
  end.setMonth(end.getMonth() + 1);

  const startStr = start.toISOString().split('T')[0];
  const endStr = end.toISOString().split('T')[0];

  // 1. Transaction stats
  const [txStats] = await db
    .select({
      jumlah_transaksi: sql<number>`count(*)::int`,
      pendapatan_bersih: sql<string>`coalesce(sum(grand_total - tax_amount), 0)::text`,
    })
    .from(transactions)
    .where(
      and(
        eq(transactions.outlet_id, outletId),
        eq(transactions.status, 'PAID'),
        gte(transactions.created_at, start),
        lt(transactions.created_at, end)
      )
    );

  // 2. HPP and Items sold
  const [itemStats] = await db
    .select({
      produk_terjual: sql<number>`coalesce(sum(${transaction_items.quantity}), 0)::int`,
      total_hpp: sql<string>`coalesce(sum(${transaction_items.cost_price_snapshot} * ${transaction_items.quantity}), 0)::text`,
    })
    .from(transaction_items)
    .innerJoin(transactions, eq(transaction_items.transaction_id, transactions.id))
    .where(
      and(
        eq(transactions.outlet_id, outletId),
        eq(transactions.status, 'PAID'),
        gte(transactions.created_at, start),
        lt(transactions.created_at, end)
      )
    );

  // 3. Expenses
  const [expStats] = await db
    .select({
      total_pengeluaran: sql<string>`coalesce(sum(amount), 0)::text`,
    })
    .from(expenses)
    .where(
      and(
        eq(expenses.outlet_id, outletId),
        gte(expenses.expense_date, startStr),
        lt(expenses.expense_date, endStr)
      )
    );

  // 4. Products stock snapshot (current stock, not historical)
  const [prodStats] = await db
    .select({
      total_produk: sql<number>`count(*)::int`,
      produk_tersedia: sql<number>`count(*) filter (where stock > 0)::int`,
      produk_kosong: sql<number>`count(*) filter (where stock <= 0)::int`,
      stok_kurang_dari_5: sql<number>`count(*) filter (where stock > 0 and stock < 5)::int`,
    })
    .from(products)
    .where(
      and(eq(products.outlet_id, outletId), isNull(products.deleted_at))
    );

  // Calculate Laba Bersih
  const pendapatan = new Decimal(txStats?.pendapatan_bersih || '0');
  const hpp = new Decimal(itemStats?.total_hpp || '0');
  const pengeluaran = new Decimal(expStats?.total_pengeluaran || '0');
  const labaBersih = pendapatan.minus(hpp).minus(pengeluaran);

  return {
    produk_terjual: itemStats?.produk_terjual || 0,
    jumlah_transaksi: txStats?.jumlah_transaksi || 0,
    pendapatan_bersih: pendapatan.toFixed(2),
    total_hpp: hpp.toFixed(2),
    total_pengeluaran: pengeluaran.toFixed(2),
    laba_bersih: labaBersih.toFixed(2),
    stok: {
      total_produk: prodStats?.total_produk || 0,
      produk_tersedia: prodStats?.produk_tersedia || 0,
      produk_kosong: prodStats?.produk_kosong || 0,
      stok_kurang_dari_5: prodStats?.stok_kurang_dari_5 || 0,
    }
  };
}

export async function getChartData(db: any, outletId: string, month: string) {
  const start = new Date(`${month}-01T00:00:00Z`);
  const end = new Date(start);
  end.setMonth(end.getMonth() + 1);

  // Group revenue by date
  // using date_trunc or casting to date in postgres
  const rows = await db
    .select({
      date: sql<string>`date(${transactions.created_at})::text`,
      revenue: sql<string>`sum(grand_total - tax_amount)::text`,
    })
    .from(transactions)
    .where(
      and(
        eq(transactions.outlet_id, outletId),
        eq(transactions.status, 'PAID'),
        gte(transactions.created_at, start),
        lt(transactions.created_at, end)
      )
    )
    .groupBy(sql`date(${transactions.created_at})`)
    .orderBy(sql`date(${transactions.created_at})`);

  return rows;
}

export async function getExportData(db: any, outletId: string, from?: string, to?: string, page: number = 1, limit: number = 50) {
  const offset = (page - 1) * limit;

  let filters = [eq(transactions.outlet_id, outletId)];
  if (from) filters.push(gte(transactions.created_at, new Date(from)));
  if (to) filters.push(lt(transactions.created_at, new Date(to)));

  const txData = await db
    .select()
    .from(transactions)
    .where(and(...filters))
    .orderBy((t: any) => t.created_at, 'desc') // Quick fallback for sort
    .limit(limit)
    .offset(offset);

  if (txData.length === 0) return [];

  const txIds = txData.map((t: any) => t.id);

  const items = await db
    .select()
    .from(transaction_items)
    .where(inArray(transaction_items.transaction_id, txIds));

  const pmts = await db
    .select()
    .from(payments)
    .where(inArray(payments.transaction_id, txIds));

  // Merge in memory
  const data = txData.map((t: any) => ({
    ...t,
    items: items.filter((i: any) => i.transaction_id === t.id),
    payments: pmts.filter((p: any) => p.transaction_id === t.id),
  }));

  return data;
}

export async function getAllOutletsMonthlySummary(db: any, userOutletIds: string[] | null, month: string, locationId?: string) {
  if (userOutletIds && userOutletIds.length === 0) return [];
  
  const start = new Date(`${month}-01T00:00:00Z`);
  const end = new Date(start);
  end.setMonth(end.getMonth() + 1);

  // Aggregated data grouped by outlet
  const query = db
    .select({
      outlet_id: transactions.outlet_id,
      outlet_name: outlets.name,
      jumlah_transaksi: sql<number>`count(*)::int`,
      pendapatan_bersih: sql<string>`coalesce(sum(${transactions.grand_total} - ${transactions.tax_amount}), 0)::text`,
    })
    .from(transactions)
    .innerJoin(outlets, eq(transactions.outlet_id, outlets.id));

  const filters = [
    eq(transactions.status, 'PAID'),
    gte(transactions.created_at, start),
    lt(transactions.created_at, end)
  ];

  if (userOutletIds && userOutletIds.length > 0) {
    filters.push(inArray(transactions.outlet_id, userOutletIds));
  }
  
  if (locationId && locationId !== 'ALL') {
    filters.push(eq(outlets.location_id, locationId));
  }

  const rows = await query.where(and(...filters)).groupBy(transactions.outlet_id, outlets.name);

  return rows;
}

export async function getAllOutletsChartData(db: any, userOutletIds: string[] | null, month: string, locationId?: string) {
  if (userOutletIds && userOutletIds.length === 0) return [];

  const start = new Date(`${month}-01T00:00:00Z`);
  const end = new Date(start);
  end.setMonth(end.getMonth() + 1);

  const query = db
    .select({
      date: sql<string>`date(${transactions.created_at})::text`,
      revenue: sql<string>`sum(grand_total - tax_amount)::text`,
    })
    .from(transactions)
    .innerJoin(outlets, eq(transactions.outlet_id, outlets.id));

  const filters = [
    eq(transactions.status, 'PAID'),
    gte(transactions.created_at, start),
    lt(transactions.created_at, end)
  ];

  if (userOutletIds && userOutletIds.length > 0) {
    filters.push(inArray(transactions.outlet_id, userOutletIds));
  }
  
  if (locationId && locationId !== 'ALL') {
    filters.push(eq(outlets.location_id, locationId));
  }

  const rows = await query
    .where(and(...filters))
    .groupBy(sql`date(${transactions.created_at})`)
    .orderBy(sql`date(${transactions.created_at})`);

  return rows;
}

export async function getSummaryByDates(db: any, outletId: string, startDate?: string, endDate?: string) {
  const start = startDate ? new Date(startDate) : new Date(new Date().getFullYear(), new Date().getMonth(), 1);
  const end = endDate ? new Date(`${endDate.split('T')[0]}T23:59:59.999Z`) : new Date();

  const startStr = start.toISOString().split('T')[0];
  const endStr = end.toISOString().split('T')[0];

  const [txStats] = await db
    .select({
      jumlah_transaksi: sql<number>`count(*)::int`,
      pendapatan_bersih: sql<string>`coalesce(sum(grand_total - tax_amount), 0)::text`,
    })
    .from(transactions)
    .where(
      and(
        eq(transactions.outlet_id, outletId),
        eq(transactions.status, 'PAID'),
        gte(transactions.created_at, start),
        lte(transactions.created_at, end)
      )
    );

  const [itemStats] = await db
    .select({
      produk_terjual: sql<number>`coalesce(sum(${transaction_items.quantity}), 0)::int`,
      total_hpp: sql<string>`coalesce(sum(${transaction_items.cost_price_snapshot} * ${transaction_items.quantity}), 0)::text`,
    })
    .from(transaction_items)
    .innerJoin(transactions, eq(transaction_items.transaction_id, transactions.id))
    .where(
      and(
        eq(transactions.outlet_id, outletId),
        eq(transactions.status, 'PAID'),
        gte(transactions.created_at, start),
        lte(transactions.created_at, end)
      )
    );

  const [expStats] = await db
    .select({
      total_pengeluaran: sql<string>`coalesce(sum(amount), 0)::text`,
    })
    .from(expenses)
    .where(
      and(
        eq(expenses.outlet_id, outletId),
        gte(expenses.expense_date, startStr),
        lte(expenses.expense_date, endStr)
      )
    );

  const pendapatan = new Decimal(txStats?.pendapatan_bersih || '0');
  const hpp = new Decimal(itemStats?.total_hpp || '0');
  const pengeluaran = new Decimal(expStats?.total_pengeluaran || '0');
  const grossProfit = pendapatan.minus(hpp);
  const labaBersih = grossProfit.minus(pengeluaran);

  return {
    total_omzet: pendapatan.toFixed(2),
    total_transaksi: txStats?.jumlah_transaksi || 0,
    total_hpp: hpp.toFixed(2),
    gross_profit: grossProfit.toFixed(2),
    pendapatan_bersih: pendapatan.toFixed(2),
    jumlah_transaksi: txStats?.jumlah_transaksi || 0,
    total_pengeluaran: pengeluaran.toFixed(2),
    laba_bersih: labaBersih.toFixed(2),
  };
}

export async function getChartByDates(db: any, outletId: string, startDate?: string, endDate?: string) {
  const start = startDate ? new Date(startDate) : new Date(new Date().getFullYear(), new Date().getMonth(), 1);
  const end = endDate ? new Date(`${endDate.split('T')[0]}T23:59:59.999Z`) : new Date();

  const rows = await db
    .select({
      date: sql<string>`date(${transactions.created_at})::text`,
      revenue: sql<string>`coalesce(sum(grand_total - tax_amount), 0)::text`,
    })
    .from(transactions)
    .where(
      and(
        eq(transactions.outlet_id, outletId),
        eq(transactions.status, 'PAID'),
        gte(transactions.created_at, start),
        lte(transactions.created_at, end)
      )
    )
    .groupBy(sql`date(${transactions.created_at})`)
    .orderBy(sql`date(${transactions.created_at})`);

  return rows;
}
