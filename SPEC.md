# SPEC BACKEND POS + AKUNTANSI + CRM (2 OUTLET: RESTORAN & CAFE)

## A. STACK
Hono + TypeScript, Drizzle ORM (postgres.js), Zod (@hono/zod-validator), decimal.js-light, hono/jwt.
Cloudflare Workers + Hyperdrive -> Aiven PostgreSQL (SSL).
Binding/env: HYPERDRIVE, JWT_SECRET, JWT_REFRESH_SECRET, CORS_ORIGIN.
File konfigurasi SUDAH ADA: package.json, wrangler.toml, tsconfig.json, drizzle.config.ts.
Koneksi DB dibuat per request dari c.env.HYPERDRIVE.connectionString. Migrasi: drizzle-kit (dijalankan lokal, bukan dari Worker).
Struktur: src/{index.ts, db/{schema.ts,client.ts}, middleware/, lib/, modules/<nama>/{routes,service,schema}.ts}, scripts/seed.ts
Modul: auth, outlet, device, menu, pricing, transaction, discount, stock, purchase, expense, income, hpp, accounting, crm, report, audit.

## B. ATURAN UMUM
- Uang: numeric(15,2); string di TS/JSON; hitung dengan decimal.js-light; dilarang float.
- PK UUID v4; ID nota dari Flutter = kunci idempotensi.
- Waktu timestamptz (UTC); pengelompokan harian/bulanan/jam pakai Asia/Jakarta.
- Tabel bisnis: outlet_id, created_at, updated_at, deleted_at (soft delete).
- Error: {error:{code,message}}. Semua list paginasi. CORS hanya domain Next.js. Rate limit /auth/login.
- Batas Workers (free: CPU 10 ms/request): agregasi di SQL, batch kecil, multi-row insert, tanpa library berat, hash password PBKDF2 WebCrypto.

## C. OUTLET, ROLE, AKSES
- Tabel outlets (RESTORAN, CAFE): is_active, timezone, tax_percent, service_percent, receipt_header/footer, payment_methods_enabled, low_stock_threshold (default 5), enable_table_number.
- Route: /api/v1/{restoran|cafe}/... ; gabungan: /api/v1/all/reports/... (super_admin, accountant).
- outlet_ids dari klaim JWT (bukan input klien); filter outlet_id wajib di semua query.
- Role -> akses:
  super_admin: semua, kedua outlet + gabungan.
  manager: semua modul operasional di outletnya.
  cashier: POS saja (buat transaksi, lihat menu/harga/stok); terkunci ke satu outlet kecuali punya "outlet:switch".
  accountant: baca transaksi, jurnal, COA, laporan keuangan, export; tidak ubah menu/stok.
  crm_staff: pelanggan, member, poin, diskon member.
- RBAC via permission (mis. "stock:write", "journal:write", "transaction:void", "outlet:write", "outlet:switch").
- Stok dicatat per produk/menu jadi (bukan per bahan baku).

## D. FITUR PER OUTLET
1 Menu: kategori & produk (makanan, minuman, dll).
2 Harga: harga jual + harga pokok; riwayat perubahan harga.
3 Total transaksi: jumlah nota & nilai per periode.
4 Diskon: persen/nominal, per produk/nota, periode aktif, khusus member.
5 Stok: stok saat ini, satuan, ambang minimum; tabel stock_movements untuk semua pergerakan (jual, beli, opname, retur, void).
6 Grafik: granularity=hour|day|month.
7 Opname stok + ubah harga: selisih dicatat + jurnal penyesuaian persediaan; perubahan harga masuk riwayat.
8 Pengeluaran harian: kategori, nominal, tanggal, catatan.
9 Pendapatan: dipisah TUNAI dan QRIS (payments per nota, mendukung split, amount_received, kembalian, qris_reference).
10 HPP: snapshot harga pokok per item saat transaksi; metode moving average dari pembelian.
11 Ringkasan bulanan (?month=YYYY-MM): produk_terjual, jumlah_transaksi, total_pengeluaran, laba_bersih (= pendapatan bersih - HPP - pengeluaran), total_produk, produk_tersedia (stok>0), produk_kosong (stok=0), stok_kurang_dari_5 (0<stok<5) + daftar produk.

## E. AKUNTANSI (DOUBLE-ENTRY)
Akun: 1111 Kas Resto, 1112 QRIS Resto, 1121 Kas Cafe, 1122 QRIS Cafe, 1201 Stok Resto, 1202 Stok Cafe, 2100 Utang Pajak, 3100 Modal, 3200 Laba Ditahan, 4100 Jual Resto, 4200 Jual Cafe, 5100 HPP Resto, 5200 HPP Cafe, 6100 Beban Resto, 6200 Beban Cafe, 6900 Selisih Kas.
Tabel: journal_entries + journal_lines.
Jurnal: jual (Dr Kas/QRIS, Cr Pendapatan, Cr Utang Pajak jika ada); HPP (Dr HPP, Cr Persediaan); beban (Dr Beban, Cr Kas); beli (Dr Persediaan, Cr Kas); void/refund = jurnal pembalik + stok kembali; opname = penyesuaian persediaan; selisih kas shift -> 6900.
Semua jurnal DI DALAM db.transaction yang sama dengan datanya; wajib debit = kredit, jika tidak rollback.
Fitur: CRUD akun COA, saldo awal, jurnal manual (accountant/super_admin), tutup/kunci periode bulanan.
Laporan (per outlet atau gabungan): general-ledger, trial-balance, income-statement, balance-sheet, cash-flow.

