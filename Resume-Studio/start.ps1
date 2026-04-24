# Start backend + frontend on Windows.
# Run from PowerShell:  .\start.ps1

$ErrorActionPreference = "Stop"
$root = $PSScriptRoot

# --- backend ---
Push-Location "$root\backend"
if (-not (Test-Path ".venv")) {
    Write-Host ">> Creating Python venv..."
    python -m venv .venv
}
& ".\.venv\Scripts\Activate.ps1"
pip install -q -r requirements.txt

if (-not (Test-Path ".env")) {
    Copy-Item ".env.example" ".env"
    Write-Host ">> Created backend\.env (edit it to enable LLM features)."
}

$backend = Start-Process -PassThru -NoNewWindow `
    -FilePath "uvicorn" `
    -ArgumentList "app.main:app","--reload","--port","8000"
Pop-Location

# --- frontend ---
Push-Location "$root\frontend"
if (-not (Test-Path "node_modules")) {
    Write-Host ">> Installing npm deps..."
    npm install
}
$frontend = Start-Process -PassThru -NoNewWindow `
    -FilePath "npm" -ArgumentList "run","dev"
Pop-Location

Write-Host ""
Write-Host "=========================================="
Write-Host " Backend  : http://localhost:8000"
Write-Host " Frontend : http://localhost:5173"
Write-Host "=========================================="
Write-Host ""
Write-Host "Press Ctrl+C to stop."

try {
    Wait-Process -Id $backend.Id, $frontend.Id
} finally {
    Stop-Process -Id $backend.Id  -ErrorAction SilentlyContinue
    Stop-Process -Id $frontend.Id -ErrorAction SilentlyContinue
}
