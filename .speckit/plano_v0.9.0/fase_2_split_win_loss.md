# Fase 2 — Split Win-vs-Loss

> **Objetivo:** calcular dois perfis 8D por jogador (quando vence / quando perde) e expor o **delta** como sinal prescritivo. Recomendação passa a priorizar champs cujo perfil casa com o **comportamento vencedor** do player.
>
> **Pré-requisitos:** Fase 1 concluída.
> **Custo estimado:** 2 dias.
> **Bloqueia:** Fase 6 (algumas regras dependem do delta).
> **Status:** Não iniciado.

---

## Decisões de design

| Pergunta | Decisão | Justificativa |
|---|---|---|
| Sample mínimo por side | 5 wins E 5 losses | Abaixo disso o delta é ruído. Se só tem 4 vitórias, cai no caminho "all" |
| O que vira o "profile" principal usado pra ranquear | `wins_only` quando `delta_confidence='high'`, senão `all` | Queremos recomendar champs que batem com o padrão vencedor do player |
| Exposição do delta | Novo campo `delta: [8]` no response + campo `delta_confidence: 'high'\|'low'\|'none'` | Frontend pode usar pra mostrar radar duplo (já tem `DualRadar`) |
| Threshold de "delta alto" pra gerar reason | `abs(delta[i]) > 2.5` | Empírico — 2.5 em escala 0-10 = diferença notável mas não extrema |

---

## Steps

### Step 2.1 — Refatorar `_build_8d_profile` pra ser filtrável

**Decisão:** sem mudar a assinatura. A função já recebe `rows`; basta filtrar antes.

**Código helper novo:**
```python
def _split_rows_by_outcome(rows: list[dict]) -> tuple[list[dict], list[dict]]:
    """Retorna (wins, losses)."""
    wins = [r for r in rows if r.get("win") is True]
    losses = [r for r in rows if r.get("win") is False]
    return wins, losses
```

---

### Step 2.2 — Construir 3 perfis no `buscar_recomendacoes`

**Mudança em `buscar_recomendacoes`:**

```python
MIN_WL_SAMPLE = 5

# Após obter player_rows e role_refs:

main_role = _most_frequent_role(player_rows)

# Três perfis
profile_all = _build_8d_profile(player_rows, main_role, role_refs)

wins_rows, losses_rows = _split_rows_by_outcome(player_rows)

if len(wins_rows) >= MIN_WL_SAMPLE and len(losses_rows) >= MIN_WL_SAMPLE:
    profile_wins = _build_8d_profile(wins_rows, main_role, role_refs)
    profile_losses = _build_8d_profile(losses_rows, main_role, role_refs)
    delta = [round(w - l, 2) for w, l in zip(profile_wins, profile_losses)]
    delta_confidence = "high"
    compare_base = profile_wins  # recomendações baseadas em "como você joga quando ganha"
else:
    profile_wins = None
    profile_losses = None
    delta = None
    delta_confidence = "none" if not (wins_rows and losses_rows) else "low"
    compare_base = profile_all
```

---

### Step 2.3 — Usar `compare_base` na similaridade

**Antes (Fase 1):**
```python
compare_profile = _build_8d_profile(role_rows, champ_role, role_refs) \
    if len(role_rows) >= 3 else player_profile
```

**Depois (Fase 2):**
```python
# Se tem role-specific profile com sample ok, usa ele (vence preferência geral)
# Caso contrário, usa compare_base (wins_only ou all)
if len(role_rows) >= MIN_WL_SAMPLE:
    wins_role, losses_role = _split_rows_by_outcome(role_rows)
    if len(wins_role) >= MIN_WL_SAMPLE and len(losses_role) >= MIN_WL_SAMPLE:
        compare_profile = _build_8d_profile(wins_role, champ_role, role_refs)
    else:
        compare_profile = _build_8d_profile(role_rows, champ_role, role_refs)
else:
    compare_profile = compare_base
```

**Ponto chave:** a comparação com o champ_profile **continua sendo contra a média do campeão** (não split W/L do champ). Só o **lado do player** é "wins-only" quando possível. Motivo: queremos champs que parecem você em dia bom — não só champs que ganham muito.

---

### Step 2.4 — Ampliar response JSON

**Campos novos:**
```json
{
  "champion": "Kayn",
  "role": "JUNGLE",
  "similarity": 82.3,
  "confidence": 78.1,
  "winrate": 56.2,
  "games_in_db": 412,
  "times_played": 32,
  "player_profile": [5.2, 4.8, 6.1, ...],
  "player_profile_wins": [7.1, 5.2, 6.8, ...],
  "player_profile_losses": [3.4, 4.1, 5.5, ...],
  "delta": [3.7, 1.1, 1.3, ...],
  "delta_confidence": "high",
  "champion_profile": [7.5, 4.2, 6.9, ...],
  "reasons": [
    "Quando vence, sua Agressividade sobe +3.7 — Kayn amplifica esse padrão",
    "Eficiência compatível"
  ]
}
```

**Nota:** `player_profile` continua sendo o perfil geral (útil pra UI que já consome). Adicionar os novos **sem quebrar** o contrato atual.

---

### Step 2.5 — Reasons baseados no delta

**Nova função `_explain_match_v2`:**

