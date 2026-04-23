# 🦅 Metis

**Bem-vinde!**

Metis é uma aliada estratégica de alto nível para jogadores de League of Legends. Combinando o poder de LLMs (Gemini 2.5 Flash em produção, Llama 3 via Ollama no dev local) com uma arquitetura de dados robusta (RAG sobre pgvector + OpenRAG), a Metis não apenas exibe estatísticas, mas "entende" o estado do jogo e oferece sabedoria tática real.

**Versão atual**: p-0.9.22 (Alpha). Próximo marco: Beta v1.0.0 — requer os 5 tickets de backend documentados em [.speckit/plano_backend_decisoes.md](.speckit/plano_backend_decisoes.md).

## 🧑‍💻 Equipe Principal
- **César (Tech Lead, Data Eng & CI/CD) - [LinkedIn](https://www.linkedin.com/in/cesar-sibila/):** Maestro da infraestrutura e engenharia de dados. Focado na orquestração de deploy via CI/CD (Actions) e sustentação atômica. Como Tech Lead, também guia e revisa ativamente as formatações e mudanças técnicas desenvolvidas pelos parceiros.
- **Takida (Frontend & UX Engineer):** Responsável por dar vida e fluidez aos dados na interface visual com Next.js, mantendo uma experiência visual premium (Tailwind) e fluxos seguros de Auth.
- **André (Backend, Python & AI Engineer) - [LinkedIn](https://www.linkedin.com/in/andre-messina-506179239/):** Engenheiro polivalente sedento por arquitetura. Fundador de grande parte do esqueleto do **FastAPI**, além de ser o estrategista cognitivo que doma o modelo Llama 3 (Prompt Engineer) conectando-o precisamente com o OpenRAG.

## 🏗️ Estrutura do Projeto

A arquitetura é dividida entre a Pipeline de Engenharia de Dados (Extração/Processamento) e a Aplicação Web.

- `/scripts` (Motor de Dados):
  - `/ingestion`: Scripts de extração bruta (Riot API via RiotWatcher e Web Scraping via Playwright).
  - `/processing`: Scripts de transformação e carga (ETL) alimentando o banco de dados (Camada Prata) e computando agregadas (Camada Gold) a partir do R2.
  - `/scrapers`: Scrapers especializados (Mobafire, Probuilds).
  - `/utils`: Helpers compartilhados.
- `/tests`: Ambiente de TDD (Test-Driven Development) com mocks de banco de dados para garantir a integridade da lógica.
- `/data`: Armazenamento local temporário (Ex: `/raw/guides_preview` para revisão Human-in-the-Loop). **Gitignored**.
- `/analysis`: Spikes locais de análise (power curve, comp heuristics). **Gitignored**.
- `/frontend`: Aplicação Next.js (Dashboard, Chat, `/account`, `/auth`, `/admin`).
- `/backend`: API FastAPI (Orquestração do Agente & Ferramentas).
- `/infra`: Configurações de Deploy, CI/CD e Docker.
- `/docs`: Inteligência de projeto, diagramas de arquitetura e dicionário de dados.
- `/.speckit`: Estado centralizado do AI Context Director — `plano_atual.md`, `patch_notes.md`, `plano_backend_decisoes.md`, `handoffs/` (bundles do Claude Design), `templates/` (CSVs pra preencher localmente).

## 🛠️ Stack Tecnológica

- **Linguagens:** Python 3.12 (Engenharia de Dados/Backend), TypeScript (Frontend).
- **Engenharia de Dados (Scraping & ETL):** Playwright, BeautifulSoup4, RiotWatcher, **Polars** (ETL rápido).
- **Arquitetura Medalhão de Dados:**
  - **Bronze (R2)** — Cloudflare R2 (S3-compatible) é **source of truth**: JSONs brutos da Riot (`matches/`, `timelines/`) ficam ali indefinidamente. Custo: ~$0.015/GB/mês.
  - **Silver (Supabase)** — PostgreSQL 17 + pgvector guarda **só a season atual** (dados estruturados, tabelas relacionais, timeline de partidas recentes). Rotação automática semanal apaga partidas antigas do DB — o JSON cru continua no R2.
  - **Gold (tabelas materialized no Supabase)** — stats agregadas (`stats_champion_aggregate`, `stats_item_aggregate`) computadas em batch **a partir do R2** via Polars. Tierlist, WR de campeão e WR de item leem daqui em <50ms.
  - Escalabilidade: 5M de partidas em R2 ≈ $45/mês; manter tudo no DB exigiria plano Supabase Team ($599+). **13× mais barato**.
- **Inteligência Artificial:**
  - **Produção**: Gemini 2.5 Flash (via Google AI) — escolhido por custo (~10× mais barato que Haiku pro volume esperado).
  - **Dev local / fallback**: Llama 3 + Gemma 4 via Ollama.
  - **Cache**: Cloudflare KV (TTL 24h/7d conforme tipo de resposta).
- **Infraestrutura:** GitHub Actions (Automação ETL), Vercel (Frontend), Railway (Backend FastAPI), Cloudflare Tunnel.
- **i18n:** `next-intl` cookie-based (PT/EN, 15 namespaces, ~700 chaves).

> [!TIP]
> Confira o detalhamento completo da nossa [Stack de Tecnologia](docs/tech_stack.md) e as decisões arquiteturais em [`.speckit/plano_backend_decisoes.md`](.speckit/plano_backend_decisoes.md).

## 🚀 Como Começar (Setup de Desenvolvimento)

### 1. Setup Automático (Windows — recomendado)

Na raiz do projeto, rode o script de bootstrap:

```powershell
.\setup.ps1
```

Isso cria/valida o `.venv`, instala todos os pacotes Python e roda `npm install` no frontend automaticamente.

**Flags opcionais:**
```powershell
.\setup.ps1 -Freeze    # atualiza requirements.txt com o estado atual do venv
.\setup.ps1 -Backend   # setup + sobe o backend em localhost:8000
```

### 2. Subindo os serviços

**Backend (FastAPI):** sempre rodar da raiz do projeto para os imports funcionarem.
```powershell
.venv\Scripts\Activate.ps1
python -m uvicorn backend.main:app --reload --port 8000
# Swagger disponível em http://localhost:8000/docs
```

**Frontend (Next.js):**
```bash
cd frontend
npm run dev   # http://localhost:3000
```

### 3. Variáveis de Ambiente

O projeto tem **dois arquivos `.env`** — um para o backend/scripts e outro para o frontend. Ambos estão no `.gitignore` e **nunca devem ser commitados**.

#### `/.env` — Backend, Scripts e CI/CD

Copie o template e preencha com suas credenciais:

```bash
cp .env.example .env
```

| Variável | Onde obter |
|----------|-----------|
| `RIOT_API_KEY` | [developer.riotgames.com](https://developer.riotgames.com) |
| `SUPABASE_URL` | Painel Supabase → Settings → API |
| `SUPABASE_KEY` | Painel Supabase → Settings → API (anon/service_role) |
| `CLOUDFLARE_R2_ACCOUNT_ID` | Painel Cloudflare → R2 → Manage R2 API Tokens |
| `CLOUDFLARE_R2_ACCESS_KEY_ID` | Idem |
| `CLOUDFLARE_R2_SECRET_ACCESS_KEY` | Idem |
| `CLOUDFLARE_R2_BUCKET_NAME` | Nome do bucket criado no R2 (ex: `metis`) |
| `OLLAMA_BASE_URL` | URL do Ollama local ou via Cloudflare Tunnel |
| `CLOUDFLARE_TUNNEL_URL` | Painel Cloudflare → Zero Trust → Tunnels |

> As mesmas variáveis (exceto `RIOT_API_KEY`) devem ser configuradas como **GitHub Secrets** para os Actions de ingestão e processamento rodarem em produção.

---

#### `/frontend/.env` — Next.js (Frontend)

Copie o template e preencha:

```bash
cp frontend/.env.example frontend/.env
```

| Variável | Onde obter |
|----------|-----------|
| `NEXT_PUBLIC_SUPABASE_URL` | Painel Supabase → Settings → API |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Painel Supabase → Settings → API (chave anon pública) |
| `NEXT_PUBLIC_API_URL` | URL do backend no Railway (ex: `https://metis-api.up.railway.app`) |

> Para **deploy no Vercel**: configure as mesmas 3 variáveis no painel do projeto em Settings → Environment Variables.

---