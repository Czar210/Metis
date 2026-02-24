# Metis Architecture

A Metis utiliza uma arquitetura híbrida e escalável que une engenharia de dados moderna (Arquitetura Medalhão) com inteligência artificial de ponta (RAG).

## 🚀 Visão Geral
A stack utiliza **Next.js** no frontend, **FastAPI** como maestro no backend, e **Llama 3 (Ollama)** rodando soberanamente via **Cloudflare Tunnels**. A inteligência é potencializada por um sistema de **RAG** utilizando **Pinecone** e um fluxo de dados automatizado via **GitHub Actions** para o **Cloudflare R2 (Bronze)** e **Supabase (Prata/Ouro)**.

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
        Supa[(Supabase Postgres - Silver)]
        Pine[(Pinecone Vector - Gold)]
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
    Guides --> GAC --> Pine

    Next <--> API
    API <--> Core
    Core <--> Models
    Core <--> Supa
    Core <--> Pine
    Core <--> Tunnel <--> Ollama
```

## Data Layers
- **Bronze (R2):** Raw JSON from Riot API. Keep everything for audit/re-processing.
- **Silver (Supabase):** Structured and cleaned data. Player stats, champion ratios, game events.
- **Gold (Pinecone):** Vectorized strategic knowledge. Guides, pro-tips, and contextual analysis.
