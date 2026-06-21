$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot

Write-Host "==> Backend smoke (pytest tests/smoke)" -ForegroundColor Cyan
Push-Location (Join-Path $root "backend")
pytest -v tests/smoke
Pop-Location

Write-Host "==> Playwright smoke E2E" -ForegroundColor Cyan
Push-Location (Join-Path $root "frontend")
npx playwright test e2e/smoke
Pop-Location

Write-Host "Smoke tests concluídos com sucesso." -ForegroundColor Green
