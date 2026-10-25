# 70MM AI — Group 2: Script Intelligence Engine
# PowerShell launcher — activates venv and starts Flask

Write-Host ""
Write-Host "============================================" -ForegroundColor Cyan
Write-Host "  70MM AI -- Group 2: Script Intelligence  " -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $scriptDir

$activateScript = Join-Path $scriptDir "venv\Scripts\Activate.ps1"

if (-not (Test-Path $activateScript)) {
    Write-Host "[ERROR] venv not found!" -ForegroundColor Red
    Write-Host "Run this first to set up:" -ForegroundColor Yellow
    Write-Host "  python -m venv venv" -ForegroundColor White
    Write-Host "  .\venv\Scripts\python.exe -m pip install -r requirements.txt" -ForegroundColor White
    Read-Host "Press Enter to exit"
    exit 1
}

Write-Host "[1/2] Activating virtual environment..." -ForegroundColor Green
& $activateScript

Write-Host "[2/2] Starting Flask server..." -ForegroundColor Green
Write-Host ""
Write-Host "  Open browser at: http://localhost:5000" -ForegroundColor Yellow
Write-Host "  Press Ctrl+C to stop." -ForegroundColor Gray
Write-Host ""

python app.py
