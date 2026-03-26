# Estrutura da Camada Prata

Detalhes sobre a camada "prata" (processed data) da Arquitetura Medalhão do Metis: formatos, schemas, transformações e partições.

---

## O que é a Camada Prata?

Na [[Arquitetura Medalhão]], a camada Prata recebe dados brutos da camada Bronze e os transforma em dados limpos, estruturados e confiáveis. Não é dado para consumo final (isso é a Camada Ouro), mas é o dado validado que alimenta tanto a vetorização RAG quanto as queries do backend.

Regra de ouro: **dados na Prata nunca chegaram ao usuário, mas já são confiáveis o suficiente para alimentar modelos e pipelines downstream.**

---

## Localização

```
data/
└── processed/          ← Camada Prata
    ├── guides/
    │   ├── jinx.parquet
    │   ├── yasuo.parquet
    │   └── ...
    ├── players/
    │   ├── matches_pro.parquet
    │   └── stats_aggregated.parquet
    └── meta/
        └── patch_items.parquet
```

---

## Formatos Utilizados

### Parquet (principal)
Formato colunar binário — ideal para dados tabulares com muitos campos. Vantagens no contexto do Metis:
- Compressão nativa (Snappy/Zstd): guias com texto grande ficam até 5x menores que CSV
- Leitura seletiva de colunas: o pipeline de vetorização só precisa de `guide_text` e `champion_name`, sem carregar o resto
- Compatível com Pandas, Polars, DuckDB e Spark — facilita migração futura

### CSV
Usado para dados simples e de fácil inspeção humana (ex: listas de campeões, mapeamentos de IDs). Priorizado quando um membro do time precisa abrir o arquivo direto no Excel ou Google Sheets para validação manual.

### JSONL (JSON Lines)
Mantido como saída intermédia quando os dados têm estrutura aninhada variável (ex: diferentes seções de guias com profundidades diferentes). Cada linha é um JSON válido e independente — facilita processamento incremental e streaming.

---

## Transformações Aplicadas

A passagem de Bronze → Prata aplica as seguintes operações:

### 1. Deduplicação
Guias repetidos (mesma URL ou mesmo `guide_id`) são identificados e apenas a versão mais recente (`scraped_at` maior) é mantida.

### 2. Validação de Schema
Campos obrigatórios (`champion_name`, `guide_text`, `rune_page`) são verificados. Registros incompletos são movidos para `data/quarantine/` para inspeção manual em vez de serem silenciosamente descartados.

### 3. Normalização de Texto
- Remoção de HTML residual, caracteres de controle e unicode problemático
- Truncamento de textos acima de 10.000 tokens (evita problemas na etapa de chunking do RAG)
- Conversão para minúsculas onde aplicável (nomes de campeões, itens)

### 4. Enriquecimento de Metadados
- Adição de `patch_version` baseada na data de scraping (consultando tabela de patches)
- `champion_slug` derivado do `champion_name` para uso como chave de partição

### 5. Tipagem Forte
Colunas numéricas (`rating`, `view_count`) convertidas de string para int/float. Datas padronizadas para ISO 8601 UTC.

---

## Schema Principal: Guias

| Campo | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| `guide_id` | string (UUID) | ✅ | Identificador único do guia |
| `champion_name` | string | ✅ | Nome normalizado do campeão |
| `champion_slug` | string | ✅ | Versão slug (ex: `miss-fortune`) |
| `guide_title` | string | ✅ | Título do guia |
| `author` | string | ❌ | Autor do guia no Mobafire |
| `rating` | float | ❌ | Avaliação normalizada (0–10) |
| `patch_version` | string | ✅ | Patch vigente na coleta |
| `rune_page` | object | ❌ | Runas em estrutura JSON |
| `item_build` | object | ❌ | Build de itens estruturado |
| `guide_text` | string | ✅ | Texto principal da estratégia |
| `scraped_at` | datetime (UTC) | ✅ | Timestamp da coleta |
| `source_url` | string | ✅ | URL original do Mobafire |

---

## Particionamento

Os arquivos Parquet são particionados por `champion_slug` para otimizar leituras que filtram por campeão específico (caso de uso mais comum no RAG do Metis). Para dados de jogadores, o particionamento é por `year_month` da partida.

---

## Conceitos Relacionados

- [[Arquitetura Medalhão]] — contexto completo das três camadas
- [[Como funciona o Fetch Guides]] — o que chega na camada Bronze antes da Prata
- [[Fluxo de Vetorização Pinecone]] — o que consome os dados da Prata
- [[ADR-002 Supabase fonte única pra dados limpos]] — onde esses dados são eventualmente persistidos
