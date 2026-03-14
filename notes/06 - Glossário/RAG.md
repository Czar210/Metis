---
aliases:
  - Retrieval-Augmented Generation
  - Geração Aumentada por Recuperação
  - RAG
tags:
---
O **RAG** é um padrão de arquitetura em Inteligência Artificial que enriquece as respostas de um Grande Modelo de Linguagem (LLM) conectando-o a uma base de dados externa e privada. 

Em vez de depender exclusivamente do conhecimento "congelado" que a IA adquiriu durante seu treinamento (que pode estar desatualizado ou ser genérico demais), o RAG divide o processo em duas etapas:
1. **Retrieval (Recuperação):** O sistema atua como um motor de busca, procurando em um banco de dados vetorial os fragmentos de texto mais relevantes para a pergunta do usuário.
2. **Generation (Geração):** O sistema injeta esses textos recuperados no *prompt* da IA e pede para ela formular a resposta baseando-se estritamente naqueles dados.

## Como e Onde usamos no Metis
No **Metis**, o RAG é a espinha dorsal da nossa inteligência. É ele que transforma o modelo **Llama 3** de um "chatbot genérico" para um "Estrategista Especialista de League of Legends". 

O fluxo funciona da seguinte maneira:
1. O usuário pergunta algo específico no chat (ex: *"Como jogar de Ahri contra Zed?"*).
2. Nosso motor (Langflow/FastAPI) transforma essa pergunta em um vetor matemático (Embedding).
3. Fazemos uma busca semântica na **Camada Ouro Vetorial** (nosso banco **Supabase utilizando a extensão `pgvector`**).
4. O banco retorna os parágrafos exatos dos guias de jogadores Challenger (extraídos do Mobafire) que falam sobre o *matchup* Ahri vs Zed.
5. Injetamos esses guias no Llama 3 junto com a pergunta original. A IA processa tudo e entrega uma resposta tática perfeita ao usuário.

### Benefícios no Metis:
* **Zero Alucinação:** Impede que a IA invente dicas de itens que não existem ou táticas erradas, pois ela é obrigada a usar os guias como "cola".
* **Conhecimento Dinâmico:** Se um novo *Patch* mudar o jogo, não precisamos treinar o modelo Llama 3 de novo (o que custaria milhões). Basta que nossos robôs (Playwright) raspem os guias atualizados e atualizem o Supabase. A IA fica instantaneamente inteligente no novo Patch.