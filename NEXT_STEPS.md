# 🚀 Next Steps - Database Setup

## Current Status
✅ Backend dependencies installed  
✅ Prisma schema created with versioning  
✅ Offline-first sync architecture implemented  
✅ Environment configuration ready  

⏳ **NEXT: Initialize development database**

---

## 📋 **OPTION 1: Docker Setup (Recommended)**

Docker is **not currently installed** on your Mac. Here's how to set it up:

### Step 1: Install Docker Desktop for Mac

```bash
# Option A: Download from website
# Visit: https://www.docker.com/products/docker-desktop
# Download and install Docker Desktop for Mac

# Option B: Install with Homebrew (if you have it)
brew install --cask docker

# After installation, start Docker Desktop from Applications
```

### Step 2: Verify Docker Installation

```bash
docker --version
# Should show: Docker version 24.x.x or newer

docker compose version
# Should show: Docker Compose version v2.x.x
```

### Step 3: Start Development Services

```bash
cd /Users/macbook/Hospital-Medicine-IMS/mims/backend

# Start all services (PostgreSQL, Redis, MinIO, Adminer, Redis Commander)
docker compose up -d

# Check if services are running
docker compose ps

# Expected output:
# postgres     running    0.0.0.0:5432->5432/tcp
# redis        running    0.0.0.0:6379->6379/tcp
# minio        running    0.0.0.0:9000->9000/tcp
# adminer      running    0.0.0.0:8080->8080/tcp
# redis-ui     running    0.0.0.0:8081->8081/tcp
```

### Step 4: Run Database Migration

```bash
cd /Users/macbook/Hospital-Medicine-IMS/mims/backend

# Create initial migration
npm run prisma:migrate -- --name initial_schema

# This will:
# 1. Connect to PostgreSQL (localhost:5432)
# 2. Create all database tables from schema.prisma
# 3. Generate migration files in prisma/migrations/
```

### Step 5: Seed Database (Optional)

```bash
# Create seed script first
npm run prisma:seed

# Or manually insert test data using Adminer
# Open: http://localhost:8080
# System: PostgreSQL
# Server: postgres
# Username: postgres
# Password: postgres
# Database: mims
```

---

## 📋 **OPTION 2: Local PostgreSQL Setup**

If you prefer not to use Docker, install PostgreSQL directly:

### Step 1: Install PostgreSQL with Homebrew

```bash
# Install PostgreSQL 16
brew install postgresql@16

# Start PostgreSQL service
brew services start postgresql@16

# Create database
createdb mims

# Create user (if needed)
psql postgres -c "CREATE USER postgres WITH PASSWORD 'postgres' SUPERUSER;"
```

### Step 2: Update .env File

```bash
cd /Users/macbook/Hospital-Medicine-IMS/mims/backend

# Edit .env file
# Change DATABASE_URL to:
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/mims"
```

### Step 3: Run Migration

```bash
npm run prisma:migrate -- --name initial_schema
```

### Step 4: Install Redis (Optional but recommended)

```bash
brew install redis
brew services start redis
```

---

## 🎯 **RECOMMENDED: Quick Start with Docker**

Since you need the complete stack (PostgreSQL + Redis + MinIO), **Docker Desktop is the easiest option**.

### Complete Installation Flow:

```bash
# 1. Install Docker Desktop for Mac
brew install --cask docker
# OR download from: https://www.docker.com/products/docker-desktop

# 2. Start Docker Desktop application
# Open from Applications folder

# 3. Verify installation
docker --version
docker compose version

# 4. Start services
cd /Users/macbook/Hospital-Medicine-IMS/mims/backend
docker compose up -d

# 5. Wait for services to be ready (10-15 seconds)
docker compose logs -f postgres
# Press Ctrl+C when you see "database system is ready to accept connections"

# 6. Run migration
npm run prisma:migrate -- --name initial_schema

# 7. Verify database
docker compose exec postgres psql -U postgres -d mims -c "\dt"
# Should list all your tables

# 8. Access tools
# Adminer (DB GUI):     http://localhost:8080
# Redis Commander:      http://localhost:8081
# MinIO Console:        http://localhost:9001
```

---

## ✅ **After Database is Ready**

Once migration completes successfully, you'll be ready to:

1. **Start Backend API**
   ```bash
   cd /Users/macbook/Hospital-Medicine-IMS/mims/backend
   npm run start:dev
   # API will run on: http://localhost:3001
   ```

2. **Setup Frontend**
   ```bash
   cd /Users/macbook/Hospital-Medicine-IMS/mims/frontend
   npx shadcn-ui@latest init
   # Follow prompts to configure
   ```

3. **Start Frontend**
   ```bash
   npm run dev
   # Frontend will run on: http://localhost:3000
   ```

4. **Test Sync Service**
   ```bash
   cd /Users/macbook/Hospital-Medicine-IMS/mims/local-sync
   npm install
   npm run start:dev
   # Sync service status: http://localhost:3002/status
   ```

---

## 🔍 **Troubleshooting**

### Docker Desktop won't start
```bash
# Check if already running
ps aux | grep Docker

# Kill existing processes
killall Docker

# Restart from Applications
```

### Port conflicts (e.g., 5432 already in use)
```bash
# Check what's using the port
sudo lsof -i :5432

# Kill the process or stop existing PostgreSQL
brew services stop postgresql
# or
sudo pkill -u postgres
```

### Migration fails
```bash
# Check connection
cd /Users/macbook/Hospital-Medicine-IMS/mims/backend
npm run prisma:studio
# If Studio opens, connection works

# Reset database if needed (CAUTION: deletes all data)
npm run prisma:migrate:reset
```

---

## 📝 **Summary**

**IMMEDIATE ACTION REQUIRED:**

```bash
# Install Docker Desktop (easiest path)
brew install --cask docker

# Or download from:
# https://www.docker.com/products/docker-desktop
```

Once Docker is running, execute:
```bash
cd /Users/macbook/Hospital-Medicine-IMS/mims/backend
docker compose up -d
npm run prisma:migrate -- --name initial_schema
```

**Then you'll be ready to start building features!** 🚀
