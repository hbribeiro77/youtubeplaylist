$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot

Write-Host "==> Instalando dependências do backend" -ForegroundColor Cyan
Push-Location (Join-Path $root "backend")
pip install -r requirements.txt -q
Pop-Location

Write-Host "==> Instalando dependências do frontend" -ForegroundColor Cyan
Push-Location (Join-Path $root "frontend")
if (-not (Test-Path "node_modules")) {
    npm install
}
Write-Host "==> Build do frontend" -ForegroundColor Cyan
npm run build
Pop-Location

Write-Host "==> Subindo app unificado em http://localhost:8080" -ForegroundColor Green
Push-Location (Join-Path $root "backend")
if (-not (Test-Path ".env") -and (Test-Path "..\.env")) {
    Copy-Item "..\.env" ".env"
}
python -m uvicorn app.main:app --host 0.0.0.0 --port 8080 --reload
