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

Write-Host "   Success: MIMS installation found at $InstallDir" -ForegroundColor Green

Write-Host ""
Write-Host "2. Stopping PM2 services..." -ForegroundColor Yellow
$pmStop = Start-Process "pm2" -ArgumentList "stop", "all" -PassThru -Wait -WindowStyle Hidden -ErrorAction SilentlyContinue
if ($pmStop.ExitCode -eq 0) {
    Write-Host "   Success: PM2 services stopped" -ForegroundColor Green
} else {
    Write-Host "   Warning: Could not stop PM2 services (may not be running)" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "3. Creating backup..." -ForegroundColor Yellow
if (Test-Path $BackupDir) {
    Remove-Item -Path $BackupDir -Recurse -Force
}
Copy-Item -Path $InstallDir -Destination $BackupDir -Recurse -Force
if (Test-Path $BackupDir) {
    Write-Host "   Success: Backup created at $BackupDir" -ForegroundColor Green
} else {
    Write-Host "   ERROR: Failed to create backup" -ForegroundColor Red
    Read-Host "Press Enter to exit"
    exit 1
}

Write-Host ""
Write-Host "4. Updating backend with clean build..." -ForegroundColor Yellow

# Remove old backend
if (Test-Path "$InstallDir\backend") {
    Remove-Item -Path "$InstallDir\backend" -Recurse -Force
    Write-Host "   Success: Removed old backend" -ForegroundColor Green
}

# Extract new package - check multiple locations
$ZipFile = $null
$PossiblePaths = @(
    ".\mims-windows-v1.0.1-clean.zip",
    "$env:USERPROFILE\Downloads\mims-windows-v1.0.1-clean.zip",
    "C:\Users\$env:USERNAME\Downloads\mims-windows-v1.0.1-clean.zip"
)

foreach ($path in $PossiblePaths) {
    if (Test-Path $path) {
        $ZipFile = $path
        Write-Host "   Found package at: $ZipFile" -ForegroundColor Green
        break
    }
}

if (!$ZipFile) {
    Write-Host "   ERROR: Package file not found in any of these locations:" -ForegroundColor Red
    foreach ($path in $PossiblePaths) {
        Write-Host "   - $path" -ForegroundColor Yellow
    }
    Write-Host "   Please place the mims-windows-v1.0.1-clean.zip file in one of these locations" -ForegroundColor Red
    Read-Host "Press Enter to exit"
    exit 1
}

# Extract using Expand-Archive (simpler approach)
$tempDir = "$env:TEMP\mims-extract"
if (Test-Path $tempDir) { Remove-Item $tempDir -Recurse -Force }
New-Item -ItemType Directory -Path $tempDir -Force | Out-Null

Write-Host "   Extracting package from: $ZipFile" -ForegroundColor Cyan
Expand-Archive -Path $ZipFile -DestinationPath $tempDir -Force

if (Test-Path "$tempDir\windows-package\backend") {
    Copy-Item -Path "$tempDir\windows-package\backend\*" -Destination "$InstallDir\backend\" -Recurse -Force
    Write-Host "   Success: Backend updated with clean build" -ForegroundColor Green
} else {
    Write-Host "   ERROR: Backend files not found in package" -ForegroundColor Red
    Read-Host "Press Enter to exit"
    exit 1
}

# Cleanup temp directory
Remove-Item $tempDir -Recurse -Force -ErrorAction SilentlyContinue

Write-Host ""
Write-Host "5. Installing backend dependencies..." -ForegroundColor Yellow
Set-Location "$InstallDir\backend"
$npmResult = Start-Process "npm" -ArgumentList "install", "--only=production", "--no-audit" -PassThru -Wait -WindowStyle Hidden
if ($npmResult.ExitCode -eq 0) {
    Write-Host "   Success: Dependencies installed" -ForegroundColor Green
} else {
    Write-Host "   WARNING: npm install had issues. You may need to run 'npm install' manually" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "6. Starting services..." -ForegroundColor Yellow
Set-Location $InstallDir

$pm2Result = Start-Process "pm2" -ArgumentList "start", ".\config\pm2.config.js" -PassThru -Wait -WindowStyle Hidden
if ($pm2Result.ExitCode -eq 0) {
    Start-Sleep -Seconds 3
    & pm2 status
    Write-Host "   Success: Services started" -ForegroundColor Green
} else {
    Write-Host "   WARNING: PM2 start had issues. You may need to run 'pm2 start .\config\pm2.config.js' manually" -ForegroundColor Yellow
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