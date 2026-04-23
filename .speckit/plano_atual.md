# Metis — Plano Atual

*Ultima sync: 2026-04-22 | Versao atual: p-0.9.15 — REDESIGN COMPLETO 🎉*

---

## Estado Atual das Versoes

| Versao | Status | O que entregou |
|--------|--------|----------------|
| v0.1–0.7 | ✅ Concluido | Base de dados, pipeline, endpoints, frontend inicial |
| v0.8.0 | ✅ Concluido | Big Update: header, tier list, player page, match detail, itens, IA, pricing |
| v0.8.1 | ✅ Concluido | Recomendacoes 8D (Neo-Artemis), radar chart, mapa de runas completo |
| v0.8.2 | ✅ Concluido | Security: API key middleware, CORS restrito, erros sanitizados, Gemini seguro |
| v0.8.3 | ✅ Concluido | Gemini 2.5 Flash |
| p-0.9.0 | ✅ Concluido | Guardrail LoL, token limits por tier, barra de uso, SDK google-genai |
| p-0.9.1 → p-0.9.4 | ✅ Concluido | Bans/pickrate/banrate, ETL local, filtro impopulares, Bronze HTML guides, bugfixes |
| p-0.9.5 | ✅ Concluido | Redesign: Fundação (tokens `--m-*`, fontes Space Grotesk/JetBrains Mono, `components/design/` com 18 primitives) |
| p-0.9.6 | ✅ Concluido | Redesign: Home + ajustes do design system (auth real no header, modo claro removido, hover utilities, ícones oficiais de role, `--m-accent` seguindo switcher, counts reais do Supabase) |
| p-0.9.7 | ✅ Concluido | Redesign: Tier List (`app/champions/page.tsx` — agrupamento por tier com cards responsivos, filtros preservados) |
| p-0.9.8 | ✅ Concluido | Redesign: Itens (`app/items/page.tsx` — 2 spotlights top-picks/top-WR + tabela densa, filtros role/patch/busca/sort preservados) |
| p-0.9.8.1 | ✅ Concluido | Backend: Enriquecer catálogo de itens (tabela `items` no Supabase, script `sync_items.py`, endpoint retorna gold_cost/tags/category/trend) |
| p-0.9.9 | ✅ Concluido | Redesign: Planos + Cupons (4 tier cards, tabela `coupons`, endpoint público, comparativo + FAQ + empresas reestilizados) |
| p-0.9.10 | ✅ Concluido | Redesign: Changelog (`app/changelog/page.tsx` — timeline vertical com spine + nodes, tags coloridas, histórico atualizado com p-0.9.5→p-0.9.9) |
| p-0.9.11 | ✅ Concluido | Redesign: Team (`app/team/page.tsx` — 3 cards com glow decorativo, tags em chips, stats footer) |
| p-0.9.12 | ✅ Concluido | Redesign: Chat Metis (token bar, thread bubbles, quick prompts, gate premium) + easter egg de código de cupom oculto |
| p-0.9.13 | ✅ Concluido | Redesign: Player Dashboard (banner, 4 KPIs, winrate cumulativo, tabela campeões, recomendações com DualRadar, match history, sidebar rica) |
| p-0.9.14 | ✅ Concluido | Redesign: Champion Page (hero violet, 4 sub-tabs, detecção de role impopular) |
| **p-0.9.15** | ✅ **Concluido** | **Redesign: Match Detail (3 tabs Overview/Análise de Equipe/Builds, TeamBlock com Metis Score, SplitDonut por métrica, timeline de frames reusada). FECHA O REDESIGN 🎉** |

---

## Roadmap Redesign (p-0.9.6 → p-0.9.15)

Baseado no handoff do Claude Design (`metis-design.html` + 10 screens JSX). Uma tela por versao, cada uma consumindo `.metis-scope` + primitives da fundacao p-0.9.5.