## F. MODUL LAIN
- Transaksi: status PAID | VOID | REFUNDED (tidak pernah dihapus); pajak & service charge tersimpan di nota.
- Pembelian: suppliers, purchases, purchase_items -> stok masuk + jurnal.
- Shift: shifts (kasir, kas awal, kas akhir, selisih, buka/tutup); server hitung ekspektasi kas per metode bayar.
- CRM: customers (nama, HP, tipe member), poin/loyalty, riwayat & total belanja; nota opsional customer_id.
- Audit: audit_logs (siapa, kapan, aksi, sebelum/sesudah) untuk harga, stok, void, jurnal manual, pengaturan, ganti outlet.
- Nomor nota: prefix RST- / CFE- + device_id + urutan.

## G. ENDPOINT (prefix /api/v1)
Auth: POST /auth/login, /auth/refresh, /auth/logout; GET /auth/me. Hash PBKDF2.
User: CRUD user, nonaktifkan, reset password (super_admin).
Outlet/Device: GET /outlets; GET,PUT /{outlet}/settings (PUT: "outlet:write"); POST /devices/register {device_id,name,outlet_id}; PUT /devices/{device_id}/outlet (ganti outlet, "outlet:switch", masuk audit); GET /devices/me. Jika outlet is_active=false: /sync tolak dengan OUTLET_INACTIVE, pull & laporan tetap boleh.
Per outlet {outlet}: CRUD categories, products, discounts, customers, suppliers, expenses; POST/GET purchases; POST /opname; POST /shifts/open, /shifts/close; POST /transactions/{id}/void.
Sync:
 - POST /{outlet}/sync -> batch campuran (transaksi, pengeluaran, shift, void), mendukung Content-Encoding gzip (DecompressionStream), maksimal 25 item/batch. Tiap item: db.transaction + insert onConflictDoNothing (id). Potong stok dengan UPDATE atomik (stok = stok - qty), stok negatif diizinkan tapi ditandai. Response per item {id, status: accepted|duplicate|failed, error}; satu item gagal tidak menggagalkan batch.
 - GET /{outlet}/sync/pull?since=&cursor= -> menu, harga, stok, diskon, tombstone (deleted_at), paginasi; mode bootstrap untuk sinkron penuh pertama.
Laporan: GET /{outlet}/reports/monthly, /chart, /export?from=&to=&page=&limit= (JSON mentah; PDF/Excel dirender di Next.js, JANGAN di Worker); GET /all/reports/*; laporan akuntansi (bagian E).

## H. TEST (Vitest)
Keseimbangan jurnal; idempotensi /sync (kirim 2x, tidak dobel); presisi decimal; isolasi outlet (user Cafe tidak bisa baca Restoran); void mengembalikan stok & jurnal.

## I. PETA FASE
Fase 1 Fondasi: bagian A, B, C. Buat src/index.ts (+ GET /health), db/schema.ts LENGKAP untuk SEMUA tabel di bagian C-F, db/client.ts, middleware (auth JWT, RBAC, outlet, error), modul auth (login, refresh, logout, me), scripts/seed.ts (2 outlet, semua akun COA, satu user per role, kata sandi awal dicetak sekali di terminal). Jalankan `npm run db:generate`. JANGAN membuat ulang file konfigurasi.
Fase 2 Master data: bagian C, D poin 1, 2, 4, 5, 7; G (Outlet/Device, CRUD categories, products, discounts, opname).
Fase 3 Transaksi & sinkronisasi: D poin 9, 10; E (jurnal jual/HPP); F (Transaksi, Shift, Nomor nota); G (Sync, shifts).
Fase 4 Pengeluaran, pembelian, void, audit: D poin 8; E (jurnal beban, beli, void); F (Pembelian, Audit); G (expenses, purchases, void).
Fase 5 Laporan operasional: D poin 3, 6, 11; G (Laporan monthly, chart, export, all/reports).
Fase 6 Akuntansi lanjutan: bagian E (CRUD COA, jurnal manual, periode, 5 laporan akuntansi).
Fase 7 CRM & user: F (CRM); G (User, customers, suppliers).
Fase 8 Test & deploy: bagian H; panduan deploy (wrangler secret put, wrangler deploy, Hyperdrive produksi).
