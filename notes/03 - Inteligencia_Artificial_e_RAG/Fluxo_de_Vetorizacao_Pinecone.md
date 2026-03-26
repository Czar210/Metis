# Fluxo de Vetorização (Pinecone) — ⚠️ DEPRECADO

> **Esta nota está deprecada.**
> O Metis migrou do Pinecone para o **OpenRAG** (Langflow + Docling + OpenSearch).
> Consulte [[ADR-003 Migração Pinecone para OpenRAG]] para entender a decisão e [[Fluxo_de_Vetorizacao_OpenRAG]] para o pipeline atual.
> Esta nota é mantida apenas como referência histórica.

---

Descrição completa do processo de chunking, embedding e ingestão no Pinecone para alimentar o RAG do Metis (arquitetura anterior).

---

## Visão Geral do Pipeline

O pipeline de vetorização transforma os guias textuais (camada Prata) em vetores numéricos armazenados no Pinecone. É esse índice vetorial que permite a [[Busca Semântica]] — encontrar guias relevantes não por palavras-chave exatas, mas por proximidade de significado.

```
data/processed/ (Parquet)
        ↓
  Carregamento e chunking
        ↓
  Geração de embeddings
        ↓
  Upsert no índice Pinecone
        ↓
  RAG queries em produção
```

---

## Etapa 1: Chunking

Modelos de embedding têm limite de tokens (tipicamente 512 ou 8192 tokens). Guias do Mobafire podem ter muito mais texto que isso, então precisam ser divididos em **chunks** menores antes da vetorização.

### Estratégia de Chunking do Metis

O Metis usa **chunking por seção semântica** — em vez de cortar mecanicamente a cada N tokens, o texto é dividido pelas seções naturais do guia (introdução, runas, build de itens, matchups, etc.). Isso preserva o contexto de cada bloco.

Para seções muito longas, aplica-se um chunking secundário com overlap:

| Parâmetro | Valor | Motivo |
|---|---|---|
| `chunk_size` | 512 tokens | Compatível com a maioria dos modelos de embedding |
| `chunk_overlap` | 64 tokens | Preservar contexto entre chunks adjacentes |
| `separadores` | `\n\n`, `\n`, `. ` | Prioridade: parágrafo > linha > frase |

O overlap é crítico: se uma informação importante estiver no fim de um chunk e começo do próximo, sem overlap ela seria perdida na recuperação.

### Metadados por Chunk

Cada chunk carrega metadados que serão armazenados no Pinecone junto com o vetor:

```python
{
  "chunk_id": "jinx_guide_42_chunk_3",
  "guide_id": "jinx_guide_42",
  "champion_slug": "jinx",
  "section": "item_build",
  "patch_version": "14.5",
  "author": "Profesor_Akali",
  "rating": 9.2,
  "source_url": "https://www.mobafire.com/..."
}
```

Esses metadados permitem filtrar resultados no Pinecone antes mesmo de calcular similaridade (ex: "buscar apenas guias do patch atual").

---

## Etapa 2: Geração de Embeddings

### Modelo Utilizado

O Metis usa **`sentence-transformers/all-MiniLM-L6-v2`** como modelo de embedding principal por ser:
- Leve (22M parâmetros) — roda localmente sem GPU
- Rápido — vetoriza milhares de chunks em minutos
- Dimensão 384 — boa relação custo/qualidade para o caso de uso

Para futuras melhorias, `text-embedding-3-small` da OpenAI (dimensão 1536) oferece qualidade superior, mas tem custo por token.

```python
from sentence_transformers import SentenceTransformer

model = SentenceTransformer("all-MiniLM-L6-v2")
embeddings = model.encode(chunks, batch_size=64, show_progress_bar=True)
```

### Normalização dos Vetores
Os vetores são normalizados para norma unitária (L2 norm = 1) antes do upsert. Isso garante que a **similaridade de cosseno** (métrica usada no Pinecone) funcione corretamente — dois vetores normalizados têm similaridade de cosseno equivalente ao produto escalar.

---

## Etapa 3: Upsert no Pinecone

### Configuração do Índice

| Parâmetro | Valor |
|---|---|
| `index_name` | `metis-guides` |
| `dimension` | 384 (deve bater com o modelo de embedding) |
| `metric` | `cosine` |
| `cloud` | `aws` |
| `region` | `us-east-1` (free tier) |

### Namespace por Campeão
Para consultas eficientes, os vetores são organizados por **namespace** no Pinecone — um por campeão:

```
namespace: "jinx"    → todos os chunks de guias da Jinx
namespace: "yasuo"   → todos os chunks de guias do Yasuo
namespace: "global"  → chunks de meta-game, itens gerais, patches
```

Isso permite que o Metis faça uma query já pré-filtrada pelo campeão que o usuário está perguntando, reduzindo latência e melhorando relevância.

### Batch Upsert

```python
import pinecone

index = pinecone.Index("metis-guides")

# Upsert em lotes de 100 vetores
batch_size = 100
for i in range(0, len(vectors), batch_size):
    batch = vectors[i:i + batch_size]
    index.upsert(vectors=batch, namespace=champion_slug)
```

O Pinecone recomenda batches de 100 vetores por upsert para equilibrar throughput e estabilidade.

---

## Custo Estimado (Free Tier vs Produção)

| Plano | Vetores | Namespaces | Custo |
|---|---|---|---|
| **Free (Starter)** | 100k vetores | 1 índice | Gratuito |
| **Standard** | 5M vetores | Ilimitado | ~U$0.08/1k vetores armazenados/mês |

Para o Metis em estágio atual: com ~160 campeões × ~20 guias × ~15 chunks = **~48.000 vetores**. Cabe no free tier com margem.

---

## Atualização Incremental

O pipeline suporta atualização incremental — apenas guias com `scraped_at` mais recente que o `last_indexed_at` são revetorizados. O Pinecone atualiza vetores existentes via upsert com o mesmo `chunk_id` (não cria duplicatas).

---

## Conceitos Relacionados

- [[RAG]] — como esses vetores são usados em tempo de consulta
- [[Busca Semântica]] — o que torna vetores úteis para recuperação de informação
- [[Embedding]] — o que é um vetor de embedding e como é gerado
- [[Estrutura da Camada Prata]] — os dados que alimentam este pipeline
- [[Fluxo_de_Vetorizacao_Pinecone]] → consumido pelo [[Backend_FastAPI]]