| Versao | Tela | Arquivo alvo |
|--------|------|--------------|
| ~~p-0.9.6~~ | ~~Home~~ ✅ concluída | ~~`app/page.tsx`~~ |
| ~~p-0.9.7~~ | ~~Tier List~~ ✅ concluída | ~~`app/champions/page.tsx`~~ |
| ~~p-0.9.8~~ | ~~Itens~~ ✅ concluída | ~~`app/items/page.tsx`~~ |
| ~~p-0.9.9~~ | ~~Planos + Cupons~~ ✅ concluída | ~~`app/pricing/page.tsx`~~ |
| ~~p-0.9.10~~ | ~~Changelog~~ ✅ concluída | ~~`app/changelog/page.tsx`~~ |
| ~~p-0.9.11~~ | ~~Equipe~~ ✅ concluída | ~~`app/team/page.tsx`~~ |
| ~~p-0.9.12~~ | ~~Chat Metis~~ ✅ concluída | ~~`app/chat/page.tsx`~~ |
| ~~p-0.9.13~~ | ~~Player dashboard~~ ✅ concluída | ~~`app/players/[puuid]/page.tsx`~~ |
| ~~p-0.9.14~~ | ~~Champion page~~ ✅ concluída | ~~`app/champions/[champion]/page.tsx`~~ |
| ~~p-0.9.15~~ | ~~Match detail~~ ✅ concluída (timeline interativa com mapa fica pro Bloco 0) | ~~`app/matches/[match_id]/page.tsx`~~ |

**Redesign Metis 1.0 — FECHADO.** Próximos passos em aberto:
- `/admin` e `/auth` continuam no estilo antigo (fora do handoff do Claude Design). Decidir se migrar numa próxima versão.
- Sistema antigo `--metis-*` no CSS pode ser removido quando admin/auth migrarem.
- Roadmap analytics: Bloco 0 (parsing eventos timeline) destrava timeline interativa completa, builds filtradas, matchup profundo — seguir no M2.

---

## 🎯 Roadmap v0.9.0 — Analytics Profundo

> Objetivo: tornar o Metis a fonte mais rica de analytics de LoL em PT-BR.
> Pre-requisito critico: **parsear eventos ITEM_PURCHASED e SKILL_LEVEL_UP do critical_events** — desbloqueia 3 dos 5 blocos abaixo.

### Bloco 0 (PRE-REQUISITO) — Parsing de Eventos do Timeline
**Responsavel:** Cesar | **Complexidade:** Media | **Desbloqueia:** Blocos 1, 2 e 3

- [ ] Estender `extrair_dados_timeline()` em `process_timelines.py` para parsear:
  - `ITEM_PURCHASED` — item_id + timestamp + participant_id
  - `SKILL_LEVEL_UP` — skill_slot (Q/W/E/R) + level + timestamp
- [ ] Salvar esses eventos na tabela `critical_events` (schema ja existe com dados de kill/dragon/torre)
- [ ] Rodar backfill nos matches existentes via pipeline
- [ ] Verificar que os 37k eventos existentes + novos ficam consistentes

### Bloco 1 — Matchup Detalhado
**Responsavel:** Cesar (backend) + Takida (frontend) | **Complexidade:** Grande

- [ ] `GET /api/v1/champion/{champion}/vs/{opponent}` — pagina de matchup
- [ ] Forcar mesma lane (TOP vs TOP, MID vs MID) — counter de lane real
- [ ] Gold diff e XP diff @5/10/15min — cruzar `match_timelines` com `match_participants`
- [ ] Delta normalizado: quao diferente vs media geral desse campeao
- [ ] Stats especificas da matchup (KDA, CS/m, dano, visao)
- [ ] Builds usadas CONTRA esse oponente especifico
- [ ] Link clicavel na tabela de matchups do campeao → pagina detalhada

### Bloco 2 — Itens Profundo
**Responsavel:** Cesar (backend) + Andre (AI) + Takida (frontend) | **Complexidade:** Grande
**Depende de:** Bloco 0 (ordem de compra)

