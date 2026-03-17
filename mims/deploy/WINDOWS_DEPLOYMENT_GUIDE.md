# M-IMS Complete Windows Deployment Guide
### From Development to Production - Complete End-to-End Guide
**Version 1.0 · February 2026**

---

> **This guide covers everything:** Setting up development environment, building production packages, creating Windows installer, and deploying to Windows Server. No prior experience required.

---

## 📋 Table of Contents

**PART 1: DEVELOPMENT SETUP**
1. [Setting Up Development Environment](#1-setting-up-development-environment)
2. [Running in Development Mode](#2-running-in-development-mode)
3. [Testing the Application](#3-testing-the-application)

**PART 2: BUILDING FOR PRODUCTION**
4. [Preparing for Production Build](#4-preparing-for-production-build)
5. [Building Protected Backend](#5-building-protected-backend)
6. [Building Optimized Frontend](#6-building-optimized-frontend)
7. [Creating Windows Package](#7-creating-windows-package)

**PART 3: WINDOWS SERVER DEPLOYMENT**
8. [Windows Server Requirements](#8-windows-server-requirements)
9. [Installing Required Software](#9-installing-required-software)
10. [Database Setup](#10-database-setup)
11. [Application Deployment](#11-application-deployment)
12. [Service Configuration](#12-service-configuration)
13. [Security Setup](#13-security-setup)

**PART 4: OPERATIONS & MAINTENANCE**
14. [Testing and Verification](#14-testing-and-verification)
15. [Daily Operations](#15-daily-operations)
16. [Backup and Monitoring](#16-backup-and-monitoring)
17. [Troubleshooting](#17-troubleshooting)

---

# PART 1: DEVELOPMENT SETUP

## 1. Setting Up Development Environment

### 1.1 — Development Machine Requirements

**Your development machine needs:**
- **macOS** 12.0+ or **Linux** Ubuntu 20.04+
- **16GB RAM** minimum (32GB recommended)
- **50GB free space** for development tools and source code
- **Internet connection** for downloading dependencies

### 1.2 — Install Required Tools

**On macOS:**
```bash
# Install Homebrew (package manager)
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

# Install development tools
brew install node@20 postgresql@16 redis git docker

# Install Docker Desktop from https://docker.com/products/docker-desktop
```

**On Linux (Ubuntu):**
```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Node.js 20
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install PostgreSQL and Redis
sudo apt install postgresql postgresql-contrib redis-server -y

# Install Docker
sudo apt install docker.io docker-compose -y
sudo usermod -aG docker $USER

# Install Git
sudo apt install git -y
```

### 1.3 — Clone the Source Code

```bash
# Navigate to your development directory
cd ~/

# Clone the repository (replace with actual repository URL)
git clone https://github.com/your-org/Hospital-Medicine-IMS.git
cd Hospital-Medicine-IMS

# Verify the structure
ls -la
```

You should see:
```
mims/
├── backend/          ← Node.js/NestJS API
├── frontend/         ← Next.js React app
├── deploy/           ← Deployment scripts
└── docker-compose.yml
```

### 1.4 — Set Up Development Database

```bash
# Start PostgreSQL and Redis with Docker
docker-compose up -d postgres redis

# Wait 30 seconds for services to start
sleep 30

# Check if services are running
docker ps
```

You should see containers for `postgres` and `redis` running.

---

## 2. Running in Development Mode

### 2.1 — Install Backend Dependencies

```bash
cd mims/backend

# Install Node.js dependencies
npm install

# Copy environment template
cp .env.example .env

# Edit environment file
nano .env
```

**Update the `.env` file with these values:**
```env
NODE_ENV=development
DATABASE_URL=postgresql://postgres:password@localhost:5432/mims_db
REDIS_URL=redis://localhost:6379
JWT_SECRET=dev-secret-key-change-in-production
JWT_REFRESH_SECRET=dev-refresh-secret-change-in-production
PORT=3001
CORS_ORIGIN=http://localhost:3000
```

Save with `Ctrl+O`, then `Ctrl+X`.

### 2.2 — Initialize Database

```bash
# Generate Prisma client
npx prisma generate

# Run database migrations
npx prisma migrate deploy

# Seed initial data
npx prisma db seed
```

### 2.3 — Start Backend Development Server

```bash
# Start the backend in development mode
npm run start:dev
```

**Keep this terminal open.** You should see:
```
[Nest] Application successfully started on port 3001
```

### 2.4 — Install Frontend Dependencies

**Open a new terminal window:**
```bash
cd ~/Hospital-Medicine-IMS/mims/frontend

# Install dependencies
npm install

# Copy environment template
cp .env.example .env.local

# Edit environment file
nano .env.local
```

**Update `.env.local` with:**
```env
NEXT_PUBLIC_API_URL=http://localhost:3001
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=dev-nextauth-secret
```

### 2.5 — Start Frontend Development Server

```bash
# Start the frontend in development mode
npm run dev
```

**Keep this terminal open.** You should see:
```
✓ Ready on http://localhost:3000
```

### 2.6 — Access the Development Application

1. Open your web browser
2. Navigate to `http://localhost:3000`
3. You should see the M-IMS login page

**Default login credentials:**
- **Email:** `admin@hospital.com`
- **Password:** `admin123`

---

## 3. Testing the Application

### 3.1 — Test Basic Functionality

1. **Login** with default credentials
2. **Navigate** through different modules (Patients, Pharmacy, Reports)
3. **Create a test patient** to verify database connectivity
4. **Check inventory** to verify Redis caching
5. **Generate a report** to verify full functionality

### 3.2 — Run Automated Tests

```bash
# Backend tests
cd ~/Hospital-Medicine-IMS/mims/backend
npm run test

# Frontend tests
cd ~/Hospital-Medicine-IMS/mims/frontend
npm run test
```

### 3.3 — Performance Testing

```bash
# Install testing tools
npm install -g clinic autocannon

# Test backend API performance
autocannon -c 10 -d 30 http://localhost:3001/api/health

# Profile backend performance
cd ~/Hospital-Medicine-IMS/mims/backend
clinic doctor -- node dist/main.js
```

---

# PART 2: BUILDING FOR PRODUCTION

## 4. Preparing for Production Build

### 4.1 — Stop Development Servers

```bash
# Stop both frontend and backend development servers
# Press Ctrl+C in both terminal windows

# Stop Docker services
cd ~/Hospital-Medicine-IMS
docker-compose down
```

### 4.2 — Clean Development Dependencies

```bash
# Clean backend
cd mims/backend
rm -rf node_modules dist
npm cache clean --force

# Clean frontend
cd ../frontend
rm -rf node_modules .next
npm cache clean --force
```

### 4.3 — Update Version Numbers

```bash
cd ~/Hospital-Medicine-IMS/mims

# Update backend version
cd backend
npm version 1.0.0

# Update frontend version
cd ../frontend
npm version 1.0.0
```

---

## 5. Building Protected Backend

### 5.1 — Install Production Dependencies

```bash
cd ~/Hospital-Medicine-IMS/mims/backend

# Install production dependencies
npm ci --production

# Install obfuscation tools
npm install --save-dev javascript-obfuscator webpack webpack-cli
```

### 5.2 — Configure Production Environment

```bash
# Create production environment file
cat > .env.production << 'EOF'
NODE_ENV=production
PORT=3001
DATABASE_URL=postgresql://mims_user:REPLACE_PASSWORD@localhost:5432/mims_db
REDIS_URL=redis://localhost:6379
JWT_SECRET=REPLACE_WITH_STRONG_SECRET
JWT_REFRESH_SECRET=REPLACE_WITH_STRONG_REFRESH_SECRET
CORS_ORIGIN=http://localhost
LOG_LEVEL=info
EOF
```

### 5.3 — Create Obfuscation Configuration

```bash
# Create obfuscation config
cat > obfuscator.config.js << 'EOF'
module.exports = {
  compact: true,
  controlFlowFlattening: true,
  controlFlowFlatteningThreshold: 0.75,
  deadCodeInjection: true,
  deadCodeInjectionThreshold: 0.4,
  debugProtection: true,
  debugProtectionInterval: 2000,
  disableConsoleOutput: true,
  identifierNamesGenerator: 'hexadecimal',
  log: false,
  numbersToExpressions: true,
  renameGlobals: false,
  selfDefending: true,
  simplify: true,
  splitStrings: true,
  splitStringsChunkLength: 10,
  stringArray: true,
  stringArrayCallsTransform: true,
  stringArrayEncoding: ['base64'],
  stringArrayIndexShift: true,
  stringArrayRotate: true,
  stringArrayShuffle: true,
  stringArrayWrappersCount: 2,
  stringArrayWrappersChainedCalls: true,
  stringArrayWrappersParametersMaxCount: 4,
  stringArrayWrappersType: 'function',
  stringArrayThreshold: 0.8,
  transformObjectKeys: true,
  unicodeEscapeSequence: false
};
EOF
```

### 5.4 — Build Production Backend

```bash
# Compile TypeScript to JavaScript
npm run build

# Obfuscate the compiled code
npx javascript-obfuscator dist --config obfuscator.config.js --output dist-protected

# Copy necessary files
cp package.json dist-protected/
cp -r prisma dist-protected/
cp .env.production dist-protected/.env

# Create startup script
cat > dist-protected/start.sh << 'EOF'
#!/bin/bash
cd "$(dirname "$0")"
export NODE_ENV=production
node main.js
EOF

chmod +x dist-protected/start.sh
```

### 5.5 — Verify Protected Build

```bash
# Check the protected build
ls -la dist-protected/

# Test that it starts (will fail without database, but should not throw syntax errors)
cd dist-protected
timeout 5 node main.js || true
cd ..
```

---

## 6. Building Optimized Frontend

### 6.1 — Configure Production Build

```bash
cd ~/Hospital-Medicine-IMS/mims/frontend

# Install production dependencies
npm ci

# Create production environment
cat > .env.production << 'EOF'
NEXT_PUBLIC_API_URL=http://localhost/api
NEXTAUTH_URL=http://localhost
NEXTAUTH_SECRET=REPLACE_WITH_STRONG_SECRET
NODE_ENV=production
EOF
```

### 6.2 — Optimize Next.js Configuration

```bash
# Update next.config.js for production
cat > next.config.js << 'EOF'
/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  poweredByHeader: false,
  compress: true,
  swcMinify: true,
  experimental: {
    outputFileTracingRoot: path.join(__dirname, '../'),
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'Referrer-Policy',
            value: 'origin-when-cross-origin',
          },
        ],
      },
    ]
  },
}

module.exports = nextConfig
EOF
```

### 6.3 — Build Production Frontend

```bash
# Build the frontend for production
NODE_ENV=production npm run build

# Verify build was successful
ls -la .next/
```

You should see a `.next` directory with the built application.

---

## 7. Creating Windows Package

### 7.1 — Create Package Directory Structure

```bash
cd ~/Hospital-Medicine-IMS/mims/deploy

# Create Windows package directory
mkdir -p windows-package/{backend,frontend,database,scripts,config,docs}
```

### 7.2 — Copy Backend Files

```bash
# Copy protected backend
cp -r ../backend/dist-protected/* windows-package/backend/

# Copy additional backend files
cp ../backend/package.json windows-package/backend/package-production.json
```

### 7.3 — Copy Frontend Files

```bash
# Copy built frontend
cp -r ../frontend/.next windows-package/frontend/
cp -r ../frontend/public windows-package/frontend/
cp ../frontend/package.json windows-package/frontend/
cp ../frontend/next.config.js windows-package/frontend/
```

### 7.4 — Copy Database Files

```bash
# Copy database schema and migrations
cp -r ../backend/prisma windows-package/database/
```

### 7.5 — Create Windows Installation Scripts

**Create PowerShell installer:**
```bash
cat > windows-package/scripts/install-windows.ps1 << 'EOF'
# M-IMS Windows Installation Script
# Version 1.0 - February 2026

param(
    [string]$InstallPath = "C:\mims",
    [string]$ServiceUser = "mimsservice",
    [switch]$SkipFirewall = $false
)

# Set error handling
$ErrorActionPreference = "Stop"

Write-Host "============================================================" -ForegroundColor Green
Write-Host "  M-IMS Windows Installation Starting..." -ForegroundColor Green
Write-Host "============================================================" -ForegroundColor Green

# Check if running as Administrator
if (-NOT ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole] "Administrator")) {
    Write-Error "This script must be run as Administrator. Right-click PowerShell and 'Run as Administrator'"
    exit 1
}

# Check PowerShell version
if ($PSVersionTable.PSVersion.Major -lt 5) {
    Write-Error "PowerShell 5.0 or higher is required. Current version: $($PSVersionTable.PSVersion)"
    exit 1
}

# Install Chocolatey if not present
if (!(Get-Command choco -ErrorAction SilentlyContinue)) {
    Write-Host "Installing Chocolatey package manager..." -ForegroundColor Yellow
    Set-ExecutionPolicy Bypass -Scope Process -Force
    [System.Net.ServicePointManager]::SecurityProtocol = [System.Net.ServicePointManager]::SecurityProtocol -bor 3072
    Invoke-Expression ((New-Object System.Net.WebClient).DownloadString('https://community.chocolatey.org/install.ps1'))
    
    # Refresh environment
    $env:PATH = [System.Environment]::GetEnvironmentVariable("PATH","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("PATH","User")
}

# Install required software
Write-Host "Installing Node.js 20..." -ForegroundColor Yellow
choco install nodejs.install --version 20.11.0 -y

Write-Host "Installing PostgreSQL 16..." -ForegroundColor Yellow
choco install postgresql16 --params '/Password:MimsDB2026!' -y

Write-Host "Installing Redis..." -ForegroundColor Yellow
choco install redis-64 -y

Write-Host "Installing Nginx..." -ForegroundColor Yellow
choco install nginx -y

Write-Host "Installing NSSM (Service Manager)..." -ForegroundColor Yellow
choco install nssm -y

# Refresh environment variables
refreshenv
$env:PATH = [System.Environment]::GetEnvironmentVariable("PATH","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("PATH","User")

# Install PM2 globally
Write-Host "Installing PM2 process manager..." -ForegroundColor Yellow
npm install pm2@latest -g
npm install pm2-windows-service -g

# Create installation directory
Write-Host "Creating application directories..." -ForegroundColor Yellow
New-Item -ItemType Directory -Path $InstallPath -Force
New-Item -ItemType Directory -Path "$InstallPath\logs" -Force
New-Item -ItemType Directory -Path "$InstallPath\backups" -Force
New-Item -ItemType Directory -Path "$InstallPath\uploads" -Force

# Copy application files
Write-Host "Copying application files..." -ForegroundColor Yellow
Copy-Item -Path ".\backend\*" -Destination "$InstallPath\backend\" -Recurse -Force
Copy-Item -Path ".\frontend\*" -Destination "$InstallPath\frontend\" -Recurse -Force
Copy-Item -Path ".\database\*" -Destination "$InstallPath\database\" -Recurse -Force

# Create service user
Write-Host "Creating service user..." -ForegroundColor Yellow
try {
    $Password = ConvertTo-SecureString "MimsService2026!" -AsPlainText -Force
    New-LocalUser -Name $ServiceUser -Password $Password -Description "M-IMS Service Account" -UserMayNotChangePassword -PasswordNeverExpires
    Add-LocalGroupMember -Group "IIS_IUSRS" -Member $ServiceUser
} catch {
    Write-Warning "Service user creation failed or user already exists: $($_.Exception.Message)"
}

# Configure PostgreSQL
Write-Host "Configuring PostgreSQL..." -ForegroundColor Yellow
Start-Service postgresql-x64-16
Start-Sleep 10

# Create database and user
$env:PGPASSWORD = "MimsDB2026!"
& "C:\Program Files\PostgreSQL\16\bin\psql.exe" -U postgres -h localhost -c "CREATE DATABASE mims_db;"
& "C:\Program Files\PostgreSQL\16\bin\psql.exe" -U postgres -h localhost -c "CREATE USER mims_user WITH PASSWORD 'StrongPassword123!';"
& "C:\Program Files\PostgreSQL\16\bin\psql.exe" -U postgres -h localhost -c "GRANT ALL PRIVILEGES ON DATABASE mims_db TO mims_user;"
& "C:\Program Files\PostgreSQL\16\bin\psql.exe" -U postgres -h localhost -c "ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO mims_user;"
& "C:\Program Files\PostgreSQL\16\bin\psql.exe" -U postgres -h localhost -c "ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO mims_user;"

# Configure Redis
Write-Host "Configuring Redis..." -ForegroundColor Yellow
Set-Service Redis -StartupType Automatic
Start-Service Redis

# Set up firewall rules
if (-not $SkipFirewall) {
    Write-Host "Configuring Windows Firewall..." -ForegroundColor Yellow
    New-NetFirewallRule -DisplayName "M-IMS HTTP" -Direction Inbound -Protocol TCP -LocalPort 80 -Action Allow -ErrorAction SilentlyContinue
    New-NetFirewallRule -DisplayName "M-IMS HTTPS" -Direction Inbound -Protocol TCP -LocalPort 443 -Action Allow -ErrorAction SilentlyContinue
}

# Install Node.js dependencies
Write-Host "Installing backend dependencies..." -ForegroundColor Yellow
cd "$InstallPath\backend"
npm ci --production

Write-Host "Installing frontend dependencies..." -ForegroundColor Yellow
cd "$InstallPath\frontend"
npm ci --production

# Configure PM2
Write-Host "Configuring PM2..." -ForegroundColor Yellow
pm2-service-install -n PM2

# Create PM2 ecosystem file
$ecosystemConfig = @"
module.exports = {
  apps: [
    {
      name: 'mims-backend',
      script: 'main.js',
      cwd: '$InstallPath\\backend',
      instances: 1,
      exec_mode: 'cluster',
      env: {
        NODE_ENV: 'production',
        PORT: 3001
      },
      log_file: '$InstallPath\\logs\\backend.log',
      error_file: '$InstallPath\\logs\\backend-error.log',
      out_file: '$InstallPath\\logs\\backend-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm Z',
      max_memory_restart: '1G',
      node_args: '--max-old-space-size=1024'
    },
    {
      name: 'mims-frontend',
      script: 'server.js',
      cwd: '$InstallPath\\frontend',
      instances: 1,
      exec_mode: 'cluster',
      env: {
        NODE_ENV: 'production',
        PORT: 3000
      },
      log_file: '$InstallPath\\logs\\frontend.log',
      error_file: '$InstallPath\\logs\\frontend-error.log',
      out_file: '$InstallPath\\logs\\frontend-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm Z',
      max_memory_restart: '512M'
    }
  ]
};
"@

$ecosystemConfig | Out-File -FilePath "$InstallPath\ecosystem.config.js" -Encoding UTF8

# Configure Nginx
Write-Host "Configuring Nginx..." -ForegroundColor Yellow
$nginxConfig = @"
events {
    worker_connections 1024;
}

http {
    include       mime.types;
    default_type  application/octet-stream;
    
    sendfile        on;
    keepalive_timeout  65;
    
    # Gzip compression
    gzip on;
    gzip_comp_level 6;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml application/xml+rss text/javascript;
    
    # Rate limiting
    limit_req_zone `$binary_remote_addr zone=api:10m rate=10r/s;
    
    upstream backend {
        server 127.0.0.1:3001;
    }
    
    upstream frontend {
        server 127.0.0.1:3000;
    }
    
    server {
        listen 80;
        server_name localhost;
        
        # Security headers
        add_header X-Frame-Options DENY;
        add_header X-Content-Type-Options nosniff;
        add_header X-XSS-Protection "1; mode=block";
        
        # API routes
        location /api/ {
            limit_req zone=api burst=20 nodelay;
            proxy_pass http://backend;
            proxy_http_version 1.1;
            proxy_set_header Upgrade `$http_upgrade;
            proxy_set_header Connection 'upgrade';
            proxy_set_header Host `$host;
            proxy_set_header X-Real-IP `$remote_addr;
            proxy_set_header X-Forwarded-For `$proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto `$scheme;
            proxy_cache_bypass `$http_upgrade;
            proxy_read_timeout 300s;
            proxy_connect_timeout 75s;
        }
        
        # Frontend routes
        location / {
            proxy_pass http://frontend;
            proxy_http_version 1.1;
            proxy_set_header Upgrade `$http_upgrade;
            proxy_set_header Connection 'upgrade';
            proxy_set_header Host `$host;
            proxy_set_header X-Real-IP `$remote_addr;
            proxy_set_header X-Forwarded-For `$proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto `$scheme;
            proxy_cache_bypass `$http_upgrade;
        }
        
        # Static files
        location /_next/static {
            proxy_pass http://frontend;
            expires 1y;
            add_header Cache-Control "public, immutable";
        }
    }
}
"@

$nginxConfig | Out-File -FilePath "C:\nginx\conf\nginx.conf" -Encoding UTF8

# Create Nginx service
nssm install "M-IMS-Nginx" "C:\nginx\nginx.exe"
nssm set "M-IMS-Nginx" AppDirectory "C:\nginx"
nssm set "M-IMS-Nginx" DisplayName "M-IMS Nginx Web Server"
nssm set "M-IMS-Nginx" Description "Web server for M-IMS Hospital Management System"
nssm set "M-IMS-Nginx" Start SERVICE_AUTO_START

# Set file permissions
Write-Host "Setting file permissions..." -ForegroundColor Yellow
icacls "$InstallPath" /grant "IIS_IUSRS:(OI)(CI)RX" /T
icacls "$InstallPath\logs" /grant "IIS_IUSRS:(OI)(CI)F"
icacls "$InstallPath\backups" /grant "IIS_IUSRS:(OI)(CI)F"
icacls "$InstallPath\uploads" /grant "IIS_IUSRS:(OI)(CI)F"

Write-Host "============================================================" -ForegroundColor Green
Write-Host "  M-IMS Windows Installation Complete!" -ForegroundColor Green
Write-Host "============================================================" -ForegroundColor Green
Write-Host ""
Write-Host "Next Steps:" -ForegroundColor Yellow
Write-Host "1. Copy license.key to $InstallPath\license.key" -ForegroundColor White
Write-Host "2. Edit $InstallPath\.env with your configuration" -ForegroundColor White
Write-Host "3. Run: pm2 start $InstallPath\ecosystem.config.js" -ForegroundColor White
Write-Host "4. Run: Start-Service M-IMS-Nginx" -ForegroundColor White
Write-Host ""
Write-Host "The application will be available at: http://localhost" -ForegroundColor Green
EOF
```

### 7.6 — Create Configuration Templates

**Create Nginx configuration:**
```bash
cat > windows-package/config/nginx.conf << 'EOF'
events {
    worker_connections 1024;
}

http {
    include       mime.types;
    default_type  application/octet-stream;
    
    sendfile        on;
    keepalive_timeout  65;
    client_max_body_size 100M;
    
    # Gzip compression
    gzip on;
    gzip_comp_level 6;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml application/xml+rss text/javascript;
    
    # Rate limiting
    limit_req_zone $binary_remote_addr zone=api:10m rate=10r/s;
    
    upstream backend {
        server 127.0.0.1:3001;
        keepalive 32;
    }
    
    upstream frontend {
        server 127.0.0.1:3000;
        keepalive 32;
    }
    
    server {
        listen 80;
        server_name localhost;
        
        # Security headers
        add_header X-Frame-Options DENY;
        add_header X-Content-Type-Options nosniff;
        add_header X-XSS-Protection "1; mode=block";
        add_header Referrer-Policy "strict-origin-when-cross-origin";
        
        # API routes
        location /api/ {
            limit_req zone=api burst=20 nodelay;
            proxy_pass http://backend;
            proxy_http_version 1.1;
            proxy_set_header Upgrade $http_upgrade;
            proxy_set_header Connection 'upgrade';
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
            proxy_cache_bypass $http_upgrade;
            proxy_read_timeout 300s;
            proxy_connect_timeout 75s;
        }
        
        # Frontend routes
        location / {
            proxy_pass http://frontend;
            proxy_http_version 1.1;
            proxy_set_header Upgrade $http_upgrade;
            proxy_set_header Connection 'upgrade';
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
            proxy_cache_bypass $http_upgrade;
        }
        
        # Static assets with caching
        location /_next/static {
            proxy_pass http://frontend;
            expires 1y;
            add_header Cache-Control "public, immutable";
        }
        
        # Health check
        location /health {
            access_log off;
            return 200 "healthy\n";
            add_header Content-Type text/plain;
        }
    }
}
EOF
```

**Create PM2 ecosystem configuration:**
```bash
cat > windows-package/config/pm2.ecosystem.js << 'EOF'
module.exports = {
  apps: [
    {
      name: 'mims-backend',
      script: 'main.js',
      cwd: 'C:\\mims\\backend',
      instances: 1,
      exec_mode: 'cluster',
      env: {
        NODE_ENV: 'production',
        PORT: 3001
      },
      log_file: 'C:\\mims\\logs\\backend.log',
      error_file: 'C:\\mims\\logs\\backend-error.log',
      out_file: 'C:\\mims\\logs\\backend-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm Z',
      max_memory_restart: '1G',
      node_args: '--max-old-space-size=1024',
      kill_timeout: 5000,
      restart_delay: 5000
    },
    {
      name: 'mims-frontend',
      script: 'server.js',
      cwd: 'C:\\mims\\frontend',
      instances: 1,
      exec_mode: 'cluster',
      env: {
        NODE_ENV: 'production',
        PORT: 3000,
        HOSTNAME: '0.0.0.0'
      },
      log_file: 'C:\\mims\\logs\\frontend.log',
      error_file: 'C:\\mims\\logs\\frontend-error.log',
      out_file: 'C:\\mims\\logs\\frontend-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm Z',
      max_memory_restart: '512M',
      kill_timeout: 5000,
      restart_delay: 5000
    }
  ]
};
EOF
```

**Create environment template:**
```bash
cat > windows-package/config/.env.template << 'EOF'
# M-IMS Production Environment
# Replace all REPLACE_* values before installation

NODE_ENV=production
APP_VERSION=1.0.0

# Server Configuration
SERVER_IP=REPLACE_WITH_SERVER_IP
PORT=3001
HOSTNAME=0.0.0.0

# Database Configuration
DATABASE_URL=postgresql://mims_user:REPLACE_WITH_DB_PASSWORD@localhost:5432/mims_db
DB_HOST=localhost
DB_PORT=5432
DB_USERNAME=mims_user
DB_PASSWORD=REPLACE_WITH_DB_PASSWORD
DB_NAME=mims_db

# Redis Configuration
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=REPLACE_WITH_REDIS_PASSWORD
REDIS_URL=redis://localhost:6379

# JWT Configuration
JWT_SECRET=REPLACE_WITH_64_CHAR_SECRET
JWT_REFRESH_SECRET=REPLACE_WITH_64_CHAR_REFRESH_SECRET
JWT_EXPIRY=24h
JWT_REFRESH_EXPIRY=7d

# NextAuth Configuration
NEXTAUTH_SECRET=REPLACE_WITH_32_CHAR_SECRET
NEXTAUTH_URL=http://REPLACE_WITH_SERVER_IP

# Application URLs
NEXT_PUBLIC_API_URL=http://REPLACE_WITH_SERVER_IP/api
API_URL=http://localhost:3001

# File Upload Configuration
UPLOAD_PATH=C:/mims/uploads
MAX_FILE_SIZE=10485760
ALLOWED_FILE_TYPES=.jpg,.jpeg,.png,.pdf,.doc,.docx

# Logging Configuration
LOG_LEVEL=info
LOG_FILE_PATH=C:/mims/logs/application.log
LOG_MAX_FILES=10
LOG_MAX_SIZE=10m

# License Configuration
LICENSE_KEY_PATH=C:/mims/license.key

# Security Configuration
BCRYPT_ROUNDS=12
CORS_ORIGIN=http://REPLACE_WITH_SERVER_IP
RATE_LIMIT_WINDOW=15
RATE_LIMIT_MAX_REQUESTS=100
SESSION_SECRET=REPLACE_WITH_SESSION_SECRET

# Email Configuration (optional)
SMTP_HOST=
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=
SMTP_PASSWORD=

# Backup Configuration
BACKUP_RETENTION_DAYS=30
BACKUP_PATH=C:/mims/backups
EOF
```

### 7.7 — Create Documentation

```bash
cat > windows-package/docs/README.md << 'EOF'
# M-IMS Windows Installation Package

## Package Contents

- `backend/` - Compiled and obfuscated Node.js backend application
- `frontend/` - Built Next.js frontend application  
- `database/` - Database schema and migration files
- `scripts/` - PowerShell installation and management scripts
- `config/` - Configuration templates for services
- `docs/` - Documentation and guides

## System Requirements

- Windows Server 2016/2019/2022 or Windows 10/11 Pro
- 8GB RAM minimum (16GB recommended)
- 100GB free disk space
- Static IP address recommended

## Installation Steps

1. Copy this entire folder to the Windows server
2. Open PowerShell as Administrator
3. Run: `Set-ExecutionPolicy RemoteSigned`
4. Run: `.\scripts\install-windows.ps1`
5. Copy license.key to C:\mims\license.key
6. Edit C:\mims\.env with your configuration
7. Start services: `pm2 start C:\mims\ecosystem.config.js`

## Support

For technical support, contact:
- Email: support@mims.com
- Phone: +92-XXX-XXXXXXX
EOF
```

### 7.8 — Create License Generator

```bash
cat > windows-package/scripts/generate-license.js << 'EOF'
const crypto = require('crypto');
const os = require('os');

function getMachineFingerprint() {
    const networkInterfaces = os.networkInterfaces();
    const cpus = os.cpus();
    
    // Get MAC addresses
    const macAddresses = [];
    Object.values(networkInterfaces).forEach(interfaces => {
        interfaces.forEach(iface => {
            if (iface.mac && iface.mac !== '00:00:00:00:00:00') {
                macAddresses.push(iface.mac);
            }
        });
    });
    
    // Create machine fingerprint
    const fingerprint = {
        hostname: os.hostname(),
        platform: os.platform(),
        arch: os.arch(),
        cpuModel: cpus[0]?.model || 'unknown',
        cpuCount: cpus.length,
        macAddresses: macAddresses.sort(),
        totalMemory: os.totalmem()
    };
    
    return fingerprint;
}

function generateLicense(machineInfo, validityDays = 365) {
    const licenseData = {
        machineInfo,
        generatedAt: new Date().toISOString(),
        validUntil: new Date(Date.now() + validityDays * 24 * 60 * 60 * 1000).toISOString(),
        version: '1.0.0',
        features: ['full']
    };
    
    // Sign the license
    const licenseString = JSON.stringify(licenseData);
    const signature = crypto.createHmac('sha256', 'M1MS-L1C3NS3-K3Y-2026').update(licenseString).digest('hex');
    
    const license = {
        data: licenseData,
        signature
    };
    
    return Buffer.from(JSON.stringify(license)).toString('base64');
}

// Generate license for current machine
const machineInfo = getMachineFingerprint();
const license = generateLicense(machineInfo);

console.log('Machine Fingerprint:');
console.log(JSON.stringify(machineInfo, null, 2));
console.log('\nGenerated License:');
console.log(license);

// Save to file
require('fs').writeFileSync('license.key', license);
console.log('\nLicense saved to license.key');
EOF
```

### 7.9 — Package Everything

```bash
# Create the final package
cd ~/Hospital-Medicine-IMS/mims/deploy
tar -czf mims-windows-package-v1.0.0.tar.gz windows-package/

# Create a USB-friendly zip file
zip -r mims-windows-package-v1.0.0.zip windows-package/

# Verify package contents
ls -la *.tar.gz *.zip
```

---

# PART 3: WINDOWS SERVER DEPLOYMENT

## 8. Windows Server Requirements

### 8.1 — Hardware Requirements

**Minimum Specifications:**
- **CPU:** 4 cores, 2.4GHz
- **RAM:** 8GB
- **Storage:** 100GB SSD
- **Network:** Gigabit Ethernet

**Recommended Specifications:**
- **CPU:** 8 cores, 3.0GHz+
- **RAM:** 16GB+
- **Storage:** 500GB SSD
- **Network:** Gigabit Ethernet with static IP

### 8.2 — Windows Version Compatibility

| Windows Version | Status | Notes |
|-----------------|--------|-------|
| Windows Server 2022 | ✅ **Recommended** | Best performance |
| Windows Server 2019 | ✅ Fully Supported | Tested |
| Windows Server 2016 | ✅ Supported | PowerShell 5.1+ required |
| Windows 11 Pro/Enterprise | ✅ Supported | For smaller deployments |
| Windows 10 Pro (v1903+) | ✅ Minimum Support | Version 1903+ required |

### 8.3 — Pre-Installation Checklist

- [ ] Administrator access to Windows server
- [ ] Internet connection for downloading dependencies
- [ ] USB drive with M-IMS package
- [ ] Static IP address configured
- [ ] Windows Firewall configured or documented
- [ ] Antivirus exclusions planned

---

## 9. Installing Required Software

### 9.1 — Transfer Package to Server

1. **Insert USB** drive into Windows server
2. **Copy** the `mims-windows-package` folder to `C:\mims-install\`
3. **Verify** all files copied correctly

```powershell
# Verify package contents
Get-ChildItem C:\mims-install -Recurse | Measure-Object | Select-Object Count
```

### 9.2 — Run Installation Script

1. **Right-click** Start button → **Windows PowerShell (Admin)**
2. **Navigate** to installation directory:

```powershell
cd C:\mims-install
```

3. **Set execution policy:**

```powershell
Set-ExecutionPolicy RemoteSigned -Scope LocalMachine -Force
```

4. **Run the installer:**

```powershell
.\scripts\install-windows.ps1
```

**Wait 10-15 minutes** for installation to complete.

### 9.3 — Verify Software Installation

```powershell
# Check installed software
node --version
npm --version
pm2 --version

# Check Windows services
Get-Service postgresql*,Redis,PM2 | Format-Table

# Check Nginx
nginx -v
```

---

## 10. Database Setup

### 10.1 — Verify Database Installation

```powershell
# Check PostgreSQL service
Get-Service postgresql-x64-16

# Test connection
$env:PGPASSWORD = "MimsDB2026!"
& "C:\Program Files\PostgreSQL\16\bin\psql.exe" -U postgres -h localhost -l
```

### 10.2 — Initialize M-IMS Database

```powershell
cd C:\mims\backend

# Run database migrations
npm run prisma:migrate:deploy

# Seed initial data
npm run prisma:db:seed
```

### 10.3 — Verify Database Setup

```powershell
# Check database tables
$env:PGPASSWORD = "StrongPassword123!"
& "C:\Program Files\PostgreSQL\16\bin\psql.exe" -U mims_user -d mims_db -c "\dt"
```

You should see tables like `User`, `Hospital`, `Patient`, `Medicine`, etc.

---

## 11. Application Deployment

### 11.1 — Configure Environment Variables

```powershell
# Copy environment template
Copy-Item C:\mims-install\config\.env.template C:\mims\.env

# Edit environment file
notepad C:\mims\.env
```

**Replace all placeholder values:**
- `REPLACE_WITH_SERVER_IP` → Actual server IP (e.g., `192.168.1.100`)
- `REPLACE_WITH_DB_PASSWORD` → `StrongPassword123!`
- `REPLACE_WITH_REDIS_PASSWORD` → `RedisPass2026!`
- Generate secrets using PowerShell:

```powershell
# Generate JWT secret (64 characters)
$jwtSecret = -join ((65..90)+(97..122)+(48..57) | Get-Random -Count 64 | ForEach-Object {[char]$_})
Write-Output "JWT_SECRET=$jwtSecret"

# Generate refresh secret (64 characters)
$refreshSecret = -join ((65..90)+(97..122)+(48..57) | Get-Random -Count 64 | ForEach-Object {[char]$_})
Write-Output "JWT_REFRESH_SECRET=$refreshSecret"

# Generate NextAuth secret (32 characters)
$nextAuthSecret = -join ((65..90)+(97..122)+(48..57) | Get-Random -Count 32 | ForEach-Object {[char]$_})
Write-Output "NEXTAUTH_SECRET=$nextAuthSecret"
```

### 11.2 — Generate and Install License Key

```powershell
cd C:\mims-install\scripts

# Generate license for this machine
node generate-license.js

# Copy license to application directory
Copy-Item license.key C:\mims\license.key

# Verify license file
Test-Path C:\mims\license.key
```

### 11.3 — Install Dependencies

```powershell
# Backend dependencies
cd C:\mims\backend
npm ci --production

# Frontend dependencies  
cd C:\mims\frontend
npm ci --production
```

---

## 12. Service Configuration

### 12.1 — Configure PM2 Process Manager

```powershell
# Copy PM2 configuration
Copy-Item C:\mims-install\config\pm2.ecosystem.js C:\mims\ecosystem.config.js

# Install PM2 as Windows service
pm2-service-install -n PM2

# Start PM2 applications
pm2 start C:\mims\ecosystem.config.js

# Verify applications started
pm2 status
```

You should see both `mims-backend` and `mims-frontend` as **online**.

### 12.2 — Configure Nginx Web Server

```powershell
# Stop default Nginx service if running
Stop-Service nginx -ErrorAction SilentlyContinue

# Copy custom configuration
Copy-Item C:\mims-install\config\nginx.conf C:\nginx\conf\nginx.conf -Force

# Test configuration
nginx -t
```

### 12.3 — Setup Nginx as Windows Service

```powershell
# Create Nginx service
nssm install "M-IMS-Nginx" "C:\nginx\nginx.exe"
nssm set "M-IMS-Nginx" AppDirectory "C:\nginx"
nssm set "M-IMS-Nginx" DisplayName "M-IMS Nginx Web Server"
nssm set "M-IMS-Nginx" Start SERVICE_AUTO_START

# Start Nginx service
Start-Service "M-IMS-Nginx"

# Verify service status
Get-Service "M-IMS-Nginx"
```

### 12.4 — Configure Automatic Startup

```powershell
# Save PM2 configuration
pm2 save

# Create startup script
$startupScript = @"
# M-IMS Service Startup Script
Write-Host "Starting M-IMS services..." -ForegroundColor Green

# Ensure services start in correct order
Start-Service postgresql-x64-16
Start-Sleep 5
Start-Service Redis
Start-Sleep 5
Start-Service PM2
Start-Sleep 10
Start-Service M-IMS-Nginx

Write-Host "M-IMS services started successfully!" -ForegroundColor Green
"@

$startupScript | Out-File C:\mims\scripts\startup.ps1 -Encoding UTF8

# Create scheduled task for startup
$action = New-ScheduledTaskAction -Execute "PowerShell.exe" -Argument "-WindowStyle Hidden -ExecutionPolicy Bypass -File C:\mims\scripts\startup.ps1"
$trigger = New-ScheduledTaskTrigger -AtStartup
$principal = New-ScheduledTaskPrincipal -UserID "SYSTEM" -LogonType ServiceAccount -RunLevel Highest

Register-ScheduledTask -TaskName "M-IMS Startup" -Action $action -Trigger $trigger -Principal $principal -Description "Start M-IMS services on boot"
```

---

## 13. Security Setup

### 13.1 — Configure Windows Firewall

```powershell
# Allow HTTP traffic
New-NetFirewallRule -DisplayName "M-IMS HTTP" -Direction Inbound -Protocol TCP -LocalPort 80 -Action Allow

# Allow HTTPS traffic (optional)
New-NetFirewallRule -DisplayName "M-IMS HTTPS" -Direction Inbound -Protocol TCP -LocalPort 443 -Action Allow

# Verify firewall rules
Get-NetFirewallRule -DisplayName "*M-IMS*"
```

### 13.2 — Set File Permissions

```powershell
# Secure application directory
icacls "C:\mims" /remove "Users" /T
icacls "C:\mims" /grant "IIS_IUSRS:(OI)(CI)RX" /T
icacls "C:\mims\logs" /grant "IIS_IUSRS:(OI)(CI)F"
icacls "C:\mims\backups" /grant "IIS_IUSRS:(OI)(CI)F"

# Protect sensitive files
icacls "C:\mims\.env" /grant "Administrators:F"
icacls "C:\mims\.env" /remove "Users"
icacls "C:\mims\license.key" /grant "Administrators:R"
icacls "C:\mims\license.key" /remove "Users"
```

### 13.3 — Configure Windows Defender Exclusions

```powershell
# Add process exclusions
Add-MpPreference -ExclusionProcess "node.exe"
Add-MpPreference -ExclusionProcess "nginx.exe"
Add-MpPreference -ExclusionProcess "postgres.exe"
Add-MpPreference -ExclusionProcess "redis-server.exe"

# Add path exclusions
Add-MpPreference -ExclusionPath "C:\mims"
Add-MpPreference -ExclusionPath "C:\nginx"
Add-MpPreference -ExclusionPath "C:\Program Files\PostgreSQL\16"
```

---

# PART 4: OPERATIONS & MAINTENANCE

## 14. Testing and Verification

### 14.1 — Test Service Status

```powershell
# Check all Windows services
Get-Service postgresql-x64-16,Redis,PM2,M-IMS-Nginx | Format-Table

# Check PM2 applications
pm2 status

# Check application logs
pm2 logs --lines 10
```

### 14.2 — Test Database Connectivity

```powershell
# Test backend database connection
cd C:\mims\backend
node -e "const { PrismaClient } = require('@prisma/client'); const prisma = new PrismaClient(); prisma.\$queryRaw\`SELECT version()\`.then(console.log).finally(() => process.exit(0));"
```

### 14.3 — Test Web Access

```powershell
# Test local access
Invoke-WebRequest -Uri "http://localhost" -UseBasicParsing

# Test API endpoint
Invoke-WebRequest -Uri "http://localhost/api/health" -UseBasicParsing
```

### 14.4 — Test External Access

**From another computer on the network:**
1. Open web browser
2. Navigate to `http://SERVER_IP` (replace with actual IP)
3. Verify M-IMS login page loads
4. Test login with default credentials

---

## 15. Daily Operations

### 15.1 — Service Management Commands

```powershell
# Check service status
pm2 status
Get-Service postgresql-x64-16,Redis,M-IMS-Nginx | Format-Table

# Restart individual services
pm2 restart mims-backend
pm2 restart mims-frontend
Restart-Service M-IMS-Nginx

# Restart all services
pm2 restart all
Restart-Service postgresql-x64-16,Redis,M-IMS-Nginx
```

### 15.2 — Log Management

```powershell
# View PM2 logs
pm2 logs --lines 50
pm2 logs mims-backend --lines 20
pm2 logs mims-frontend --lines 20

# View Nginx logs
Get-Content "C:\nginx\logs\access.log" -Tail 20
Get-Content "C:\nginx\logs\error.log" -Tail 10

# View application logs
Get-Content "C:\mims\logs\backend.log" -Tail 20
```

### 15.3 — Performance Monitoring

```powershell
# Monitor PM2 processes
pm2 monit

# Check system resources
Get-Counter -Counter "\Processor(_Total)\% Processor Time","\Memory\Available MBytes"

# Check disk space
Get-WmiObject -Class Win32_LogicalDisk | Select-Object DeviceID,Size,FreeSpace
```

---

## 16. Backup and Monitoring

### 16.1 — Manual Database Backup

```powershell
# Create backup with timestamp
$timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
$env:PGPASSWORD = "StrongPassword123!"
& "C:\Program Files\PostgreSQL\16\bin\pg_dump.exe" -U mims_user -h localhost -d mims_db -F c -f "C:\mims\backups\backup_$timestamp.dump"

# Verify backup created
Get-ChildItem "C:\mims\backups\backup_$timestamp.dump"
```

### 16.2 — Automated Backup Script

```powershell
# Create automated backup script
$backupScript = @'
param([int]$RetentionDays = 30)

$BackupDir = "C:\mims\backups"
$timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
$BackupFile = "$BackupDir\backup_$timestamp.dump"

New-Item -ItemType Directory -Path $BackupDir -Force

try {
    $env:PGPASSWORD = "StrongPassword123!"
    & "C:\Program Files\PostgreSQL\16\bin\pg_dump.exe" -U mims_user -h localhost -d mims_db -F c -f $BackupFile
    
    if (Test-Path $BackupFile) {
        Write-Host "Backup created: $BackupFile"
        
        # Clean old backups
        Get-ChildItem $BackupDir -Filter "backup_*.dump" | 
            Where-Object { $_.CreationTime -lt (Get-Date).AddDays(-$RetentionDays) } |
            Remove-Item -Force
    }
} catch {
    Write-Error "Backup failed: $($_.Exception.Message)"
}
'@

$backupScript | Out-File C:\mims\scripts\backup.ps1 -Encoding UTF8
```

### 16.3 — Schedule Automated Backups

```powershell
# Create daily backup task
$action = New-ScheduledTaskAction -Execute "PowerShell.exe" -Argument "-File C:\mims\scripts\backup.ps1"
$trigger = New-ScheduledTaskTrigger -Daily -At "02:00"
$principal = New-ScheduledTaskPrincipal -UserID "SYSTEM" -LogonType ServiceAccount

Register-ScheduledTask -TaskName "M-IMS Daily Backup" -Action $action -Trigger $trigger -Principal $principal
```

---

## 17. Troubleshooting

### 17.1 — Service Won't Start

**Problem:** Applications fail to start

**Diagnosis:**
```powershell
# Check service status
Get-Service postgresql-x64-16,Redis,PM2,M-IMS-Nginx
pm2 status

# Check logs
pm2 logs --lines 20
Get-WinEvent -LogName Application -MaxEvents 10
```

**Solution:**
```powershell
# Restart services in order
Stop-Service PM2,M-IMS-Nginx
Start-Service postgresql-x64-16
Start-Sleep 5
Start-Service Redis
Start-Sleep 5
Start-Service PM2
Start-Sleep 10
Start-Service M-IMS-Nginx
```

### 17.2 — Database Connection Issues

**Problem:** Cannot connect to database

**Diagnosis:**
```powershell
# Test PostgreSQL
Get-Service postgresql-x64-16
$env:PGPASSWORD = "StrongPassword123!"
& "C:\Program Files\PostgreSQL\16\bin\psql.exe" -U mims_user -d mims_db -c "SELECT 1;"
```

**Solution:**
```powershell
# Restart PostgreSQL
Restart-Service postgresql-x64-16

# Check configuration
Get-Content "C:\Program Files\PostgreSQL\16\data\pg_hba.conf" | Select-String "mims"
```

### 17.3 — License Key Errors

**Problem:** Invalid license error

**Diagnosis:**
```powershell
# Check license file
Test-Path C:\mims\license.key
Get-Content C:\mims\license.key

# Check application logs
pm2 logs mims-backend | Select-String "license"
```

**Solution:**
```powershell
# Regenerate license
cd C:\mims-install\scripts
node generate-license.js
Copy-Item license.key C:\mims\license.key -Force
pm2 restart mims-backend
```

### 17.4 — Performance Issues

**Problem:** Slow response times

**Diagnosis:**
```powershell
# Check system resources
Get-Counter "\Processor(_Total)\% Processor Time"
Get-Counter "\Memory\Available MBytes"
pm2 monit
```

**Solution:**
```powershell
# Restart applications
pm2 restart all

# Clear Redis cache
& "C:\Program Files\Redis\redis-cli.exe" FLUSHDB

# Update database statistics
$env:PGPASSWORD = "StrongPassword123!"
& "C:\Program Files\PostgreSQL\16\bin\psql.exe" -U mims_user -d mims_db -c "ANALYZE;"
```

---

## Summary

This complete guide covers the entire deployment process from development setup to production Windows server installation. The system is now running with:

✅ **Production-Ready Build:** Obfuscated backend, optimized frontend
✅ **Windows Native Installation:** All components as Windows services
✅ **Automated Service Management:** PM2 + Windows Service integration
✅ **Security Configuration:** Firewall, permissions, antivirus exclusions
✅ **Monitoring & Backup:** Automated database backups and log rotation
✅ **Comprehensive Troubleshooting:** Step-by-step problem resolution

The application is accessible at `http://SERVER_IP` and ready for hospital staff training and production use.

**Support Contact:**
- Technical Support: support@mims.com
- Emergency: +92-XXX-XXXXXXX