Proyek: backend POS 2 outlet (RESTORAN, CAFE). Hono + TypeScript + Drizzle (postgres.js) di Cloudflare Workers, Hyperdrive -> Aiven PostgreSQL. Spesifikasi lengkap: SPEC.md.

- Uang: numeric(15,2), string di TS/JSON, hitung dengan decimal.js-light. Dilarang float/Number.
- PK UUID v4. Waktu timestamptz UTC; pengelompokan laporan pakai Asia/Jakarta.
- Semua tabel bisnis punya outlet_id; semua query wajib difilter outlet (dari JWT + path).
- Jurnal akuntansi di db.transaction yang sama dengan datanya; debit harus = kredit.
- Batas Workers: agregasi di SQL, batch kecil, multi-row insert, tanpa library berat, koneksi DB dibuat per request.
- Jangan tulis kredensial di kode. Secret lewat .dev.vars (lokal) / wrangler secret (produksi).
- File konfigurasi (package.json, wrangler.toml, tsconfig.json, drizzle.config.ts) sudah ada; jangan dibuat ulang atau diubah kecuali diminta.
- Jangan menjalankan wrangler deploy, db:migrate, seed, atau perintah lain yang menyentuh database tanpa persetujuan user.
- Output: kode per file, tanpa penjelasan panjang. Kerjakan hanya fase yang diminta.
