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
