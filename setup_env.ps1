# Metis - Script de Inicialização de Ambiente

Write-Host "🚀 Iniciando ambiente da Metis..." -ForegroundColor Cyan

# Verificando Docker
if (!(Get-Command docker -ErrorAction SilentlyContinue)) {
    Write-Host "❌ Docker não encontrado. Por favor, instale o Docker Desktop." -ForegroundColor Red
    exit
}

# Subindo os containers
Write-Host "📦 Subindo containers (Banco de Dados, Ollama, API)..." -ForegroundColor Yellow
docker-compose up -d

# Aguardando Ollama iniciar
Write-Host "🤖 Aguardando Ollama iniciar para baixar o Llama 3.1..." -ForegroundColor Yellow
Start-Sleep -Seconds 10

# Baixando o modelo
docker exec -it metis_ollama ollama pull llama3.1

Write-Host "✅ Ambiente pronto!" -ForegroundColor Green
Write-Host "📍 API: http://localhost:8000"
Write-Host "📍 Ollama: http://localhost:11434"
Write-Host "📍 DB: localhost:5432 (User: cesar, Pass: password, DB: metis)"
