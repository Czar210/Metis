"""
Testes funcionais das mudanças do André (andre_changes.md — 2026-03-26)
Cobre:
  1. CORS configurável via variável de ambiente
  2. Health check versionado em /api/v1/health
  4. Bug tracker (arquivo existência)
  5. Modelo ChatRequest (validação Pydantic)
  6. Esqueleto POST /api/v1/chat
"""
import os
import pytest
from fastapi.testclient import TestClient

# Garante que não há vars de ambiente interferindo antes de importar o app
os.environ.pop("CORS_ORIGINS", None)
os.environ.pop("RIOT_API_KEY", None)
os.environ.pop("CLOUDFLARE_R2_BUCKET_NAME", None)

from backend.main import app  # noqa: E402

client = TestClient(app, raise_server_exceptions=True)


# ─────────────────────────────────────────────────────────────────────────────
# Mudança 2: Health check versionado
# ─────────────────────────────────────────────────────────────────────────────

class TestHealthCheck:
    def test_health_returns_200(self):
        """GET /api/v1/health deve retornar 200."""
        response = client.get("/api/v1/health")
        assert response.status_code == 200

    def test_health_body(self):
        """Corpo deve conter status=online e system=Metis."""
        response = client.get("/api/v1/health")
        data = response.json()
        assert data["status"] == "online"
        assert data["system"] == "Metis"

    def test_old_route_does_not_exist(self):
        """Rota /health (sem prefixo) não deve existir após versionamento."""
        response = client.get("/health")
        assert response.status_code == 404


# ─────────────────────────────────────────────────────────────────────────────
# Mudança 5 + 6: ChatRequest (Pydantic) + POST /api/v1/chat
# ─────────────────────────────────────────────────────────────────────────────

class TestChatEndpoint:
    def test_chat_caminho_feliz(self):
        """POST /api/v1/chat com corpo válido deve retornar 200."""
        response = client.post("/api/v1/chat", json={"mensagem": "Como jogar Jinx?"})
        assert response.status_code == 200

    def test_chat_retorna_status_skeleton(self):
        """Enquanto a IA não está conectada, status deve ser 'skeleton'."""
        response = client.post("/api/v1/chat", json={"mensagem": "Qual a build do Zed?"})
        data = response.json()
        assert data["status"] == "skeleton"

    def test_chat_resposta_contem_mensagem_original(self):
        """A resposta de placeholder deve ecoar a mensagem enviada."""
        msg = "Como escalar no ranked?"
        response = client.post("/api/v1/chat", json={"mensagem": msg})
        data = response.json()
        assert msg in data["resposta"]

    def test_chat_sem_campo_mensagem_retorna_422(self):
        """Pydantic deve rejeitar body sem o campo 'mensagem' com 422."""
        response = client.post("/api/v1/chat", json={})
        assert response.status_code == 422

    def test_chat_campo_mensagem_nulo_retorna_422(self):
        """Pydantic deve rejeitar 'mensagem: null' com 422."""
        response = client.post("/api/v1/chat", json={"mensagem": None})
        assert response.status_code == 422

    def test_chat_body_vazio_retorna_422(self):
        """Body completamente vazio deve retornar 422."""
        response = client.post("/api/v1/chat", content=b"", headers={"Content-Type": "application/json"})
        assert response.status_code == 422

    def test_chat_campo_errado_retorna_422(self):
        """Campo com nome errado ('message' em vez de 'mensagem') deve retornar 422."""
        response = client.post("/api/v1/chat", json={"message": "hello"})
        assert response.status_code == 422


# ─────────────────────────────────────────────────────────────────────────────
# Mudança 1: CORS configurável
# ─────────────────────────────────────────────────────────────────────────────

class TestCORS:
    def test_cors_localhost_aceito(self):
        """Origem localhost:3000 deve receber header Access-Control-Allow-Origin."""
        response = client.get(
            "/api/v1/health",
            headers={"Origin": "http://localhost:3000"}
        )
        assert response.status_code == 200
        assert response.headers.get("access-control-allow-origin") == "http://localhost:3000"

    def test_cors_preflight_localhost(self):
        """OPTIONS preflight de localhost:3000 deve retornar 200 com headers CORS."""
        response = client.options(
            "/api/v1/health",
            headers={
                "Origin": "http://localhost:3000",
                "Access-Control-Request-Method": "GET",
            }
        )
        assert response.status_code == 200
        assert "access-control-allow-origin" in response.headers

    def test_cors_origem_nao_permitida_nao_tem_header(self):
        """Origem não autorizada não deve receber header Access-Control-Allow-Origin."""
        response = client.get(
            "/api/v1/health",
            headers={"Origin": "http://evil.com"}
        )
        assert "access-control-allow-origin" not in response.headers


# ─────────────────────────────────────────────────────────────────────────────
# Mudança 4: Bug tracker (arquivo deve existir e ter estrutura mínima)
# ─────────────────────────────────────────────────────────────────────────────

class TestBugTracker:
    def test_arquivo_bugs_existe(self):
        """bugs.md deve existir na raiz do projeto."""
        assert os.path.isfile("bugs.md"), "bugs.md não encontrado na raiz"

    def test_arquivo_bugs_tem_template(self):
        """bugs.md deve conter o template de registro."""
        with open("bugs.md", encoding="utf-8") as f:
            content = f.read()
        assert "Status" in content
        assert "Descrição" in content
