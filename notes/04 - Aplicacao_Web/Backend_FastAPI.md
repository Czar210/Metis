# Backend FastAPI

Notas sobre a arquitetura do backend do Metis: endpoints, autenticação, integração com RAG e padrões de organização.

---

## Visão Geral

O backend do Metis é uma API REST construída com **FastAPI**, servida via **Uvicorn** e deployada no **Railway** com exposição via **Cloudflare Tunnels**. Ele é o ponto central que conecta:

- O frontend Next.js (requisições dos usuários)
- O sistema RAG (consulta ao Pinecone + Llama 3)
- O Supabase (autenticação e dados estruturados)

---

## Estrutura de Pastas

```
backend/
├── main.py                  ← Entry point (app FastAPI, middlewares, routers)
├── config.py                ← Settings via pydantic-settings (.env)
├── routers/
│   ├── __init__.py
│   ├── query.py             ← Endpoint principal de consulta ao RAG
│   ├── champions.py         ← Listagem e dados de campeões
│   └── auth.py              ← Validação de tokens JWT (Supabase)
├── services/
│   ├── rag_service.py       ← Orquestra Pinecone + Llama 3
│   ├── pinecone_service.py  ← Busca vetorial
│   └── llm_service.py       ← Chamadas ao Ollama/LangChain
├── models/
│   ├── query.py             ← Pydantic: QueryRequest, QueryResponse
│   └── champion.py          ← Pydantic: Champion, GuideMetadata
└── tests/
    └── test_query.py
```

---

## Endpoints Públicos e Privados

### Públicos (sem autenticação)

| Método | Rota | Descrição |
|---|---|---|
| `GET` | `/` | Health check — retorna versão e status |
| `GET` | `/champions` | Lista todos os campeões disponíveis |
| `GET` | `/champions/{slug}` | Detalhes de um campeão específico |

### Privados (requerem JWT válido do Supabase)

| Método | Rota | Descrição |
|---|---|---|
| `POST` | `/query` | Consulta principal ao RAG — recebe pergunta e retorna resposta do Llama 3 |
| `GET` | `/query/history` | Histórico de consultas do usuário autenticado |
| `POST` | `/query/feedback` | Registra feedback (👍/👎) sobre uma resposta |

---

## Endpoint Principal: `/query`

Este é o coração do sistema. Recebe a pergunta do usuário e orquestra todo o pipeline RAG.

### Request

```python
class QueryRequest(BaseModel):
    question: str                         # pergunta do usuário
    champion_slug: str | None = None      # opcional: filtrar por campeão
    patch_version: str | None = None      # opcional: filtrar por patch
    top_k: int = 5                        # número de chunks a recuperar
```

### Response

```python
class QueryResponse(BaseModel):
    answer: str                           # resposta gerada pelo Llama 3
    sources: list[GuideMetadata]          # chunks usados como contexto
    query_id: str                         # UUID para rastreamento e feedback
    latency_ms: int                       # tempo total de resposta
```

### Fluxo Interno do `/query`

```
1. Validar JWT do header Authorization
2. Gerar embedding da question
3. Buscar top-k chunks no Pinecone (filtrado por champion_slug/patch se fornecido)
4. Montar contexto com os chunks recuperados
5. Chamar Llama 3 via LangChain com o contexto
6. Salvar query + resposta no Supabase (para histórico e feedback)
7. Retornar QueryResponse
```

---

## Autenticação (Supabase JWT)

O Metis usa **Supabase Auth** para autenticação. O frontend faz login via Supabase Client e recebe um JWT. O backend valida esse token em todas as rotas privadas.

```python
from fastapi import Depends, HTTPException
from fastapi.security import HTTPBearer
from supabase import create_client

security = HTTPBearer()

async def get_current_user(token = Depends(security)):
    try:
        user = supabase.auth.get_user(token.credentials)
        return user
    except Exception:
        raise HTTPException(status_code=401, detail="Token inválido ou expirado")
```

---

## Injeção de Dependências

O FastAPI usa seu sistema nativo de `Depends()` para injetar serviços nas rotas. Isso facilita testes (mock dos serviços) e mantém as rotas limpas.

```python
@router.post("/query", response_model=QueryResponse)
async def query_rag(
    body: QueryRequest,
    user = Depends(get_current_user),
    rag: RAGService = Depends(get_rag_service),
):
    return await rag.query(body.question, body.champion_slug, body.top_k)
```

---

## Background Tasks

Operações que não precisam bloquear a resposta (como salvar logs e feedback) são executadas como background tasks:

```python
from fastapi import BackgroundTasks

@router.post("/query")
async def query(body: QueryRequest, background_tasks: BackgroundTasks, ...):
    response = await rag.query(body.question)
    background_tasks.add_task(save_query_log, body, response)
    return response
```

---

## CORS e Middlewares

```python
from fastapi.middleware.cors import CORSMiddleware

app.add_middleware(
    CORSMiddleware,
    allow_origins=["https://metis.vercel.app", "http://localhost:3000"],
    allow_methods=["GET", "POST"],
    allow_headers=["Authorization", "Content-Type"],
)
```

---

## Deploy no Railway

O Railway detecta automaticamente o `Dockerfile` ou `requirements.txt` e faz o deploy. Variáveis de ambiente (`PINECONE_API_KEY`, `SUPABASE_URL`, etc.) são configuradas no painel do Railway e carregadas via `pydantic-settings`.

A exposição pública do serviço Railway é feita via **Cloudflare Tunnels** — isso evita custos de IP estático e adiciona uma camada de proteção DDoS.

---

## Conceitos Relacionados

- [[Prompts_do_Llama3]] — os templates usados dentro do `llm_service.py`
- [[Fluxo_de_Vetorizacao_Pinecone]] — o índice que o `pinecone_service.py` consulta
- [[RAG]] — o padrão arquitetural que o `/query` implementa
- [[ADR-002 Supabase fonte única pra dados limpos]] — por que Supabase gerencia auth e dados
- [[Frontend_NextJS]] — o cliente que consome esta API
