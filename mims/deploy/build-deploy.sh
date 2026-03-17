#!/usr/bin/env bash
# ============================================================
# M-IMS  Full Protected Deployment Build Script
# ============================================================
# Run this on your VENDOR machine before handing off to client.
# This script:
#   1. Installs all dependencies
#   2. Runs the obfuscated backend build
#   3. Builds the production frontend
#   4. Builds Docker images (backend + frontend)
#   5. Exports images as tarballs (for air-gap delivery)
# ============================================================
set -euo pipefail

# ─── Configuration ──────────────────────────────────────────
APP_VERSION="${APP_VERSION:-1.0.0}"
IMAGE_REGISTRY="${IMAGE_REGISTRY:-}"            # e.g. registry.yourcompany.com
BACKEND_IMAGE="mims-backend"
FRONTEND_IMAGE="mims-frontend"
DEPLOY_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT_DIR="$(cd "$DEPLOY_DIR/.." && pwd)"
BACKEND_DIR="$ROOT_DIR/backend"
FRONTEND_DIR="$ROOT_DIR/frontend"
OUTPUT_DIR="$DEPLOY_DIR/output"

echo ""
echo "╔══════════════════════════════════════════════════════╗"
echo "║        M-IMS Protected Deployment Builder            ║"
echo "╚══════════════════════════════════════════════════════╝"
echo ""
echo "  Version    : $APP_VERSION"
echo "  Root       : $ROOT_DIR"
echo "  Output     : $OUTPUT_DIR"
echo ""

mkdir -p "$OUTPUT_DIR"

# ─── Step 1: Install backend dependencies ───────────────────
echo "▶ [1/6] Installing backend dependencies…"
cd "$BACKEND_DIR"
npm ci

# ─── Step 2: Build & obfuscate backend ──────────────────────
echo "▶ [2/6] Building & obfuscating backend…"
node scripts/build-protected.js

# ─── Step 3: Install frontend dependencies ──────────────────
echo "▶ [3/6] Installing frontend dependencies…"
cd "$FRONTEND_DIR"
npm ci

# ─── Step 4: Build frontend (production, no source maps) ────
echo "▶ [4/6] Building frontend…"
NODE_ENV=production npm run build

# ─── Step 5: Build Docker images ────────────────────────────
echo "▶ [5/6] Building Docker images…"
cd "$ROOT_DIR"

docker build \
  --no-cache \
  -f "$DEPLOY_DIR/Dockerfile.backend" \
  -t "${IMAGE_REGISTRY:+$IMAGE_REGISTRY/}$BACKEND_IMAGE:$APP_VERSION" \
  -t "${IMAGE_REGISTRY:+$IMAGE_REGISTRY/}$BACKEND_IMAGE:latest" \
  .

docker build \
  --no-cache \
  -f "$DEPLOY_DIR/Dockerfile.frontend" \
  -t "${IMAGE_REGISTRY:+$IMAGE_REGISTRY/}$FRONTEND_IMAGE:$APP_VERSION" \
  -t "${IMAGE_REGISTRY:+$IMAGE_REGISTRY/}$FRONTEND_IMAGE:latest" \
  .

# ─── Step 6: Export images for air-gap delivery ─────────────
echo "▶ [6/6] Exporting Docker images…"
docker save \
  "${IMAGE_REGISTRY:+$IMAGE_REGISTRY/}$BACKEND_IMAGE:$APP_VERSION" \
  | gzip > "$OUTPUT_DIR/${BACKEND_IMAGE}-${APP_VERSION}.tar.gz"

docker save \
  "${IMAGE_REGISTRY:+$IMAGE_REGISTRY/}$FRONTEND_IMAGE:$APP_VERSION" \
  | gzip > "$OUTPUT_DIR/${FRONTEND_IMAGE}-${APP_VERSION}.tar.gz"

# Copy compose + nginx config to output
cp "$DEPLOY_DIR/docker-compose.prod.yml" "$OUTPUT_DIR/"
cp "$DEPLOY_DIR/nginx.conf"              "$OUTPUT_DIR/"

# Create .env template for client (no secrets pre-filled)
cat > "$OUTPUT_DIR/.env.template" << 'EOF'
# M-IMS Production Environment Configuration
# Fill in all values before starting the system

# Database
DB_USERNAME=mims_user
DB_PASSWORD=CHANGE_ME_STRONG_PASSWORD
DB_NAME=mims_db

# Redis
REDIS_PASSWORD=CHANGE_ME_REDIS_PASSWORD

# JWT Secrets (generate with: openssl rand -hex 64)
JWT_SECRET=CHANGE_ME_JWT_SECRET_64_CHARS
JWT_REFRESH_SECRET=CHANGE_ME_REFRESH_SECRET_64_CHARS

# NextAuth
NEXTAUTH_SECRET=CHANGE_ME_NEXTAUTH_SECRET

# License — provided by vendor
LICENSE_MASTER_KEY=VENDOR_PROVIDED_KEY

# App version
APP_VERSION=REPLACE_WITH_VERSION
EOF

echo ""
echo "╔══════════════════════════════════════════════════════╗"
echo "║              ✅ Build Complete!                       ║"
echo "╚══════════════════════════════════════════════════════╝"
echo ""
echo "📁 Output: $OUTPUT_DIR"
echo "   - ${BACKEND_IMAGE}-${APP_VERSION}.tar.gz"
echo "   - ${FRONTEND_IMAGE}-${APP_VERSION}.tar.gz"
echo "   - docker-compose.prod.yml"
echo "   - nginx.conf"
echo "   - .env.template"
echo ""
echo "📋 CLIENT DEPLOYMENT STEPS:"
echo "   1. Transfer the output/ folder to the client server"
echo "   2. Load Docker images:"
echo "      docker load < ${BACKEND_IMAGE}-${APP_VERSION}.tar.gz"
echo "      docker load < ${FRONTEND_IMAGE}-${APP_VERSION}.tar.gz"
echo "   3. Collect client machine fingerprint:"
echo "      cd \$ROOT/backend && npm run license:current-machine"
echo "   4. Generate license key:"
echo "      npm run license:generate -- --client-name='Hospital' --licensed-to='Admin' --machine-id=... --mac=..."
echo "   5. Copy license.key to the output/ folder on client server"
echo "   6. Copy and fill in .env.template → .env"
echo "   7. Start the system:"
echo "      docker compose -f docker-compose.prod.yml up -d"
echo ""
echo "⚠️  DO NOT share with client:"
echo "   - src/ directories"
echo "   - *.ts source files"
echo "   - scripts/"
echo "   - package-lock.json"
echo "   - obfuscator.config.js"
echo ""