- [ ] Winrate por slot (1o/2o/3o item lendario) — usando eventos ITEM_PURCHASED
- [ ] Delta WR: diff de quem builda X como 1o vs 2o item
- [ ] Detectar combos frequentes (pares e trios): Tocha+Liandry → WR do combo
- [ ] Combos por campeao: quais campeoes mais usam cada combo
- [ ] Combos CONTRA: contra quais times cada combo tem melhor WR
- [ ] Combos COM: com quais aliados cada combo funciona melhor
- [ ] AI titles: Gemini gera nomes criativos pros combos ("Burn Build", "Poke Machine")

### Bloco 3 — Builds Core na Pagina do Campeao
**Responsavel:** Cesar + Takida | **Complexidade:** Media
**Depende de:** Bloco 0 (para ter ordem real) — sem ele, usa top-3 mais frequentes juntos

- [ ] Core build visual: Item 1 → Item 2 → Item 3 com setas e winrate do trio
- [ ] Builds alternativas (2o e 3o combo mais comum)
- [ ] Skill order: Q/W/E/R por nivel (eventos SKILL_LEVEL_UP)

### Bloco 4 — Recomendacao de Runas
**Responsavel:** Cesar + Takida | **Complexidade:** Media
**Dados ja disponiveis:** `runes_raw` JSONB em `match_participants`

- [ ] Agregar runas por campeao+role a partir do `runes_raw`
- [ ] Mostrar: keystone mais usado + arvores + stat shards + WR de cada combo
- [ ] Integrar na pagina do campeao (nova tab ou secao na tab Builds)
- [ ] Na tab Build da partida: mostrar TODAS as runas (ja existe parcialmente)
- [ ] Nas recomendacoes de campeao do player: sugerir runas que combinam com o playstyle

### Bloco 5 — CI/CD e Qualidade
**Responsavel:** Cesar | **Complexidade:** Media

- [ ] GitHub Action: roda `pytest tests/ -v` em todo PR
- [ ] GitHub Action: roda `npx tsc --noEmit` no frontend em todo PR
- [ ] Smoke test de endpoints criticos (health, tierlist, player/history)
- [ ] Deploy automatico no Railway (backend) e Vercel (frontend) apos merge na main

### Seguranca (Backlog — nao bloqueia 0.9.0)
- [ ] Rate limiting por IP (Railway middleware ou Cloudflare)
- [ ] Supabase RLS nas tabelas publicas (players, matches, match_participants)
- [ ] WAF / Cloudflare na frente do Railway

---

## 🏆 Visao v1.0.0 — Release Oficial

> A 1.0.0 e a versao que sai do Alpha e entra em producao real com usuarios pagantes.
> Dois pilares obrigatorios: **produto completo** e **monetizacao funcionando**.

### Pilar 1 — Produto Completo

**Analytics:**
- Todos os 5 blocos da 0.9.0 entregues
- Timeline interativa com mapa (critico_events ja tem posicoes X/Y)
- Dashboard de evolucao temporal do jogador (WR por semana/mes)
- Comparacao com jogadores do mesmo elo

**IA:**
- Chat com RAG real: Metis consulta dados do banco antes de responder
- Function calling: Gemini chama endpoints da propria API ("busca o historico desse jogador")
- Build sugerida por IA: dado campeao+lane+matchup → build com explicacao
- Alertas de meta: "Esse campeao subiu 5% de WR nesse patch"

**Conta Riot:**
- Vinculo OAuth Riot Sign On (conta verificada)
- Badges automaticas: Challenger, 1kk maestria, etc.
- Perfil publico com badges visiveis

### Pilar 2 — Monetizacao Funcionando

- [ ] Gateway de pagamento integrado (Stripe ou MercadoPago)
- [ ] Fluxo completo: plano → pagamento → acesso automatico
- [ ] Renovacao automatica + cancelamento self-service
- [ ] Webhook de pagamento → atualiza `subscriptions` e `app_metadata.tier` no Supabase
- [ ] Pagina de conta do usuario (ver plano, historico de pagamentos, cancelar)

### Pilar 3 — Estabilidade e Escala

