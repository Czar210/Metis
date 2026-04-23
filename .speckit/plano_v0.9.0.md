# Plano v0.9.0 — Sistema de Recomendação Neo-Artemis 2.0

**Criado:** 2026-04-22
**Autor:** César (proposta) + Claude (detalhamento)
**Status:** Aprovado em macro. Cada fase exige re-aval antes de implementar.

---

## Índice

- [Filosofia](#filosofia)
- [Convenções](#convenções)
- [Bibliotecas globais](#bibliotecas-globais-do-projeto)
- [Fase 0 — Infraestrutura Estatística](#fase-0--infraestrutura-estatística)
- [Fase 1 — Normalização real no perfil 8D](#fase-1--normalização-real-no-perfil-8d)
- [Fase 2 — Split Win-vs-Loss](#fase-2--split-win-vs-loss)
- [Fase 3a — Timing via Frames](#fase-3a--timing-via-frames)
- [Fase 3b — Timing via Events (depende Bloco 0)](#fase-3b--timing-via-events-depende-bloco-0)
- [Fase 4 — Classes de Campeões + Enemy Comp](#fase-4--classes-de-campeões--enemy-comp)
- [Fase 5 — Build Contextual](#fase-5--build-contextual)
- [Fase 6 — Pensamento Crítico (regras)](#fase-6--pensamento-crítico-regras)
- [Fase 7 — IA Narrativa (Metis)](#fase-7--ia-narrativa-metis)
- [Anexo A — Taxonomia de classes](#anexo-a--taxonomia-de-classes-fase-4)
- [Anexo B — Arquétipos de composição](#anexo-b--arquétipos-de-composição-fase-5)
- [Anexo C — Catálogo inicial de regras](#anexo-c--catálogo-inicial-de-regras-fase-6)

---

## Filosofia

1. **Cada fase entrega valor isolado.** Parar depois da Fase 1 já é um upgrade válido em produção.
2. **Toda fase precisa de re-aval antes de começar.** Este doc é o mapa macro. Antes de codar a Fase N, abro um plano curto específico com código real.
3. **Fragmento = unidade atômica de ~30min–2h.** Se um step está demorando mais, é porque virou 2 steps.
4. **Se descobrir que X já existe no meio do caminho, paro e adapto.** Exemplo: se a `match_participants.challenges` já tem `laning_phase_gold_exp_advantage`, pulamos a criação desse campo.
5. **Não começo Fase N+1 sem Fase N validada.** Validação = critério de "done" da fase + smoke test no endpoint/UI.

---

## Convenções

- **Migrations:** numeradas `003_`, `004_`, etc. Aplicadas via MCP Supabase (`apply_migration`).
- **Scripts:** ficam em `scripts/processing/` (agregação) ou `scripts/ingestion/` (fetch externo).
- **Endpoints:** prefixo `/api/v1/`, respostas sempre JSON, erros via `HTTPException`.
- **Testes:** pytest em `tests/`. Todo endpoint novo ganha teste de caminho feliz + erro.
- **Frontend:** novos componentes em `frontend/src/components/design/` quando reusáveis, inline na page quando específicos.
- **Git:** cada fase = 1 PR. Dentro da fase, commits frequentes; ao final, squash se necessário.
- **`.speckit/patch_notes.md`:** atualizado ao fechar cada fase.

---

## Bibliotecas globais do projeto

Pra não repetir em cada fase, aqui vai o stack que já existe e vai ser usado:

### Backend (Python 3.12)
- `fastapi` — framework
- `supabase-py` (import `supabase`) — cliente do Supabase
- `pydantic` — contratos de API
- `python-dotenv` — env vars
- `polars` — dataframes (mais rápido que pandas, já em uso)
- `numpy` — só se polars ficar limitador
- `google-genai` — chat com Gemini
- `httpx` / `requests` — chamadas HTTP externas (DDragon)

### Frontend (Next.js 15 + React 19)
- Já tudo definido no `frontend/package.json`
- Vou reusar os primitives em `components/design/`

### DevOps
- Migrations: MCP Supabase (`mcp__claude_ai_Supabase__apply_migration`)
- GitHub Actions: YAML em `.github/workflows/`
- Local: `uvicorn backend.main:app --reload` + `npm run dev`

### Bibliotecas novas que cada fase pode precisar
Cada fase lista explicitamente **o que é novo**. Se não estiver listado, é porque o stack global cobre.

---

## Fase 0 — Infraestrutura Estatística

> **Objetivo:** tabela de referência com médias, stddev e percentis por role/stat/patch, base pra tudo que vem depois.

**Pré-requisitos:** nenhum.
**Custo estimado:** 1 dia.
**Bloqueia:** Fase 1, 2, 6.

### Steps

#### Step 0.1 — Definir lista de stats relevantes
- **Tarefa:** lista fechada de stats que entram na tabela (15 stats).
- **Input:** schema de `match_participants` (consultar Supabase MCP `list_tables`).
- **Output:** lista em Python constante `ROLE_STAT_FIELDS: list[str]`.
- **Bibliotecas:** nenhuma.
- **Validação:** cada stat existe como coluna em `match_participants` (não é computada).
- **Falha previsível:** usar uma stat que está só no `challenges` JSONB — tem que extrair em coluna primeiro.
- **Proposta inicial de stats:** `kills, deaths, assists, cs_per_minute, damage_per_minute, vision_score, kill_participation, gold_earned, damage_dealt_to_buildings, solo_kills, early_laning_phase_gold_exp_advantage, total_damage_taken, champion_level, total_cs, gold_per_minute` (15 stats).

#### Step 0.2 — Criar migration `003_create_role_stat_refs.sql`
- **Tarefa:** DDL da tabela.
- **Input:** lista do 0.1.
- **Output:** arquivo em `database/migrations/003_create_role_stat_refs.sql`.
- **Bibliotecas:** nenhuma.
- **Validação:** SQL valida no validator do Supabase (se tiver) ou na hora de aplicar.
- **Schema:**
  ```sql
  CREATE TABLE role_stat_refs (
    role        TEXT NOT NULL,        -- 'TOP' | 'JUNGLE' | 'MIDDLE' | 'BOTTOM' | 'UTILITY'
    stat_name   TEXT NOT NULL,        -- ex: 'cs_per_minute'
    patch       TEXT NOT NULL,        -- ex: '16.7'
    avg         DOUBLE PRECISION NOT NULL,
    stddev      DOUBLE PRECISION NOT NULL,
    p25         DOUBLE PRECISION NOT NULL,
    p50         DOUBLE PRECISION NOT NULL,
    p75         DOUBLE PRECISION NOT NULL,
    p95         DOUBLE PRECISION NOT NULL,
    sample_size INTEGER NOT NULL,
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (role, stat_name, patch)
  );
  -- RLS: leitura pública (não é dado sensível), write só service_role.
  ```

#### Step 0.3 — Aplicar migration via MCP
- **Tarefa:** chamar `mcp__claude_ai_Supabase__apply_migration`.
- **Input:** SQL do 0.2.
- **Output:** tabela existe no banco.
- **Validação:** `mcp__claude_ai_Supabase__list_tables` confirma a tabela.

#### Step 0.4 — Escrever script `refresh_role_stat_refs.py`
- **Tarefa:** script que varre `match_participants`, agrega por `(role, patch, stat)`, calcula percentis, faz upsert.
- **Input:** tabela `match_participants` populada, `ROLE_STAT_FIELDS`.
- **Output:** arquivo em `scripts/processing/refresh_role_stat_refs.py`.
- **Bibliotecas:**
  - `polars` — group_by + quantile em batch (rápido pra agregação)
  - `supabase-py` — upsert final
  - `python-dotenv` — env
- **Estrutura:**
  ```python
  # 1. Lê .env (SUPABASE_URL, SUPABASE_KEY)
  # 2. Fetch match_participants com select das colunas relevantes + matches(game_version)
  # 3. Monta DataFrame polars
  # 4. Filtra por roles válidas (5), exclui UNKNOWN
  # 5. Pra cada stat:
  #    - group_by(role, patch).agg(mean, std, quantiles 0.25/0.5/0.75/0.95, count)
  # 6. Unpivot + batch upsert na role_stat_refs com on_conflict=(role, stat_name, patch)
  ```
- **Validação:**
  - Roda local: `python -m scripts.processing.refresh_role_stat_refs`
  - Verifica log: `upsert 75 rows` (5 roles × 15 stats)
  - Query: `SELECT avg, stddev FROM role_stat_refs WHERE role='JUNGLE' AND stat_name='cs_per_minute' AND patch='16.7'` → avg ~5–6
- **Falha previsível:** sample_size muito baixo pra alguma role (ex: UNKNOWN) → skip. Log warnings.

#### Step 0.5 — Primeiro run + validação manual
- **Tarefa:** rodar o script e validar números.
- **Input:** script funcionando.
- **Output:** tabela populada com patch atual.
- **Validação:**
  - `SELECT role, avg FROM role_stat_refs WHERE stat_name='kill_participation' AND patch='16.7'` → Sup > Jg > Mid > Top > ADC (ordem esperada: Sup tem KP maior)
  - `SELECT role, avg FROM role_stat_refs WHERE stat_name='cs_per_minute' AND patch='16.7'` → ADC > Mid > Top > Jg > Sup (ordem esperada)
  - Se algo inverter, investigar — pode ser bug no script.

#### Step 0.6 — (Opcional) Endpoint de debug
- **Tarefa:** `GET /api/v1/stats/role-refs?role=&patch=` retorna a tabela.
- **Input:** tabela populada.
- **Output:** endpoint em `backend/api/routes/stats.py`.
- **Bibliotecas:** já no stack.
- **Validação:** curl retorna JSON com 15 rows quando filtrado por role.
- **Decisão:** se não precisa de debug via UI, pular esse step.

#### Step 0.7 — GitHub Action semanal
- **Tarefa:** workflow `.github/workflows/refresh_role_stat_refs.yml` roda o script 1×/semana.
- **Input:** secrets `SUPABASE_URL`, `SUPABASE_KEY`.
- **Output:** YAML.
- **Validação:** trigger manual (`workflow_dispatch`) funciona antes do cron.
- **Frequência:** domingo 04:00 UTC.

### Critério de "done" da Fase 0
- [ ] Tabela `role_stat_refs` existe com 75 rows populadas pra patch atual
- [ ] Script roda sem erro local
- [ ] GitHub Action agendada
- [ ] Números passam sanity check (Sup KP alto, ADC CS alto)
- [ ] Patch notes atualizado com entrada da Fase 0

---

## Fase 1 — Normalização real no perfil 8D

> **Objetivo:** substituir thresholds hardcoded em `_build_8d_profile` por z-score contra `role_stat_refs`.

**Pré-requisitos:** Fase 0 completa.
**Custo estimado:** 1–2 dias.
**Bloqueia:** Fases 2, 3a, 6, 7 (qualquer coisa que dependa de perfil realista).

### Steps

#### Step 1.1 — Adicionar função `z_to_score` em `recommendation_service.py`
- **Tarefa:** mapear z-score → 0–10.
- **Input:** z-score (float).
- **Output:** score 0–10 (float).
- **Fórmula:** `score = clip((z + 2) / 4 * 10, 0, 10)` — `z=0` vira 5, `z=+2` vira 10, `z=-2` vira 0. Linear e previsível.
- **Alternativa considerada:** sigmoid `10 / (1 + exp(-z))`. Descartado por não ter saturação linear pros casos médios.
- **Bibliotecas:** `math` stdlib.
- **Validação:** testes inline:
  - `z_to_score(0) == 5.0`
  - `z_to_score(2) == 10.0`
  - `z_to_score(-2) == 0.0`
  - `z_to_score(1) == 7.5`

#### Step 1.2 — Fetch lazy dos role_refs no `buscar_recomendacoes`
- **Tarefa:** carregar `role_stat_refs` do patch atual na memória e passar pro `_build_8d_profile`.
- **Input:** patch atual via `stats_service.get_current_patch()` (já existe? Verificar).
- **Output:** dict `role_refs: dict[str, dict[str, tuple[float, float]]]` tipo `{"JUNGLE": {"cs_per_minute": (5.2, 1.1), ...}, ...}`.
- **Bibliotecas:** `supabase-py`.
- **Validação:** dict tem 5 roles × 15 stats.
- **Cache:** em memória no service por até 1h — evita query a cada request.

#### Step 1.3 — Refatorar `_build_8d_profile` pra aceitar `role_refs`
- **Tarefa:** assinatura nova `_build_8d_profile(rows, role, role_refs)`.
- **Input:** rows do player/champ, role identificada, role_refs dict.
- **Output:** vetor 8D normalizado via z-score.
- **Bibliotecas:** `math`.
- **Mudança interna:** cada dimensão deixa de usar `min(x / THRESHOLD, 1.0)` e passa a usar:
  ```python
  def z_stat(field: str) -> float:
      avg, std = role_refs[role].get(field, (0, 1))
      if std == 0: return 5.0  # sem variação, fica no meio
      z = (player_avg_of_field - avg) / std
      return z_to_score(z)
  ```
- **Validação:** manter mesmas 8 dimensões semânticas, mas o cálculo interno muda.

#### Step 1.4 — Migrar cada uma das 8 dimensões
- **Tarefa:** uma por vez, substituir cálculo antigo pelo novo.
- **Bibliotecas:** `math`.
- **Fragmentos:**
  - 1.4.1 Agressividade: componentes `kills`, `solo_kills`, `kill_participation`, `damage_per_minute` → média dos z-scores → `z_to_score`
  - 1.4.2 Controle de Mapa: `vision_score`
  - 1.4.3 Eficiência: `gold_earned`, `cs_per_minute`
  - 1.4.4 Pressão: `damage_dealt_to_buildings`
  - 1.4.5 Sobrevivência: KDA ratio normalizado por role + death penalty
  - 1.4.6 Utilidade: assist_ratio (precisa ser computado em relação à role)
  - 1.4.7 Early Game: `early_laning_phase_gold_exp_advantage`
  - 1.4.8 Consistência: winrate (esta pode ficar em 0–10 direto, não tem "média de role" pra winrate)

#### Step 1.5 — A/B test manual
- **Tarefa:** rodar recomendação pra 5 puuids conhecidos antes/depois.
- **Input:** endpoint `/api/v1/player/recommendations?puuid=`.
- **Output:** comparação lado a lado em markdown.
- **Validação:**
  - Player Sup não aparece mais "agressividade 9/10"
  - Player ADC com CS alto tem Eficiência distinta de player ADC com CS baixo (hoje ambos dão 10 pelo threshold)
- **Ferramenta:** curl + jq, ou script rápido em Python.

#### Step 1.6 — Atualizar UI `/players/[puuid]` se necessário
- **Tarefa:** se os scores mudam de distribuição muito, revalidar a tela.
- **Output:** nada ou ajuste visual leve.
- **Validação:** smoke test em 3 players.

### Critério de "done" da Fase 1
- [ ] `_build_8d_profile` usa `role_refs` via z-score
- [ ] Nenhum threshold hardcoded remanescente
- [ ] A/B mostra diferença plausível (não 100% em tudo)
- [ ] Endpoint responde 200 com tempos iguais ou melhores (cache do role_refs)
- [ ] Patch notes atualizado

---

## Fase 2 — Split Win-vs-Loss

> **Objetivo:** calcular dois perfis 8D por jogador (vitórias / derrotas) e expor o delta como sinal.

**Pré-requisitos:** Fase 1 completa.
**Custo estimado:** 2 dias.
**Bloqueia:** Fase 6 (algumas regras dependem do delta).

### Steps

#### Step 2.1 — Filtro win/loss no `_build_8d_profile`
- **Tarefa:** chamar a função 2x com subconjunto filtrado.
- **Input:** rows totais.
- **Output:** 3 perfis — `all`, `wins_only`, `losses_only`.
- **Bibliotecas:** stdlib.
- **Validação:** se o player tem só vitórias, `losses_only` vira `None` e o delta é só informativo.

#### Step 2.2 — Calcular delta
- **Tarefa:** `delta[i] = wins_only[i] - losses_only[i]` pra cada dimensão.
- **Input:** dois vetores 8D.
- **Output:** vetor delta (pode ser negativo).
- **Bibliotecas:** stdlib.
- **Validação:** se perfil_win igual a perfil_loss → delta zero → sem sinal prescritivo, ok.

#### Step 2.3 — Sample size mínimo
- **Tarefa:** exigir mínimo 5 partidas de vitória e 5 de derrota pra confiar no delta.
- **Se não tem:** usar só `profile_all` (comportamento atual).
- **Output:** flag `delta_confidence: 'high' | 'low' | 'none'` no response.

#### Step 2.4 — Ampliar similaridade pra priorizar padrão de vitória
- **Tarefa:** quando `delta_confidence == 'high'`, comparar champs contra `wins_only` em vez de `all`.
- **Rationale:** quer recomendar champs que se parecem com o **player quando vence**, não com a média.
- **Bibliotecas:** stdlib.
- **Validação:** player agressivo-quando-vence recebe recomendação de champ agressivo; player passivo-quando-vence recebe champ defensivo.

#### Step 2.5 — Novo campo no response
- **Tarefa:** adicionar `player_profile_wins`, `player_profile_losses`, `delta`, `delta_confidence`.
- **Input:** cálculos dos steps anteriores.
- **Output:** JSON do endpoint expandido.
- **Teste:** `curl /api/v1/player/recommendations?puuid=X | jq '.[] | keys'` mostra campos novos.

#### Step 2.6 — Insight/reason baseado no delta
- **Tarefa:** regra simples no `_explain_match`:
  ```python
  if abs(delta[i]) > 2.5 and delta_confidence == 'high':
      # Dimensão onde o player muda muito entre w/l
      reasons.append(f"Quando vence, sua {DIMENSION_NAMES[i]} sobe +{delta[i]:.1f}")
  ```
- **Output:** array `reasons` com essas strings.
- **Validação:** player com padrão W/L claro recebe esse reason.

#### Step 2.7 — UI no dashboard do player
- **Tarefa:** no card de recomendações, mini-radar dual (wins vs losses do próprio player) opcional ao expandir.
- **Input:** dados já no response.
- **Output:** componente reusa `DualRadar` existente (redesign já tem).
- **Validação:** smoke em `/players/Zaras%230210` mostra o radar dual.

### Critério de "done" da Fase 2
- [ ] Response tem 3 perfis + delta + confidence
- [ ] `delta_confidence='high'` muda o ranking das recomendações
- [ ] Reasons baseados em delta aparecem quando aplicável
- [ ] UI mostra o delta sem quebrar
- [ ] A/B test com player de W/L muito assimétrico confirma que faz sentido

---

## Fase 3a — Timing via Frames

> **Objetivo:** agregar métricas de timing a partir dos frames da timeline (que já temos). Novas dimensões: `scaling` e `early pressure`.

**Pré-requisitos:** Fase 1 completa. **Não** depende da Fase 2 (podem rodar em paralelo).
**Custo estimado:** 2 dias.
**Bloqueia:** Fase 6 (regras de timing).

### Steps

#### Step 3a.1 — Definir métricas derivadas dos frames
- **Tarefa:** fechar quais campos vão pra `player_timing_profile`.
- **Proposta inicial (só frames):**
  - `gold_diff_at_10`: ouro do player menos ouro da média do lane oposta aos 10 min
  - `cs_diff_at_15`: CS diff aos 15 min
  - `scaling_inflection_minute`: minuto em que gold cumulativo do player começa a crescer mais rápido que a média (derivada positiva)
  - `peak_lead_minute`: minuto com maior gold diff positivo
  - `avg_gold_per_min`: média geral
  - `avg_cspm_first_15`: CS/m nos primeiros 15 min
- **Output:** lista fechada em comentário.

#### Step 3a.2 — Migration `004_create_player_timing_profile.sql`
- **Tarefa:** DDL.
- **Schema:**
  ```sql
  CREATE TABLE player_timing_profile (
    puuid                      TEXT NOT NULL,
    role                       TEXT NOT NULL,
    patch                      TEXT NOT NULL,
    gold_diff_at_10            DOUBLE PRECISION,
    cs_diff_at_15              DOUBLE PRECISION,
    scaling_inflection_minute  DOUBLE PRECISION,
    peak_lead_minute           DOUBLE PRECISION,
    avg_gold_per_min           DOUBLE PRECISION,
    avg_cspm_first_15          DOUBLE PRECISION,
    sample_size                INTEGER NOT NULL,
    updated_at                 TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (puuid, role, patch)
  );
  ```
- **RLS:** leitura pública.

#### Step 3a.3 — Endpoint `/api/v1/match/{id}/timeline` já existe. Confirmar schema
- **Tarefa:** testar e documentar o schema exato.
- **Input:** match_id conhecido.
- **Output:** snippet markdown com estrutura.
- **Ferramenta:** curl.

#### Step 3a.4 — Escrever `scripts/processing/build_timing_profiles.py`
- **Tarefa:** script que agrega timing per (puuid, role, patch).
- **Input:** `matches` + `/timeline` endpoint ou acesso direto à tabela de frames se já existe.
- **Output:** script em `scripts/processing/`.
- **Bibliotecas:**
  - `polars` (agregação rápida)
  - `supabase-py`
  - `httpx` (se consumir via endpoint próprio) **ou** query direta se frames tão em tabela
- **Estrutura:**
  ```python
  # 1. Lista matches do últimos N dias (configurável)
  # 2. Pra cada match, busca frames (bulk se possível)
  # 3. Pra cada (puuid, match) calcula métricas
  # 4. Agrega por (puuid, role, patch)
  # 5. Upsert em player_timing_profile
  ```
- **Validação:** rodar pro Zaras#0210 e ver `gold_diff_at_10` próximo do sentimento (se ele é jungler agressivo, espera positivo).

#### Step 3a.5 — Lidar com frames incompletos
- **Tarefa:** partidas que acabaram antes dos 15 min não têm `cs_diff_at_15` — tratar como `NULL`.
- **Output:** lógica de skip + warning log.

#### Step 3a.6 — Expandir perfil pra 10D em `recommendation_service`
- **Tarefa:** adicionar 2 dimensões novas que puxam de `player_timing_profile`.
- **Dimensões:**
  - 9. `Scaling` — baseado em `scaling_inflection_minute` e `avg_gold_per_min` tarde
  - 10. `Early Pressure` — baseado em `gold_diff_at_10` e `cs_diff_at_15`
- **Bibliotecas:** stdlib.
- **Validação:** player hyper-carry (scaling alto, early pressure baixa) tem vetor esperado.

#### Step 3a.7 — Role_refs também ganha 2 stats novas
- **Tarefa:** atualizar `ROLE_STAT_FIELDS` na Fase 0 pra incluir `gold_diff_at_10` e `cs_diff_at_15`, rodar `refresh_role_stat_refs.py`.
- **Dependência:** o script de refresh precisa saber pegar dessas colunas (estão em `player_timing_profile`, não em `match_participants`). **Complicação:** a Fase 0 foi feita pra `match_participants` direto. Talvez precise um segundo script ou query que faça JOIN.
- **Decisão:** ou (a) escrever `refresh_role_stat_refs_v2.py` que cobre timing, ou (b) incluir essas stats como colunas computadas em `match_participants` via trigger/view. Escolher **(a)** porque é menos invasivo.

#### Step 3a.8 — GitHub Action pra rodar `build_timing_profiles.py`
- **Tarefa:** workflow semanal (ou diário pra players ativos).
- **Input:** mesmos secrets da Fase 0.
- **Output:** YAML.

### Critério de "done" da Fase 3a
- [ ] Tabela `player_timing_profile` populada pros top N players ativos
- [ ] Recomendação agora é **10D**, não 8D
- [ ] Smoke test mostra players com scaling alto recebendo recomendações de late-game
- [ ] Patch notes atualizado

---

## Fase 3b — Timing via Events (depende Bloco 0)

> **Objetivo:** usar eventos do Riot Timeline (CHAMPION_KILL, etc) pra calcular `avg_death_minute`, `first_blood_rate`, `early_kill_participation`.

**Pré-requisitos:** Fase 3a + **Bloco 0 do roadmap M2 original** (parsing de eventos em `process_timelines.py`).
**Custo estimado:** 4–5 dias (inclui o Bloco 0).
**Bloqueia:** nada crítico — é upgrade do Fase 3a.

### Steps

#### Step 3b.1 — Bloco 0: parser de eventos
- **Tarefa:** estender `scripts/processing/process_timelines.py` pra parsear `CHAMPION_KILL`, `ITEM_PURCHASED`, `SKILL_LEVEL_UP`.
- **Input:** JSONs brutos da Riot timeline (em `matches_dirty` ou R2?).
- **Output:** rows em `critical_events` table (já existe com schema pra kill/dragon/tower).
- **Bibliotecas:** stdlib + `polars` pra bulk insert.
- **Validação:** 37k eventos existentes + novos batem em volume esperado.

#### Step 3b.2 — Adicionar métricas em `player_timing_profile`
- **Tarefa:** extender schema + script.
- **Novas métricas:** `avg_death_minute`, `first_blood_rate`, `early_kill_participation` (kills+assists nos primeiros 10 min).

#### Step 3b.3 — Eventual 11ª e 12ª dimensão no perfil
- **Tarefa:** avaliar se vale expandir pra 12D. **Regra:** só adicionar dimensão se ela dá sinal **não-redundante** com as 10 existentes.
- **Validação:** correlação entre dims — se `avg_death_minute` tem r > 0.8 com `Sobrevivência`, não vale criar dimensão separada.

### Critério de "done" da Fase 3b
- [ ] `critical_events` tem `CHAMPION_KILL`, `ITEM_PURCHASED`, `SKILL_LEVEL_UP`
- [ ] `player_timing_profile` ganhou as 3 métricas novas
- [ ] (Condicional) 1–2 dimensões novas no perfil se passaram o teste de não-redundância
- [ ] Patch notes

---

## Fase 4 — Classes de Campeões + Enemy Comp

> **Objetivo:** ter taxonomia de classes por campeão e calcular composição do time inimigo em cada match — pré-requisito pra build contextual.

**Pré-requisitos:** nenhum técnico. **Decisão pendente contigo:** curadoria manual vs first-pass automatizado via LLM.
**Custo estimado:** 3 dias (se for first-pass LLM + revisão humana).

### Steps

#### Step 4.1 — Definir taxonomia de 10 classes
- **Tarefa:** fechar a lista.
- **Output:** constante em Python + no schema comment.
- **Proposta:** ver [Anexo A](#anexo-a--taxonomia-de-classes-fase-4).

#### Step 4.2 — Migration `005_create_champions_table.sql`
- **Schema:**
  ```sql
  CREATE TABLE champions (
    champion_name   TEXT PRIMARY KEY,
    title           TEXT,
    ddragon_tags    JSONB DEFAULT '[]'::jsonb,  -- tags brutos do DDragon
    classes         JSONB DEFAULT '[]'::jsonb,  -- array de classes nossa taxonomia
    primary_class   TEXT,                        -- pra agrupamento rápido
    updated_at      TIMESTAMPTZ DEFAULT now()
  );
  CREATE INDEX champions_primary_class_idx ON champions (primary_class);
  ```
- **RLS:** leitura pública.

#### Step 4.3 — Script `scripts/processing/sync_champions.py`
- **Tarefa:** popula `name`, `title`, `ddragon_tags` via DDragon `/cdn/{v}/data/pt_BR/championFull.json`.
- **Bibliotecas:** `httpx`, `supabase-py`.
- **Output:** tabela com ~170 rows, `classes` e `primary_class` ainda NULL.
- **Validação:** `SELECT count(*) FROM champions` → ~170.

#### Step 4.4 — First-pass automático via LLM (Claude/Gemini)
- **Tarefa:** prompt que recebe `{name, title, ddragon_tags, short description}` e retorna `classes` + `primary_class`.
- **Input:** 170 champions.
- **Output:** script `scripts/processing/classify_champions_llm.py`.
- **Bibliotecas:**
  - `google-genai` (já instalado — reusar infra do chat)
  - `supabase-py`
- **Prompt estruturado:**
  ```
  Dado o campeão {name} ({title}), com tags DDragon {tags} e papel no jogo {descrição curta},
  classifique-o nas nossas 10 categorias: [lista]. Retorne JSON:
  {"primary_class": "...", "classes": ["...", "..."]}
  ```
- **Validação:** sample de 30 champs — confronto com conhecimento de domínio.

#### Step 4.5 — Curadoria humana
- **Tarefa:** César revisa só os duvidosos (estimativa: ~30 dos 170).
- **Ferramenta:** SQL manual no Supabase (UPDATE champions SET classes=...).
- **Output:** coluna `classes` 100% preenchida.

#### Step 4.6 — Migration `006_add_comp_archetypes_to_matches.sql`
- **Tarefa:** adicionar 2 colunas em `matches`.
- **Schema:**
  ```sql
  ALTER TABLE matches ADD COLUMN blue_comp_archetypes JSONB;
  ALTER TABLE matches ADD COLUMN red_comp_archetypes  JSONB;
  ```
- **Formato:** `{"tank": 2, "bruiser": 1, "burst_mage": 1, "marksman": 1}`

#### Step 4.7 — Função `compute_comp_archetypes(team_champions)`
- **Tarefa:** dado array de champion_names de um time, consulta `champions.primary_class` e conta.
- **Output:** Python function + teste unitário.
- **Bibliotecas:** stdlib.
- **Validação:** time `[Ornn, Vi, Orianna, Jinx, Thresh]` → `{"tank":1,"bruiser":1,"control_mage":1,"marksman":1,"catcher":1}`.

#### Step 4.8 — Backfill matches existentes
- **Tarefa:** script `scripts/processing/backfill_comp_archetypes.py` varre todas as `matches`, computa e atualiza.
- **Bibliotecas:** `polars`, `supabase-py`.
- **Validação:** contagem de `matches WHERE blue_comp_archetypes IS NOT NULL` bate com total de matches.

#### Step 4.9 — ETL novas matches preenche automaticamente
- **Tarefa:** adicionar chamada de `compute_comp_archetypes` em `riot_service._processar_e_salvar()`.
- **Output:** daqui pra frente toda match novinha já nasce com o campo populado.

### Critério de "done" da Fase 4
- [ ] Tabela `champions` com todos os champs e `primary_class` preenchido
- [ ] `matches` têm os 2 campos de archetype preenchidos (backfill + ETL novo)
- [ ] Query `SELECT primary_class, count(*) FROM champions GROUP BY 1` mostra distribuição razoável
- [ ] Patch notes atualizado

---

## Fase 5 — Build Contextual

> **Objetivo:** analisar item × composição inimiga → recomendar build adaptada. "Void Staff vs tank_heavy = 58% WR; vs squishy = 44% WR".

**Pré-requisitos:** Fase 4 completa. (Nota: Fase 5 **não** depende da Fase 1/2/3 — pode ser feita em paralelo se quiser.)
**Custo estimado:** 4 dias.

### Steps

#### Step 5.1 — Definir 5–7 arquétipos canônicos
- **Tarefa:** lista fechada + regras determinísticas de classificação.
- **Output:** ver [Anexo B](#anexo-b--arquétipos-de-composição-fase-5).

#### Step 5.2 — Função `classify_comp_archetype(comp_dict) → str`
- **Tarefa:** dado `{"tank":2, "bruiser":1, ...}` retorna `"tank_heavy"` (ou outro).
- **Bibliotecas:** stdlib.
- **Validação:** testes unitários pros 7 arquétipos + 1 "balanced".

#### Step 5.3 — Migration `007_create_item_context_stats.sql`
- **Schema:**
  ```sql
  CREATE TABLE item_context_stats (
    item_id           INT NOT NULL,
    champion_name     TEXT NOT NULL,
    role              TEXT NOT NULL,
    enemy_archetype   TEXT NOT NULL,
    patch             TEXT NOT NULL,
    picks             INT NOT NULL DEFAULT 0,
    wins              INT NOT NULL DEFAULT 0,
    winrate           DOUBLE PRECISION GENERATED ALWAYS AS (
      CASE WHEN picks > 0 THEN wins::float / picks * 100 ELSE 0 END
    ) STORED,
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (item_id, champion_name, role, enemy_archetype, patch)
  );
  ```

#### Step 5.4 — Script `scripts/processing/build_item_context.py`
- **Tarefa:** cross-tab massivo.
- **Input:** `match_participants` + `matches.red_comp_archetypes` + `matches.blue_comp_archetypes` + `classify_comp_archetype`.
- **Output:** tabela `item_context_stats` populada.
- **Bibliotecas:** `polars` (indispensável — cross-tab em SQL seria lento), `supabase-py`.
- **Estrutura:**
  ```python
  # 1. Fetch match_participants + matches
  # 2. Pra cada participante, identifica archetype do time INIMIGO
  # 3. Pra cada item que ele buildou, vira um row (item, champ, role, archetype, win)
  # 4. Agrega por (item, champ, role, archetype, patch)
  # 5. Upsert em item_context_stats
  ```

#### Step 5.5 — Endpoint `/api/v1/builds/recommend`
- **Tarefa:** `GET /api/v1/builds/recommend?champion=&role=&vs_archetype=`.
- **Input:** filtros.
- **Output:** top 6 items por winrate (min picks configurável) + keystone principal.
- **Bibliotecas:** já no stack.

#### Step 5.6 — Endpoint `/api/v1/builds/matchup`
- **Tarefa:** `GET /api/v1/builds/matchup?champion=&role=` retorna **breakdown por archetype**.
- **Output:** JSON tipo:
  ```json
  {
    "champion": "Orianna", "role": "MIDDLE",
    "by_archetype": {
      "tank_heavy": {"recommended_items": [3135, 6653, ...], "winrate": 55.2, "picks": 240},
      "squishy": {"recommended_items": [6655, 3157, ...], "winrate": 52.1, "picks": 180}
    }
  }
  ```

#### Step 5.7 — UI na tab Builds do champion page
- **Tarefa:** seletor "vs comp inimiga" com 7 opções + "overall".
- **Input:** endpoint novo.
- **Output:** tab Builds redesenhada com filtro.
- **Bibliotecas:** já no design system.

#### Step 5.8 — Integrar na recomendação de campeão
- **Tarefa:** na página do player, pra cada champ recomendado, mostrar **2 builds alternativas** (vs tank vs squishy) já que o player não sabe o matchup antes.
- **Output:** UI expande quando clica no champ.
- **Validação:** smoke test.

### Critério de "done" da Fase 5
- [ ] `item_context_stats` populada com cross-tab completa
- [ ] Endpoint responde e tem dados plausíveis (Void Staff vs tank_heavy > vs squishy)
- [ ] UI mostra as builds condicionais
- [ ] Patch notes

---

## Fase 6 — Pensamento Crítico (regras)

> **Objetivo:** substituir reasons descritivos por **insights diagnósticos prescritivos e específicos**, via catálogo de regras determinísticas.

**Pré-requisitos:** Fases 1, 2, 3a (perfil 10D com delta).
**Custo estimado:** 3 dias.

### Steps

#### Step 6.1 — Arquitetura do catálogo
- **Tarefa:** definir data class `Rule`.
- **Output:** arquivo `backend/services/insights/rules.py`.
- **Estrutura:**
  ```python
  @dataclass
  class Rule:
      id: str                                   # 'cs_below_role_avg'
      category: str                             # 'farming' | 'aggression' | 'vision' | ...
      priority: int                             # 1-10, insights ordenados por priority × relevance
      condition: Callable[[PlayerContext], bool]
      template: str                             # "Seu CS/m é {cspm} vs {role_avg} na {role} — déficit de {delta}%"
      fill: Callable[[PlayerContext], dict]     # preenche variáveis do template
  ```
- **Bibliotecas:** stdlib (dataclasses), jinja2 se quiser templating avançado (mais fácil f-string).

#### Step 6.2 — PlayerContext dataclass
- **Tarefa:** classe que agrupa todo o perfil do player num objeto único.
- **Fields:** `profile_all, profile_wins, profile_losses, delta, timing_profile, role_refs, recent_matches, champion_stats`.
- **Bibliotecas:** stdlib.

#### Step 6.3 — Escrever 10 regras iniciais
- **Ver [Anexo C](#anexo-c--catálogo-inicial-de-regras-fase-6).**
- **Validação:** cada regra tem teste unitário com `PlayerContext` mock.

#### Step 6.4 — Função `generate_insights(ctx: PlayerContext) → list[dict]`
- **Tarefa:** rodar catálogo contra o contexto, filtrar por `condition=True`, ranquear por `priority × relevance` (relevance = magnitude do desvio).
- **Output:** top 5 insights como `[{id, category, text, priority}]`.
- **Bibliotecas:** stdlib.

#### Step 6.5 — Endpoint `/api/v1/player/insights`
- **Tarefa:** `GET /api/v1/player/insights?puuid=&role=`.
- **Bibliotecas:** já no stack.

#### Step 6.6 — UI no player dashboard
- **Tarefa:** substituir o "Ask Metis teaser" atual por card de insights reais + CTA do chat.
- **Validação:** smoke test pro Zaras.

#### Step 6.7 — Expandir catálogo (iterativo)
- **Tarefa:** adicionar regras novas conforme descobrimos padrões.
- **Cadência:** semanal nas próximas versões (p-0.9.1, p-0.9.2).

### Critério de "done" da Fase 6
- [ ] 10 regras funcionando com testes
- [ ] Endpoint responde insights ranqueados
- [ ] UI consome e mostra no dashboard
- [ ] Pra 3 players diferentes, insights são específicos e acionáveis (não genéricos)

---

## Fase 7 — IA Narrativa (Metis)

> **Objetivo:** a Metis (Gemini) consome perfil 10D + delta + timing + insights + builds contextuais e gera **análise narrativa** em PT-BR com argumentação.

**Pré-requisitos:** Fases 1 a 6.
**Custo estimado:** 2 dias.

### Steps

#### Step 7.1 — Função `build_player_context_dict(puuid)`
- **Tarefa:** coleta todo o contexto do player e transforma em dict estruturado pra injetar no prompt.
- **Bibliotecas:** stdlib.
- **Output:** dict com `{profile, delta, timing, top_champions, insights_generated, recent_w_l}`.

#### Step 7.2 — Template de prompt
- **Tarefa:** prompt-template em PT-BR que instrui o Gemini a agir como a Metis.
- **Restrições:** herda guardrail LoL-only (já tem na p-0.9.0), personalidade calma e não-tóxica.
- **Formato de saída:** 3–4 parágrafos de prosa (não bullet points).
- **Bibliotecas:** `string.Template` ou f-string.

#### Step 7.3 — Endpoint `/api/v1/player/ai-summary`
- **Tarefa:** `GET /api/v1/player/ai-summary?puuid=`.
- **Bibliotecas:** `google-genai` (já instalado).
- **Gate premium:** já tem infra (chat é premium).
- **Rate limit:** 1 sumário por player por hora (cache simples em tabela ou Redis futuro).

#### Step 7.4 — Cache em tabela nova `player_ai_summaries`
- **Migration `008_create_player_ai_summaries.sql`:**
  ```sql
  CREATE TABLE player_ai_summaries (
    puuid        TEXT PRIMARY KEY,
    summary      TEXT NOT NULL,
    tokens_used  INT,
    generated_at TIMESTAMPTZ DEFAULT now()
  );
  ```

#### Step 7.5 — Consumir contador de tokens do plano
- **Tarefa:** reusar infra de `/api/v1/chat/usage` — cada sumário conta como N tokens.
- **Bibliotecas:** já no stack.

#### Step 7.6 — UI no dashboard
- **Tarefa:** botão "Análise completa da Metis" gera sumário sob demanda (premium).
- **Output:** card expandido com o texto.
- **Validação:** smoke test.

### Critério de "done" da Fase 7
- [ ] Endpoint gera sumário consistente (referencia stats reais, não generaliza)
- [ ] Cache reduz re-geração dentro da janela de 1h
- [ ] UI gated corretamente
- [ ] Qualidade do output validada em 5 players diferentes
- [ ] **Lançamento v0.9.0** — patch notes com changelog consolidado de todas as fases

---

## Anexo A — Taxonomia de classes (Fase 4)

10 classes fechadas. Um campeão pode ter múltiplas em `classes`, mas apenas uma `primary_class`.

| Classe | Descrição | Exemplos |
|---|---|---|
| `tank` | Frontline com foco em absorver dano, CC pesado | Ornn, Malphite, Maokai |
| `bruiser` | Durável + dano corpo-a-corpo, meio-termo | Darius, Camille, Sett |
| `juggernaut` | Tank ofensivo de AD, lento, alto dano sustentado | Mordekaiser, Aatrox, Illaoi |
| `skirmisher` | Duelista ágil, dano sustentado, pouca CC | Yone, Fiora, Irelia |
| `assassin` | Burst damage, alta mobilidade, frágil | Zed, Talon, Kayn Shadow |
| `burst_mage` | Dano mágico em rajada, combos curtos | Syndra, LeBlanc, Veigar |
| `control_mage` | Dano mágico sustentado + zone control | Viktor, Orianna, Anivia |
| `marksman` | ADC, dano físico à distância, scaling | Jinx, Caitlyn, Aphelios |
| `enchanter` | Suporte de buffs/heals, defensivo | Soraka, Lulu, Nami |
| `catcher` | Suporte de pick/zone, CC forte | Thresh, Morgana, Bard |

Regras de atribuição:
- `primary_class` é a mais representativa do papel em **ranked solo queue atual**
- `classes` pode ter 2–3 se o champ é versátil (ex: Kayn = `[assassin, skirmisher]`, primary `assassin`)
- Caso raro onde não cabe em nenhuma → deixamos em aberto e decidimos caso a caso (Ivern? Yuumi?)

---

## Anexo B — Arquétipos de composição (Fase 5)

7 arquétipos canônicos + 1 fallback. Regras de classificação determinísticas.

```python
def classify_comp_archetype(comp: dict[str, int]) -> str:
    tanks = comp.get('tank', 0) + comp.get('juggernaut', 0)
    bruisers = comp.get('bruiser', 0)
    assassins = comp.get('assassin', 0)
    skirmishers = comp.get('skirmisher', 0)
    mages = comp.get('burst_mage', 0) + comp.get('control_mage', 0)
    marksmen = comp.get('marksman', 0)
    supports = comp.get('enchanter', 0) + comp.get('catcher', 0)

    if tanks >= 2:
        return "tank_heavy"
    if assassins + skirmishers >= 3:
        return "dive_heavy"
    if comp.get('catcher', 0) + assassins >= 2 and tanks == 0:
        return "pick_comp"
    if comp.get('control_mage', 0) + marksmen >= 2 and comp.get('enchanter', 0) >= 1:
        return "poke_scaling"
    if bruisers + skirmishers >= 3:
        return "bruiser_stack"
    if mages + marksmen >= 3 and tanks == 0:
        return "squishy_burst"
    if comp.get('enchanter', 0) >= 1 and marksmen >= 1 and (tanks + bruisers) >= 1:
        return "teamfight"
    return "balanced"
```

Essas regras são uma **primeira versão**. Na fase 5, vamos testar com dados reais e ajustar limiares. Pode virar um classificador probabilístico se regras não capturarem bem.

---

## Anexo C — Catálogo inicial de regras (Fase 6)

10 regras pra começar. Cada uma tem `id`, `category`, `condition` (lambda sobre `PlayerContext`), `template`.

| ID | Categoria | Condição | Template |
|---|---|---|---|
| `cs_below_role_avg` | farming | `ctx.profile_all[2] < 4.0` (Eficiência) | "Seu CS/m está abaixo da média da role ({role_avg:.1f}) — cada 1 CS/m a mais é um item por 20 min" |
| `early_death_prone` | safety | `ctx.timing.avg_death_minute < 8` | "Você morre cedo em muitas partidas (média {avg:.1f} min) — prioriza champs com kit safe early (Malphite, Tahm Kench)" |
| `delta_aggression_high` | strength | `abs(ctx.delta[0]) > 3` | "Quando vence, sua agressão sobe +{delta:.1f} — champs como Kayn/Talon amplificam esse padrão" |
| `low_vision_dia_plus` | mapa | `ctx.profile_all[1] < 3 and ctx.recent_rank >= 'DIAMOND'` | "Visão baixa ({score:.1f}/10) em Diamond+ é gargalo — control wards podem subir 5-10% de WR" |
| `win_scaling_game` | timing | `ctx.recent_matches_longer_than_30min.win_rate > 0.6` | "Você vence {pct}% de partidas longas (>30 min) — prolongar jogos parece bom pro seu estilo" |
| `tilt_after_loss` | mental | `ctx.matches_after_loss.win_rate < 0.35` | "Após uma derrota, seu WR cai pra {pct}% — considera pausa ou champ de conforto na próxima" |
| `role_unpopular_performance` | role | `ctx.least_played_role.win_rate > ctx.most_played_role.win_rate` | "Você joga {main} 80% das vezes, mas vence mais em {alt} ({alt_wr}% vs {main_wr}%) — vale tentar" |
| `duo_synergy` | social | `ctx.best_duo.games >= 10 and ctx.best_duo.wr >= 0.65` | "Seu melhor duo é {ally} ({wr}% em {games} jogos) — queue em sombra" |
| `champ_mastery_gap` | pool | `ctx.champion_count < 4 and ctx.top_champ.mastery_games < 30` | "Sua pool é pequena ({n} champs) — amplia aos poucos pra não virar alvo de ban" |
| `early_gold_deficit` | laning | `ctx.timing.gold_diff_at_10 < -300` | "Você está 300+ de ouro atrás aos 10 min em média — focar em CS e evitar poke trade faz diferença" |

Cada regra deve fazer:
- Sanity check (condition não dispara em dados vazios)
- Ter template com variáveis que o `fill` preenche
- Priority entre 1–10 (insights mais acionáveis = priority mais alta)

---

## Resumo — o que o usuário faz

Este doc é revisado a cada fase. Fluxo:

1. **Tu lê este macro plano** (uma vez)
2. **Antes de cada fase**, eu abro um sub-plano com código real + aval explícito
3. **Dentro da fase**, cada step é validado antes do próximo (nada roda às cegas)
4. **Fim da fase:** patch notes + smoke test + PR merged
5. **Só então** começo a próxima

Qualquer mudança nesse plano (escopo, ordem, dependências) documenta aqui via edit deste arquivo.
