---
aliases:
  - Curadoria do Agente
  - Atividade Agente IA
---

# Atividade – Curadoria e Estrutura de um Agente de IA para Negócios

---

## 1. Contextualização do Agente

**Nome do agente:** Metis

**Objetivo principal:**
A Metis é uma aliada estratégica para jogadores de League of Legends. Seu objetivo é responder perguntas táticas com profundidade — como "qual é o melhor build para o Thresh no meta atual?" — cruzando dados reais de partidas profissionais com o conhecimento de guias especializados, e entregando respostas contextualizadas através de linguagem natural.

**Contexto de uso:**
O agente opera dentro de uma aplicação web voltada para jogadores que querem evoluir no competitivo. O usuário interage via chat com o agente, que funciona como um coach pessoal disponível 24/7.

**Problema que resolve:**
Jogadores perdem horas navegando em múltiplos sites (Mobafire, OP.GG, probuilds) tentando entender o meta. A Metis centraliza esse conhecimento, filtra o ruído e entrega insights estratégicos direto ao ponto — com a autoridade de quem "leu tudo" e "viu os dados".

---

## 2. Tópicos Já Implementados

### RAG (Retrieval-Augmented Generation)

**Como está implementado:**
Os guias extraídos via scraping (Mobafire, Lolpedia) são quebrados em chunks, convertidos em embeddings e armazenados no Pinecone (Vector DB). Quando o usuário faz uma pergunta, o sistema realiza uma busca semântica e injeta os trechos mais relevantes como contexto para o Llama 3 formular a resposta.

**Em que momento do fluxo:**
No momento da consulta — entre o recebimento da pergunta pelo FastAPI e o envio ao modelo LLM.

**Impacto:**
Elimina alucinações. O modelo nunca inventa builds ou estratégias porque só responde com base no que foi recuperado da base de conhecimento real. É o diferencial central do sistema.

---

### Arquitetura Medalhão (Bronze → Prata → Ouro)

**Como está implementado:**
- **Bronze:** JSONs brutos da Riot API e HTMLs do scraping armazenados no Cloudflare R2.
- **Prata:** Scripts ETL limpam e estruturam os dados em tabelas relacionais no Supabase (PostgreSQL).
- **Ouro:** Estatísticas pré-calculadas (Ouro Relacional) e embeddings dos guias (Ouro Vetorial no Pinecone).

**Em que momento do fluxo:**
Na pipeline de dados, antes de qualquer interação do usuário.

**Impacto:**
Garante que o agente nunca consuma dados sujos. A separação de camadas permite reprocessar dados sem perder a fonte original, e mantém o custo operacional baixo (Cloudflare R2 tem egress gratuito).

---

### Orquestração Automática via GitHub Actions

**Como está implementado:**
Scripts de ingestão (Riot API e scraping com Playwright) são agendados e executados automaticamente nos servidores do GitHub Actions, sem custo de servidor dedicado.

**Em que momento do fluxo:**
Na camada de ingestão, antes do ETL.

**Impacto:**
O agente se mantém atualizado com os dados mais recentes de forma autônoma, sem intervenção manual. É a base que garante a "inteligência viva" do sistema.

---

### Ferramentas especializadas (Tool Use / Function Calling)

**Como está implementado:**
O backend FastAPI age como maestro — ele não apenas repassa perguntas ao LLM, mas decide qual fonte consultar: dados estruturados do Supabase (estatísticas de partidas) ou dados vetoriais do Pinecone (guias táticos). Cada rota de consulta funciona como uma "ferramenta" separada.

**Em que momento do fluxo:**
No Core Logic do backend, após receber a requisição e antes de montar o prompt para o LLM.

**Impacto:**
O agente responde com dados precisos e rastreáveis, não apenas com geração livre de texto. Isso aumenta a confiabilidade e torna as respostas verificáveis.

---

## 3. Tópicos Ainda Não Implementados

### Memória de Conversa (Memory / Histórico de Sessão)

**Por que ainda não foi implementado:**
O foco inicial foi em garantir que uma única consulta funcionasse com qualidade antes de adicionar estado entre turnos.

**Importância:**
Sem memória, o agente trata cada mensagem como independente. O usuário precisa repetir contexto a cada pergunta ("como eu disse, jogo de toplaner..."). Com memória, a conversa flui de forma natural e o agente pode refinar respostas com base no histórico, como um coach real faria.

---

