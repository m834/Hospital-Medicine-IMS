# =================================================================
#  M-IMS Windows Native Installer
#  Tested on: Windows 10 / Windows 11 / Windows Server 2019 / 2022
# =================================================================
# USAGE (Run PowerShell as Administrator):
#   Set-ExecutionPolicy Bypass -Scope Process -Force
#   .\install-windows.ps1
#
# PREREQUISITES (must exist in the same folder as this script):
#   backend-dist.tar.gz    <- built by package-native.sh
#   frontend-dist.tar.gz   <- built by package-native.sh
#   nginx-native.conf      <- included in output-native/
#   .env                   <- copy from .env.template and fill in
#
# AFTER INSTALL:
#   Place license.key into C:\mims\backend\license.key
#   then: pm2 restart mims-backend
# =================================================================
#Requires -RunAsAdministrator

$ErrorActionPreference = "Stop"

function Write-Info    { Write-Host "[INFO] $args" -ForegroundColor Cyan }
function Write-OK      { Write-Host "[OK]   $args" -ForegroundColor Green }
function Write-Warning { Write-Host "[WARN] $args" -ForegroundColor Yellow }
function Write-Fail    { Write-Host "[FAIL] $args" -ForegroundColor Red; exit 1 }

$ScriptDir   = Split-Path -Parent $MyInvocation.MyCommand.Path
$AppDir      = "C:\mims"
$BackendDir  = "$AppDir\backend"
$FrontendDir = "$AppDir\frontend"
$NginxDir    = "C:\nginx"
$LogDir      = "$AppDir\logs"

# ─── Preflight ────────────────────────────────────────────────────
Write-Info "Checking prerequisites..."
if (-not (Test-Path "$ScriptDir\backend-dist.tar.gz"))  { Write-Fail "backend-dist.tar.gz not found in $ScriptDir" }
if (-not (Test-Path "$ScriptDir\frontend-dist.tar.gz")) { Write-Fail "frontend-dist.tar.gz not found in $ScriptDir" }
if (-not (Test-Path "$ScriptDir\.env"))                 { Write-Fail ".env not found in $ScriptDir — copy .env.template and fill it in" }
if (-not (Test-Path "$ScriptDir\nginx-native.conf"))    { Write-Fail "nginx-native.conf not found in $ScriptDir" }

# Check Windows version supports tar.exe (Windows 10 1803+, build 17063)
$build = [System.Environment]::OSVersion.Version.Build
if ($build -lt 17063) { Write-Fail "Windows build $build too old. Need build 17063 (Windows 10 v1803) or newer." }

Write-Info "Starting M-IMS installation on Windows build $build"

