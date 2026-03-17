#!/usr/bin/env bash
# =================================================================
#  M-IMS Native Installer  —  No Docker Required
#  Tested on: Ubuntu 22.04 LTS / Debian 12
# =================================================================
# USAGE:
#   sudo bash install-native.sh
#
# PREREQUISITES (must exist next to this script):
#   backend-dist.tar.gz   ← packed by package-native.sh
#   frontend-dist.tar.gz  ← packed by package-native.sh
#   nginx-native.conf
#   .env                  ← you must create this with real secrets
#
# POST-INSTALL:
#   Place license.key into /opt/mims/backend/ before first run.
# =================================================================

set -euo pipefail

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; CYAN='\033[0;36m'; NC='\033[0m'
info()    { echo -e "${CYAN}[INFO]${NC} $*"; }
success() { echo -e "${GREEN}[OK]${NC}   $*"; }
warn()    { echo -e "${YELLOW}[WARN]${NC} $*"; }
die()     { echo -e "${RED}[FAIL]${NC} $*" >&2; exit 1; }

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
APP_DIR="/opt/mims"
BACKEND_DIR="$APP_DIR/backend"
FRONTEND_DIR="$APP_DIR/frontend"
NODE_VERSION="20"
POSTGRES_VERSION="16"

# ─── Preflight ───────────────────────────────────────────────────
[[ $EUID -ne 0 ]] && die "Run as root: sudo bash $0"
[[ -f "$SCRIPT_DIR/backend-dist.tar.gz"  ]] || die "backend-dist.tar.gz not found in $SCRIPT_DIR"
[[ -f "$SCRIPT_DIR/frontend-dist.tar.gz" ]] || die "frontend-dist.tar.gz not found in $SCRIPT_DIR"
[[ -f "$SCRIPT_DIR/.env"                 ]] || die ".env not found in $SCRIPT_DIR — create it first"
[[ -f "$SCRIPT_DIR/nginx-native.conf"    ]] || die "nginx-native.conf not found in $SCRIPT_DIR"

info "Starting M-IMS native installation on $(lsb_release -ds 2>/dev/null || uname -s)"

# ─── 1. System packages ──────────────────────────────────────────
info "Updating package lists…"
apt-get update -qq

info "Installing system dependencies…"
apt-get install -y -qq curl gnupg2 lsb-release ca-certificates \
    apt-transport-https software-properties-common unzip nginx ufw

# ─── 2. Node.js $NODE_VERSION ────────────────────────────────────
if ! command -v node &>/dev/null || [[ "$(node -v | cut -dv -f2 | cut -d. -f1)" -lt "$NODE_VERSION" ]]; then
    info "Installing Node.js $NODE_VERSION via NodeSource…"
    curl -fsSL https://deb.nodesource.com/setup_${NODE_VERSION}.x | bash - >/dev/null
    apt-get install -y -qq nodejs
else
    info "Node.js $(node -v) already installed."
fi
success "Node.js: $(node -v)"

# ─── 3. PM2 ──────────────────────────────────────────────────────
if ! command -v pm2 &>/dev/null; then
    info "Installing PM2…"
    npm install -g pm2 --quiet
fi
success "PM2: $(pm2 --version)"

# ─── 4. PostgreSQL $POSTGRES_VERSION ────────────────────────────
if ! command -v psql &>/dev/null; then
    info "Installing PostgreSQL $POSTGRES_VERSION…"
    curl -fsSL https://www.postgresql.org/media/keys/ACCC4CF8.asc \
        | gpg --dearmor -o /usr/share/keyrings/postgresql.gpg
    echo "deb [signed-by=/usr/share/keyrings/postgresql.gpg] \
https://apt.postgresql.org/pub/repos/apt $(lsb_release -cs)-pgdg main" \
        > /etc/apt/sources.list.d/pgdg.list
    apt-get update -qq
    apt-get install -y -qq postgresql-${POSTGRES_VERSION}
    systemctl enable postgresql --quiet
    systemctl start postgresql
else
    info "PostgreSQL already installed: $(psql --version)"
fi
success "PostgreSQL is running: $(systemctl is-active postgresql)"

# ─── 5. Redis 7 ──────────────────────────────────────────────────
if ! command -v redis-server &>/dev/null; then
    info "Installing Redis…"
    curl -fsSL https://packages.redis.io/gpg \
        | gpg --dearmor -o /usr/share/keyrings/redis-archive-keyring.gpg
    echo "deb [signed-by=/usr/share/keyrings/redis-archive-keyring.gpg] \
https://packages.redis.io/deb $(lsb_release -cs) main" \
        > /etc/apt/sources.list.d/redis.list
    apt-get update -qq
    apt-get install -y -qq redis
    systemctl enable redis-server --quiet
    systemctl start redis-server
