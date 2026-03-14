# Diagrama de Dados do projeto Metis


```mermaid
graph TD
    %% Estilos
    classDef user fill:#2d3748,stroke:#fff,stroke-width:2px,color:#fff
    classDef front fill:#000000,stroke:#fff,stroke-width:2px,color:#fff
    classDef back fill:#10b981,stroke:#fff,stroke-width:2px,color:#fff
    classDef actions fill:#2563eb,stroke:#fff,stroke-width:2px,color:#fff
    classDef bronze fill:#b45309,stroke:#fff,stroke-width:2px,color:#fff
    classDef prata fill:#94a3b8,stroke:#000,stroke-width:2px,color:#000
    classDef ouro fill:#eab308,stroke:#000,stroke-width:2px,color:#000

    User((Usuário)):::user -->|Acessa Dashboard/Chat| Vercel[Vercel<br>Frontend Next.js]:::front
    Vercel -->|Requisições API| Railway[Railway<br>Backend FastAPI]:::back

    subgraph "Fontes Externas"
        Riot[API da Riot]
        Moba[Mobafire / Guias]
    end

    subgraph "Ingestão (Data Lake)"
        Coleta[GitHub Actions<br>Scripts de Coleta]:::actions
        Riot --> Coleta
        Moba --> Coleta
        
        Bronze[(Camada Bronze<br>Cloudflare R2)]:::bronze
        Coleta -->|Salva Bruto Compactado| Bronze
    end

    subgraph "Data Warehouse"
        Limpeza[GitHub Actions<br>Scripts de Limpeza]:::actions
        Bronze -->|Lê arquivos brutos| Limpeza
        
        Prata[(Camada Prata<br>Supabase SQL)]:::prata
        Limpeza -->|Filtra remakes, AFKs, <3min| Prata
    end

    subgraph "Refinamento e IA (Serving Layer)"
        Vetorizacao[GitHub Actions<br>Script de Vetorização]:::actions
        Agregacao[GitHub Actions<br>Script de Agregação Gold]:::actions
        
        Bronze -->|Lê textos limpos| Vetorizacao
        Prata -->|Lê partidas limpas| Agregacao
        
        Ouro_Vector[(Camada Ouro: pgvector<br>Supabase - Embeddings)]:::ouro
        Ouro_SQL[(Camada Ouro: SQL<br>Supabase - Agregações)]:::ouro
        
        Vetorizacao -->|Grava Vetores| Ouro_Vector
        Agregacao -->|Grava Estatísticas| Ouro_SQL
    end

    Railway <-->|Consulta Stats Instantâneas| Ouro_SQL
    Railway <-->|Busca Semântica RAG| Ouro_Vector
```


Breve descrição:

- Objetivo: representar entidades e relacionamentos principais do Metis.
- Local de referência: pasta `notes/00 - Visao_Geral_e_Arquitetura`.
