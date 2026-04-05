# CLAUDE.md — Guia do Executor (Metis)

> Leia este arquivo **antes de qualquer ação**. Ele define a arquitetura, o fluxo de trabalho e as regras de ouro do projeto Metis.

## 1. O que é o Metis

Metis é uma aliada estratégica para jogadores de League of Legends. Combina uma pipeline robusta de engenharia de dados (Riot API → Cloudflare R2 → Supabase) com um agente de IA (Llama 3 via Ollama + RAG) para entregar sabedoria tática real, não apenas estatísticas.

---

## 2. Equipe — Adapte o Escopo ao Membro

| Membro | Papel | Foco Técnico |
|--------|-------|--------------|
| **César (Tech Lead)** | Data Architect, CI/CD, Code Reviewer | Python/Polars, GitHub Actions, Supabase SQL, Cloudflare R2, Railway |
| **André** | Backend & AI Engineer | FastAPI, Prompt Engineering, Llama 3, OpenRAG |
| **Takida** | Frontend & UX | Next.js (App Router), Tailwind CSS, Supabase Auth |

César revisa e aprova o código dos outros. Trate-o com abstração estruturada e zero enrolação.

---

## 3. Stack Canônica (Source of Truth)

| Camada | Tecnologia | Observação |
|--------|-----------|------------|
| Frontend | Next.js + Tailwind CSS | Vercel |
| Backend API | FastAPI (Python 3.12) | Railway, Docker |
| Banco Estruturado | Supabase (PostgreSQL) | Silver/Gold |
| Busca Vetorial | **pgvector (nativo Supabase)** | ⚠️ NÃO é Pinecone |
| RAG Orchestration | **OpenRAG** (Langflow + Docling + OpenSearch) | Substitui Pinecone |
| Data Lake Bronze | Cloudflare R2 (S3-compatible) | Dados brutos .gz |
| LLM | Llama 3 via Ollama | Exposto via Cloudflare Tunnel |
| CI/CD | GitHub Actions | Automação de ingestão e ETL |
| Processamento | Python Polars | Mais rápido que Pandas |

> **CRÍTICO:** O Pinecone foi abandonado. Qualquer referência a `PINECONE_API_KEY` ou SDK do Pinecone é código morto/obsoleto. O stack vetorial é Supabase pgvector + OpenRAG.

---

## 4. Arquitetura Medalhão (Data Flow)

```
Riot API / Mobafire / Probuilds
          ↓
   GitHub Actions (Ingestão)
          ↓
  Cloudflare R2 (Bronze — JSONs brutos .gz)
          ↓
  Scripts ETL Python (Limpeza/Transformação)
          ↓
  Supabase PostgreSQL (Silver — dados estruturados)
          ↓
  Supabase pgvector + OpenRAG (Gold — vetores + busca híbrida)
          ↓
  FastAPI ←→ Langflow ←→ Ollama (Llama 3)
          ↓
       Next.js (Dashboard + Chat)
```

---

## 5. Estado Atual dos Milestones

| Milestone | Status | Responsável |
|-----------|--------|-------------|
| M1: Setup & Endpoints Base | ✅ Concluído | — |
| M2: Engenharia de Dados & Scrapers | 🔄 Em progresso | César |
| M3: Interface & UX | ⬜ Pendente | Takida |
| M4: Orquestração RAG & IA | ⬜ Pendente | André / Todos |
| M5: Qualidade & Testes | ✅ Concluído (API Metis) | César + Claude |

**Bloqueios restantes no M2 (César):**
1. Mobafire scraper — Playwright quebrado, precisa bugfix + Action semanal
2. `process_timelines.py` — falta loop + GitHub Action (lógica pronta)

### Coluna [Revisão] no Trello = César + Claude

Cards na coluna [Revisão] são tarefas finalizadas aguardando validação conjunta ou o card de Testes Funcionais (M5) que é responsabilidade de César + Claude executar. Ver checklist completa em `.speckit/plano_atual.md`.

---

## 6. Regras de Ouro do Executor

### SEMPRE
- Consulte `.speckit/plano_atual.md` para estado atual dos tickets.
- Consulte `.speckit/bugfixes.md` antes de iniciar qualquer feature — bugs bloqueadores têm precedência absoluta.
- Atualize `.speckit/patch_notes.md` ao fechar um bloco significativo de trabalho.
- Use **transações atômicas** em qualquer mutação no banco (DDL, bulk inserts, dumps SQL).
- Respeite **RLS (Row Level Security)** do Supabase — isolamento de tenant é inquebrável.
- Escreva testes pytest para todo caminho feliz, edge-cases e tentativas de injeção antes de declarar uma feature "pronta".

