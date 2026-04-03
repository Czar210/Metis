# 🦅 Metis

**Bem-vinde!**

Metis é uma aliada estratégica de alto nível para jogadores de League of Legends. Combinando o poder de Agentes de IA (Llama 3 via Ollama) com uma arquitetura de dados robusta (RAG - Retrieval-Augmented Generation), a Metis não apenas exibe estatísticas, mas "entende" o estado do jogo e oferece sabedoria tática real.

## 🧑‍💻 Equipe Principal
- **César (Tech Lead, Data Eng & CI/CD) - [LinkedIn](https://www.linkedin.com/in/cesar-sibila/):** Maestro da infraestrutura e engenharia de dados. Focado na orquestração de deploy via CI/CD (Actions) e sustentação atômica. Como Tech Lead, também guia e revisa ativamente as formatações e mudanças técnicas desenvolvidas pelos parceiros.
- **Takida (Frontend & UX Engineer):** Responsável por dar vida e fluidez aos dados na interface visual com Next.js, mantendo uma experiência visual premium (Tailwind) e fluxos seguros de Auth.
- **André (Backend, Python & AI Engineer) - [LinkedIn](https://www.linkedin.com/in/andre-messina-506179239/):** Engenheiro polivalente sedento por arquitetura. Fundador de grande parte do esqueleto do **FastAPI**, além de ser o estrategista cognitivo que doma o modelo Llama 3 (Prompt Engineer) conectando-o precisamente com o OpenRAG.

## 🏗️ Estrutura do Projeto

A arquitetura é dividida entre a Pipeline de Engenharia de Dados (Extração/Processamento) e a Aplicação Web.

- `/scripts` (Motor de Dados):
  - `/ingestion`: Scripts de extração bruta (Riot API via RiotWatcher e Web Scraping via Playwright).
  - `/processing`: Scripts de transformação e carga (ETL) alimentando o banco de dados (Camada Prata).
  - `/tests`: Ambiente de TDD (Test-Driven Development) com mocks de banco de dados para garantir a integridade da lógica.
- `/data`: Armazenamento local temporário (Ex: `/raw/guides_preview` para revisão Human-in-the-Loop).
- `/frontend`: Aplicação Next.js (Dashboard & Interface do Chat).
- `/backend`: API FastAPI (Orquestração do Agente & Ferramentas).
- `/infra`: Configurações de Deploy, CI/CD e Docker.
- `/docs`: Inteligência de projeto, diagramas de arquitetura e dicionário de dados.

## 🛠️ Stack Tecnológica

- **Linguagens:** Python 3.12 (Engenharia de Dados/Backend), TypeScript (Frontend).
- **Engenharia de Dados (Scraping & ETL):** Playwright, BeautifulSoup4, RiotWatcher.
- **Armazenamento de Dados:**
  - Supabase (PostgreSQL + pgvector) para dados estruturados e busca semântica.
  - Cloudflare R2 (Object Storage S3) para dados brutos e JSONs de guias.
- **Inteligência Artificial:** Llama 3 (via Ollama local/nuvem).
- **Infraestrutura:** GitHub Actions (Automação ETL), Vercel (Frontend), Railway (Backend), Cloudflare Tunnel.

> [!TIP]
> Confira o detalhamento completo da nossa [Stack de Tecnologia](docs/tech_stack.md).

## 🚀 Como Começar (Setup de Desenvolvimento)

### 1. Preparando o Ambiente
Clone o repositório e crie o seu ambiente virtual Python para isolar as dependências:

```bash
git clone [https://github.com/SeuUsuario/Metis.git](https://github.com/SeuUsuario/Metis.git)
cd Metis
python -m venv .venv

# Ative o ambiente virtual
# No Windows:
.venv\Scripts\activate
# No Linux/Mac:
source .venv/bin/activate
```

### 2. Instalando Dependências

**Backend / Scripts (Python):**
```bash
pip install -r requirements.txt
```

**Frontend (Next.js):**
```bash
cd frontend
npm install
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