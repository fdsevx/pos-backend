import "dotenv/config";
// @ts-ignore
import crypto from "crypto";
// @ts-ignore
global.crypto = crypto;
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { hashPassword } from "../src/lib/crypto";
import {
  outlets,
  users,
  user_outlets,
  user_permissions,
  coa_accounts,
} from "../src/db/schema";

async function seed() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error("DATABASE_URL not set in .env");
    process.exit(1);
  }

  const client = postgres(url, { prepare: false });
  const db = drizzle(client);

  console.log("🌱 Seeding database...\n");

  // --- 1. Outlets ---
  const [restoran, cafe] = await db
    .insert(outlets)
    .values([
      {
        name: "Restoran Utama",
        slug: "restoran",
        tax_percent: "10.00",
        service_percent: "5.00",
        receipt_header: "RESTORAN UTAMA\nJl. Contoh No. 1",
        receipt_footer: "Terima kasih telah berkunjung!",
        enable_table_number: true,
      },
      {
        name: "Cafe Santai",
        slug: "cafe",
        tax_percent: "10.00",
        service_percent: "0.00",
        receipt_header: "CAFE SANTAI\nJl. Contoh No. 2",
        receipt_footer: "Terima kasih!",
        enable_table_number: false,
      },
    ])
    .returning();

  console.log("✅ Outlets created:", restoran.slug, cafe.slug);

  // --- 2. COA Accounts ---
  const coaData = [
    { code: "1111", name: "Kas Restoran", type: "asset", outlet_id: restoran.id },
    { code: "1112", name: "QRIS Restoran", type: "asset", outlet_id: restoran.id },
    { code: "1121", name: "Kas Cafe", type: "asset", outlet_id: cafe.id },
    { code: "1122", name: "QRIS Cafe", type: "asset", outlet_id: cafe.id },
    { code: "1201", name: "Persediaan Restoran", type: "asset", outlet_id: restoran.id },
    { code: "1202", name: "Persediaan Cafe", type: "asset", outlet_id: cafe.id },
    { code: "2100", name: "Utang Pajak", type: "liability", outlet_id: null },
    { code: "3100", name: "Modal", type: "equity", outlet_id: null },
    { code: "3200", name: "Laba Ditahan", type: "equity", outlet_id: null },
    { code: "4100", name: "Penjualan Restoran", type: "revenue", outlet_id: restoran.id },
    { code: "4200", name: "Penjualan Cafe", type: "revenue", outlet_id: cafe.id },
    { code: "5100", name: "HPP Restoran", type: "expense", outlet_id: restoran.id },
    { code: "5200", name: "HPP Cafe", type: "expense", outlet_id: cafe.id },
    { code: "6100", name: "Beban Restoran", type: "expense", outlet_id: restoran.id },
    { code: "6200", name: "Beban Cafe", type: "expense", outlet_id: cafe.id },
    { code: "6900", name: "Selisih Kas", type: "expense", outlet_id: null },
  ];

  await db.insert(coa_accounts).values(coaData);
  console.log("✅ COA accounts created:", coaData.length, "accounts");

  // --- 3. Users (one per role) ---
  const initialPassword = "password123";
  const hashedPw = await hashPassword(initialPassword);

  const usersData = [
    { username: "superadmin", display_name: "Super Admin", role: "super_admin", password_hash: hashedPw },
    { username: "manager_resto", display_name: "Manager Restoran", role: "manager", password_hash: hashedPw },
    { username: "manager_cafe", display_name: "Manager Cafe", role: "manager", password_hash: hashedPw },
    { username: "kasir_resto", display_name: "Kasir Restoran", role: "cashier", password_hash: hashedPw },
    { username: "kasir_cafe", display_name: "Kasir Cafe", role: "cashier", password_hash: hashedPw },
    { username: "akuntan", display_name: "Akuntan", role: "accountant", password_hash: hashedPw },
    { username: "crm_staff", display_name: "Staff CRM", role: "crm_staff", password_hash: hashedPw },
  ];

  const insertedUsers = await db.insert(users).values(usersData).returning();
  console.log("✅ Users created:", insertedUsers.map((u) => u.username).join(", "));

  // --- 4. User-Outlet assignments ---
  const userMap = Object.fromEntries(insertedUsers.map((u) => [u.username, u.id]));

  const userOutletAssignments = [
    // super_admin -> both outlets
    { user_id: userMap["superadmin"], outlet_id: restoran.id },
    { user_id: userMap["superadmin"], outlet_id: cafe.id },
    // managers -> their outlet
    { user_id: userMap["manager_resto"], outlet_id: restoran.id },
    { user_id: userMap["manager_cafe"], outlet_id: cafe.id },
    // cashiers -> their outlet
    { user_id: userMap["kasir_resto"], outlet_id: restoran.id },
    { user_id: userMap["kasir_cafe"], outlet_id: cafe.id },
    // accountant -> both
    { user_id: userMap["akuntan"], outlet_id: restoran.id },
    { user_id: userMap["akuntan"], outlet_id: cafe.id },
    // crm_staff -> both
    { user_id: userMap["crm_staff"], outlet_id: restoran.id },
    { user_id: userMap["crm_staff"], outlet_id: cafe.id },
  ];

  await db.insert(user_outlets).values(userOutletAssignments);
  console.log("✅ User-outlet assignments created");

  // --- 5. Permissions ---
  const allPermissions = [
    "stock:read", "stock:write",
    "menu:read", "menu:write",
    "transaction:read", "transaction:write", "transaction:void",
    "journal:read", "journal:write",
    "outlet:read", "outlet:write", "outlet:switch",
    "report:read", "report:export",
    "user:read", "user:write",
    "customer:read", "customer:write",
    "supplier:read", "supplier:write",
    "expense:read", "expense:write",
    "purchase:read", "purchase:write",
    "discount:read", "discount:write",
    "shift:read", "shift:write",
    "audit:read",
  ];

  // Manager gets all operational permissions
  const managerPerms = allPermissions.filter((p) => !p.startsWith("user:") && p !== "outlet:write");

  // Cashier gets POS-only permissions
  const cashierPerms = [
    "menu:read", "stock:read", "transaction:read", "transaction:write",
    "discount:read", "shift:read", "shift:write",
  ];

  // Accountant gets read + journal + report
  const accountantPerms = [
    "transaction:read", "journal:read", "journal:write",
    "report:read", "report:export", "expense:read", "purchase:read",
    "stock:read", "menu:read",
  ];

  // CRM staff
  const crmPerms = [
    "customer:read", "customer:write", "discount:read", "discount:write",
    "transaction:read",
  ];

  const permEntries: { user_id: string; permission: string }[] = [];

  // super_admin doesn't need explicit permissions (bypasses check)
  for (const p of managerPerms) {
    permEntries.push({ user_id: userMap["manager_resto"], permission: p });
    permEntries.push({ user_id: userMap["manager_cafe"], permission: p });
  }
  for (const p of cashierPerms) {
    permEntries.push({ user_id: userMap["kasir_resto"], permission: p });
    permEntries.push({ user_id: userMap["kasir_cafe"], permission: p });
  }
  for (const p of accountantPerms) {
    permEntries.push({ user_id: userMap["akuntan"], permission: p });
  }
  for (const p of crmPerms) {
    permEntries.push({ user_id: userMap["crm_staff"], permission: p });
  }

  await db.insert(user_permissions).values(permEntries);
  console.log("✅ Permissions created:", permEntries.length, "entries");

  // --- Done ---
  console.log("\n========================================");
  console.log("🎉 Seed complete!");
  console.log("========================================");
  console.log("Kata sandi awal untuk SEMUA user:");
  console.log(`  ${initialPassword}`);
  console.log("----------------------------------------");
  for (const u of insertedUsers) {
    console.log(`  ${u.username} (${u.role})`);
  }
  console.log("========================================\n");

  await client.end();
  process.exit(0);
}

seed().catch((err) => {
  console.error("❌ Seed failed:", err);
  process.exit(1);
});
