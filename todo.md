# 🦅 Metis - To-Do List (Versão Master)

## 🎯 Objetivos Centrais
1. **Comparação de Estilo (GNN + Cosine):** Transformar partidas em grafos e gerar um "Style Embedding". (**Grátis**)
2. **Match de Campeões:** Cruzar vetor de estilo com estilos vencedores por campeão. (**Grátis**)
3. **Estilos por Campeão:** Análise estatística de padrões que geram vitórias. (**Grátis**)
4. **Análise de Certo/Errado (IA + RAG):** Agente de IA cruzando dados com conhecimento vetorizado. (**Pago**)
5. **Aprender com a IA:** Chat interativo sobre táticas de jogo. (**Pago**)

---

## 🧙‍♂️ Membro 1: AI & Knowledge Engineer
**Dever:** Criar a inteligência linguística e o sistema de busca semântica (RAG).
**Tech Stack:** Ollama (Llama 3.1 8B), Sentence-Transformers, Pinecone/Supabase (pgvector), Cloudflare Tunnel.

- [ ] Configurar Ollama Local (Llama 3.1 8B)
- [ ] Criar Scraper de Guias (Mobafire/Probuilds)
- [ ] Integrar API da Wiki para Patches (Dados de Campeões)
- [ ] Gerar Embeddings e salvar na Camada Gold
- [ ] Implementar o Agente de IA e o fluxo de RAG
- [ ] Configurar Túnel Cloudflare para acesso via FastAPI

---

## 🎨 Membro 2: Product & UX Engineer
**Dever:** Interface intuitiva e visualização de dados.
**Tech Stack:** Next.js (App Router), Tailwind CSS, Recharts/D3.js, Figma, Vercel.

- [ ] Design das telas no Figma (Dashboard + Chat)
- [ ] Setup do Next.js e conexão com FastAPI
- [ ] Criar Dashboards de estatísticas e deltas
- [ ] Implementar Chat Interativo
- [ ] Puxar dados da Gold 1 para visualização GNN
- [ ] **Tarefa Dupla:** Modelagem inicial dos grafos (GNN)

---

## ⚙️ Membro 3: Data Architect & CloudOps
**Dever:** Ingestão de dados limpos e rápidos da Riot API.
**Tech Stack:** Python (Polars), Riot API, Cloudflare R2, Supabase (SQL), Railway, FastAPI.

- [ ] Scripts de ingestão Riot API e compressão .gz (Bronze)
- [ ] Configurar Cloudflare R2
- [ ] Scripts de Limpeza/Transferência (Prata/Gold)
- [ ] Criar e configurar FastAPI no Railway
- [ ] Criar fluxo automático para baixar jogos de Pro Players
- [ ] **Tarefa Dupla:** Treinamento final da GNN (PyTorch)

---
*"Um passo à frente deles. Um jogo à frente de todos." - Jericho Swain*
