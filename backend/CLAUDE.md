# CLAUDE.md — Backend (FastAPI)

> Contexto específico para trabalho no `/backend`. Leia também o `CLAUDE.md` da raiz.

## Stack

- **Python 3.12 + FastAPI** hospedado no Railway via Docker
- **Pydantic** para validação de contratos de entrada/saída
- **Supabase** como banco de dados (via `supabase-py` ou `asyncpg` direto)
- **CORS**: configurado via variável `CORS_ORIGINS` (não hardcode origens em produção)

## Estrutura

```
backend/
├── main.py          # Entry point: app FastAPI, CORS, rotas registradas
├── app/             # Lógica de negócio e serviços
├── core/            # Configurações, dependências, segurança
├── models/          # Modelos Pydantic (contratos de API)
└── requirements.txt
```

## Endpoints Existentes

| Método | Rota | Arquivo | Status |
|--------|------|---------|--------|
| GET | `/api/v1/health` | `main.py` | ✅ Operacional |
| POST | `/api/v1/ingestion/fetch-matches` | `main.py` | ✅ Operacional |
| POST | `/api/v1/player/update-history` | `routes/player.py` | ✅ Operacional |
| POST | `/api/v1/player/sync` | `routes/player.py` | ✅ Operacional |
| GET | `/api/v1/stats/champions` | `routes/stats.py` | ✅ Operacional |
| POST | `/api/v1/chat` | `main.py` | 🟡 Skeleton — aguarda integração Ollama/RAG |

> **Nota `/api/v1/stats/champions`:** filtro `?elo=` é aceito mas ignorado — sem dados de rank por partida no schema atual.

## Regras Específicas do Backend

- **Prefixo de rota obrigatório:** `/api/v1/` para todos os endpoints.
- **Nunca** instancie LangChain diretamente no FastAPI — a integração RAG passa pela API do Langflow (OpenRAG).
- **Chat endpoint** (`/api/v1/chat`): quando implementar a IA real, chamar a API do Langflow, não Ollama diretamente.
- **Models Pydantic** ficam em `models/` — um arquivo por domínio (ex: `match.py`, `chat.py`, `player.py`).
- Erros retornam `HTTPException` com `detail` descritivo. Nunca exponha stack traces em produção.
- Para qualquer operação de banco: use conexão assíncrona, nunca bloqueie o event loop.

## TODO Imediato (M4 — Integração IA)

1. Implementar `rag_service.py` que chama a API do Langflow (OpenRAG)
2. Substituir o skeleton do `/api/v1/chat` pela chamada real ao `rag_service`
3. Adicionar autenticação JWT (Supabase Auth) nos endpoints protegidos
4. Remover qualquer referência ao SDK do Pinecone

## Testes

Testes ficam em `/tests/` na raiz. Rode com:
```bash
pytest tests/ -v
```
Toda rota nova precisa de teste pytest cobrindo: caminho feliz, entrada inválida e (se aplicável) tentativa de injeção.
