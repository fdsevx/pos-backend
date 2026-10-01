import "dotenv/config";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { eq } from "drizzle-orm";
import {
  outlets,
  categories,
  products,
  transactions,
  transaction_items,
  payments,
  users,
} from "../src/db/schema";

async function seedDummy() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error("DATABASE_URL not set in .env");
    process.exit(1);
  }

  const client = postgres(url, { prepare: false });
  const db = drizzle(client);

  console.log("🌱 Seeding dummy transaction data...\n");

  const restoran = (await db.select().from(outlets).where(eq(outlets.slug, 'wkb-restoran')))[0];
  const cafe = (await manager_resto_db(db, 'wkb-cafe'));

  async function manager_resto_db(db: any, slug: string) {
    return (await db.select().from(outlets).where(eq(outlets.slug, slug)))[0];
  }

  const cashierResto = (await db.select().from(users).where(eq(users.username, 'kasir_resto')))[0];
  const cashierCafe = (await db.select().from(users).where(eq(users.username, 'kasir_cafe')))[0];

  // --- Categories ---
  const [catMakanan, catMinuman] = await db.insert(categories).values([
    { outlet_id: restoran.id, name: "Makanan Utama", sort_order: 1 },
    { outlet_id: cafe.id, name: "Kopi & Minuman", sort_order: 1 },
  ]).returning();

  // --- Products ---
  const [prodNasi, prodAyam] = await db.insert(products).values([
    { outlet_id: restoran.id, category_id: catMakanan.id, sku: "NS-001", name: "Nasi Goreng Spesial", price: "35000", cost_price: "15000", stock: 100 },
    { outlet_id: restoran.id, category_id: catMakanan.id, sku: "AY-001", name: "Ayam Bakar Madu", price: "45000", cost_price: "20000", stock: 50 },
  ]).returning();

  const [prodKopi, prodMatcha] = await db.insert(products).values([
    { outlet_id: cafe.id, category_id: catMinuman.id, sku: "CF-001", name: "Kopi Susu Gula Aren", price: "25000", cost_price: "10000", stock: 100 },
    { outlet_id: cafe.id, category_id: catMinuman.id, sku: "CF-002", name: "Matcha Latte", price: "30000", cost_price: "12000", stock: 100 },
  ]).returning();

  console.log("✅ Products created");

  // --- Transactions ---
  const today = new Date();
  
  for (let i = 0; i < 30; i++) {
    // Generate dates for the last 30 days
    const txDate = new Date(today);
    txDate.setDate(today.getDate() - i);

    // Restoran Transaction
    const txResto = await db.insert(transactions).values({
      outlet_id: restoran.id,
      device_id: "POS-RESTO-1",
      receipt_number: `RST-${Date.now()}-${i}`,
      cashier_id: cashierResto.id,
      subtotal: "80000",
      tax_amount: "8000",
      service_amount: "4000",
      grand_total: "92000",
      status: "PAID",
      created_at: txDate,
      updated_at: txDate,
    }).returning();

    await db.insert(transaction_items).values([
      { transaction_id: txResto[0].id, product_id: prodNasi.id, product_name: prodNasi.name, quantity: 1, unit_price: "35000", cost_price_snapshot: "15000", subtotal: "35000" },
      { transaction_id: txResto[0].id, product_id: prodAyam.id, product_name: prodAyam.name, quantity: 1, unit_price: "45000", cost_price_snapshot: "20000", subtotal: "45000" },
    ]);

    await db.insert(payments).values({
      transaction_id: txResto[0].id,
      method: "TUNAI",
      amount: "92000",
      amount_received: "100000",
      change_amount: "8000",
    });

    // Cafe Transaction
    const txCafe = await db.insert(transactions).values({
      outlet_id: cafe.id,
      device_id: "POS-CAFE-1",
      receipt_number: `CFE-${Date.now()}-${i}`,
      cashier_id: cashierCafe.id,
      subtotal: "55000",
      tax_amount: "5500",
      service_amount: "0",
      grand_total: "60500",
      status: "PAID",
      created_at: txDate,
      updated_at: txDate,
    }).returning();

    await db.insert(transaction_items).values([
      { transaction_id: txCafe[0].id, product_id: prodKopi.id, product_name: prodKopi.name, quantity: 1, unit_price: "25000", cost_price_snapshot: "10000", subtotal: "25000" },
      { transaction_id: txCafe[0].id, product_id: prodMatcha.id, product_name: prodMatcha.name, quantity: 1, unit_price: "30000", cost_price_snapshot: "12000", subtotal: "30000" },
    ]);

    await db.insert(payments).values({
      transaction_id: txCafe[0].id,
      method: "QRIS",
      amount: "60500",
      amount_received: "60500",
      change_amount: "0",
    });
  }

  console.log("✅ 30 days of dummy transactions created!");
  await client.end();
  process.exit(0);
}

seedDummy().catch((err) => {
  console.error("❌ Seed failed:", err);
  process.exit(1);
});