### Avaliação e Feedback do Agente (Evals / LLM-as-Judge)

**Por que ainda não foi implementado:**
Exige uma camada de infraestrutura adicional (ex: LangSmith ou framework próprio de avaliação) que ainda não foi priorizada.

**Importância:**
Sem evals, não há como saber se o agente melhorou ou piorou entre versões. A avaliação sistemática é o que transforma um "parece bom" em evidência concreta de qualidade. É essencial para evoluir o agente com segurança.

---

### Roteamento Inteligente de Intenção (Router / Classificador de Query)

**Por que ainda não foi implementado:**
Atualmente a lógica de roteamento é simples (estruturado vs. vetorial). Um classificador mais sofisticado ainda não foi construído.

**Importância:**
Perguntas diferentes exigem fontes diferentes. "Qual o winrate do Faker?" ≠ "Como jogar contra Zed no mid?". Um roteador inteligente garante que a pergunta certa chegue à fonte certa, aumentando drasticamente a precisão das respostas.

---

### Reranking dos Resultados Recuperados

**Por que ainda não foi implementado:**
O pipeline RAG atual usa apenas a busca semântica do Pinecone sem reordenar os chunks recuperados.

**Importância:**
A busca semântica retorna os `top-k` resultados mais próximos vetorialmente, mas o mais próximo nem sempre é o mais útil. Um modelo de reranking (ex: CrossEncoder) reordena os chunks por relevância real antes de enviá-los ao LLM, melhorando significativamente a qualidade do contexto injetado.

---

## 4. Planejamento de Evolução

### Memória de Conversa
**O que será feito:** Implementar um buffer de histórico de sessão no FastAPI que mantém os últimos N turnos da conversa.

**Como:** Armazenar o histórico no Supabase por `session_id` do usuário. A cada nova mensagem, os turnos anteriores são recuperados e inseridos no prompt antes do contexto RAG.

**Resultado esperado:** Conversas contínuas e contextuais. O usuário pode fazer perguntas de follow-up ("e para o jungle?") sem precisar repetir o contexto.

---

### Evals e Monitoramento
**O que será feito:** Criar um conjunto de perguntas-padrão com respostas esperadas, e rodar o agente contra esse benchmark a cada versão.

**Como:** Usar LangSmith ou uma planilha simples de Golden Dataset com score manual + LLM-as-Judge para avaliar coerência e precisão.

**Resultado esperado:** Capacidade de medir regressões e evoluções do agente de forma objetiva. Saber se uma mudança de prompt ou de chunking foi melhor ou pior.

---

### Roteador de Intenção
**O que será feito:** Adicionar uma etapa de classificação da query antes do roteamento.

**Como:** Um prompt simples que classifica a intenção entre: `stat_lookup`, `tactical_advice`, `build_recommendation`, `meta_analysis`. Cada classe é roteada para uma cadeia de recuperação diferente.

**Resultado esperado:** Respostas mais precisas e com menor latência, pois o agente consulta apenas a fonte relevante para cada tipo de pergunta.

---

### Reranking
**O que será feito:** Adicionar uma etapa de reranking entre a recuperação do Pinecone e a montagem do prompt.

**Como:** Integrar um CrossEncoder (ex: `ms-marco-MiniLM`) que pontua os chunks recuperados por relevância antes de selecionar os top-3 para o contexto.

**Resultado esperado:** Contexto mais limpo e relevante entregue ao LLM, reduzindo ruído e aumentando a qualidade das respostas.

---

## 5. Conclusão

**Maturidade atual:**
A Metis tem uma base sólida. A pipeline de dados funciona de ponta a ponta — da ingestão ao vetor store — e o núcleo RAG já entrega respostas fundamentadas em fontes reais. A arquitetura é escalável e o custo operacional é baixo.

O agente ainda opera de forma **stateless** (sem memória entre turnos) e sem avaliação sistemática, o que limita tanto a experiência do usuário quanto a capacidade de evolução controlada.

**Próximos passos mais importantes:**
1. Memória de conversa — muda completamente a experiência do usuário.
2. Evals — sem isso, toda melhoria é especulativa.
3. Roteador de intenção — aumenta precisão sem aumentar custo.

**O que fará mais diferença no resultado final:**
A combinação de **memória + evals** é o que vai transformar a Metis de uma demonstração técnica impressionante em um produto confiável e iterável. A memória humaniza a experiência; os evals garantem que cada iteração seja um passo para frente, não um passo no escuro.