- [ ] Rate limiting real (Cloudflare ou Railway)
- [ ] Monitoramento: alertas de erro, latencia, uso de tokens IA
- [ ] Supabase RLS completo em todas as tabelas
- [ ] Testes automatizados cobrindo todos os endpoints e flows criticos
- [ ] SLA definido: 99.5% uptime, resposta < 500ms nos endpoints principais
- [ ] Documentacao de onboarding pra novos devs (CONTRIBUTING.md)

### Criterio de entrada na 1.0.0

Todos os itens abaixo devem estar verdes:
- [ ] Gateway de pagamento processando transacoes reais
- [ ] Chat com RAG (nao so LLM sem contexto)
- [ ] Todos os blocos analiticos da 0.9.0 entregues
- [ ] Timeline interativa funcionando
- [ ] CI/CD rodando em 100% dos PRs
- [ ] Pelo menos 1 usuario pagante ativo (prova de conceito do fluxo completo)

---

## Dependencias Tecnicas Criticas

```
Bloco 0 (ITEM_PURCHASED parsing)
    ↓
    ├─ Bloco 1 (builds na matchup)
    ├─ Bloco 2 (itens profundo: combos, WR por slot)
    └─ Bloco 3 (builds core: ordem real)

Bloco 4 (runas) — independente, pode comecar agora
Bloco 5 (CI/CD) — independente, pode comecar agora

Para 1.0.0:
    Blocos 1-5 completos
    + RAG no chat
    + Gateway de pagamento
    + Timeline interativa
```

---

## Visao v1.1.0 — Compressao de dados (implementar cedo)

> Implementar JA na 1.1.0 pra economizar espaço antes de acumular muitos dados.

- [ ] Separar `challenges` JSONB do `match_participants` pra tabela propria (`participant_challenges`)
  - `match_participants` fica leve (~15 KB/partida em vez de ~42 KB)
  - `participant_challenges` carregado sob demanda (so quando o usuario abre detalhes)
- [ ] Comprimir `runes_raw` — guardar so os IDs de runas (array de ints) em vez do JSONB completo
- [ ] Comprimir `match_timelines.frames` — guardar so os minutos-chave (5, 10, 15, 20, 25) em vez de todos
- [ ] Economia estimada: ~40% de reducao (de ~80 KB pra ~48 KB por partida)
- [ ] De 104k partidas/8GB pra ~170k partidas/8GB

## Visao v1.2.0 — Rotacao e Archival

> Implementar quando o banco passar de 6 GB.

- [ ] Rotacao automatica: deletar `match_participants` e `critical_events` com mais de 3 meses
- [ ] Manter `matches` (metadata) pra sempre — so deletar os dados pesados
- [ ] Archival: mover dados antigos pro R2 em formato comprimido (Parquet ou JSONL.gz)
- [ ] Script de restore: poder recuperar dados archivados se necessario
- [ ] Monitoramento: alerta quando banco passar de 7 GB

## Numeros de referencia (custos DB)

- **~80 KB por partida** (com tudo: participants, events, snapshots, timelines)
- **~13.000 partidas por GB**
- **Pipeline atual: ~1.000 partidas/dia** → ~2.4 GB/mes
- **Supabase Pro (8 GB, $25/mes):** aguenta ~3.3 meses sem rotacao
- **Com compressao (v1.1.0):** aguenta ~5.5 meses
- **Com rotacao (v1.2.0):** infinito (mantem janela de 3 meses)

---

## Times e Responsabilidades (0.9.0)

| Bloco | Cesar | Andre | Takida |
|-------|-------|-------|--------|
| 0 (Pre-req) | Pipeline + parsing | — | — |
| 1 (Matchup) | Backend endpoint | — | Frontend pagina |
| 2 (Itens) | Backend agregacao | AI titles | Frontend pagina |
| 3 (Builds core) | Backend query | — | Frontend visual |
| 4 (Runas) | Backend agregacao | Rec. de runas IA | Frontend tab |
| 5 (CI/CD) | Setup workflows | — | — |
