# Fluxo de Vetorização (OpenRAG)

Descrição do pipeline de ingestão, vetorização e busca do Metis usando a plataforma **OpenRAG** (Langflow + Docling + OpenSearch).

> **Decisão arquitetural:** Ver [[ADR-003 Migração Pinecone para OpenRAG]]
> **Substitui:** [[Fluxo_de_Vetorizacao_Pinecone]] (deprecado)

---

## O que é o OpenRAG

O OpenRAG é uma plataforma RAG open-source e self-hosted criada pela equipe do Langflow. Ela empacota em um único deployment três ferramentas complementares:

| Componente | Papel no Pipeline | O que substitui no Metis |
|---|---|---|
| **Docling** | Ingestão e processamento de documentos | Pipeline manual de extração + normalização do `fetch_guides.py` |
| **OpenSearch** | Banco vetorial + busca híbrida (KNN + BM25) | Pinecone |
| **Langflow** | Orquestração visual dos fluxos RAG | Chamadas diretas ao LangChain/Ollama no `rag_service.py` |

O OpenRAG suporta Ollama nativamente como LLM provider — o Llama 3 continua sendo o modelo do Metis sem nenhuma mudança.

---

## Visão Geral do Novo Pipeline

```
data/processed/ (Parquet/JSONL)
        ↓
  Docling (ingestão + chunking inteligente)
        ↓
  Geração de embeddings (modelo configurado no Langflow)
        ↓
  Indexação no OpenSearch (vetores KNN + texto BM25)
        ↓
  Busca híbrida em tempo de consulta
        ↓
  Contexto enviado ao Llama 3 via Ollama
        ↓
  Resposta gerada ao usuário
```

---

## Etapa 1: Ingestão com Docling

O **Docling** recebe os documentos (guias em HTML/JSONL, PDFs de patch notes) e realiza:

- **Parsing estruturado:** Identifica seções, tabelas, listas e blocos de texto automaticamente — muito mais robusto que o BeautifulSoup manual
- **Chunking semântico:** Divide o documento em chunks respeitando fronteiras naturais de seção, sem cortar no meio de uma frase ou conceito
- **Normalização:** Remove HTML residual, unicode problemático e blocos de anúncio
- **Enriquecimento de metadados:** Adiciona `champion_slug`, `patch_version`, `section_type` e `source_url` a cada chunk antes da indexação

Comparado ao pipeline anterior, o Docling elimina o código manual de normalização e chunking que vivía no script de ingestão.

---

## Etapa 2: Indexação no OpenSearch

### Por que OpenSearch em vez de Pinecone?

O OpenSearch é um motor de busca e analytics open-source (fork do Elasticsearch) que suporta dois tipos de busca em paralelo:

**Busca Vetorial (KNN — K-Nearest Neighbors)**
Funciona igual ao Pinecone: o chunk é convertido em vetor de embedding e armazenado. Na busca, a query também é vetorizada e o OpenSearch retorna os N vetores mais próximos por similaridade de cosseno.

**Busca por Palavra-Chave (BM25)**
Busca textual clássica baseada em frequência de termos. Essencial para nomes próprios do LoL que têm grafia exata (campeões, itens, habilidades). "Infinity Edge", "Gangplank", "R do Zed" são casos onde BM25 supera busca semântica pura.

### Busca Híbrida: o Melhor dos Dois Mundos

O OpenRAG combina os dois scores via **Reciprocal Rank Fusion (RRF)** — um algoritmo que funde as listas ranqueadas de vetorial e BM25 sem depender de pesos mágicos:

```
Score_final(chunk) = RRF(rank_vetorial, rank_BM25)
```

Resultado: perguntas vagas ("como jogar ADC no late game?") são respondidas pela busca semântica, enquanto perguntas específicas ("build do Jinx contra Draven") se beneficiam da correspondência exata de nomes.

### Configuração do Índice

```json
{
  "index_name": "metis-guides",
  "knn": true,
  "knn_vector_dimension": 384,
  "similarity": "cosine",
  "mappings": {
    "champion_slug": "keyword",
    "patch_version": "keyword",
    "section_type": "keyword",
    "guide_text": "text (BM25)",
    "embedding": "knn_vector"
  }
}
```

A separação entre campos `keyword` (filtragem exata) e `text` (BM25 full-text) é fundamental para a busca híbrida funcionar corretamente.

---

## Etapa 3: Orquestração com Langflow

O **Langflow** é a interface visual onde o pipeline RAG é montado e gerenciado. Em vez de hardcodar o fluxo no `rag_service.py`, o time cria e itera o pipeline arrastando componentes em uma tela.

O fluxo principal no Langflow para o Metis:

```
[Input do usuário]
      ↓
[Classificador de Intenção]  ← novo! (era no backlog)
      ↓
[Retriever OpenSearch - Busca Híbrida]
      ↓
[Reranker]  ← novo! (era no backlog)
      ↓
[Prompt Template com contexto]
      ↓
[Ollama - Llama 3]
      ↓
[Output formatado]
```

Features do backlog que o Langflow viabiliza **sem escrever código**:
- Roteamento de intenção (build vs matchup vs geral)
- Reranking dos chunks recuperados
- Memória de conversa (janela de mensagens anteriores)

---

## Deploy do OpenRAG

O OpenRAG é deployado via Docker Compose com todos os serviços incluídos:

```yaml
services:
  openrag:      # Interface principal + Langflow
  opensearch:   # Banco vetorial + busca
  docling:      # Processador de documentos
```

No contexto do Metis:
- **Desenvolvimento local:** `docker compose up` na máquina do time
- **Produção:** Deploy no Railway com o mesmo `docker-compose.yml`

O backend FastAPI (`rag_service.py`) passa a chamar a API do Langflow em vez de instanciar LangChain diretamente, simplificando o código Python.

---

## Migração do Pinecone

Para completar a migração, os passos são:

1. Fazer o deploy do OpenRAG (Docker Compose)
2. Reexecutar o pipeline de ingestão — os guias da camada Prata são reingeridos via Docling no OpenSearch
3. Atualizar o `rag_service.py` para chamar a API do Langflow em vez do SDK do Pinecone
4. Remover as variáveis de ambiente do Pinecone (`PINECONE_API_KEY`, `PINECONE_INDEX`)
5. Validar respostas do novo pipeline com perguntas de referência

---

## Conceitos Relacionados

- [[ADR-003 Migração Pinecone para OpenRAG]] — a decisão que motivou esta mudança
- [[RAG]] — o padrão arquitetural que este pipeline implementa
- [[Busca Semântica]] — o que é e como o OpenSearch a executa
- [[Embedding]] — como os vetores são gerados antes da indexação
- [[Prompts_do_Llama3]] — os templates que recebem o contexto recuperado
- [[Backend_FastAPI]] — onde a API do Langflow é chamada em produção
