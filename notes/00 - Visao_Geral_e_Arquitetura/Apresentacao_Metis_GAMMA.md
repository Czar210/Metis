# Metis

## Aliada estratégica para jogadores de League of Legends

Não é só mais um site de estatísticas: é engenharia de dados real (pipeline Riot API → Cloudflare R2 → Supabase) combinada com IA conversacional (RAG + Gemini) para entregar sabedoria tática — o "porquê" por trás dos números, não só o número.

---

# Infraestrutura: um ecossistema de serviços

![Diagrama do ecossistema de infraestrutura da Metis: ícone central da marca conectado aos logos reais de Riot API, GitHub Actions, Cloudflare R2, Python/Polars, Supabase, Google Gemini, FastAPI e Next.js/Vercel](imagem-customizada-ecossistema-infraestrutura)

> 📌 **Nota de design para o Gamma:** este slide usará uma **imagem própria, já pronta**, com o diagrama completo do ecossistema (logos reais dos serviços conectados ao centro). Por favor, escolha um layout em que a imagem ocupe a maior parte do slide — texto mínimo ao lado ou embaixo, apenas como legenda de apoio.

O **mapa das peças** — cada uma com um papel fixo, agrupadas pela função que cumprem (não pela ordem em que o dado passa por elas — isso é o próximo slide):

- **Captura de dados** — Riot API (fonte oficial) + GitHub Actions (automação que dispensa servidor dedicado)
- **Armazenamento** — Cloudflare R2 (data lake barato, compatível com S3, guarda tudo cru e auditável)
- **Banco & busca** — Supabase (PostgreSQL + pgvector): um único serviço fazendo o papel de banco estruturado E motor de busca vetorial nativo — dispensa ferramentas terceiras como Pinecone
- **Segurança** — Row Level Security (RLS): isolamento de dados por usuário garantido no nível do banco, não da aplicação
- **Orquestração** — FastAPI: o "maestro" que conecta banco, IA e frontend
- **Apresentação** — Next.js (Vercel): a vitrine — dashboard, páginas de produto e chat
- **Inteligência** — Gemini + RAG próprio (detalhado no próximo bloco, é grande o suficiente pra ter um slide só dele)

---

# Pipeline de dados: a jornada de uma partida

![Infográfico horizontal do pipeline de dados da Metis: estações com logos reais (Riot Games, GitHub, Cloudflare R2, Python/Polars, Supabase, Gemini) conectadas em sequência, terminando em ramificações para as funcionalidades do produto (Tier List, Dashboard, Detalhe de Partida, Chat com IA)](imagem-customizada-pipeline-dados)

> 📌 **Nota de design para o Gamma:** este slide também usará uma **imagem própria, já pronta** — um infográfico horizontal mostrando a jornada do dado, da fonte até as funcionalidades do produto. Escolha um layout horizontal/wide em que essa imagem seja o elemento principal, com o texto abaixo servindo apenas de roteiro de apoio para a fala.

Não é "quais serviços existem" (slide anterior) — é **o que acontece com o dado**, passo a passo, até virar produto.

1. **Extração** — partidas (Riot API) e conhecimento estratégico (guias, wiki, patch notes) chegam crus, em horários automatizados
2. **Preservação** — tudo é comprimido e guardado no estado bruto, sem perder nada — permite reprocessar do zero se a lógica de limpeza mudar amanhã
3. **Limpeza e estruturação** — scripts Python (Polars) filtram remakes, calculam KDA/dano/gold/builds, agregam estatísticas (winrate, pickrate, banrate, tier por z-score)
4. **Vetorização** — guias estratégicos viram *embeddings*: texto deixa de ser "string" e passa a ser algo que se busca **por significado**
5. **Bifurcação final** — o mesmo dado processado segue dois caminhos ao mesmo tempo: vira **número** (analytics, tier list, dashboards) e vira **contexto para a IA** (chat com RAG)

