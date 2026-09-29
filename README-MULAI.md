# PANDUAN MULAI (lakukan berurutan)

## 1. Persiapan komputer
- Pasang Node.js versi 20 atau lebih baru dan Git.
- Ekstrak folder ini (misalnya menjadi `pos-backend`), lalu buka di Antigravity: File > Open Folder.
- Pastikan folder tersembunyi `.agents` ikut terbawa (berisi Rules dan Workflow).

## 2. Pasang dependensi (di terminal, di dalam folder proyek)
```
npm install hono drizzle-orm postgres zod @hono/zod-validator decimal.js-light
npm install -D wrangler typescript drizzle-kit dotenv tsx vitest @cloudflare/workers-types
git init
```

## 3. Database Aiven
- Aiven Console > service PostgreSQL > salin "Service URI" (pastikan memakai sslmode=require).
- Salin `.env.example` menjadi `.env`, lalu isi DATABASE_URL dan CLOUDFLARE_HYPERDRIVE_LOCAL_CONNECTION_STRING_HYPERDRIVE dengan URI tadi.
- Salin `.dev.vars.example` menjadi `.dev.vars`, isi JWT_SECRET dan JWT_REFRESH_SECRET dengan nilai acak.
- Jangan pernah commit .env, .dev.vars, atau menempelkannya ke chat AI.

## 4. Cloudflare
```
npx wrangler login
npx wrangler hyperdrive create pos-db --connection-string="URI_AIVEN_ANDA"
```
Salin `id` yang muncul ke wrangler.toml pada bagian [[hyperdrive]] (ganti ISI_ID_HYPERDRIVE_DI_SINI).

## 5. Jalankan Fase 1 di Antigravity
- Buka percakapan BARU di Agent Manager (atau agent chat).
- Pilih model Claude Opus 4.6 (Fase 1 memuat skema seluruh tabel, jadi pakai model terkuat).
- Aktifkan mode Planning, periksa rencananya, lalu setujui.
- Ketik:
  /fase 1
- Jika workflow tidak menerima tambahan teks, ketik prompt ini:
  "Kerjakan Fase 1 sesuai SPEC.md bagian I (Peta Fase). Baca bagian A, B, C. Ikuti aturan di Rules. Akhiri dengan daftar file yang dibuat."

## 6. Setelah Fase 1 selesai
```
npm run typecheck
npm run db:generate      (jika agent belum menjalankannya)
npm run db:migrate       (menerapkan tabel ke Aiven, jalankan sendiri)
npm run seed             (mengisi 2 outlet, akun COA, user awal)
npm run dev              (uji: buka http://localhost:8787/health)
git add . && git commit -m "fase 1"
```

## 7. Fase berikutnya
Percakapan baru untuk tiap fase, lalu ketik `/fase 2`, `/fase 3`, dan seterusnya.
Rekomendasi model:
- Opus 4.6: Fase 1, 3, 6
- Model Gemini yang lebih ringan: Fase 2, 4, 5, 7, 8
Commit Git setiap selesai satu fase.

## Catatan keamanan
- Agent dilarang (lewat Rules) menjalankan deploy, migrasi, atau seed tanpa persetujuan Anda. Baca dulu perintah yang diminta sebelum menyetujui.
- Jika kuota habis di tengah fase, berhenti di commit terakhir dan lanjutkan setelah kuota pulih atau dengan model lain.
