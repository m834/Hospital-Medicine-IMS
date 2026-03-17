#!/usr/bin/env bash
# =================================================================
#  M-IMS Native Package Builder
#  Run this on your BUILD machine AFTER:
#    - npm run build:prod   (backend obfuscated build)
#    - NODE_ENV=production npm run build   (frontend)
#
#  Output (in deploy/output-native/):
#    backend-dist.tar.gz
#    frontend-dist.tar.gz
#    install-native.sh
#    nginx-native.conf
#    .env.template
# =================================================================

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
BACKEND_DIST="$REPO_ROOT/backend/dist-protected"
FRONTEND_DIST="$REPO_ROOT/frontend/.next/standalone"
FRONTEND_STATIC="$REPO_ROOT/frontend/.next/static"
FRONTEND_PUBLIC="$REPO_ROOT/frontend/public"
DEPLOY_DIR="$REPO_ROOT/deploy"
OUTPUT_DIR="$DEPLOY_DIR/output-native"

RED='\033[0;31m'; GREEN='\033[0;32m'; CYAN='\033[0;36m'; NC='\033[0m'
info()    { echo -e "${CYAN}[INFO]${NC} $*"; }
success() { echo -e "${GREEN}[OK]${NC}   $*"; }
die()     { echo -e "${RED}[FAIL]${NC} $*" >&2; exit 1; }

# Preflight checks
[[ -d "$BACKEND_DIST"   ]] || die "backend/dist-protected/ not found. Run: npm run build:prod"
[[ -f "$FRONTEND_DIST/server.js" ]] || die "frontend/.next/standalone/server.js not found. Run: NODE_ENV=production npm run build"

mkdir -p "$OUTPUT_DIR"
info "Output directory: $OUTPUT_DIR"

# ─── Pack backend ────────────────────────────────────────────────
info "Packing backend (dist-protected/)…"
tar -czf "$OUTPUT_DIR/backend-dist.tar.gz" \
    -C "$BACKEND_DIST" \
    --exclude="*.map" \
    .
success "backend-dist.tar.gz → $(du -sh "$OUTPUT_DIR/backend-dist.tar.gz" | cut -f1)"

# ─── Pack frontend ───────────────────────────────────────────────
info "Packing frontend (standalone + static + public)…"

STAGING=$(mktemp -d)
trap 'rm -rf "$STAGING"' EXIT

# Next.js standalone is already self-contained — copy it entirely
cp -r "$FRONTEND_DIST/." "$STAGING/"

# Copy static assets to the location Next.js standalone expects
mkdir -p "$STAGING/.next/static"
cp -r "$FRONTEND_STATIC/." "$STAGING/.next/static/"

# Copy public directory
if [[ -d "$FRONTEND_PUBLIC" ]]; then
    cp -r "$FRONTEND_PUBLIC" "$STAGING/public"
fi

tar -czf "$OUTPUT_DIR/frontend-dist.tar.gz" \
    -C "$STAGING" \
    --exclude="*.map" \
    .
success "frontend-dist.tar.gz → $(du -sh "$OUTPUT_DIR/frontend-dist.tar.gz" | cut -f1)"

# ─── Copy deployment scripts ─────────────────────────────────────
info "Copying deployment scripts…"
cp "$DEPLOY_DIR/install-native.sh"  "$OUTPUT_DIR/"
cp "$DEPLOY_DIR/nginx-native.conf"  "$OUTPUT_DIR/"
chmod +x "$OUTPUT_DIR/install-native.sh"

# ─── .env template ───────────────────────────────────────────────
info "Writing .env.template…"
cat > "$OUTPUT_DIR/.env.template" <<'ENV'
# =================================================================
# M-IMS Environment Configuration — Native (No Docker) Deployment
# Copy this file to .env and fill in all values before running
# install-native.sh
# =================================================================

# ── Database ──────────────────────────────────────────────────────
# Format: postgresql://USER:PASSWORD@HOST:PORT/DATABASE
DATABASE_URL=postgresql://mims_user:CHANGE_ME_STRONG_PASSWORD@localhost:5432/mims_db

# ── Redis ─────────────────────────────────────────────────────────
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=CHANGE_ME_REDIS_PASSWORD

# ── JWT ───────────────────────────────────────────────────────────
JWT_SECRET=CHANGE_ME_64_CHAR_RANDOM_STRING
JWT_EXPIRES_IN=8h
JWT_REFRESH_EXPIRES_IN=7d

# ── App ───────────────────────────────────────────────────────────
PORT=3001
NODE_ENV=production
BACKEND_URL=http://localhost:3001

# ── NextAuth ──────────────────────────────────────────────────────
# Set NEXTAUTH_URL to your server's public IP or domain
NEXTAUTH_URL=http://YOUR_SERVER_IP_OR_DOMAIN
NEXTAUTH_SECRET=CHANGE_ME_32_CHAR_RANDOM_STRING
NEXT_PUBLIC_API_URL=http://YOUR_SERVER_IP_OR_DOMAIN/api

# ── License ───────────────────────────────────────────────────────
# Do NOT set SKIP_LICENSE_CHECK in production
# Place license.key file in /opt/mims/backend/ after installation
ENV
success ".env.template created"

# ─── Summary ─────────────────────────────────────────────────────
echo ""
echo -e "${GREEN}============================================================${NC}"
echo -e "${GREEN}  Native package ready in: deploy/output-native/${NC}"
echo -e "${GREEN}============================================================${NC}"
echo ""
ls -lh "$OUTPUT_DIR"
echo ""
echo "  Next steps:"
echo "  1. Copy output-native/ folder to a USB drive"
echo "  2. On the client server:"
echo "     cp .env.template .env"
echo "     nano .env              # fill in all secrets"
echo "     sudo bash install-native.sh"
echo "  3. After first login, generate license.key and place it in"
echo "     /opt/mims/backend/license.key"
echo "     then: pm2 restart mims-backend"
echo ""
