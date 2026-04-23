# Fase 3b — Timing via Events

> **Objetivo:** parsear eventos ricos do Riot Timeline (CHAMPION_KILL, ITEM_PURCHASED, SKILL_LEVEL_UP) e usar isso pra calcular métricas novas: `avg_death_minute`, `first_blood_rate`, `early_kill_participation`. **Esta fase absorve o "Bloco 0" do roadmap antigo do M2.**
>
> **Pré-requisitos:** Fase 3a concluída.
> **Custo estimado:** 4–5 dias (inclui Bloco 0).
> **Bloqueia:** nada crítico — é upgrade de qualidade.
> **Status:** Não iniciado.

---

## Decisões de design

| Pergunta | Decisão | Justificativa |
|---|---|---|
| Onde armazenar eventos | Tabela `critical_events` que já existe no schema | Reaproveita infra; schema já cobre kill/dragon/tower |
| Quais tipos de evento | `CHAMPION_KILL`, `ITEM_PURCHASED`, `SKILL_LEVEL_UP` (novos) + os que já tem | ITEM_PURCHASED destrava Bloco 2/3 do roadmap analytics; SKILL_LEVEL_UP destrava skill order |
| Novas métricas no `player_timing_profile` | 3: `avg_death_minute`, `first_blood_rate`, `early_kill_participation` | Sinais fortes de perfil comportamental |
| Expansão pra 11D/12D? | **Avaliar primeiro, não expandir cegamente** | Se `avg_death_minute` tem correlação >0.8 com `Sobrevivência`, é redundante |
| Backfill | Sim, incremental, priorizando matches recentes | Histórico traz valor imediato pra recomendação |

---

## Steps

### Step 3b.1 — Auditar `process_timelines.py` atual

**Objetivo:** entender o que já processa antes de estender.

**Comando:**
```bash
grep -n "def\|event_type\|frame\|CHAMPION_KILL\|ITEM_PURCHASED" \
  c:/Users/cesar/Documents/GitHub/Metis/scripts/processing/process_timelines.py
```

**Ponto a validar:**
- Já parsea eventos? Ou só frames?
- `critical_events` tem linhas hoje? Quantas e de que tipos?
```sql
SELECT event_type, count(*) FROM critical_events GROUP BY event_type;
```
- Se zero CHAMPION_KILL, o Bloco 0 é realmente "novo". Se tem, só precisa estender os tipos.

---

### Step 3b.2 — Ajustar schema `critical_events` se necessário

**Situação A** — a tabela já tem colunas genéricas (`event_type`, `timestamp_ms`, `position_x`, `position_y`, `killer_puuid`, `victim_puuid`, `item_id`, `skill_slot`, etc):
→ pular este step.

**Situação B** — tabela só tem campos pra kill/dragon/tower específicos:
→ migration `005_extend_critical_events.sql` adicionando `item_id INT`, `skill_slot TEXT`, `level INT` pra cobrir os novos tipos.

(Decidir após o Step 3b.1.)

---

### Step 3b.3 — Estender parser em `process_timelines.py`

**Adicionar** três tipos:

```python
# Pseudocódigo — o código real depende do shape dos frames da Riot

for frame in timeline["info"]["frames"]:
    for event in frame.get("events", []):
        t = event.get("type")

        if t == "CHAMPION_KILL":
            yield {
                "event_type": "CHAMPION_KILL",
                "match_id": match_id,
                "timestamp_ms": event["timestamp"],
                "timestamp_min": event["timestamp"] // 60000,
                "position_x": event.get("position", {}).get("x"),
                "position_y": event.get("position", {}).get("y"),
                "killer_participant_id": event.get("killerId"),
                "victim_participant_id": event.get("victimId"),
                "assist_participant_ids": event.get("assistingParticipantIds", []),
            }

        elif t == "ITEM_PURCHASED":
            yield {
                "event_type": "ITEM_PURCHASED",
                "match_id": match_id,
                "timestamp_ms": event["timestamp"],
                "timestamp_min": event["timestamp"] // 60000,
                "participant_id": event.get("participantId"),
                "item_id": event.get("itemId"),
            }

        elif t == "SKILL_LEVEL_UP":
            yield {
                "event_type": "SKILL_LEVEL_UP",
                "match_id": match_id,
                "timestamp_ms": event["timestamp"],
                "timestamp_min": event["timestamp"] // 60000,
                "participant_id": event.get("participantId"),
                "skill_slot": event.get("skillSlot"),  # 1=Q, 2=W, 3=E, 4=R
            }
```

**Conversão participant_id → puuid** precisa ser feita via lookup na match (`participants` tem `participantId` e `puuid`).

**Bulk insert** na `critical_events` em batches de 500 rows.

---

### Step 3b.4 — Backfill das matches existentes

**Script:** `scripts/processing/backfill_critical_events.py` — varre matches, chama o parser estendido, popula em batch.