# ─── 1. Chocolatey ────────────────────────────────────────────────
Write-Info "Checking Chocolatey..."
if (-not (Get-Command choco -ErrorAction SilentlyContinue)) {
    Write-Info "Installing Chocolatey package manager..."
    [System.Net.ServicePointManager]::SecurityProtocol = [System.Net.ServicePointManager]::SecurityProtocol -bor 3072
    Invoke-Expression ((New-Object Net.WebClient).DownloadString('https://community.chocolatey.org/install.ps1'))
    # Reload PATH
    $env:PATH = [System.Environment]::GetEnvironmentVariable("PATH","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("PATH","User")
}
Write-OK "Chocolatey: $(choco --version)"

# ─── 2. Node.js 20 LTS ────────────────────────────────────────────
Write-Info "Checking Node.js..."
$nodeOk = $false
try {
    $nodeVer = (node --version 2>$null).TrimStart("v").Split(".")[0]
    if ([int]$nodeVer -ge 20) { $nodeOk = $true }
} catch {}

if (-not $nodeOk) {
    Write-Info "Installing Node.js 20 LTS..."
    choco install nodejs-lts --version 20 -y --no-progress | Out-Null
    $env:PATH = [System.Environment]::GetEnvironmentVariable("PATH","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("PATH","User")
}
Write-OK "Node.js: $(node --version)"

# ─── 3. PM2 ───────────────────────────────────────────────────────
Write-Info "Checking PM2..."
if (-not (Get-Command pm2 -ErrorAction SilentlyContinue)) {
    Write-Info "Installing PM2..."
    npm install -g pm2 pm2-windows-startup | Out-Null
    $env:PATH = [System.Environment]::GetEnvironmentVariable("PATH","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("PATH","User")
}
Write-OK "PM2: $(pm2 --version)"

# ─── 4. PostgreSQL 16 ─────────────────────────────────────────────
Write-Info "Checking PostgreSQL..."
$pgService = Get-Service -Name "postgresql*" -ErrorAction SilentlyContinue
if (-not $pgService) {
    Write-Info "Installing PostgreSQL 16 (this takes 2-3 minutes)..."
    # Generate a strong postgres superuser password
    $pgAdminPass = -join ((65..90)+(97..122)+(48..57) | Get-Random -Count 20 | ForEach-Object {[char]$_})
    choco install postgresql16 --params "/Password:$pgAdminPass /Port:5432" -y --no-progress | Out-Null
    # Save admin pass to a temp file (we delete it after DB setup)
    Set-Content -Path "$env:TEMP\pg_admin_pass.tmp" -Value $pgAdminPass
    $env:PATH = [System.Environment]::GetEnvironmentVariable("PATH","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("PATH","User")
    # Wait for service to start
    Start-Sleep -Seconds 8
} else {
    Write-Info "PostgreSQL already installed."
    $pgAdminPass = $null
}
$pgSvc = Get-Service -Name "postgresql*"
if ($pgSvc.Status -ne "Running") { Start-Service $pgSvc.Name }
Write-OK "PostgreSQL: running as service '$($pgSvc.Name)'"

# ─── 5. Redis for Windows ─────────────────────────────────────────
Write-Info "Checking Redis..."
$redisSvc = Get-Service -Name "Redis" -ErrorAction SilentlyContinue
if (-not $redisSvc) {
    Write-Info "Downloading Redis for Windows (tporadowski build)..."
    $redisVersion = "5.0.14.1"
    $redisUrl = "https://github.com/tporadowski/redis/releases/download/v$redisVersion/Redis-x64-$redisVersion.msi"
    $redisMsi = "$env:TEMP\redis-install.msi"
    Invoke-WebRequest -Uri $redisUrl -OutFile $redisMsi -UseBasicParsing
    Write-Info "Installing Redis..."
    Start-Process msiexec.exe -ArgumentList "/i `"$redisMsi`" /quiet /norestart ADDLOCAL=ALL" -Wait
    Remove-Item $redisMsi -Force -ErrorAction SilentlyContinue
    Start-Sleep -Seconds 5
    $redisSvc = Get-Service -Name "Redis" -ErrorAction SilentlyContinue
}
if ($redisSvc -and $redisSvc.Status -ne "Running") { Start-Service "Redis" }
Write-OK "Redis: running"

# ─── 6. Nginx for Windows ─────────────────────────────────────────
Write-Info "Checking Nginx..."
if (-not (Test-Path "$NginxDir\nginx.exe")) {
    Write-Info "Downloading Nginx for Windows..."
    $nginxVersion = "1.26.3"
    $nginxUrl = "https://nginx.org/download/nginx-$nginxVersion.zip"
    $nginxZip = "$env:TEMP\nginx.zip"
    Invoke-WebRequest -Uri $nginxUrl -OutFile $nginxZip -UseBasicParsing
    Expand-Archive -Path $nginxZip -DestinationPath "C:\" -Force
    # Rename extracted folder to C:\nginx
    if (Test-Path "C:\nginx-$nginxVersion") {
        if (Test-Path $NginxDir) { Remove-Item $NginxDir -Recurse -Force }
        Rename-Item "C:\nginx-$nginxVersion" $NginxDir
    }
    Remove-Item $nginxZip -Force -ErrorAction SilentlyContinue
}
Write-OK "Nginx: $NginxDir\nginx.exe present"

# ─── 7. NSSM (service manager for Nginx) ─────────────────────────
Write-Info "Checking NSSM..."
if (-not (Get-Command nssm -ErrorAction SilentlyContinue)) {
    choco install nssm -y --no-progress | Out-Null
    $env:PATH = [System.Environment]::GetEnvironmentVariable("PATH","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("PATH","User")
}
Write-OK "NSSM ready"

# ─── 8. Read .env values ──────────────────────────────────────────
Write-Info "Reading .env..."
$envContent = Get-Content "$ScriptDir\.env" | Where-Object { $_ -match "=" -and $_ -notmatch "^#" }
$envMap = @{}
foreach ($line in $envContent) {
    $parts = $line -split "=", 2
    if ($parts.Count -eq 2) { $envMap[$parts[0].Trim()] = $parts[1].Trim().Trim('"').Trim("'") }
}
$dbUrl       = $envMap["DATABASE_URL"]
$redisPass   = $envMap["REDIS_PASSWORD"]
# Extract DB password from DATABASE_URL  (postgresql://user:PASS@host:port/db)
if ($dbUrl -match "://[^:]+:([^@]+)@") { $dbPass = $matches[1] } else { $dbPass = "" }

# ─── 9. Create PostgreSQL database ────────────────────────────────
Write-Info "Setting up PostgreSQL database..."
$pgBin = (Get-Item "C:\Program Files\PostgreSQL\16\bin" -ErrorAction SilentlyContinue)?.FullName
if (-not $pgBin) {
    $pgBin = (Get-ChildItem "C:\Program Files\PostgreSQL" -ErrorAction SilentlyContinue | Sort-Object Name -Descending | Select-Object -First 1)?.FullName + "\bin"
}
if ($pgBin -and (Test-Path $pgBin)) {
    # Get postgres admin password
    if (-not $pgAdminPass) {
        if (Test-Path "$env:TEMP\pg_admin_pass.tmp") {
            $pgAdminPass = Get-Content "$env:TEMP\pg_admin_pass.tmp"
        } else {
            $pgAdminPass = Read-Host "Enter PostgreSQL superuser (postgres) password"
        }
    }
    $env:PGPASSWORD = $pgAdminPass
    # Create mims_user
    & "$pgBin\psql.exe" -U postgres -c @"
DO `$`$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'mims_user') THEN
    CREATE ROLE mims_user WITH LOGIN ENCRYPTED PASSWORD '$dbPass';
  ELSE
    ALTER ROLE mims_user WITH ENCRYPTED PASSWORD '$dbPass';
  END IF;
END `$`$;
"@ 2>$null | Out-Null
    # Create mims_db
    & "$pgBin\psql.exe" -U postgres -c "SELECT 'CREATE DATABASE mims_db OWNER mims_user' WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'mims_db')" 2>$null | ForEach-Object {
        if ($_ -match "CREATE DATABASE") {
            & "$pgBin\psql.exe" -U postgres -c "CREATE DATABASE mims_db OWNER mims_user;" 2>$null | Out-Null
        }
    }
    & "$pgBin\psql.exe" -U postgres -c "GRANT ALL PRIVILEGES ON DATABASE mims_db TO mims_user;" 2>$null | Out-Null
    Remove-Item "$env:TEMP\pg_admin_pass.tmp" -Force -ErrorAction SilentlyContinue
    Remove-Item Env:PGPASSWORD -ErrorAction SilentlyContinue
    Write-OK "PostgreSQL: mims_db and mims_user created"
} else {
    Write-Warning "Could not find psql.exe — create the database manually (see guide Appendix B, step B.7)"
}

# ─── 10. Configure Redis password ─────────────────────────────────
if ($redisPass) {
    Write-Info "Setting Redis requirepass..."
    $redisConf = "C:\Program Files\Redis\redis.windows-service.conf"
    if (Test-Path $redisConf) {
        $conf = Get-Content $redisConf
        $conf = $conf | Where-Object { $_ -notmatch "^requirepass " }
        $conf += "requirepass $redisPass"
        Set-Content -Path $redisConf -Value $conf
        Restart-Service Redis -ErrorAction SilentlyContinue
        Write-OK "Redis password set"
    }
}

# ─── 11. Create directories and extract archives ──────────────────
Write-Info "Creating application directories..."
New-Item -ItemType Directory -Path $BackendDir  -Force | Out-Null
New-Item -ItemType Directory -Path $FrontendDir -Force | Out-Null
New-Item -ItemType Directory -Path $LogDir      -Force | Out-Null

Write-Info "Extracting backend..."
tar -xzf "$ScriptDir\backend-dist.tar.gz" -C $BackendDir

Write-Info "Extracting frontend..."
tar -xzf "$ScriptDir\frontend-dist.tar.gz" -C $FrontendDir

Write-Info "Copying .env to backend..."
Copy-Item "$ScriptDir\.env" "$BackendDir\.env" -Force

Write-Info "Writing frontend .env..."
$nextUrl    = $envMap["NEXTAUTH_URL"]
$nextSecret = $envMap["NEXTAUTH_SECRET"]
$apiUrl     = $envMap["NEXT_PUBLIC_API_URL"]
@"
PORT=3000
HOSTNAME=0.0.0.0
NODE_ENV=production
NEXTAUTH_URL=$nextUrl
NEXTAUTH_SECRET=$nextSecret
NEXT_PUBLIC_API_URL=$apiUrl
"@ | Set-Content "$FrontendDir\.env"

Write-OK "Files extracted to $AppDir"

# ─── 12. Run database migrations ──────────────────────────────────
Write-Info "Running database migrations..."
$env:DATABASE_URL = $dbUrl
Push-Location $BackendDir
try {
    node node_modules/.bin/prisma migrate deploy
    Write-OK "Migrations applied"
} catch {
    Write-Warning "Migration failed: $_"
    Write-Warning "Run manually after fix: cd $BackendDir && node node_modules/.bin/prisma migrate deploy"
} finally {
    Pop-Location
}

# ─── 13. PM2 ecosystem for Windows ────────────────────────────────
Write-Info "Writing PM2 ecosystem config..."
@"
module.exports = {
  apps: [
    {
      name        : 'mims-backend',
      script      : 'app/main.js',
      cwd         : '$($BackendDir -replace "\\", "\\\\")',
      env         : { NODE_ENV: 'production' },
      error_file  : '$($LogDir -replace "\\", "\\\\")\backend-error.log',
      out_file    : '$($LogDir -replace "\\", "\\\\")\backend-out.log',
      max_restarts: 10,
      restart_delay: 5000,
    },
    {
      name        : 'mims-frontend',
      script      : 'server.js',
      cwd         : '$($FrontendDir -replace "\\", "\\\\")',
      env         : { NODE_ENV: 'production', PORT: '3000', HOSTNAME: '0.0.0.0' },
      error_file  : '$($LogDir -replace "\\", "\\\\")\frontend-error.log',
      out_file    : '$($LogDir -replace "\\", "\\\\")\frontend-out.log',
      max_restarts: 10,
      restart_delay: 5000,
    },
  ],
};
"@ | Set-Content "$AppDir\ecosystem.config.js"

# ─── 14. Configure and register Nginx ─────────────────────────────
Write-Info "Configuring Nginx..."
Copy-Item "$ScriptDir\nginx-native.conf" "$NginxDir\conf\nginx.conf" -Force
# Test nginx config
$result = & "$NginxDir\nginx.exe" -t 2>&1
if ($LASTEXITCODE -ne 0) { Write-Warning "Nginx config test warning: $result" }

# Register nginx as Windows service via NSSM
$nginxSvc = Get-Service -Name "mims-nginx" -ErrorAction SilentlyContinue
if (-not $nginxSvc) {
    nssm install mims-nginx "$NginxDir\nginx.exe" | Out-Null
    nssm set mims-nginx AppDirectory $NginxDir | Out-Null
    nssm set mims-nginx Description "M-IMS Nginx Reverse Proxy" | Out-Null
    nssm set mims-nginx Start SERVICE_AUTO_START | Out-Null
}
Start-Service "mims-nginx" -ErrorAction SilentlyContinue
Write-OK "Nginx registered as Windows service 'mims-nginx'"

# ─── 15. Start apps with PM2 ─────────────────────────────────────
Write-Info "Starting M-IMS apps with PM2..."
pm2 start "$AppDir\ecosystem.config.js"
Start-Sleep -Seconds 10

# ─── 16. PM2 auto-start on Windows boot ──────────────────────────
Write-Info "Configuring PM2 to start on Windows boot..."
pm2 save
pm2-startup install | Out-Null
Write-OK "PM2 startup configured"

# ─── 17. Windows Firewall ─────────────────────────────────────────
Write-Info "Adding Windows Firewall rules..."
New-NetFirewallRule -DisplayName "M-IMS HTTP"  -Direction Inbound -Protocol TCP -LocalPort 80  -Action Allow -ErrorAction SilentlyContinue | Out-Null
New-NetFirewallRule -DisplayName "M-IMS HTTPS" -Direction Inbound -Protocol TCP -LocalPort 443 -Action Allow -ErrorAction SilentlyContinue | Out-Null
Write-OK "Firewall: port 80 and 443 allowed"

# ─── 18. Final status ─────────────────────────────────────────────
$ip = (Get-NetIPAddress -AddressFamily IPv4 | Where-Object { $_.IPAddress -notmatch "^127\." -and $_.PrefixOrigin -ne "WellKnown" } | Select-Object -First 1).IPAddress

Write-Host ""
Write-Host "============================================================" -ForegroundColor Green
Write-Host "  M-IMS Windows Installation Complete!" -ForegroundColor Green
Write-Host "============================================================" -ForegroundColor Green
Write-Host ""
Write-Host "  App directory    : $AppDir"
Write-Host "  Logs             : $LogDir"
Write-Host "  PM2 status       : pm2 status"
Write-Host ""
Write-Host "  ⚠  Place your license.key into:" -ForegroundColor Yellow
Write-Host "       $BackendDir\license.key" -ForegroundColor Yellow
Write-Host "     then restart the backend:" -ForegroundColor Yellow
Write-Host "       pm2 restart mims-backend" -ForegroundColor Yellow
Write-Host ""
Write-Host "  Access the app at:"
Write-Host "    http://$ip"
Write-Host ""
Write-Host "  Quick health check:"
Write-Host "    Invoke-WebRequest http://localhost:3001/api/health"
Write-Host ""
