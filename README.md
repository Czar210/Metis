# 🦅 Metis

**Metis** é uma aliada estratégica de alto nível para jogadores de League of Legends. Combinando o poder do Agente AI (Llama 3 via Ollama) com uma arquitetura de dados robusta (RAG), a Metis não apenas mostra estatísticas, mas "entende" o jogo.

## 🏗️ Estrutura do Projeto

- `/frontend`: Aplicação Next.js (Dashboard & Chat).
- `/backend`: API FastAPI (Agente & Ferramentas).
    - `/app`: Lógica principal.
    - `/api`: Endpoints.
    - `/models`: Schemas de dados.
- `/scripts`: Motores de processamento.
    - `/ingestion`: Fluxos Riot API.
    - `/scrapers`: Wiki & Guias.
- `/infra`: Configurações de Deploy e Docker.
- `/tests`: Garantia de qualidade (Unit & Integration).
- `/docs`: Inteligência de projeto, diagramas de arquitetura e modelos de dados.

## 🛠️ Tecnologias

- **Linguagem:** Python (Backend/Scripts), TypeScript (Frontend).
- **IA:** Ollama (Llama 3), Pinecone (Vector DB), Cloudflare Tunnel.
- **Dados:** Supabase (Postgres), Cloudflare R2 (Object Storage).
- **Infra:** GitHub Actions (ETL), Vercel (Frontend), Railway (Backend).

> [!TIP]
> Confira o detalhamento completo da nossa [Stack de Tecnologia](docs/tech_stack.md).

## 🚀 Começando

1. Clone o repositório.
2. Copie o `.env.example` para `.env` e preencha as chaves.
3. Consulte o [Roadmap (`todo.md`)](todo.md) para o status atual do desenvolvimento.
4. Veja a [Arquitetura](docs/architecture.md) para entender o fluxo de dados.

---
*Maturidade técnica e estratégia em um só lugar.*
