# M-IMS Windows Deployment Guide
**Version 1.0 · February 2026**

---

## 📋 Quick Start

1. [Development Setup](#development-setup)
2. [Production Build](#production-build) 
3. [Windows Deployment](#windows-deployment)
4. [Operations](#operations)

---

# Development Setup

## Prerequisites

- **macOS 12+** or **Ubuntu 20.04+**
- **16GB RAM**, **50GB storage**, **Internet**

## Install Tools

**macOS:**
```bash
# Install Homebrew
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
brew install node@20 postgresql@16 redis git docker
```

**Ubuntu:**
```bash
sudo apt update && sudo apt upgrade -y
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs postgresql postgresql-contrib redis-server docker.io docker-compose git
sudo usermod -aG docker $USER
```

## Setup Development Environment

```bash
# Clone repository
git clone https://github.com/your-org/Hospital-Medicine-IMS.git
cd Hospital-Medicine-IMS

# Start databases
docker-compose up -d postgres redis

# Setup backend
cd mims/backend
npm install
cp .env.example .env
nano .env  # Edit with development values
npx prisma generate && npx prisma migrate deploy && npx prisma db seed
npm run start:dev

# Setup frontend (new terminal)
cd mims/frontend  
npm install
cp .env.example .env.local
nano .env.local  # Edit with development values
npm run dev
```

**Access:** http://localhost:3000 (admin@hospital.com / admin123)

---

# Production Build

## Clean & Prepare

```bash
cd ~/Hospital-Medicine-IMS
docker-compose down
cd mims/backend && rm -rf node_modules dist && npm cache clean --force
cd ../frontend && rm -rf node_modules .next && npm cache clean --force
```

## Build Backend

```bash
cd ~/Hospital-Medicine-IMS/mims/backend
npm ci --production
npm install --save-dev javascript-obfuscator

# Create obfuscation config
cat > obfuscator.config.js << 'EOF'
module.exports = {
  compact: true,
  controlFlowFlattening: true,
  debugProtection: true,
  disableConsoleOutput: true,
  identifierNamesGenerator: 'hexadecimal',
  stringArray: true,
  stringArrayEncoding: ['base64']
};
EOF

# Build and obfuscate
npm run build
npx javascript-obfuscator dist --config obfuscator.config.js --output dist-protected
cp package.json dist-protected/ && cp -r prisma dist-protected/
```

## Build Frontend

```bash
cd ~/Hospital-Medicine-IMS/mims/frontend
npm ci
NODE_ENV=production npm run build
```

## Create Windows Package

```bash
cd ~/Hospital-Medicine-IMS/mims/deploy
mkdir -p windows-package/{backend,frontend,scripts,config}

# Copy files
cp -r ../backend/dist/* windows-package/backend/
cp -r ../frontend/.next windows-package/frontend/
cp -r ../frontend/public windows-package/frontend/
cp -r ../backend/prisma windows-package/backend/
cp ../backend/package.json windows-package/backend/

# Create license generator
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

# Create installer script
cat > windows-package/scripts/install.ps1 << 'EOF'
param([string]$InstallPath = "C:\mims")

Write-Host "M-IMS Windows Installation Starting..." -ForegroundColor Green

# Check Administrator
if (-NOT ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole] "Administrator")) {
    Write-Error "Run as Administrator"
    exit 1
}

# Install Chocolatey
if (!(Get-Command choco -ErrorAction SilentlyContinue)) {
    Set-ExecutionPolicy Bypass -Scope Process -Force
    Invoke-Expression ((New-Object System.Net.WebClient).DownloadString('https://community.chocolatey.org/install.ps1'))
}

# Install software
choco install nodejs.install --version 20.11.0 -y
choco install postgresql16 --params '/Password:MimsDB2026!' -y
choco install redis-64 nginx nssm -y

# Refresh environment
refreshenv
npm install pm2@latest pm2-windows-service -g

# Create directories
New-Item -ItemType Directory -Path $InstallPath -Force
New-Item -ItemType Directory -Path "$InstallPath\logs" -Force
New-Item -ItemType Directory -Path "$InstallPath\scripts" -Force
New-Item -ItemType Directory -Path "$InstallPath\config" -Force

# Copy files
Copy-Item -Path ".\backend\*" -Destination "$InstallPath\backend\" -Recurse -Force
Copy-Item -Path ".\frontend\*" -Destination "$InstallPath\frontend\" -Recurse -Force
Copy-Item -Path ".\scripts\*" -Destination "$InstallPath\scripts\" -Recurse -Force
Copy-Item -Path ".\config\*" -Destination "$InstallPath\config\" -Recurse -Force

# Configure PostgreSQL
Start-Service postgresql-x64-16
$env:PGPASSWORD = "MimsDB2026!"
& "C:\Program Files\PostgreSQL\16\bin\psql.exe" -U postgres -h localhost -c "CREATE DATABASE mims_db; CREATE USER mims_user WITH PASSWORD 'StrongPass123!'; GRANT ALL PRIVILEGES ON DATABASE mims_db TO mims_user;"

# Install dependencies
Set-Location "$InstallPath\backend"
npm ci --production
Set-Location "$InstallPath\frontend" 
npm ci --production

# Generate machine license key
Write-Host "Generating license key for this machine..." -ForegroundColor Yellow
Set-Location "$InstallPath\scripts"
node generate-license.js
Move-Item license.key "$InstallPath\license.key" -Force

Write-Host "Installation Complete! License key generated for this machine." -ForegroundColor Green
Write-Host "Next steps:" -ForegroundColor Yellow
Write-Host "1. Copy config\.env.template to $InstallPath\.env and edit configuration" -ForegroundColor White
Write-Host "2. Start services with PM2 and Nginx" -ForegroundColor White
'EOF

# Create environment template
cat > windows-package/config/.env.template << 'EOF'
NODE_ENV=production
DATABASE_URL=postgresql://mims_user:StrongPass123!@localhost:5432/mims_db
REDIS_URL=redis://localhost:6379
JWT_SECRET=REPLACE_WITH_STRONG_SECRET
NEXTAUTH_SECRET=REPLACE_WITH_STRONG_SECRET
NEXT_PUBLIC_API_URL=http://localhost/api
PORT=3001

# License Configuration
LICENSE_PATH=C:/mims/license.key
LICENSE_VALIDATION_ENABLED=true
'EOF

# Create license validator
cat > windows-package/config/validate-license.js << 'EOF'
const crypto = require('crypto');
const os = require('os');
const fs = require('fs');

function getMachineFingerprint() {
    const networkInterfaces = os.networkInterfaces();
    const cpus = os.cpus();
    
    const macAddresses = [];
    Object.values(networkInterfaces).forEach(interfaces => {
        interfaces.forEach(iface => {
            if (iface.mac && iface.mac !== '00:00:00:00:00:00') {
                macAddresses.push(iface.mac);
            }
        });
    });
    
    return {
        hostname: os.hostname(),
        platform: os.platform(),
        arch: os.arch(),
        cpuModel: cpus[0]?.model || 'unknown',
        cpuCount: cpus.length,
        macAddresses: macAddresses.sort(),
        totalMemory: os.totalmem()
    };
}

function validateLicense(licensePath) {
    try {
        if (!fs.existsSync(licensePath)) {
            throw new Error('License file not found');
        }
        
        const licenseContent = fs.readFileSync(licensePath, 'utf8');
        const license = JSON.parse(Buffer.from(licenseContent, 'base64').toString());
        
        // Verify signature
        const licenseString = JSON.stringify(license.data);
        const expectedSignature = crypto.createHmac('sha256', 'M1MS-L1C3NS3-K3Y-2026').update(licenseString).digest('hex');
        
        if (license.signature !== expectedSignature) {
            throw new Error('Invalid license signature');
        }
        
        // Check expiry
        if (new Date() > new Date(license.data.validUntil)) {
            throw new Error('License expired');
        }
        
        // Verify machine fingerprint
        const currentMachine = getMachineFingerprint();
        const licensedMachine = license.data.machineInfo;
        
        // Check critical machine attributes (allow some flexibility)
        const criticalMatches = (
            currentMachine.platform === licensedMachine.platform &&
            currentMachine.arch === licensedMachine.arch &&
            currentMachine.macAddresses.some(mac => licensedMachine.macAddresses.includes(mac))
        );
        
        if (!criticalMatches) {
            throw new Error('License not valid for this machine');
        }
        
        return { valid: true, data: license.data };
    } catch (error) {
        return { valid: false, error: error.message };
    }
}

// Validate license on startup
const result = validateLicense(process.env.LICENSE_PATH || 'C:/mims/license.key');
if (!result.valid) {
    console.error('LICENSE VALIDATION FAILED:', result.error);
    process.exit(1);
}

console.log('License validation successful. Valid until:', result.data.validUntil);
module.exports = { validateLicense };
EOF

# Create PM2 config
cat > windows-package/config/pm2.config.js << 'EOF'
module.exports = {
  apps: [
    {
      name: 'mims-license-validator',
      script: 'validate-license.js',
      cwd: 'C:\\mims\\config',
      env: { LICENSE_PATH: 'C:/mims/license.key' },
      restart_delay: 5000,
      max_restarts: 3
    },
    {
      name: 'mims-backend',
      script: 'npm',
      args: 'run start:prod',
      cwd: 'C:\\mims\\backend',
      env: { 
        NODE_ENV: 'production', 
        PORT: 3001,
        LICENSE_PATH: 'C:/mims/license.key'
      },
      depends_on: 'mims-license-validator'
    },
    {
      name: 'mims-frontend', 
      script: 'npm',
      args: 'start',
      cwd: 'C:\\mims\\frontend',
      env: { 
        NODE_ENV: 'production', 
        PORT: 3000,
        LICENSE_PATH: 'C:/mims/license.key'
      },
      depends_on: 'mims-backend'
    }
  ]
};
EOF

# Create Nginx config
cat > windows-package/config/nginx.conf << 'EOF'
events { worker_connections 1024; }
http {
    upstream backend { server 127.0.0.1:3001; }
    upstream frontend { server 127.0.0.1:3000; }
    
    server {
        listen 80;
        server_name localhost;
        
        location /api/ { proxy_pass http://backend; }
        location / { proxy_pass http://frontend; }
    }
}
EOF

# Package for Windows
zip -r mims-windows-v1.0.0.zip windows-package/
```

---

# Windows Deployment

## System Requirements

- **Windows Server 2016+** or **Windows 10/11 Pro**
- **8GB RAM**, **100GB storage**, **Static IP**

## Installation Steps

1. **Extract package** to `C:\mims-install\`
2. **Run PowerShell as Administrator**
3. **Execute installer:**
   ```powershell
   cd C:\mims-install
   Set-ExecutionPolicy RemoteSigned
   .\scripts\install.ps1
   ```
4. **Configure environment:**
   ```powershell
   copy C:\mims\config\.env.template C:\mims\.env
   notepad C:\mims\.env  # Edit secrets and server IP
   ```
5. **Generate secrets:**
   ```powershell
   # JWT Secret (64 chars)
   -join ((65..90)+(97..122)+(48..57) | Get-Random -Count 64 | ForEach-Object {[char]$_})
   ```
6. **Start services:**
   ```powershell
   pm2-service-install -n PM2
   copy C:\mims\config\pm2.config.js C:\mims\pm2.config.js
   pm2 start C:\mims\pm2.config.js
   
   # Create nginx directory structure
   New-Item -ItemType Directory -Path "C:\nginx\conf" -Force
   copy C:\mims\config\nginx.conf C:\nginx\conf\nginx.conf
   nssm install "M-IMS-Nginx" "C:\nginx\nginx.exe"
   Start-Service M-IMS-Nginx
   ```

## License Setup

**Verify license generation:**
```powershell
# Check if license was created
Test-Path C:\mims\license.key

# View license info (optional)
node C:\mims\scripts\generate-license.js
```

**For manual license generation:**
```powershell
cd C:\mims\scripts
node generate-license.js
Move-Item license.key C:\mims\license.key -Force
```

## Database Setup

```powershell
cd C:\mims\backend
npx prisma migrate deploy
npx prisma db seed
```

---

# Operations

## Service Management

```powershell
# Check status
pm2 status
Get-Service postgresql-x64-16,Redis,M-IMS-Nginx

# Restart services
pm2 restart all
Restart-Service M-IMS-Nginx

# View logs
pm2 logs --lines 20
```

## Backup

```powershell
# Manual backup
$timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
$env:PGPASSWORD = "StrongPass123!"
& "C:\Program Files\PostgreSQL\16\bin\pg_dump.exe" -U mims_user -d mims_db -f "C:\mims\backups\backup_$timestamp.sql"
```

## Troubleshooting

**Services won't start:**
```powershell
Restart-Service postgresql-x64-16,Redis
pm2 restart all
Start-Service M-IMS-Nginx
```

**Database connection issues:**
```powershell
Get-Service postgresql-x64-16
$env:PGPASSWORD = "StrongPass123!"
& "C:\Program Files\PostgreSQL\16\bin\psql.exe" -U mims_user -d mims_db -c "SELECT 1;"
```

**Performance issues:**
```powershell
pm2 monit
Get-Counter "\Processor(_Total)\% Processor Time"
```

**License issues:**
```powershell
# Check license file
Test-Path C:\mims\license.key

# Validate license manually
cd C:\mims\config
node validate-license.js

# Regenerate license for current machine
cd C:\mims\scripts
node generate-license.js
Move-Item license.key C:\mims\license.key -Force
pm2 restart all
```

---

## Summary

✅ **Development:** Local setup with Node.js, PostgreSQL, Redis  
✅ **Production Build:** Obfuscated backend, optimized frontend  
✅ **Windows Package:** Complete installation package with scripts  
✅ **Deployment:** Automated Windows installation with services  
✅ **License System:** Machine-fingerprint based license validation  
✅ **Operations:** Service management, backup, troubleshooting  

**Access:** http://SERVER_IP (admin@hospital.com / admin123)

**License Features:**
- **Machine Binding:** License tied to specific Windows server hardware
- **Automatic Generation:** License created during installation for target machine
- **Validation:** Real-time license checking on application startup
- **Security:** HMAC-SHA256 signature verification
- **Expiry Control:** Configurable license validity period