**Estratégia:**
1. Query `SELECT match_id FROM matches WHERE has_timeline=true ORDER BY game_end_timestamp DESC` (mais recentes primeiro — trazem valor imediato)
2. Pra cada match, puxa timeline do R2 ou reprocessa via `process_timelines.py`
3. Insere events em batch
4. Marca algum campo `matches.events_parsed_at`

**Custo de tempo:** ~37k eventos existentes + backfill estimado de 100k-500k novos. Pode demorar 1-2h local; GitHub Action cobre melhor.

---

### Step 3b.5 — Adicionar 3 métricas em `player_timing_profile`

**Migration `006_add_event_metrics.sql`:**

```sql
ALTER TABLE player_timing_profile
  ADD COLUMN IF NOT EXISTS avg_death_minute            DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS first_blood_rate            DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS early_kill_participation    DOUBLE PRECISION;
```

---

### Step 3b.6 — Atualizar `build_timing_profiles.py`

**Acrescentar** ao loop de agregação:

```python
# Buscar eventos desse puuid nessas matches
events = (
    db.table("critical_events")
    .select("event_type, match_id, timestamp_min, killer_participant_id, victim_participant_id")
    .in_("match_id", [m["match_id"] for m in matches])
    .in_("event_type", ["CHAMPION_KILL"])
    .execute()
    .data or []
)

# avg_death_minute: média dos timestamps quando o puuid é vítima
death_minutes = [
    e["timestamp_min"] for e in events
    if puuid_of_participant(e["victim_participant_id"], m["match_id"]) == puuid
]
avg_death_minute = sum(death_minutes) / len(death_minutes) if death_minutes else None

# first_blood_rate: das matches do puuid, em quantas ele participou do first blood (killer ou assist)
# Pra cada match, pegar o primeiro CHAMPION_KILL
# Se o puuid está como killer ou assist → +1
# first_blood_rate = FB_count / total_matches

# early_kill_participation: kills+assists nos primeiros 10 min / total de kills do time nos primeiros 10 min
```

**Complexidade:** `puuid_of_participant` precisa mapear `participant_id` → `puuid` usando `match_participants` table. Fazer lookup em batch (cache local dict).

---

### Step 3b.7 — Análise de correlação antes de expandir dimensões

**Objetivo:** decidir se vale criar dim 11 e 12 ou só enriquecer as 8 existentes.

**Script ad-hoc:** `scripts/analysis/correlation_timing_vs_8d.py`:

```python
# Pra top 200 players ativos:
# 1. Computa perfil 10D (via recommendation_service._build_profile)
# 2. Pega avg_death_minute e first_blood_rate
# 3. Correlaciona (Pearson) esses com as 10 dimensões existentes

# Output: matriz 2×10 de correlação
```

**Regra de decisão:**
- Se `avg_death_minute` tem |r| > 0.8 com `Sobrevivência` → não vira dim, mas **entra como peso** dentro dela
- Se |r| < 0.6 → vira dim nova
- Entre 0.6 e 0.8 → decidir caso a caso (pode manter como peso extra)

**Saída do step:** documentar a decisão aqui neste sub-plano. Ajustar `_build_profile` conforme.

---

### Step 3b.8 — Regras de insights dependentes de events

Ficam na Fase 6, mas deixar **já mapeadas aqui**:
- `early_death_prone` — `avg_death_minute < 8`
- `first_blood_inactive` — `first_blood_rate < 0.1`
- `early_kp_high_champ_suggestion` — `early_kill_participation > 0.6`

---

## Critério de "done" da Fase 3b

- [ ] Parser de CHAMPION_KILL, ITEM_PURCHASED, SKILL_LEVEL_UP funcionando
- [ ] `critical_events` tem rows desses 3 tipos (sanity: `SELECT count(*) FROM critical_events GROUP BY event_type`)
- [ ] Backfill rodou pras matches recentes (últimas 4 semanas)
- [ ] `player_timing_profile` tem as 3 novas colunas preenchidas
- [ ] Correlação timing-vs-8D analisada — decisão de dim nova documentada aqui
- [ ] Patch notes atualizado

---

## Rollback

- Dropar as 3 colunas novas de `player_timing_profile` (seguro — `recommendation_service` só consome se a coluna existir)
- Events parseados ficam — não atrapalham

---

## Patch notes sugerido

```markdown
## p-0.10.0-alpha.4 — Fase 3b: Timing via Events (YYYY-MM-DD)

Parser de timeline ganhou eventos ricos. Bloco 0 do roadmap analytics entregue.

### Scripts
- `process_timelines.py` estendido pra CHAMPION_KILL, ITEM_PURCHASED, SKILL_LEVEL_UP
- Backfill de ~N eventos em matches recentes

### Database
- 3 novas colunas em `player_timing_profile`: `avg_death_minute`, `first_blood_rate`, `early_kill_participation`

### Decisão
- Correlação timing×8D analisada: [decisão sobre expandir pra 11D/12D]
```