```python
def _explain_match_v2(
    compare_profile: list[float],
    champ_profile: list[float],
    delta: list[float] | None,
) -> list[str]:
    """Reasons descritivos e prescritivos."""
    reasons: list[str] = []

    # 1) Se há delta significativo, destaca isso primeiro (prescritivo)
    if delta:
        for i, d in enumerate(delta):
            if abs(d) < 2.5:
                continue
            if d > 0:
                reasons.append(
                    f"Quando vence, sua {DIMENSION_NAMES[i]} sobe +{d:.1f} — "
                    f"buscar champs que amplificam isso"
                )
            else:
                reasons.append(
                    f"Sua {DIMENSION_NAMES[i]} cai {d:.1f} em derrotas — "
                    f"cuidado com champs que dependem disso"
                )

    # 2) Matches fortes entre compare_profile e champ_profile (descritivo)
    for i, (p, c) in enumerate(zip(compare_profile, champ_profile)):
        if p < 1 or c < 1:
            continue
        diff = abs(p - c)
        if diff <= 1.0:
            reasons.append(f"{DIMENSION_NAMES[i]} compatível")
        elif c > p + 2:
            reasons.append(f"Pode melhorar seu {DIMENSION_NAMES[i]}")

    # Dedupe + limita
    seen = set()
    out = []
    for r in reasons:
        if r not in seen:
            seen.add(r)
            out.append(r)
    return out[:4]
```

---

### Step 2.6 — Atualizar o frontend do player dashboard

**Arquivo:** `frontend/src/app/players/[puuid]/page.tsx` — seção de recomendações expandida.

**Mudança:** hoje o `DualRadar` plota `player_profile` vs `champion_profile`. Quando tem delta com confidence high, oferecer **um segundo modo** que plota `player_profile_wins` vs `player_profile_losses`.

**Adicionar toggle** no expandir da recomendação:
```tsx
const [radarMode, setRadarMode] = useState<'champ' | 'wl'>('champ')

// Dentro do expandido:
{r.delta_confidence === 'high' && (
  <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
    <button onClick={() => setRadarMode('champ')}>
      Você × Campeão
    </button>
    <button onClick={() => setRadarMode('wl')}>
      Você (V) × Você (D)
    </button>
  </div>
)}

<DualRadar
  playerProfile={radarMode === 'wl' ? r.player_profile_wins : r.player_profile}
  championProfile={radarMode === 'wl' ? r.player_profile_losses : r.champion_profile}
/>
```

Labels da legenda precisam mudar dependendo do modo — cuidado pra não confundir "você vence" com "campeão" visualmente. Use cores distintas (ex: verde W / vermelho L).

---

### Step 2.7 — Testes

**`tests/test_recommendation.py`** adicionar:

```python
def test_delta_high_confidence():
    """Sample 5+ de cada lado → delta_confidence='high'."""
    mock_rows = [
        *[{"win": True, "kills": 10, ...} for _ in range(6)],
        *[{"win": False, "kills": 3, ...} for _ in range(6)],
    ]
    # chamar buscar_recomendacoes com mock db, assertar campos

def test_delta_low_sample():
    """4 wins + 6 losses → confidence='low', delta=None."""
    ...

def test_delta_none_when_only_wins():
    """Só vitórias → confidence='none'."""
    ...

def test_wl_equal_delta_zero():
    """Perfil W igual ao L → delta zero, mas confidence='high' se sample ok."""
    ...
```

---

## Critério de "done" da Fase 2

- [ ] `_split_rows_by_outcome` + helpers funcionando
- [ ] Response tem 4 campos novos: `player_profile_wins`, `player_profile_losses`, `delta`, `delta_confidence`
- [ ] `compare_base = profile_wins` quando `confidence='high'` muda o ranking
- [ ] Reasons novos aparecem quando delta é grande
- [ ] Testes unitários passam
- [ ] Frontend tem toggle de modo radar
- [ ] A/B test visual com 3 players: (a) alto delta, (b) sem delta, (c) poucos dados — todos rendereizam sem erro
- [ ] Patch notes atualizado

---

## Rollback

Campos novos são **aditivos**: o contrato antigo não quebrou. Rollback = reverter commit. A Fase 1 continua funcionando independente.

---

## Patch notes sugerido

```markdown
## p-0.10.0-alpha.2 — Fase 2: Split Win-vs-Loss (YYYY-MM-DD)

Sistema de recomendação agora aprende com o padrão vencedor do player.

### Backend
- `buscar_recomendacoes` calcula 3 perfis 8D do player: all, wins-only, losses-only
- Novo campo `delta[8]` expõe diferença comportamental entre vitória e derrota
- `delta_confidence: 'high' | 'low' | 'none'` conforme sample size
- Quando confidence=high, recomendação usa `profile_wins` como base de comparação (prioriza champs que batem com seu "eu vencedor")
- Reasons ganham versão prescritiva: "Quando vence, sua Agressividade sobe +3.7 — Kayn amplifica isso"

### Frontend
- Player dashboard: card de recomendação expandida tem toggle "Você × Campeão" / "Você (V) × Você (D)"
- DualRadar renderiza os dois modos com cores distintas

### Impacto
- Player com padrão W/L claro recebe top-N diferente
- Player com WR ~50% e pouca variância: perfil all ainda domina, confidence='low' ou 'high' com delta pequeno
```

---

## Re-aval antes de começar

Antes do Step 2.1:
1. Sample mínimo 5+5 pra high-confidence tá razoável? (alternativa: 10+10)
2. `compare_base = profile_wins` é a decisão certa? Alternativa: média ponderada `wins*0.6 + all*0.4` pra suavizar
3. Threshold 2.5 pra gerar reason prescritivo é bom?
