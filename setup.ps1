# setup.ps1 — Metis dev environment bootstrap
# Rodar da raiz do projeto: .\setup.ps1
# Flags:
#   -Freeze   Atualiza requirements.txt com o estado atual do venv
#   -Backend  Sobe o backend local apos setup

param(
    [switch]$Freeze,
    [switch]$Backend
)

$ErrorActionPreference = "Stop"
$Root = $PSScriptRoot

Write-Host "`n=== Metis Setup ===" -ForegroundColor Cyan

# ── Python / venv ─────────────────────────────────────────────
$VenvPath = Join-Path $Root ".venv"
$VenvPython = Join-Path $VenvPath "Scripts\python.exe"
$VenvPip = Join-Path $VenvPath "Scripts\pip.exe"

if (-not (Test-Path $VenvPath)) {
    Write-Host "[Python] Criando .venv..." -ForegroundColor Yellow
    python -m venv $VenvPath
} else {
    Write-Host "[Python] .venv encontrado." -ForegroundColor Green
}

Write-Host "[Python] Instalando pacotes do requirements.txt..."
& $VenvPip install -r (Join-Path $Root "backend\requirements.txt") --quiet
Write-Host "[Python] Pacotes OK." -ForegroundColor Green

if ($Freeze) {
    Write-Host "[Python] Atualizando requirements.txt..."
    & $VenvPip freeze | Out-File -FilePath (Join-Path $Root "backend\requirements.txt") -Encoding utf8NoBOM
    Write-Host "[Python] requirements.txt atualizado." -ForegroundColor Green
}

# ── Node / Frontend ───────────────────────────────────────────
$FrontendPath = Join-Path $Root "frontend"

if (Test-Path $FrontendPath) {
    Write-Host "[Node] Instalando dependencias do frontend..."
    Push-Location $FrontendPath
    npm install --silent
    Pop-Location
    Write-Host "[Node] npm install OK." -ForegroundColor Green
} else {
    Write-Host "[Node] Pasta frontend nao encontrada, pulando." -ForegroundColor Yellow
}

Write-Host "`n=== Setup concluido! ===" -ForegroundColor Cyan
Write-Host ""
Write-Host "Para subir o backend:"
Write-Host "  .venv\Scripts\Activate.ps1" -ForegroundColor White
Write-Host "  python -m uvicorn backend.main:app --reload --port 8000" -ForegroundColor White
Write-Host ""
Write-Host "Para subir o frontend:"
Write-Host "  cd frontend && npm run dev" -ForegroundColor White
Write-Host ""

# ── Subir backend automaticamente se -Backend ─────────────────
if ($Backend) {
    Write-Host "[Backend] Ativando venv e subindo servidor..." -ForegroundColor Cyan
    & (Join-Path $VenvPath "Scripts\Activate.ps1")
    Set-Location $Root
    & $VenvPython -m uvicorn backend.main:app --reload --port 8000
}
