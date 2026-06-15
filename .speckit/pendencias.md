# Pendências Metis — TODO consolidado

*Última sync: 2026-04-23 · Versão atual: p-0.9.22 · Alvo: Beta v1.0.0*

Este doc consolida TUDO que está em aberto, espalhado entre `plano_backend_decisoes.md`, seções "Pendente" dos `patch_notes.md`, stubs no código e perguntas de chat não respondidas.

**Convenção**: `[ ]` a fazer · `[~]` parcial · `[x]` concluído · `[?]` bloqueado esperando decisão.

---

## 0. Perguntas rápidas pro César (responder em chat, não precisa código)

- [ ] **A6** · Aceitar convenção de coord Riot `(0,0) = base vermelha, (14999,14999) = base azul` ou prefere inspecionar 5 matches pra verificar?
- [ ] **D2** · Quais sinais combinar no `power_curve[18]`? Sugestão: (a) participação em kills/min + (b) gold diff vs média do role/min + (c) WR @ minuto (40/30/30)
- [ ] **D5** · Schema do excel de campeões: manter 19 cols, cortar pras 7 essenciais, ou meio-termo 10-12?
- [ ] **E1** · Confirmar calendário dos splits Riot 2026 (Split 1: ~10/jan a ~15/mai, Split 2: ~15/mai a ~10/set, Split 3: ~10/set a ~5/jan)
- [ ] **A1** · Dia + hora UTC do cron do GitHub Action da rotação (sugestão: domingo 04:00 UTC)
- [ ] **C6** · Quero que eu rascunhe o system prompt de tom (técnico+amigável) pra André revisar?
- [ ] **C3** · Cotas novas 1k/3k/50k/200k tokens OK? (Premium rende ~6 match-analyses/mês)

---

## 0.5 Cupons (FIRST5 já funcional — ver patch_notes 2026-06-08)

O resgate de cupom está implementado e aplicado no Supabase (`coupon_redemptions` + RPC `redeem_coupon` + bônus diário no chat). Falta só o que está abaixo:

- [ ] **Deploy** do backend (Railway) e frontend (Vercel) — sem push, produção ainda mostra "em breve" no resgate
- [ ] **Ativar "primeiros 5"**: trocar `coupons.max_uses` de `NULL` → `5` (a RPC `redeem_coupon` já impõe a trava de forma atômica via `FOR UPDATE`)
- [ ] **Integrar o bônus no `token_guard` mensal** (`/api/ai/*`) quando esses endpoints entrarem no front — hoje o bônus só vale no chat diário (`/api/v1/chat`)
- [ ] (opcional) **Grant de tier**: resgatar cupom poderia subir o usuário pra `premium` por um período, não só dar tokens

---

## 1. Tarefas do César (só ele pode fazer — dependem de conhecimento local/contas externas)

### Task 1.1 — Spike D2 · Power curve signals
Pasta: `analysis/power_curve/` (gitignored)
- [ ] `run.py` que puxa amostra de 500 matches por role via Supabase/R2 (Polars lazy)
- [ ] Calcular, por champion, os sinais candidatos (ver Q D2 acima) em cada minuto do jogo
- [ ] Exportar `results/signal_comparison.png` (matriz de correlação) + `results/sample_power_curves.csv`
- [ ] `NOTES.md` com recomendação final de sinais + pesos
- [ ] Quando feito: me avisa que converto pra spec do backend

### Task 1.2 — Preencher excel de comp heuristics
- [ ] Copiar `.speckit/templates/comp_heuristics_champions.csv` → `analysis/comp_heuristics/champions.csv`
- [ ] Copiar `.speckit/templates/comp_heuristics_items.csv` → `analysis/comp_heuristics/items.csv`
- [ ] Preencher `champions.csv` (~300 linhas, 19 cols — OU a versão reduzida escolhida em Q D5)
- [ ] Preencher `items.csv` (~180 linhas, 9 cols)
- [ ] Me avisa que escrevo o script de ingestão `scripts/processing/ingest_comp_heuristics.py`