else
    info "Redis already installed: $(redis-server --version | head -1)"
fi
success "Redis is running: $(systemctl is-active redis-server)"

# ─── 6. Read DB credentials from .env ────────────────────────────
info "Reading database credentials from .env…"
DB_PASSWORD=$(grep -E '^DATABASE_URL=' "$SCRIPT_DIR/.env" \
    | sed 's|.*://[^:]*:\([^@]*\)@.*|\1|' || true)

if [[ -z "$DB_PASSWORD" ]]; then
    warn "Could not auto-detect DB password from DATABASE_URL."
    warn "You will need to manually create the database (see Step 6 below)."
    SKIP_DB_SETUP=true
else
    SKIP_DB_SETUP=false
fi

# ─── 7. Create PostgreSQL user + database ────────────────────────
if [[ "$SKIP_DB_SETUP" == false ]]; then
    info "Creating PostgreSQL role mims_user and database mims_db…"
    # Idempotent: won't fail if user/db already exists
    sudo -u postgres psql -c "
        DO \$\$
        BEGIN
          IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'mims_user') THEN
            CREATE ROLE mims_user WITH LOGIN ENCRYPTED PASSWORD '$DB_PASSWORD';
          ELSE
            ALTER ROLE mims_user WITH ENCRYPTED PASSWORD '$DB_PASSWORD';
          END IF;
        END
        \$\$;
    " >/dev/null
    sudo -u postgres psql -c "
        SELECT 'CREATE DATABASE mims_db OWNER mims_user'
        WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'mims_db')
    " | sudo -u postgres psql >/dev/null || true
    sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE mims_db TO mims_user;" >/dev/null
    success "PostgreSQL: mims_db ready"
fi

# ─── 8. Configure Redis password ─────────────────────────────────
REDIS_PASSWORD=$(grep -E '^REDIS_PASSWORD=' "$SCRIPT_DIR/.env" \
    | cut -d= -f2 | tr -d '"'"'" || true)

if [[ -n "$REDIS_PASSWORD" ]]; then
    info "Setting Redis requirepass…"
    REDIS_CONF="/etc/redis/redis.conf"
    if [[ -f "$REDIS_CONF" ]]; then
        # Remove any existing requirepass line, then append
        sed -i '/^requirepass /d' "$REDIS_CONF"
        echo "requirepass $REDIS_PASSWORD" >> "$REDIS_CONF"
        systemctl restart redis-server
        success "Redis password configured."
    fi
fi

# ─── 9. Create /opt/mims directory structure ─────────────────────
info "Creating application directory $APP_DIR…"
mkdir -p "$BACKEND_DIR" "$FRONTEND_DIR"

# ─── 10. Extract backend ──────────────────────────────────────────
info "Extracting backend…"
tar -xzf "$SCRIPT_DIR/backend-dist.tar.gz" -C "$BACKEND_DIR"

info "Copying .env to backend…"
cp "$SCRIPT_DIR/.env" "$BACKEND_DIR/.env"
chmod 600 "$BACKEND_DIR/.env"

info "Fixing start.sh permissions…"
[[ -f "$BACKEND_DIR/start.sh" ]] && chmod +x "$BACKEND_DIR/start.sh"

# ─── 11. Extract frontend ─────────────────────────────────────────
info "Extracting frontend…"
tar -xzf "$SCRIPT_DIR/frontend-dist.tar.gz" -C "$FRONTEND_DIR"

info "Injecting frontend environment variables…"
# Next.js standalone reads env at runtime from its own .env files
NEXT_URL=$(grep -E '^NEXTAUTH_URL=' "$SCRIPT_DIR/.env" | cut -d= -f2- || true)
NEXT_SECRET=$(grep -E '^NEXTAUTH_SECRET=' "$SCRIPT_DIR/.env" | cut -d= -f2- || true)
BACKEND_URL=$(grep -E '^NEXT_PUBLIC_API_URL=' "$SCRIPT_DIR/.env" | cut -d= -f2- || true)
{
    echo "PORT=3000"
    echo "HOSTNAME=0.0.0.0"
    [[ -n "$NEXT_URL"    ]] && echo "NEXTAUTH_URL=$NEXT_URL"
    [[ -n "$NEXT_SECRET" ]] && echo "NEXTAUTH_SECRET=$NEXT_SECRET"
    [[ -n "$BACKEND_URL" ]] && echo "NEXT_PUBLIC_API_URL=$BACKEND_URL"
} > "$FRONTEND_DIR/.env"
chmod 600 "$FRONTEND_DIR/.env"

