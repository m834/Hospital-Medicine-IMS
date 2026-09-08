<#
.SYNOPSIS
    Sets up dialog-free receipt printing on a reception machine.

.DESCRIPTION
    A web page cannot print silently: the dialog belongs to Chrome, not to MIMS,
    and no change to the app can remove it. Chrome started with --kiosk-printing
    sends every print straight to the Windows default printer as one copy, with
    no dialog and no copy count. This script creates the shortcuts that do that,
    and checks the printer is set up to receive them.

    Run once per reception machine. Re-running is safe — it overwrites its own
    shortcuts and changes nothing else.

.EXAMPLE
    powershell -ExecutionPolicy Bypass -File .\setup-kiosk-printing.ps1

.EXAMPLE
    powershell -ExecutionPolicy Bypass -File .\setup-kiosk-printing.ps1 -BaseUrl "http://192.168.1.50:8091"
#>

param(
    # The MIMS address these machines use. Override for an on-site LAN address.
    [string]$BaseUrl = "http://civil.codehustlerssol.com"
)

$ErrorActionPreference = "Stop"

function Find-Chrome {
    $candidates = @(
        "$env:ProgramFiles\Google\Chrome\Application\chrome.exe",
        "${env:ProgramFiles(x86)}\Google\Chrome\Application\chrome.exe",
        "$env:LOCALAPPDATA\Google\Chrome\Application\chrome.exe"
    )
    foreach ($path in $candidates) {
        if (Test-Path $path) { return $path }
    }
    return $null
}

function New-KioskShortcut {
    param([string]$Name, [string]$Url, [string]$Chrome)

    $desktop = [Environment]::GetFolderPath("Desktop")
    $linkPath = Join-Path $desktop "$Name.lnk"

    $shell = New-Object -ComObject WScript.Shell
    $shortcut = $shell.CreateShortcut($linkPath)
    $shortcut.TargetPath = $Chrome
    # --kiosk-printing is the whole point; --app drops the address bar so staff
    # cannot wander off to a tab that was opened without the flag.
    $shortcut.Arguments = "--kiosk-printing --app=$Url"
    $shortcut.WorkingDirectory = Split-Path $Chrome
    $shortcut.IconLocation = "$Chrome,0"
    $shortcut.Description = "MIMS with direct printing (no print dialog)"
    $shortcut.Save()

    Write-Host "  created: $linkPath" -ForegroundColor Green
}

Write-Host ""
Write-Host "MIMS — direct printing setup" -ForegroundColor Cyan
Write-Host "============================"
Write-Host ""

# 1. Chrome
$chrome = Find-Chrome
if (-not $chrome) {
    Write-Host "Chrome was not found in any of the usual locations." -ForegroundColor Red
    Write-Host "Install Google Chrome, then run this script again."
    exit 1
}
Write-Host "Chrome: $chrome" -ForegroundColor Green

# 2. Default printer. Kiosk printing has no printer picker — it always uses the
#    Windows default — so a wrong default means slips land on the wrong tray.
Write-Host ""
try {
    $default = Get-CimInstance -ClassName Win32_Printer -Filter "Default = TRUE" -ErrorAction Stop
    if ($default) {
        Write-Host "Default printer: $($default.Name)" -ForegroundColor Green
        Write-Host "  Every slip prints here. If that is the wrong printer, set the right one as"
        Write-Host "  default in Settings > Printers & scanners, and turn OFF"
        Write-Host "  'Let Windows manage my default printer'."
    } else {
        Write-Host "No default printer is set." -ForegroundColor Yellow
        Write-Host "  Set the slip printer as default before using the shortcuts."
    }
} catch {
    Write-Host "Could not read the default printer ($($_.Exception.Message))." -ForegroundColor Yellow
}

# 3. Shortcuts
Write-Host ""
Write-Host "Creating desktop shortcuts:" -ForegroundColor Cyan
New-KioskShortcut -Name "MIMS Lab (Direct Print)"          -Url "$BaseUrl/lab"       -Chrome $chrome
New-KioskShortcut -Name "MIMS Reception (Direct Print)"    -Url "$BaseUrl/reception" -Chrome $chrome

# 4. The step everybody trips over.
Write-Host ""
Write-Host "IMPORTANT — close Chrome completely before using the shortcut" -ForegroundColor Yellow
Write-Host "  Chrome only applies --kiosk-printing when it starts a fresh process. If a"
Write-Host "  Chrome window is already open, the shortcut just adds a tab to it, the flag is"
Write-Host "  ignored, and the print dialog comes back."
Write-Host ""

$running = Get-Process chrome -ErrorAction SilentlyContinue
if ($running) {
    Write-Host "  Chrome is running right now ($($running.Count) processes)." -ForegroundColor Yellow
    $answer = Read-Host "  Close it now? (y/N)"
    if ($answer -eq "y") {
        Stop-Process -Name chrome -Force
        Write-Host "  Chrome closed." -ForegroundColor Green
    } else {
        Write-Host "  Close every Chrome window by hand before testing." -ForegroundColor Yellow
    }
} else {
    Write-Host "  Chrome is not running — the shortcut will start it with the flag." -ForegroundColor Green
}

Write-Host ""
Write-Host "Next: open 'MIMS Lab (Direct Print)', create a lab order, and click" -ForegroundColor Cyan
Write-Host "Create Order & Print Slip. The slip should reach the tray with no dialog."
Write-Host "Pin the shortcut to the taskbar and remove the plain Chrome icon so nobody"
Write-Host "starts the wrong one."
Write-Host ""