### Task 1.3 — Stripe integration (infra)
- [ ] Criar conta Stripe + produtos dos 3 tiers (Doador R$4,90 once · Premium R$24,90/mês · Pro R$44,90/mês)
- [ ] Webhook endpoint `/api/v1/billing/stripe-webhook` no backend (validar signature)
- [ ] Config `STRIPE_SECRET_KEY` + `STRIPE_WEBHOOK_SECRET` no Railway e GitHub Actions
- [ ] **Destrava**: `/account` cards reais (substitui `FAKE_SUB`) + Ticket C3 loja de tokens

### Task 1.4 — Housekeeping Cloudflare
- [ ] Investigar Worker `mora` (modificado 2026-03-30) — é lixo do Metis? Ou de outro projeto?
- [ ] Se lixo: `wrangler delete mora` (ou via dashboard)

### Task 1.5 — Commit/Deploy pendente
- [x] Frontend p-0.9.20 a p-0.9.22 (commit já feito pelo César)
- [ ] Push quando quiser — Vercel pega automaticamente

---

## 2. Tarefas do André (backend + AI)

### Task 2.1 — System prompt de tom (C6) ✅ 2026-05-19
- [x] Draft em `backend/app/ai/prompts/tone_guardrails.py`
- [x] Regras: nunca "Great job!", citar métrica concreta, não traduzir nome de champion, proibir jargão não-explicado
- [x] 3-5 few-shot examples mostrando tom correto (PT + EN) — 3 PT + 2 EN
- [x] Job semanal de sampling 50 respostas pra validação offline → `scripts/sampling/sample_responses.py`

**O que foi feito:**
- `backend/app/ai/prompts/tone_guardrails.py` — `TONE_RULES` (7 regras com Errado/Certo) + `FEW_SHOT_EXAMPLES` (5 exemplos) + `build_few_shot_block()`
- `backend/services/llm_adapter.py` — `METIS_SYSTEM_PROMPT` agora composto por base + TONE_RULES + few-shots PT; `max_output_tokens` aumentado 1024 → 2048
- `backend/pyrightconfig.json` — corrige falsos positivos do pyright para imports dentro de `backend/`
- `scripts/sampling/sample_responses.py` — 50 prompts em 9 categorias, checagem regex de violações, exporta CSV

**Resultado do sampling (2026-05-19):**
- 50/50 prompts rodaram sem erro de LLM
- 0 violações reais de tom detectadas (3 falsos positivos corrigidos no regex)
- Guardrail fora-de-escopo: 4/4 corretos; comportamento tóxico: 3/3 não validado
- Pendência de produto: EN prompts sempre respondem em PT (decisão a tomar)
- Spending cap Gemini atingido após 3 execuções — resetar em AI Studio antes da próxima rodada

### Task 2.2 — Validar escolha de LLM (C1) ✅ 2026-05-20
- [x] Rodar 20 match-analyses de teste com Gemini 2.5 Flash
- [x] Qualidade suficiente — fallback para Claude Haiku 4.5 nao necessario
- [x] Documentado em `.speckit/patch_notes.md` secao Task 2.2

**Resultados:** 20/20 JSON valido, 0 violacoes de tom, ~1.885 tokens/analise, ~$0.001/analise.
`max_output_tokens` corrigido de 2048 para 8192 em `llm_adapter.py` (valor anterior cortava o JSON).
Prompts em `backend/app/ai/prompts/match_analysis.py`. Script em `scripts/sampling/validate_match_analysis.py`.

### Task 2.3 — Pré-prompting do chat via timeline event (C5)
- [ ] Só depois do Bloco 0 estar estável
- [ ] Quando usuário chega do modal de event, 1ª mensagem da IA vem pré-gerada com contexto

---

## 3. Tickets de backend pra implementação (eu escrevo assim que decisões abaixo fecharem)

Referência completa: `.speckit/plano_backend_decisoes.md`

### Ticket A · Bloco 0 (v0.9.0) — ETL de eventos da timeline
**Bloqueado por**: Q A1 (cron), Q A6 (coord convention) ou task 1.1 se César preferir inspecionar.

