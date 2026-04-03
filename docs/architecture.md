# Metis Architecture

A Metis utiliza uma arquitetura híbrida e escalável que une engenharia de dados moderna (Arquitetura Medalhão) com inteligência artificial de ponta (RAG).

## 🚀 Visão Geral
A stack utiliza **Next.js** no frontend, **FastAPI** como maestro no backend, e **Llama 3 (Ollama)** rodando soberanamente via **Cloudflare Tunnels**. A inteligência é potencializada por um sistema robusto baseado em **OpenRAG** utilizando **Supabase Puro (PostgreSQL + pgvector)** como motor vetorial atômico e repositório estruturado, além de um fluxo de dados automatizado via **GitHub Actions** armazenando dados brutos no **Cloudflare R2 (Bronze)**.

## 📐 Diagrama de Fluxo
graph TD
    subgraph "External Sources"
        RiotAPI[Riot Match-v5 & Timeline API]
        Wiki[League Wiki Scraper]
        Guides[Mobafire/Probuilds Scraper]
    end

    subgraph "Ingestion Layer (GitHub Actions)"
        GAA[Action: Match Data]
        GAB[Action: Wiki Data]
        GAC[Action: Guide Data]
    end

    subgraph "Storage Layer"
        R2[(Cloudflare R2 - Bronze)]
        Supa[(Supabase Postgres + pgvector - Silver/Gold)]
    end

    subgraph "Internal Intelligence Layer (Backend)"
        API[API Endpoints]
        Core[Core Logic & Agent]
        Models[Data Models]
        Ollama[Ollama local + Llama 3]
        Tunnel[Cloudflare Tunnel]
    end

    subgraph "Frontend (Next.js)"
        Next[Dashboard & Chat]
    end

    RiotAPI --> GAA --> R2
    R2 --> GAA --> Supa
    Wiki --> GAB --> Supa
    Guides --> GAC --> Supa

    Next <--> API
    API <--> Core
    Core <--> Models
    Core <--> Supa
    Core <--> Tunnel <--> Ollama
```

## Data Layers / Segurança
- **Bronze (R2):** Raw JSON from Riot API. Keep everything for audit/re-processing.
- **Silver / Gold (Supabase):** Structured data (Player stats, events) and Vectorized strategic knowledge (Guides, tips) armazenados com `pgvector`. Todo o acesso respeita as políticas de **Row Level Security (RLS)** definindo forte isolamento de tenant.
