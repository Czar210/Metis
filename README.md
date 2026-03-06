# 🦅 Metis

Metis é uma aliada estratégica de alto nível para jogadores de League of Legends. Combinando o poder de Agentes de IA (Llama 3 via Ollama) com uma arquitetura de dados robusta (RAG - Retrieval-Augmented Generation), a Metis não apenas exibe estatísticas, mas "entende" o estado do jogo e oferece sabedoria tática real.

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
  - Supabase (PostgreSQL) para dados estruturados (Partidas, Timelines).
  - Cloudflare R2 (Object Storage S3) para dados brutos e JSONs de guias.
  - Pinecone (Vector DB) para busca semântica da IA.
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
