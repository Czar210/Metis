## 1. Contexto

O Metis utilizava o **Pinecone** como banco de dados vetorial para armazenar os embeddings dos guias de campeões e realizar a busca semântica do pipeline RAG. Embora funcional, o Pinecone apresentou limitações que tornaram sua continuidade inviável para o projeto:

- **Custo crescente:** O free tier do Pinecone limita o armazenamento a ~100k vetores e exige migração para planos pagos à medida que o volume de guias indexados cresce. Para um projeto acadêmico, esse custo não é justificável.
- **Dependência de serviço externo:** O Pinecone é um SaaS proprietário. Qualquer instabilidade na API externa ou mudança de planos afeta diretamente a disponibilidade do Metis.
- **Fragmentação da stack:** O Pinecone é mais um serviço externo a gerenciar (chave de API, namespace, billing, limites de rate), adicionando complexidade operacional sem ganho proporcional.
- **Falta de busca híbrida nativa:** Para buscas de nomes exatos de campeões, itens e habilidades (ex: "Infinity Edge", "Yasuo", "R do Zed"), a busca semântica pura do Pinecone pode perder para buscas por palavra-chave exata (BM25). O Pinecone não oferece busca híbrida no free tier.

## 2. Decisão

Optamos por migrar toda a camada de vetorização e orquestração RAG para o **OpenRAG** — uma plataforma RAG open-source, self-hosted, construída sobre **Langflow**, **Docling** e **OpenSearch**.

- **Repositório:** [github.com/langflow-ai/openrag](https://github.com/langflow-ai/openrag)
- **Substitui:** Pinecone (banco vetorial) + pipeline de ingestão manual + chamadas diretas ao LangChain
- **Mantém:** Llama 3 via Ollama como LLM (OpenRAG é provider-agnostic e suporta Ollama nativamente)

## 3. Motivação

### Custo Zero e Self-Hosting

O OpenRAG é inteiramente open-source e roda na própria infraestrutura do projeto (Railway ou localmente). Sem chave de API paga, sem limites de vetores, sem billing surpresa. Isso está alinhado com a filosofia do Metis de manter a stack acadêmica sustentável.

### OpenSearch: Busca Híbrida Nativa

O OpenSearch (fork open-source do Elasticsearch, mantido pela AWS) combina dois tipos de busca em uma única query:

- **Busca vetorial (KNN):** Encontra guias semanticamente similares à pergunta do usuário, mesmo que as palavras exatas não apareçam
- **Busca BM25 (keyword):** Encontra resultados por correspondência exata de termos — crucial para nomes próprios do LoL (campeões, itens, habilidades)

Essa busca híbrida resolve um problema real que o Metis já tinha com Pinecone: perguntas como "qual build pro Infinity Edge?" ou "como jogo contra Draven?" funcionam melhor quando o sistema combina proximidade semântica com correspondência exata de nomes.

### Docling: Ingestão Inteligente de Documentos

O **Docling** (também da IBM/LangFlow) é um processador de documentos que lida com PDFs, HTMLs e textos estruturados de forma robusta. Para o Metis, isso abre a possibilidade de ingerir não só os guias do Mobafire, mas também:

- PDFs de patch notes da Riot
- Artigos e análises de meta-game
- Dados de partidas em formato estruturado

O Docling cuida de chunking, limpeza e normalização antes de enviar para o OpenSearch — substituindo o pipeline manual que tínhamos em `fetch_guides.py`.

### Langflow: Orquestração Visual dos Fluxos RAG

O **Langflow** é uma ferramenta de criação de workflows de IA com interface drag-and-drop. No contexto do OpenRAG, ele funciona como o orquestrador do pipeline completo: ingestão → embedding → indexação → retrieval → geração.

Benefícios práticos para o time do Metis:
- Iterar e testar variações do pipeline RAG visualmente, sem alterar código
- Adicionar etapas de reranking, roteamento de intenção e memória de conversa via interface — features que estavam no [[Backlog_e_Ideias_Futuras]]
- Suporte nativo ao Ollama como LLM provider (Llama 3 continua sendo o modelo)

### Alinhamento com ADR-002

O ADR-002 já sinalizou a intenção de manter o máximo de serviços dentro do Supabase para evitar fragmentação. A migração para OpenRAG reforça essa filosofia ao eliminar mais um serviço externo (Pinecone) e consolidar a inteligência RAG em uma plataforma única e self-hosted.

## 4. Consequências

**Positivas:**
- Eliminação do custo do Pinecone e de qualquer limitação de volume de vetores
- Busca híbrida (vetorial + keyword) melhora relevância das respostas sobre nomes exatos do LoL
- Langflow permite prototipar novas features RAG (reranking, memória, agentes) sem modificar o backend Python
- Docling simplifica e padroniza o pipeline de ingestão de documentos
- Suporte nativo ao Ollama garante que o Llama 3 continue funcionando sem alterações
- Stack inteiramente open-source e auditável

**Negativas:**
- **Infraestrutura mais pesada:** O OpenRAG requer rodar Langflow + OpenSearch + Docling em conjunto. O consumo de RAM/CPU é significativamente maior que apenas chamar a API do Pinecone. Exige planejamento de recursos no Railway ou na máquina local.
- **Curva de aprendizado no Langflow:** A equipe precisará aprender a usar a interface do Langflow para gerenciar os fluxos RAG. Estimativa: 1-2 dias para familiarização básica.
- **Migração dos vetores existentes:** Os embeddings já indexados no Pinecone precisam ser reprocessados e reingeridos no OpenSearch. O pipeline de vetorização deve ser reexecutado do zero.
- **Menos documentação em português:** O Pinecone tem extensa documentação e tutoriais em PT-BR. O OpenRAG é mais recente e a comunidade ainda é menor.
