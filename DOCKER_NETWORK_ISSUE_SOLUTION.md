# 🔧 Docker Network Issue - Solutions

## Problem
Docker cannot pull images from Docker Hub due to network authentication issue:
```
Error: failed to authorize: failed to fetch oauth token: Post "https://auth.docker.io/token": unexpected EOF
```

---

## 🚀 **SOLUTION 1: Fix Docker Network (Recommended)**

### Option A: Restart Docker Desktop
```bash
# Quit Docker Desktop completely
# Open Applications → Docker → Quit Docker Desktop

# Wait 10 seconds

# Restart Docker Desktop from Applications

# Wait for Docker to fully start (check menu bar icon)

# Try again
cd /Users/macbook/Hospital-Medicine-IMS
docker compose up -d postgres redis
```

### Option B: Reset Docker Network Settings
```bash
# In Docker Desktop:
# 1. Click Docker icon in menu bar
# 2. Settings → Resources → Network
# 3. Try toggling "Use kernel networking for UDP"
# 4. Apply & Restart

# OR reset DNS
# Settings → Docker Engine → Add:
{
  "dns": ["8.8.8.8", "8.8.4.4"]
}
```

### Option C: Login to Docker Hub
```bash
# Create free Docker Hub account at: https://hub.docker.com

# Login via terminal
docker login

# Enter your username and password

# Try pulling images again
docker compose up -d postgres redis
```

### Option D: Use Offline Cache
```bash
# If you have internet issues, try:
# 1. Use mobile hotspot temporarily
# 2. Pull images on better network
# 3. Images are cached locally after first pull
```

---

## 🚀 **SOLUTION 2: Install PostgreSQL Locally (Alternative)**

If Docker continues to have issues, use local PostgreSQL:

### Step 1: Install Homebrew (if not installed)
```bash
# Install Homebrew
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

# Follow the installation prompts
```

### Step 2: Install PostgreSQL
```bash
# Install PostgreSQL 16
brew install postgresql@16

# Start PostgreSQL service
brew services start postgresql@16

# Verify it's running
brew services list | grep postgres
# Should show: postgresql@16  started
```

### Step 3: Create Database
```bash
# Create database
createdb mims_dev

# Create user (if needed)
psql postgres -c "CREATE USER postgres WITH PASSWORD 'password' SUPERUSER;"

# Or use default user
psql postgres -c "ALTER USER $(whoami) WITH PASSWORD 'password';"
```

### Step 4: Update Backend .env
```bash
cd /Users/macbook/Hospital-Medicine-IMS/mims/backend

# Edit .env file - Change DATABASE_URL to:
DATABASE_URL="postgresql://postgres:password@localhost:5432/mims_dev"

# Or if using your macOS user:
# DATABASE_URL="postgresql://$(whoami):password@localhost:5432/mims_dev"
```

### Step 5: Install Redis (Optional)
```bash
# Install Redis
brew install redis

# Start Redis service
brew services start redis

# Verify
redis-cli ping
# Should respond: PONG
```

---

## 🎯 **RECOMMENDED QUICK FIX**

### Try This First:
```bash
# 1. Restart Docker Desktop
# Menu bar → Docker icon → Quit Docker Desktop
# Wait 10 seconds
# Reopen Docker Desktop

# 2. Wait for Docker to fully start (green light in menu bar)

# 3. Try pulling a small image first
docker pull hello-world

# 4. If that works, pull PostgreSQL
docker pull postgres:16-alpine

# 5. If that works, start services
cd /Users/macbook/Hospital-Medicine-IMS
docker compose up -d postgres redis
```

### If Still Failing - Use Local PostgreSQL:
```bash
# Install Homebrew (one-time)
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

# Install PostgreSQL
brew install postgresql@16

# Start service
brew services start postgresql@16

# Create database
createdb mims_dev

# Update .env
cd /Users/macbook/Hospital-Medicine-IMS/mims/backend
# Edit DATABASE_URL in .env to: postgresql://$(whoami):@localhost:5432/mims_dev
```

---

## ✅ **Once Database is Ready - Run Migration**

After either Docker or local PostgreSQL is working:

```bash
cd /Users/macbook/Hospital-Medicine-IMS/mims/backend

# Test connection
npm run prisma:studio
# If Studio opens, connection works!

# Run migration
npm run prisma:migrate -- --name initial_schema

# Expected output:
# ✓ Created migration: 20251120XXXXXX_initial_schema
# ✓ Applied migration
# ✓ Generated Prisma Client

# Verify tables created
npm run prisma:studio
# You should see all 20+ tables in the UI
```

---

## 🔍 **Verify Everything Works**

```bash
# Check PostgreSQL
psql mims_dev -c "\dt"
# Should list all tables

# Check Redis (if using Docker)
docker compose exec redis redis-cli ping
# Should respond: PONG

# Or local Redis
redis-cli ping

# Check backend connection
cd /Users/macbook/Hospital-Medicine-IMS/mims/backend
npm run start:dev
# Should start without errors
# API: http://localhost:3001
```

---

## 📞 **Need More Help?**

If none of these work, please share:
1. Docker Desktop version: `docker --version`
2. macOS version: `sw_vers`
3. Network type (WiFi/Ethernet/VPN)
4. Any corporate firewall/proxy settings

**Most Common Fix:** Just restart Docker Desktop and wait for it to fully initialize! 🔄
