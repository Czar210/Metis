# Backlog e Ideias Futuras

Espaço para registrar ideias, melhorias e backlog priorizado do Metis.

---

## Como usar este arquivo

Este é um espaço livre para capturar qualquer ideia antes que ela se perca. Não precisa ser elaborado — uma linha já vale. As ideias mais maduras viram tasks no `todo.md` ou registros de decisão no `01 - Decisões Arquiteturais ADR/`.

---

## 🔴 Alta Prioridade (próximos sprints)

### Memória de Conversa
Atualmente, cada consulta ao RAG é independente — o Llama 3 não lembra o que foi dito antes na mesma sessão. Implementar **memória de janela** usando `ConversationBufferWindowMemory` do LangChain (mantém últimas N mensagens no contexto).

Cuidado: cada mensagem extra no contexto aumenta latência e custo de inferência. Testar com janela de 5 mensagens primeiro.

### Roteamento de Intenção
Antes de chamar o RAG completo, classificar o tipo de pergunta:
- `build_query` → buscar chunks de item build
- `matchup_query` → buscar chunks de matchups
- `general_lore` → responder com conhecimento geral (sem RAG)
- `offtopic` → recusar educadamente

Isso melhora a relevância dos resultados e evita queries desnecessárias ao Pinecone.

---

## 🟡 Média Prioridade (futuro próximo)

### Reranking dos Resultados do RAG
Hoje o Metis usa só a similaridade de cosseno do Pinecone para ordenar chunks. Adicionar um **reranker** (ex: `cross-encoder/ms-marco-MiniLM-L-6-v2`) que reavalia os top-20 chunks e seleciona os top-5 mais relevantes para o contexto final. Melhora qualidade das respostas sem aumentar o índice.

### Avaliação Automática de Respostas (RAG Eval)
Implementar um pipeline de avaliação periódica usando **RAGAS** (framework de métricas para RAG):
- **Faithfulness**: a resposta está ancorada no contexto recuperado?
- **Answer Relevancy**: a resposta responde a pergunta feita?
- **Context Precision**: os chunks recuperados eram os certos?

Isso cria um "termômetro de qualidade" para monitorar regressões quando o modelo ou os dados mudam.

### Pinecone vs Weaviate
Testar Weaviate como alternativa ao Pinecone. O Weaviate tem vantagens para queries híbridas (vetorial + BM25 keyword search) que podem ser úteis para buscas de nomes de itens exatos (ex: "Infinity Edge") que não são bem capturadas por similaridade semântica.

---

## 🟢 Ideias a Explorar (longo prazo)

### Streaming de Resposta
Hoje a resposta aparece inteira de uma vez após o LLM terminar. Implementar **streaming SSE (Server-Sent Events)** para que as palavras apareçam token a token — UX muito melhor, parece mais "vivo".

Requer mudanças no endpoint `/query` (FastAPI suporta `StreamingResponse`) e no frontend (leitura de stream no cliente).

### Integração com a Riot API em Tempo Real
Puxar a partida atual do usuário via Riot API (endpoint `spectator-v5`) e adaptar as sugestões do Metis para o jogo em andamento: "você está com Jinx contra um Draven, aqui está o que os guias recomendam para esse matchup agora".

Requer autenticação com API key da Riot e tratamento de dados ao vivo (maior complexidade).

### Painel de Analytics para o Time
Dashboard interno mostrando:
- Quais campeões são mais consultados
- Quais perguntas o Metis errou (via feedback negativo)
- Distribuição de tipos de perguntas
- Latência média por endpoint

Supabase já coleta esses dados — falta só a visualização (Metabase, Grafana, ou página interna Next.js).

### Suporte a Imagens nos Guias
Hoje só o texto dos guias é indexado. Incluir as imagens de builds (printscreens de itens, runas) no índice usando **multimodal embeddings** (ex: CLIP) para que o usuário possa perguntar "qual é esse build?" enviando uma screenshot.

### Exportar Resposta como Imagem
Botão para exportar a resposta do Metis como uma imagem formatada (tipo "post de Twitter") — util para jogadores que querem compartilhar builds rápido.

### Fine-tuning do Llama 3
Com um dataset de perguntas/respostas validadas pelos membros do time, fazer um fine-tuning leve (LoRA/QLoRA) do Llama 3 para que ele entenda melhor o vocabulário específico de LoL (nomes de habilidades, itens, posições) sem precisar explicar no system prompt.

---

## Ideias Descartadas (e por quê)

| Ideia | Motivo do descarte |
|---|---|
| Usar GPT-4 como LLM principal | Custo elevado para o volume esperado de queries; Llama 3 local é suficiente para MVP |
| Scraping do OP.GG | Termos de serviço restritivos; Riot API oficial é suficiente para dados de players |
| App mobile (React Native) | Fora do escopo do MVP; web responsivo já atende |