- [ ] Migration SQL: `match_timeline_events (id, match_id, t_seconds, type, x, y, key_moment, gold, team, payload JSONB)` + índices
- [ ] Migration SQL: `rotation_log` (pra Ticket E casar depois)
- [ ] Script `scripts/processing/process_timeline_events.py`:
  - [ ] Parse `CHAMPION_KILL` → agrupa por janela 12s ≥2 kills → tipo `solo/ambush/skirmish/teamfight`
  - [ ] Parse `ELITE_MONSTER_KILL` → dragon/herald/baron
  - [ ] Parse `BUILDING_KILL` → tower/inhibitor/nexus
  - [ ] Parse `WARD_PLACED` (todas as wards — decisão A2=b)
  - [ ] Parse `LEVEL_UP` (todos os level-ups — decisão A3=b)
  - [ ] Parse `ITEM_PURCHASED` (só lendários)
  - [ ] Conversão de coords riot (0..14999) → (0..100) com convenção decidida em A6
  - [ ] Extração da `xpCurve` de frames
  - [ ] Grava em `match_timeline_events` em transação
- [ ] Script (2ª passada) detecta key moments stateful:
  - [ ] First blood, ace, teamfight 5v5, baron, elder, soul drake, nexus tower, nexus
  - [ ] **Novo**: pickoff antes de objetivo (look-ahead ≤45s, objetivo capturado pelo time killer)
  - [ ] **Novo**: gold swing kill (look-ahead 60s, swing ≥2000g)
  - [ ] **Novo**: pickoff de grande grupo (3+ jogadores, vantagem numérica ≥2, sem objetivo próximo)
- [ ] GitHub Action `.github/workflows/process_timeline_events.yml` no cron decidido em A1
- [ ] Endpoint `GET /api/v1/match/{match_id}/timeline` → `{ events, xp_curve, heatmap }`
- [ ] Cache do heatmap pré-calculado (rodar no ETL, salvar em `match_timeline_heatmap`)
- [ ] Testes pytest: 1 happy path + 1 match sem eventos + 1 com janela de classificação ambígua

### Ticket B · Radar v2 z-score
**Bloqueado por**: task 1.1 (D2 spike) · Q B1 (escala 0..1 vs 0..10)

- [ ] Migration SQL: `champion_ideal_profiles (champion, elo_tier, role, axis, value, sample_size, computed_at)` PK composto
- [ ] Script `scripts/processing/compute_ideal_profiles.py`:
  - [ ] Fetch top 100 OTPs por (champion, role, elo_tier) com ≥55% WR
  - [ ] Fallback pra champs de nicho: baixa threshold até mínimo 20 OTPs ou WR≥52%
  - [ ] Calcular cada eixo em z-score vs população do patch atual (se ≥5k matches) OU histórico elo×role
  - [ ] Logística → 0..1, grava em `champion_ideal_profiles`
- [ ] GitHub Action cron semanal (casa com Ticket E)
- [ ] Modify `/api/v1/player/recommendations`:
  - [ ] Retornar `confidence: 'high'|'low'` (B5 decidido)
  - [ ] Incluir `percentile` por eixo
  - [ ] Labels continuam AGR/MAP/EFC/… (B2 decidido: frontend traduz)
- [ ] Endpoint novo `GET /api/v1/player/axis-breakdown?puuid&axis&elo_tier`
- [ ] A/B test 0..1 vs 0..10 no staging (B1 pendente)

### Ticket C · AI Insights + loja de tokens
**Nucleo AI**: ✅ 2026-05-20

**Núcleo AI**:
- [x] Migration `ai_cache (scope, id_hash, response JSONB, computed_at, tokens_used, expires_at)`
- [x] Endpoint `POST /api/ai/match-analysis` (cache 7d, limites mensais, free gate)
- [x] Endpoint `POST /api/ai/inline-insight` (cache 24h, limites mensais)
- [x] Endpoint `POST /api/ai/chat` SSE streaming com guardrail
- [x] Rate limit mensal por tier — tabela `token_usage_monthly`
- [x] Gate Free: `strengths[1:]`, `weaknesses[1:]`, `keyMoments[1:]`, `coaching` = None
- [x] Copywriting guardrails integrados no system prompt (task 2.1)