> Curiosidade de bastidor: o pipeline evolui — frames de timeline migraram recentemente de uma tabela do Supabase para o Cloudflare R2, aliviando o banco estruturado conforme o volume de dados cresce. Prova de que "Arquitetura Medalhão" não é estática — ela se adapta ao crescimento.

---

# A IA da Metis: o que tem por trás do "agente"

Não é um chatbot genérico plugado na API do Google — é um **pipeline próprio de RAG** com várias camadas de decisão antes de qualquer resposta chegar ao jogador.

- **Antes de responder, ela classifica** — um guardrail decide se a pergunta é sobre LoL/Metis; se não for, recusa educadamente sem gastar tokens com uma resposta cara
- **A busca é em duas etapas, não uma só** — *query expansion* (a IA reformula a pergunta de formas diferentes para buscar melhor) seguida de *reranking* (reordena os trechos encontrados por relevância real, não só similaridade bruta)
- **Múltiplas fontes de contexto, montadas na hora** — guias estratégicos vetorizados, patch notes recentes e builds de alto elo, todos buscados via embeddings no pgvector e injetados no prompt antes da resposta
- **Transparência de cobertura** — a IA "sabe" quando não tem informação suficiente sobre um campeão ou patch, e avisa o jogador disso de forma natural, em vez de inventar
- **Personalidade com regras absolutas** — calma, analítica, nunca tóxica, nunca valida flame; transforma derrota em aprendizado; recusa qualquer assunto fora de LoL — tudo isso vem de um *system prompt* estruturado, não de "jeitinho"
- **Arquitetura plugável de LLM** — roda com Gemini Flash em produção e com Llama 3 (Ollama) localmente, trocando o "motor" sem mudar o resto do pipeline
- **Limites por plano** — cada tier (donor/premium/pro) tem uma cota diária de tokens, com barra de consumo visível pro usuário — e reseta à meia-noite UTC
- **Bônus — Neo-Artemis (radar 8D)**: a mesma camada de inteligência também gera as recomendações do dashboard do jogador, comparando o desempenho real com um "perfil ideal" estatístico em 8 eixos

---

# Como o jogador usa a Metis — uma jornada em 4 perguntas

Cada funcionalidade nasce de uma dúvida real que todo jogador já teve.

**1. "Devo jogar esse campeão agora?"**
→ **Tier List & Campeões** — winrate, pickrate e banrate calculados estatisticamente (z-score, não achismo), builds, runas, matchups e guias

**2. "Qual build eu faço contra esse time?"**
→ **Página do Campeão + Itens** — winrate por item, tendências, custo, combinações — e uma pergunta direta no chat já mostra a IA puxando contexto de um guia real

**3. "Joguei mal, o que eu mudo?"**
→ **Dashboard do Jogador + Detalhe de Partida** — histórico, KPIs, radar 8D comparando com o "jogador ideal" (Neo-Artemis), Metis Score e timeline interativa explicando os momentos-chave da partida

**4. "Me dá uma dica de estratégia, agora"**
→ **Chat com a Metis (IA + RAG)** — conversa natural, resposta embasada em guias reais vetorizados, guardrail que mantém o foco em League of Legends

**Bônus — bastidor "da pergunta à resposta":**
Pegar uma dessas perguntas no chat e narrar o caminho que ela percorre: texto → embedding → busca vetorial no Supabase → contexto injetado → resposta do Gemini. Fecha o ciclo "dado → IA → resposta" de forma muito visual.

*(Conta & Planos fica como menção rápida: assinatura, uso de tokens de IA, jogadores favoritos e preferências — não precisa de uma pergunta-gancho própria.)*

---

# Fechamento

A Metis junta **dados reais e auditáveis** — uma pipeline rastreável até o JSON bruto no R2 — com **IA que explica o "porquê"**, não só o "o quê".

Projeto em desenvolvimento ativo (versão atual ~p-0.9.22), com roadmap de analytics cada vez mais profundo: matchups detalhados, builds com ordem real de compra, recomendação de runas.
