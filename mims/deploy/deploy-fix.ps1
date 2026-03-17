# MIMS Windows Server Fix Deployment Script
# This script updates the backend to the clean version to fix class-validator enum errors

Write-Host "MIMS Windows Server Backend Fix Deployment" -ForegroundColor Green
Write-Host "=========================================" -ForegroundColor Green
Write-Host ""

# Configuration
$InstallDir = "C:\mims"
$BackupDir = "C:\mims_backup_$(Get-Date -Format 'yyyy-MM-dd_HH-mm-ss')"

Write-Host "1. Checking current installation..." -ForegroundColor Yellow
if (!(Test-Path $InstallDir)) {
    Write-Host "ERROR: MIMS installation not found at $InstallDir" -ForegroundColor Red
    Read-Host "Press Enter to exit"
    exit 1
}

Write-Host "   ✓ MIMS installation found at $InstallDir" -ForegroundColor Green

Write-Host ""
Write-Host "2. Stopping PM2 services..." -ForegroundColor Yellow
try {
    & pm2 stop all 2>$null
    Write-Host "   ✓ PM2 services stopped" -ForegroundColor Green
}
catch {
    Write-Host "   ⚠ Warning: Could not stop PM2 services (may not be running)" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "3. Creating backup..." -ForegroundColor Yellow
try {
    Copy-Item -Path $InstallDir -Destination $BackupDir -Recurse -Force
    Write-Host "   ✓ Backup created at $BackupDir" -ForegroundColor Green
}
catch {
    Write-Host "   ✗ ERROR: Failed to create backup: $($_.Exception.Message)" -ForegroundColor Red
    Read-Host "Press Enter to exit"
    exit 1
}

Write-Host ""
Write-Host "4. Updating backend with clean build..." -ForegroundColor Yellow

# Remove old backend
if (Test-Path "$InstallDir\backend") {
    Remove-Item -Path "$InstallDir\backend" -Recurse -Force
    Write-Host "   ✓ Removed old backend" -ForegroundColor Green
}

# Extract new package (assuming it's in the same directory)
$ZipFile = ".\mims-windows-v1.0.1-clean.zip"
if (!(Test-Path $ZipFile)) {
    Write-Host "   ✗ ERROR: Package file not found: $ZipFile" -ForegroundColor Red
    Write-Host "   Please place the mims-windows-v1.0.1-clean.zip file in the same directory as this script" -ForegroundColor Red
    Read-Host "Press Enter to exit"
    exit 1
}

# Extract only backend from the new package
Add-Type -AssemblyName System.IO.Compression.FileSystem
$zip = [System.IO.Compression.ZipFile]::OpenRead((Resolve-Path $ZipFile))

try {
    $backendEntries = $zip.Entries | Where-Object { $_.FullName.StartsWith("windows-package/backend/") -and $_.FullName -ne "windows-package/backend/" }
    
    foreach ($entry in $backendEntries) {
        $relativePath = $entry.FullName -replace "^windows-package/", ""
        $destinationPath = Join-Path $InstallDir $relativePath
        $destinationDir = Split-Path $destinationPath -Parent
        
        if (!(Test-Path $destinationDir)) {
            New-Item -ItemType Directory -Path $destinationDir -Force | Out-Null
        }
        
        if ($entry.Length -gt 0) {
            [System.IO.Compression.ZipFileExtensions]::ExtractToFile($entry, $destinationPath, $true)
        }
    }
    
    Write-Host "   ✓ Backend updated with clean build" -ForegroundColor Green
}
catch {
    Write-Host "   ✗ ERROR: Failed to extract backend: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host "   Restoring from backup..." -ForegroundColor Yellow
    Remove-Item -Path $InstallDir -Recurse -Force -ErrorAction SilentlyContinue
    Copy-Item -Path $BackupDir -Destination $InstallDir -Recurse -Force
    Write-Host "   ✓ Backup restored" -ForegroundColor Green
    Read-Host "Press Enter to exit"
    exit 1
}
finally {
    $zip.Dispose()
}

Write-Host ""
Write-Host "5. Installing backend dependencies..." -ForegroundColor Yellow
Set-Location "$InstallDir\backend"
try {
    & npm install --only=production --no-audit 2>$null
    Write-Host "   ✓ Dependencies installed" -ForegroundColor Green
}
catch {
    Write-Host "   ✗ ERROR: Failed to install dependencies: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host "   Please run 'npm install' manually in $InstallDir\backend" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "6. Starting services..." -ForegroundColor Yellow
Set-Location $InstallDir

try {
    & pm2 start .\config\pm2.config.js 2>$null
    Start-Sleep -Seconds 3
    & pm2 status
    Write-Host "   ✓ Services started" -ForegroundColor Green
}
catch {
    Write-Host "   ✗ ERROR: Failed to start services: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host "   Please run 'pm2 start .\config\pm2.config.js' manually" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "=====================================" -ForegroundColor Green
Write-Host "Backend Fix Deployment Complete!" -ForegroundColor Green
Write-Host "=====================================" -ForegroundColor Green
Write-Host ""
Write-Host "Next Steps:" -ForegroundColor Cyan
Write-Host "1. Check PM2 status: pm2 status" -ForegroundColor White
Write-Host "2. Check backend logs: pm2 logs mims-backend" -ForegroundColor White
Write-Host "3. Test API: http://localhost:3001/api/health" -ForegroundColor White
Write-Host "4. Test frontend: http://localhost:3000" -ForegroundColor White
Write-Host ""
Write-Host "Backup Location: $BackupDir" -ForegroundColor Yellow
Write-Host ""

Read-Host "Press Enter to finish"