**Frontend AI Insights**:
- [ ] Primitive `<AIInsight>` no design system (severity + icon + title + body + action)
- [ ] Card grande Match Deep Analysis em `/matches/[id]` aba "Análise de Equipe"
- [ ] Inline insights na match history (recomendações da home)
- [ ] Pré-prompting quando vem de modal de timeline event (depois do Bloco 0)

**Loja de tokens** (depende de Stripe — task 1.3):
- [ ] Migration `token_price_snapshots` + `user_token_balances` + `token_purchases`
- [ ] Job diário `update_token_prices.py` (pega preço Gemini, aplica 1.15x markup)
- [ ] Endpoint `GET /api/v1/tokens/prices` (público, pacotes 10k/50k/200k/1M)
- [ ] Endpoint `POST /api/v1/tokens/checkout` (cria Stripe Checkout Session)
- [ ] Endpoint `GET /api/v1/tokens/balance` (user logado)
- [ ] UI loja em `/account` card novo (só Premium+) e botão em `/pricing`
- [ ] Webhook Stripe consome tokens compra → aumenta `extra_tokens_remaining`

### Ticket D · Champion profile v2
**Bloqueado por**: task 1.2 (excel), task 1.1 spike D2 · Q D3 (thresholds já decididos relativos)

- [ ] Migration `champion_meta (id, name, title, tags, lore_pt, lore_en, splash_url, portrait_url, abilities JSONB, base_stats JSONB, last_synced_at)`
- [ ] Migration `champion_matchup_notes (champion, role, opponent, note_short, note_detailed, tokens_used, generated_at, expires_at)` — cache 14d
- [ ] Script `scripts/processing/sync_champion_meta.py` (semanal + botão admin)
- [ ] Script `scripts/processing/compute_power_curve.py` (usa sinais decididos em D2)
- [ ] Modify `/api/v1/champion/{id}` retorna `ChampionProfile` completo (shape handoff seção 4.7)
- [ ] Endpoint `POST /api/v1/admin/refresh-champion-meta` + botão em `/admin`
- [ ] Ingest comp heuristics → tabelas `champion_archetypes` + `item_archetypes` (bloqueado task 1.2)
- [ ] Algoritmo classify_comp() consumido por `/api/v1/champion/{id}/synergies`
- [ ] Matchup notes via IA: só top 5 counters × 168 champs × 5 roles, cache 14d
- [ ] Campo `category_relative` no Matchup (delta vs WR global do oponente, decisão D3)
- [ ] Frontend rewrite `app/champions/[champion]/page.tsx` (4 tabs: Overview/Builds/Matchups/Sinergias)
- [ ] Premium gate: builds filtrados por matchup, note_detailed expandido

### Ticket E · Rotação DB → R2 + stats agregadas
**Bloqueado por**: Q E1 (calendar) · casa com Ticket B (mesmo batch)

- [ ] Script `scripts/processing/rotate_matches.py`:
  - [ ] Identifica partidas fora da "season atual" (split Riot conforme E1)
  - [ ] Confirma JSON existe em R2 (`matches/{id}.json.gz` e `timelines/{id}.json.gz`)
  - [ ] Deleta transacionalmente de `matches`, `match_participants`, `critical_events`, `participant_snapshots`, `match_timelines`, `match_timeline_events` (E4: inclui events)
  - [ ] Log em `rotation_log (match_id, deleted_at)`
- [ ] GitHub Action cron semanal (mesmo do Ticket B)
- [ ] Script `scripts/processing/compute_stats_from_r2.py`:
  - [ ] Lê partidas do R2 via Polars lazy + streaming
  - [ ] Agrupa por `(champion, role, patch, elo, time_bucket)` — E3 decidido, time_bucket ∈ {all, 7d, 30d}
  - [ ] Grava em `stats_champion_aggregate`, `stats_item_aggregate`, `stats_rune_aggregate`
- [ ] Migration das 3 tabelas agregadas
- [ ] Modify `/api/v1/stats/tierlist`, `/api/v1/stats/champions`, `/api/v1/items` pra ler das agregadas
- [ ] Endpoint `GET /api/v1/match/{id}?from_r2=true` on-demand pra matches antigos
- [ ] Cache Cloudflare KV (1h TTL) pras últimas N match detail requests
- [ ] Frontend: card simplificado "Carregar do R2" no match history antigo (E5=a)

