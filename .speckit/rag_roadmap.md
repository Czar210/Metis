# Metis RAG — Roadmap e Histórico

*Última atualização: 2026-05-23*

---

## O que fizemos hoje (2026-05-23)

### Pipeline Bronze → Ouro (vectorize_guides.py)
- Script autônomo que lê guides do Cloudflare R2, gera embeddings via Gemini `gemini-embedding-001` e salva na tabela `champion_guides` do Supabase (pgvector)
- Chunking inteligente: agrupa linhas (`\n`) de forma gulosa até 1200 chars, subdivide por sentença quando necessário
- Embedding com contexto do campeão: `"Campeão: {champion}. {title}: {chunk}"` — melhora precisão de ~0.77 para ~0.81 de similaridade
- Idempotência via `(source_file, chapter_title, chunk_index)`
- GitHub Action `vetorizacao_diaria.yml` toda segunda-feira às 12:00 UTC
- Resultado: 748 chunks de 12 guides, maior chunk 1229 chars, média 902 chars

### RAG integrado ao chat (/api/v1/chat)
- `rag_service.py`: converte query em embedding (RETRIEVAL_QUERY), busca top-5 chunks com similaridade ≥ 0.70, retorna contexto formatado
- `main.py`: injeta contexto no prompt antes do Gemini — sem citar fontes ou autores
- Fallback silencioso para Gemini genérico quando nenhum chunk passa o limiar
- Migration `007_match_champion_guides_rpc.sql`: função SQL `match_champion_guides()` para busca vetorial via RPC

### Decisões técnicas tomadas
- Modelo de embedding: `gemini-embedding-001` (768 dims com `output_dimensionality=768`)
- Sempre acionar RAG (não só quando detectar nome de campeão)
- MIN_SIMILARITY = 0.70
- TOP_K = 5
- Sem citação de fonte na resposta

---

## Próxima task imediata

- Validar o chat com RAG funcionando em produção (Railway)
- Rodar o checklist de validação:
  - [ ] Pergunta sobre Akali retorna resposta com detalhes específicos do guia
  - [ ] Pergunta sobre campeão sem guia (ex: Zed) retorna resposta genérica sem erro
  - [ ] Pergunta off-topic é barrada pelo guardrail
  - [ ] Log do Railway mostra `[rag] X chunks encontrados`
  - [ ] Resposta não cita autores ou fontes
  - [ ] Tempo de resposta < 5 segundos

---

## Melhorias futuras de RAG (ordenadas por impacto)

### Base de conhecimento

#### Patch Notes do LoL Wiki
- Scrappar patch notes do LoL Wiki (wiki.leagueoflegends.com/en/c/patch-notes)
- Vetorizar por patch + campeão + mudança (buff/nerf/rework)
- Permite responder "o que mudou no Ahri no patch 14.10?" ou "Akali foi buffada recentemente?"
- Sempre responder com base no meta atual — usar patch mais recente por padrão
- Só retornar informação de patches antigos se o usuário pedir explicitamente

#### Mais guias do Mobafire
- Expandir de 12 para todos os 172 campeões (scraper já existe, só rodar com mais campeões)
- Aumentar de 2 para 3-5 guias por campeão para ter múltiplas perspectivas
- Ponderar diferentes SOTs (Sources of Truth): guias de Diamond+, Challenger, pro players

#### Transcrições de YouTube
- Scrappar transcrições de canais educativos de LoL (Skill Capped, ProGuides, etc.)
- YouTube Data API v3 tem endpoint de transcrição
- Filtrar por view count + data de publicação para garantir relevância e atualidade
- Chunking diferente: por segmento de tempo (30-60s de fala)

#### Probuilds / partidas de pro players
- Já temos dados de pro players no R2
- Vetorizar padrões de build por campeão + patch + resultado (win/loss)
- Permite responder "qual build os pros estão usando em Akali agora?"

### Qualidade do RAG

#### Filtro por campeão detectado na query
- Extrair nome de campeão da query antes de buscar (regex ou NER simples)
- Filtrar `match_champion_guides` por `champion_name = ?` quando campeão detectado
- Reduz ruído: evita chunks de outros campeões em perguntas específicas

#### Query expansion
- Antes do embedding, pedir ao Gemini para reformular a query em 2-3 variações
- Ex: "como jogar Akali" → ["laning phase Akali", "trades Akali mid", "Akali abilities combo"]
- Buscar todas as variações e unir os resultados (union top-3 de cada)
- Melhora recall em queries vagas ou com vocabulário diferente do guia

#### Re-ranking dos chunks
- Após busca vetorial, usar Gemini para re-rankear os chunks por relevância real
- Cross-encoder: envia (query, chunk) e pede score de 0-10
- Mais preciso que similaridade de cosseno pura
- Custo: ~N tokens extras por chunk candidato

#### Chunk overlap
- Adicionar 100-150 chars de sobreposição entre chunks consecutivos
- Evita perder informação importante que cai na fronteira entre dois chunks
- Implementar em `vectorize_guides.py`

#### TOP_K por tier
- Donor: 3 chunks (menos tokens, mais barato)
- Premium: 5 chunks
- Pro: 8 chunks (resposta mais rica)

### Experiência do usuário

#### Indicar ao usuário onde achar informação
- Quando o assunto for fora do escopo dos guias vetorizados (ex: história de lore, mecânicas de jogo obscuras), retornar link sugerido
- Ex: "Para informações de lore, consulte o LoL Wiki: wiki.leagueoflegends.com"
- Implementar como lista de fallbacks por categoria de pergunta

#### Resposta sempre baseada no meta atual
- Priorizar chunks de guias mais recentes no ranking
- Adicionar coluna `patch_version` na tabela `champion_guides`
- Dar peso extra para chunks do patch atual no score final

#### Transparência sobre cobertura
- Se perguntado sobre campeão sem guia, informar que a base ainda não cobre esse campeão
- "Ainda não tenho guias aprofundados sobre Zed, mas posso te ajudar com informações gerais"

### Infraestrutura

#### Custo vs eficiência
- Avaliar se vale a pena mover para `gemini-embedding-2` (3072 dims) quando a base crescer
- Monitorar custo de embedding por semana (hoje ~$0 no free tier)
- Se base ultrapassar 10k chunks, considerar índice IVFFlat ao invés de HNSW

#### Cache de embeddings de queries frequentes
- Queries repetidas ("como jogar Akali?") geram o mesmo embedding
- Cache em Redis/memória com TTL de 1h reduz latência e custo de API
- Implementar em `rag_service.py`
