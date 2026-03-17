#!/bin/bash
# M-IMS Backend — Production Startup
# =====================================
# Prerequisites:
#   - license.key must be in the same directory as this script
#   - .env file must be configured
#   - PostgreSQL and Redis must be running
# =====================================
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

# Load environment
if [ -f ".env" ]; then
  export $(grep -v '^#' .env | xargs)
fi

# Validate license file
if [ ! -f "license.key" ]; then
  echo "❌ ERROR: license.key not found. Cannot start application."
  exit 1
fi

# Run database migrations
echo "🔄 Running database migrations…"
npx prisma migrate deploy --schema=./prisma/schema.prisma 2>/dev/null || true

# Start the application
echo "🚀 Starting M-IMS Backend…"
exec node app/main.js