---

## 4. Housekeeping (pequenas pendências do p-0.9.x)

### 4.1 — Changelog gap (p-0.9.10 a p-0.9.19)
- [ ] 10 versões entre p-0.9.10 e p-0.9.19 não têm entry no `app/changelog/page.tsx` (só em `patch_notes.md`)
- [ ] Escrever entries user-facing (label + entry_N) em PT/EN
- [ ] **Bloqueado por**: teu aval ("Quer que eu preencha as 10 que faltam?")

### 4.2 — Pendências do p-0.9.19 (não-bloqueantes)
- [ ] Reordenar JSX pra EN natural em "Vitória azul / Blue victory" em `/matches/[id]`
- [ ] César revisar traduções EN da feature list em `/pricing`
- [ ] Deletar dead code: `components/ui/StatsTable.tsx` e `components/ui/Header.tsx`

### 4.3 — Pendências do p-0.9.20 (/account)
- [ ] Integrar Stripe real — substitui `FAKE_SUB` (depende task 1.3)
- [ ] Endpoint de redeem de cupom (input hoje dispara toast stub)
- [ ] Alterar email real (hoje é read-only — Supabase permite mas não implementado)
- [ ] Listar sessões reais — precisa endpoint server com service role (Supabase JS não expõe)
- [ ] Deletar conta real (hoje stub)

### 4.4 — Pendências do p-0.9.22 (radar)
- [ ] Percentile real no tooltip (hoje só valor bruto player/ideal) — **requer Ticket B backend**
- [ ] Drills via IA no modal "Como melhorar" — **requer Ticket C backend**

### 4.5 — Bugs abertos (do `.speckit/bugfixes.md`)
- [x] BUG-017 GitHub Actions secrets (resolvido 2026-04-04)
- [x] BUG-009, BUG-010, BUG-011, BUG-012 (resolvidos)
- Nenhum blocker atualmente aberto

---

## 5. Decisões ainda abertas no `plano_backend_decisoes.md`

- [?] **B1** · Testar 0..1 vs 0..10 no staging — só depois de ter o Radar v2 backend rodando
- [?] **B3** · Já decidido: patch atual se ≥5k matches, senão histórico elo×role — só implementar
- [?] **A5** · Key moments: lista canônica confirmada (3 tipos novos adicionados pelo César)
- [?] **A7** · Já decidido: `note` via IA é on-demand (dentro do match-analysis), nunca batch

---

## 6. Ordem de ataque sugerida (caminho crítico)

```
1. [César responde Q0 (7 perguntas rápidas)] — 5-10 min
2. [César roda task 1.1 power curve spike] — 1-2 dias
3. [César preenche task 1.2 comp heuristics] — pode ser em paralelo, 2-3 dias
4. [André faz task 2.1 prompts] — 1-2 dias (em paralelo)
5. [Claude Code implementa Ticket A + E juntos] — 10 dias
6. [Claude Code implementa Ticket B] — 4 dias
7. [Claude Code implementa Ticket D sem matchup notes] — 5 dias
8. [Task 1.3 Stripe quando estiver pronto] — destrava Ticket C loja
9. [Claude Code implementa Ticket C completo] — 10 dias
```

**Marco Beta v1.0.0** = Tickets A + B + C + D + E todos ✅. Estimativa total: ~6-8 semanas de trabalho + dependência de decisões/spikes.

---

## 7. Onde cada coisa vive (pra referência)

| O quê | Onde |
|-------|------|
| Decisões arquiteturais | `.speckit/plano_backend_decisoes.md` |
| Estado atual das versões | `.speckit/plano_atual.md` |
| Histórico técnico de mudanças | `.speckit/patch_notes.md` |
| Bugs bloqueadores | `.speckit/bugfixes.md` |
| Templates de CSVs pra preencher | `.speckit/templates/` |
| Handoffs do Claude Design | `.speckit/handoffs/metis-1-0/` |
| Spikes locais gitignored | `analysis/` |
| Este doc (lista consolidada) | `.speckit/pendencias.md` |