### NUNCA
- Não invente arquiteturas fora do escopo aprovado (sem Pinecone, sem LangChain direto no FastAPI, sem ORMs não documentados).
- Não classifique algo como "concluído" sem evidência de teste rodando.
- Não referencie arquivos hipotéticos — leia o disco, trace a realidade.
- Não adicione features não solicitadas, refatorações desnecessárias ou docstrings em código que não foi alterado.
- Não faça `git push` sem autorização explícita do César.

### FLUXO OBRIGATÓRIO (antes de escrever código)
1. Leia os arquivos relevantes (não escreva sem ler).
2. Apresente o **Implementation Plan** com tags `[NEW]`, `[MODIFY]`, `[DELETE]` e critérios de aceite.
3. Aguarde o **"Aval total"** do César.
4. Execute de forma atômica.
5. Rode os testes.
6. Atualize `.speckit/`.

---

## 7. Estrutura de Diretórios

```
Metis/
├── .speckit/           # Estado centralizado do AI Context Director
│   ├── plano_atual.md  # Milestones e tickets (fonte da verdade)
│   ├── bugfixes.md     # Blockers e bugs punitivos
│   └── patch_notes.md  # Diário de mudanças
├── backend/            # FastAPI — ver backend/CLAUDE.md
├── frontend/           # Next.js
├── scripts/            # ETL e scrapers — ver scripts/CLAUDE.md
│   ├── ingestion/      # Riot API, Mobafire, Probuilds
│   └── processing/     # Bronze → Prata transformations
├── data/               # Armazenamento local temporário (raw, processed)
├── database/           # DDL Supabase, migrations
├── infra/              # Docker, CI/CD configs
├── docs/               # Arquitetura, tech stack, membros
├── notes/              # Obsidian vault (decisões ADR, glossário)
└── tests/              # Pytest (TDD)
```

---

## 8. Variáveis de Ambiente Esperadas

### No `.env` local (backend/) e no Railway
| Variável | Uso |
|----------|-----|
| `RIOT_API_KEY` | RiotWatcher — ingestão de partidas |
| `SUPABASE_URL` | Conexão Supabase (ex: `https://ebwplwizjsevhcowyfhg.supabase.co`) |
| `SUPABASE_KEY` | service_role key do Supabase |
| `CLOUDFLARE_R2_ACCOUNT_ID` | Cloudflare R2 |
| `CLOUDFLARE_R2_ACCESS_KEY_ID` | Cloudflare R2 |
| `CLOUDFLARE_R2_SECRET_ACCESS_KEY` | Cloudflare R2 |
| `CLOUDFLARE_R2_BUCKET_NAME` | Nome do bucket (= `metis`) |
| `CORS_ORIGINS` | Origens permitidas (produção: domínio Vercel) |

### No GitHub Actions (Settings → Secrets → Repository secrets)
> **Use exatamente estes nomes** — validados em 2026-04-04. Nomes diferentes causam secrets vazios silenciosamente.

| Secret | Workflows que usam |
|--------|-------------------|
| `RIOT_API_KEY` | fetch_high_elo_matches, fetch_pro_matches |
| `SUPABASE_URL` | process_matches, process_timelines |
| `SUPABASE_KEY` | process_matches, process_timelines |
| `CLOUDFLARE_R2_ACCOUNT_ID` | todos os 6 workflows |
| `CLOUDFLARE_R2_ACCESS_KEY_ID` | todos os 6 workflows |
| `CLOUDFLARE_R2_SECRET_ACCESS_KEY` | todos os 6 workflows |

> `PINECONE_API_KEY` = **REMOVIDA**. Se aparecer em algum arquivo, é resíduo a ser limpo.

---

## 9. Segurança (Red Teaming First)

Antes de fechar qualquer feature que envolva DDL, SQL dinâmico, CRUD ou endpoints públicos:
- Teste SQL injection nas entradas.
- Valide isolamento RLS — um tenant não pode ver dados de outro.
- Verifique escalação de privilégios nos endpoints FastAPI.
- Confirme que variáveis de ambiente sensíveis não estão hardcodadas ou expostas nos logs.
