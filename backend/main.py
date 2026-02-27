from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import os

# 1. Inicializa o servidor Metis
app = FastAPI(
    title="Metis API",
    description="Motor de processamento de dados e IA para League of Legends",
    version="0.1.0"
)

# 2. Configuração de CORS (Essencial para o "Escravo do Frontend" não travar)
# Isso permite que o Next.js converse com a sua API sem bloqueios do navegador
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Depois trocamos pelo domínio oficial da Vercel
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 3. Rota de Saúde (Health Check para o Railway)
@app.get("/")
async def root():
    return {
        "status": "online",
        "message": "Metis API está operante!",
        "version": "0.1.0"
    }

# 4. Rota de Teste para o Frontend
@app.get("/ping")
async def ping():
    return {"ping": "pong", "architect": "César - Pedreiro da Arquitetura"}
