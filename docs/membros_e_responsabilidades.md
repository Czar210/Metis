# Membros e Responsabilidades - Metis

Este documento detalha o papel de cada um dos 3 membros da equipe, suas tecnologias e o contexto de suas tarefas.

---

## 🧙‍♂️ Membro 1: AI & Knowledge Engineer
**Foco:** Inteligência Artificial, Processamento de Linguagem Natural (NLP) e RAG.

**Dever:** Construir o sistema que permite ao usuário "conversar" com o conhecimento de especialistas. Ele é responsável por transformar guias de texto em vetores matemáticos que a IA consegue buscar.

### Tech Stack
- **Ollama:** Execução local de LLMs (Llama 3.1).
- **Sentence-Transformers:** Geração de embeddings.
- **Pinecone / Supabase (pgvector):** Banco de dados vetorial.
- **Cloudflare Tunnel:** Exposição segura do Ollama para a nuvem.

### Detalhamento das Tarefas
1. **Setup Ollama:** Garantir que o Llama 3.1 rode com performance no ambiente local.
2. **Scrapers de Guias:** Criar scripts que extraiam dicas e build de sites como Mobafire e Probuilds.
3. **API de Patches:** Conectar com a Riot Wiki para saber quais itens e campeões mudaram (nerfs/buffs).
4. **Camada Gold (Vetores):** Automatizar o processo de transformar textos em vetores e salvá-los no banco.
5. **Agente de IA:** Programar a lógica do chat (Chain of Thought) para que a IA use os dados antes de responder.

---

## 🎨 Membro 2: Product & UX Engineer
**Foco:** Frontend, Visualização de Dados e Design de Produto.

**Dever:** Transformar as funções matemáticas complexas em algo que um jogador entenda. Ele cuida da experiência do usuário (UX) e da parte visual dos grafos de estilo.

### Tech Stack
- **Next.js (App Router):** Framework web principal.
- **Tailwind CSS:** Estilização moderna e rápida.
- **Recharts / D3.js:** Gráficos interativos e mapas de estilo.
- **Figma:** Prototipagem das telas.

### Detalhamento das Tarefas
1. **Design Figma:** Criar a identidade visual (Dark Theme, estilo Premium).
2. **Dashboard de Estatísticas:** Implementar as telas que mostram o "Delta" de dano e ouro do jogador.
3. **Interface do Chat:** Criar a janela de conversa com a IA de forma intuitiva.
4. **Visualização GNN:** Criar o mapa de pontos (UMAP/t-SNE) onde o jogador vê onde ele está em relação aos pro players.
5. **Tarefa Dupla (Modelagem):** Definir como os dados da partida viram "nós" e "arestas" para o algoritmo de grafo.

---

## ⚙️ Membro 3: Data Architect & CloudOps
**Foco:** Engenharia de Dados, Infraestrutura e Backend.

**Dever:** É o "encanador" do projeto. Garante que os gigabytes de dados da Riot saiam da API, sejam limpos e fiquem disponíveis para o Frontend e a IA no menor tempo possível.

### Tech Stack
- **Python (Polars):** Processamento massivo de dados (mais rápido que Pandas).
- **FastAPI:** O "Maestro" que conecta o Frontend ao Banco e à IA.
- **Cloudflare R2:** Armazenamento de arquivos JSON brutos.
- **Supabase (PostgreSQL):** Banco de dados relacional (Silver/Gold).
- **Railway:** Hospedagem da API.

### Detalhamento das Tarefas
*   **Ingestão Riot API:** Criar o fluxo que baixa as partidas e comprime em `.gz` para economizar espaço.
*   **Arquitetura Medalhão:** Implementar os scripts que pegam o dado sujo (Bronze) e transformam em categorias úteis (Prata).
*   **FastAPI Core:** Criar os endpoints (rotas) que o Membro 2 vai chamar para popular o site.
*   **Pipeline de Pro Players:** Automatizar a descida de milhares de jogos de jogadores Challenger para servir de base.
*   **Tarefa Dupla (Treinamento GNN):** Pegar a modelagem do Membro 2 e treinar o modelo no PyTorch para gerar os vetores de estilo.
