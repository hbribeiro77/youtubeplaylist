$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot

Write-Host "==> Backend pytest" -ForegroundColor Cyan
Push-Location (Join-Path $root "backend")
pytest -v
Pop-Location

Write-Host "==> Frontend Vitest" -ForegroundColor Cyan
Push-Location (Join-Path $root "frontend")
npm test
Pop-Location

Write-Host "==> Playwright smoke E2E" -ForegroundColor Cyan
Push-Location (Join-Path $root "frontend")
npx playwright test e2e/smoke
Pop-Location

Write-Host "Todos os testes concluídos com sucesso." -ForegroundColor Green
