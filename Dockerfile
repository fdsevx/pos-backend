# =============================================================================
# DOCKERFILE — POS Backend API (Go Fiber)
# Optimized for Koyeb Deployment | Multi-Stage Build | Scratch Final Image
#
# Ukuran image akhir: ~10-15 MB (vs ~300+ MB jika pakai golang base)
# =============================================================================

# ---------------------------------------------------------------------------
# STAGE 1: Module Cache
# Cache go modules terpisah agar tidak re-download setiap kali kode berubah.
# Layer ini hanya rebuild jika go.mod / go.sum berubah.
# ---------------------------------------------------------------------------
FROM golang:1.22-alpine AS modules

WORKDIR /modules
COPY go.mod go.sum ./
RUN go mod download && go mod verify

# ---------------------------------------------------------------------------
# STAGE 2: Builder
# Compile binary Go statis (tanpa CGO) dengan strip debug symbols.
# UPX compression opsional untuk mengecilkan binary ~60% lebih kecil.
# ---------------------------------------------------------------------------
FROM golang:1.22-alpine AS builder

# Install UPX untuk compress binary (opsional tapi sangat efektif)
RUN apk add --no-cache upx

WORKDIR /build

# Copy cached modules dari stage 1
COPY --from=modules /go/pkg /go/pkg

# Copy source code
COPY . .

# Build argument untuk versioning (opsional, dipakai Koyeb build)
ARG BUILD_VERSION=dev
ARG BUILD_COMMIT=unknown
ARG BUILD_DATE=unknown

# Compile static binary:
#   CGO_ENABLED=0  → Pure Go, tidak depend pada glibc (bisa jalan di scratch)
#   -trimpath      → Hapus path lokal dari binary (keamanan + reproducible)
#   -ldflags:
#     -s           → Strip symbol table (kurangi ~20% ukuran)
#     -w           → Strip DWARF debug info (kurangi ~10% ukuran)
#     -extldflags  → Static linking flags
RUN CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build \
    -trimpath \
    -ldflags="-s -w -extldflags '-static' \
      -X main.Version=${BUILD_VERSION} \
      -X main.Commit=${BUILD_COMMIT} \
      -X main.BuildDate=${BUILD_DATE}" \
    -o /build/server \
    ./cmd/server

# Compress binary dengan UPX (level 9 = max compression)
# Dari ~15MB → ~5MB. Flag --lzma memberikan rasio kompresi terbaik.
RUN upx --best --lzma /build/server || true

# ---------------------------------------------------------------------------
# STAGE 3: Runtime — FROM scratch (image kosong, 0 bytes base)
#
# scratch = image Docker paling ringan yang mungkin.
# Tidak ada shell, tidak ada package manager, tidak ada OS.
# Hanya binary Go + file yang kita butuhkan.
#
# Yang perlu dicopy manual:
#   1. ca-certificates → SSL/TLS untuk koneksi Aiven PostgreSQL
#   2. zoneinfo        → Timezone data (time.LoadLocation)
#   3. /etc/passwd     → Non-root user (security best practice)
# ---------------------------------------------------------------------------
FROM scratch

# Metadata labels (Render & Docker best practice)
LABEL maintainer="edidev23"
LABEL org.opencontainers.image.title="POS Backend API"
LABEL org.opencontainers.image.description="Go Fiber POS Backend for Render"
LABEL org.opencontainers.image.source="https://github.com/edidev23/pos-backend"

# Copy CA certificates dari Alpine (wajib untuk Aiven PostgreSQL SSL)
COPY --from=builder /etc/ssl/certs/ca-certificates.crt /etc/ssl/certs/

# Copy timezone data (wajib agar time.LoadLocation("Asia/Jakarta") berfungsi)
COPY --from=builder /usr/share/zoneinfo /usr/share/zoneinfo

# Copy passwd file agar bisa jalan sebagai non-root user
COPY --from=builder /etc/passwd /etc/passwd

# Copy binary
COPY --from=builder /build/server /server

# Environment defaults untuk Render
# PORT akan di-inject otomatis oleh Render
ENV TZ=Asia/Jakarta
ENV APP_ENV=production

# Render health check akan hit endpoint /health
# Render umumnya menggunakan port 10000 atau port yang diexpose oleh Dockerfile
EXPOSE 10000

# Jalankan sebagai non-root (security)
USER nobody

# ENTRYPOINT (bukan CMD) agar signal SIGTERM dari Render diterima langsung
# oleh binary Go — penting untuk graceful shutdown yang benar.
ENTRYPOINT ["/server"]
