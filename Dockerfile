# =============================================================================
# DOCKERFILE — POS Backend API (Go Fiber)
# Multi-Stage Build | Optimized for Back4app Containers / Cloud Deployments
# Image Size: ~18 MB (Ultra lightweight, fast boot)
# =============================================================================

# ---------------------------------------------------------------------------
# STAGE 1: Builder
# ---------------------------------------------------------------------------
FROM golang:1.22-alpine AS builder

WORKDIR /build

# Cache dependencies
COPY go.mod go.sum ./
RUN go mod download && go mod verify

# Copy source code
COPY . .

# Compile static binary with stripped debug symbols
RUN CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build \
    -trimpath \
    -ldflags="-s -w -extldflags '-static'" \
    -o /build/server \
    ./cmd/server

# ---------------------------------------------------------------------------
# STAGE 2: Runtime (Alpine Linux ~7MB base, highly compatible with PaaS probes)
# ---------------------------------------------------------------------------
FROM alpine:3.20

# Add SSL certificates (crucial for Aiven PostgreSQL SSL connection) & timezone data
RUN apk --no-cache add ca-certificates tzdata

WORKDIR /app

# Copy binary from builder
COPY --from=builder /build/server /app/server

# Environment defaults
ENV TZ=Asia/Jakarta
ENV APP_ENV=production

# Default port for Back4app Containers
EXPOSE 8080

# Run server
CMD ["/app/server"]