# ─── 12. PM2 ecosystem file ───────────────────────────────────────
info "Writing PM2 ecosystem config to $APP_DIR/ecosystem.config.js…"
cat > "$APP_DIR/ecosystem.config.js" <<'ECOSYSTEM'
module.exports = {
  apps: [
    {
      name        : "mims-backend",
      script      : "./start.sh",
      interpreter : "bash",
      cwd         : "/opt/mims/backend",
      env         : { NODE_ENV: "production" },
      log_date_format : "YYYY-MM-DD HH:mm:ss",
      error_file  : "/var/log/mims/backend-error.log",
      out_file    : "/var/log/mims/backend-out.log",
      max_restarts: 10,
      restart_delay: 5000,
    },
    {
      name        : "mims-frontend",
      script      : "server.js",
      cwd         : "/opt/mims/frontend",
      env         : {
        NODE_ENV : "production",
        PORT     : "3000",
        HOSTNAME : "0.0.0.0",
      },
      log_date_format : "YYYY-MM-DD HH:mm:ss",
      error_file  : "/var/log/mims/frontend-error.log",
      out_file    : "/var/log/mims/frontend-out.log",
      max_restarts: 10,
      restart_delay: 5000,
    },
  ],
};
ECOSYSTEM

mkdir -p /var/log/mims
success "PM2 ecosystem config written."

# ─── 13. Nginx ────────────────────────────────────────────────────
info "Configuring Nginx…"
cp "$SCRIPT_DIR/nginx-native.conf" /etc/nginx/sites-available/mims

# Disable default site to avoid port conflict
[[ -f /etc/nginx/sites-enabled/default ]] && rm -f /etc/nginx/sites-enabled/default

# Enable mims site
ln -sf /etc/nginx/sites-available/mims /etc/nginx/sites-enabled/mims

nginx -t >/dev/null 2>&1 || die "Nginx config test failed. Check /etc/nginx/sites-available/mims"
systemctl enable nginx --quiet
systemctl reload nginx
success "Nginx configured and reloaded."

# ─── 14. Firewall ─────────────────────────────────────────────────
info "Configuring UFW firewall…"
ufw allow 22/tcp  comment "SSH"      >/dev/null 2>&1 || true
ufw allow 80/tcp  comment "HTTP"     >/dev/null 2>&1 || true
ufw allow 443/tcp comment "HTTPS"    >/dev/null 2>&1 || true
ufw --force enable >/dev/null 2>&1 || true
success "Firewall: SSH, HTTP, HTTPS allowed."

# ─── 15. Run database migrations + start apps ────────────────────
info "Running database migrations via PM2 (start.sh handles prisma migrate deploy)…"
pm2 start "$APP_DIR/ecosystem.config.js" --only mims-backend

# Give backend 10 seconds to migrate and start
info "Waiting 15 s for backend to start and run migrations…"
sleep 15

if pm2 show mims-backend | grep -q "online"; then
    success "Backend is online."
else
    warn "Backend may not be running. Check logs: pm2 logs mims-backend"
fi

info "Starting frontend…"
pm2 start "$APP_DIR/ecosystem.config.js" --only mims-frontend
sleep 5

if pm2 show mims-frontend | grep -q "online"; then
    success "Frontend is online."
else
    warn "Frontend may not be running. Check logs: pm2 logs mims-frontend"
fi

# ─── 16. PM2 auto-start on server reboot ─────────────────────────
info "Setting PM2 to start on system boot…"
pm2 save
env PATH="$PATH:/usr/bin" pm2 startup systemd -u root --hp /root | tail -1 | bash
success "PM2 startup configured."

# ─── 17. Final status ─────────────────────────────────────────────
echo ""
echo -e "${GREEN}============================================================${NC}"
echo -e "${GREEN}  M-IMS Installation Complete!${NC}"
echo -e "${GREEN}============================================================${NC}"
echo ""
echo "  App directory    : $APP_DIR"
echo "  Backend logs     : pm2 logs mims-backend"
echo "  Frontend logs    : pm2 logs mims-frontend"
echo "  PM2 status       : pm2 status"
echo ""
echo -e "${YELLOW}  ⚠  Place your license.key into:${NC}"
echo -e "${YELLOW}       $BACKEND_DIR/license.key${NC}"
echo -e "${YELLOW}     then restart the backend:${NC}"
echo -e "${YELLOW}       pm2 restart mims-backend${NC}"
echo ""
echo "  Access the app at:"
echo "    http://$(hostname -I | awk '{print $1}')"
echo ""
echo "  Quick health check:"
echo "    curl -s http://localhost:3001/api/health"
echo ""
