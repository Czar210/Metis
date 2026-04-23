# Handoff técnico — Metis

> **Para:** Claude Code (frontend/backend)
> **De:** Design (Claude)
> **Escopo:** 4 sistemas complexos que aparecem nos mockups da `/matches/[id]` e `/champions/[champion]`
> **Estado:** Mockups prontos em `metis-design.html` · todos os dados são fake mas o shape é o contrato que quero manter
>
> Este documento explica **como cada sistema funciona** (comportamento, estados, contratos de dados, integração). Não entrega código pronto — é a ponte entre o design e a implementação real.

---

## Sumário

1. [Timeline interativa de partida](#1-timeline-interativa-de-partida)
2. [RadarChart e DualRadar (perfil multi-eixo)](#2-radarchart-e-dualradar-perfil-multi-eixo)
3. [Insights de IA (Metis Analysis)](#3-insights-de-ia-metis-analysis)
4. [Perfil do campeão (`/champions/[champion]`)](#4-perfil-do-campeão-championschampion)
5. [Convenções gerais](#5-convenções-gerais)

---

## 1. Timeline interativa de partida

**Onde vive:** componente `<Timeline/>` dentro da aba "Overview" de `/matches/[id]`. Mockup em `metis/timeline.jsx`.

### 1.1 O que ela faz

A timeline é o coração da análise de partida. Ela tem **4 camadas coordenadas** que mostram os mesmos eventos de perspectivas diferentes:

1. **Curva de XP Diff** (em cima do track) — SVG de área, minuto a minuto, mostra quem estava na frente
2. **Horizontal Track** — scrubber com eventos como dots coloridos, distribuídos nos eixos Y: time azul em cima, vermelho embaixo, objetivos neutros no meio
3. **Zoom range slider** — dois handles que selecionam uma janela `[r0, r1]` em segundos. Tudo acima filtra pela janela
4. **Vertical event cards** — lista rica embaixo, com mini-mapa, participantes (ChampPortrait), gold gerado, nota contextual; apenas eventos dentro de `[r0, r1]` aparecem

Todas as 4 camadas **compartilham o mesmo state `range` e `filters`**. Hover num marker do track destaca a card embaixo e vice-versa (via `hoveredId`). Click abre um **modal** detalhado com mini-mapa grande, heatmap de kills, botão "Perguntar à Metis sobre este momento".

### 1.2 Controles de filtro

- **Categoria:** `kill | obj | tower | ward | misc` — toggles independentes
- **Team:** `both | blue | red`
- **Foco em jogador:** select dropdown com todos os nomes que aparecem em qualquer evento (killer/victim/actor/assists). Quando selecionado, só mostra eventos que envolvem esse jogador
- **Jump to timestamp:** input `14:30` ou `1430` → centra range em ±90s daquele ponto
- **Reset:** volta filters e range aos defaults

### 1.3 Shape dos dados — o contrato

O componente espera **dois arrays do backend**:

#### `events: TimelineEvent[]`

Shape que bati com os mocks em `metis/timeline-data.jsx`. Cada evento tem:

```ts
type TimelineEvent = {
  id: number;                    // Único, estável (pra React keys e hover state)
  t: number;                     // Tempo em segundos desde o início da partida
  type: 'kill' | 'teamfight' | 'dragon' | 'herald' | 'baron'
      | 'tower' | 'ward' | 'level' | 'item';

  // Localização no mapa (0..100 em ambos os eixos)
  // 0,0 = base vermelha (bottom-left); 100,100 = base azul (top-right)
  x: number;
  y: number;

  // Contexto opcional
  lane?: 'TOP' | 'MID' | 'BOT' | 'JUNGLE' | 'RIVER' | 'BARON' | 'TRI';
  key?: boolean;                 // true = "momento chave", destaca em dourado
  gold?: number;                 // Ouro gerado por este evento (pra teamfight/objetivo/kill)
  note?: string;                 // Texto curto descritivo — pode vir da IA ou ser derivado
  label?: string;                // "Primeiro sangue", "Ace", etc

  // Participantes — depende do type
  // kill:
  killer?: Participant;
  victim?: Participant;
  assists?: Participant[];

  // teamfight:
  kills?: { killer: Participant; victim: Participant }[];

  // level / item / ward:
  actor?: Participant;
  level?: number;                // só em level
  item?: number;                 // id numérico do item (Data Dragon)
  itemName?: string;             // display name já traduzido
  target?: string;               // só em ward ("Ward de Controle", "Ward destruída")

  // dragon / baron / herald / tower:
  team?: 'blue' | 'red';         // quem conseguiu
  drakeType?: 'Infernal' | 'Ocean' | 'Mountain' | 'Cloud' | 'Hextech' | 'Chemtech' | 'Elder';
  tower?: string;                // "T1 Top", "Inibidor Mid", "Nexus"
};

type Participant = {
  c: string;                     // Champion id Data Dragon (Kayn, MonkeyKing, etc)
  n: string;                     // Nome do invocador (display)
  team: 'blue' | 'red';
  isYou?: boolean;               // Destaca em dourado quando é o dono do puuid visualizado
};
```

> **Importante:** o `isYou` é calculado no frontend comparando `participant.puuid` contra o `puuid` do player que chegou nesta view. Backend manda o puuid junto; frontend resolve.

#### `xpCurve: { blue: number[]; red: number[] }`

Dois arrays paralelos, **um valor por minuto** (`index 0 = minuto 0`, `index 28 = minuto 28`). Valor absoluto de XP total do time. A diff `blue[i] - red[i]` é o que a SVG desenha — normalizada pelo maior absoluto da partida.

### 1.4 Derivados calculados no cliente

- `KILL_HEATMAP` — pontos (x,y,team) tirados de todos os eventos `kill` e `teamfight`. Usado no minimapa do modal com `opacity: 0.25`
- `categoryOf(event)` → retorna uma das 5 categorias do filtro
- `eventTeam(event)` → resolve `team` olhando `e.team` > `e.killer.team` > `e.actor.team`
- `eventPlayers(event)` → flatten de todos os nomes envolvidos, pra popular o dropdown de foco

### 1.5 Integração com Riot Match-V5 Timeline

Riot expõe `GET /lol/match/v5/matches/{matchId}/timeline`. Estrutura oficial é **frame-based** (1 snapshot por minuto + eventos intra-frame).

**O que o backend precisa fazer:**

1. Buscar a timeline da Riot
2. Converter os eventos Riot → nosso shape `TimelineEvent`:
   - `CHAMPION_KILL` → `type:'kill'` ou (se 3+ kills em janela de 12s) agrupa em `type:'teamfight'`
   - `ELITE_MONSTER_KILL` + `monsterType:'DRAGON'` → `type:'dragon'` com `drakeType`
   - `ELITE_MONSTER_KILL` + `monsterType:'BARON_NASHOR'` → `type:'baron'`
   - `ELITE_MONSTER_KILL` + `monsterType:'RIFTHERALD'` → `type:'herald'`
   - `BUILDING_KILL` → `type:'tower'` (nome derivado de `towerType` + `laneType`)
   - `WARD_PLACED` + `wardType:'CONTROL_WARD'` → `type:'ward'` (ignorar wards trash pra não poluir)
   - `LEVEL_UP` → `type:'level'` (só guardar 6, 11, 16 — os power spikes que importam)
   - `ITEM_PURCHASED` + item é lendário → `type:'item'` com `itemName` traduzido
3. Detectar **momentos-chave** (`key: true`):
   - Primeiro sangue
   - Qualquer ace ou teamfight 5v5
   - Baron/Elder
   - 2º drake de alma
   - Nexus tower + Nexus
4. Gerar o **campo `note`** — preferencialmente via IA com prompt resumido (ex: "Kayn gankou top aos 1:30, Garen sem flash. 1 assist do Morde."). Se a IA não estiver disponível, deixar `null` e o card mostra só a ação.
5. Converter coords Riot (0..14999 em ambos eixos) → (0..100, 0..100): `x = (riotX / 14999) * 100; y = (riotY / 14999) * 100`
6. Extrair `xpCurve` dos frames: `frames[i].participantFrames[*].xp` → somar por time

### 1.6 Estados da UI

- **Loading:** skeleton com shimmer nos 4 componentes; track fica com um spinner centralizado
- **Empty (nenhum evento no filtro):** card cinza "Nenhum evento com os filtros atuais" no lugar dos vertical cards (já implementado no mock)
- **Error (timeline indisponível):** fallback pra "Detalhes da timeline indisponíveis. Tente de novo em alguns minutos." — a aba Overview continua funcional sem a timeline

### 1.7 Performance

- Partidas de 45+ min podem ter 200+ eventos. Cards virtualize se > 50 visíveis (`react-window`)
- Heatmap deve ser pré-calculado no backend (não calcular no render)
- Track SVG usa `preserveAspectRatio="none"` + `viewBox="0 0 100 50"` e escala — sem re-render em resize
- Minimap SVG é estático (river + lanes + bases) — só o dot do evento muda por props

### 1.8 Premium gate

- **Grátis:** timeline completa, todos os eventos, filtros, modal
- **Premium:** botão "Perguntar à Metis sobre este momento" no modal → abre o chat Metis pré-preenchido com contexto do evento (ver seção 3 de Insights)

---

## 2. RadarChart e DualRadar (perfil multi-eixo)

**Onde vive:** `<RadarChart/>` em `metis/primitives.jsx`. O **DualRadar** (Neo-Artemis) é uma composição de 2 radares sobrepostos — usado em `/players/[puuid]` e nas recomendações de campeão.

### 2.1 RadarChart — primitive base

```ts
<RadarChart
  axes={Axis[]}
  size={number}          // default 200
  color={string}         // default var(--m-accent)
/>

type Axis = {
  label: string;         // "MECÂNICA", "VISÃO", etc. UPPERCASE quando renderiza
  value: number;         // 0..1 — normalizado
};
```

**Regras de design:**
- **Sempre 4–8 eixos.** Abaixo de 4 o polígono fica ruim; acima de 8 vira ilegível.
- **Valores normalizados 0..1.** Backend faz a normalização (z-score → logística → clamp). Frontend só desenha.
- **Grid em 4 níveis** (25%, 50%, 75%, 100%) — o outermost é mais opaco como referência.
- **Labels UPPERCASE, 9px** — fica discreto, o polígono é o hero.
- **Fill com opacity 0.2, stroke 1.5px**, dots nos vértices com 3px.

### 2.2 DualRadar — Neo-Artemis

A feature "Neo-Artemis" compara **perfil do jogador vs perfil ideal do campeão**. Dois polígonos sobrepostos no mesmo radar:

```tsx
<DualRadar
  axes={[
    { label:'MECÂNICA',   player:0.72, ideal:0.85 },
    { label:'MACRO',      player:0.64, ideal:0.75 },
    { label:'FARMING',    player:0.81, ideal:0.70 },
    { label:'VISÃO',      player:0.55, ideal:0.60 },
    { label:'TEAMFIGHT',  player:0.68, ideal:0.90 },
    { label:'EARLY',      player:0.73, ideal:0.65 },
    { label:'AGRESSÃO',   player:0.85, ideal:0.80 },
    { label:'DUELING',    player:0.60, ideal:0.78 },
  ]}
  playerColor="var(--m-accent)"       // dourado
  idealColor="var(--m-violet)"        // roxo
/>
```

**Renderiza dois polígonos:**
- Player: preenchido, opacity 0.25, stroke sólida 2px
- Ideal: só outline, stroke tracejado (`strokeDasharray="3 3"`), opacity 0.7

**Legend embaixo:** 2 dots coloridos + "Seu perfil" / "Ideal pra [champion]"

### 2.3 Os 8 eixos canônicos (definir no backend)

Sugestão de fórmulas (normaliza cada uma pra 0..1 por elo):

| Eixo | Fórmula sugerida |
|---|---|
| **MECÂNICA** | z-score de `kills + (assists*0.7) - deaths*1.2` ponderado por DPM |
| **MACRO** | `objectives_participation + tower_participation + game_win_rate_when_winning` |
| **FARMING** | z-score de CS/min do player vs média do elo + role |
| **VISÃO** | `vision_score_per_minute` — **só conta de verdade pro suporte**; outros roles recebem clamp maior |
| **TEAMFIGHT** | `damage_share_in_teamfights + survival_in_fights` |
| **EARLY** | Gold diff @ 10 + XP diff @ 10 + CS diff @ 10 (em turning points do campeão) |
| **AGRESSÃO** | `solo_kills + first_blood_participation + roams_successful` |
| **DUELING** | `1v1_win_rate` em duels limpos (sem gank nos 5s seguintes) |

**Perfil ideal** do campeão = média (z-score pra 0..1) dos top 100 one-trick-ponies do campeão naquele elo. Backend batch-processa uma vez por semana.

### 2.4 Estados

- **Poucas partidas (<10):** mostra radar com banner "Jogue mais 7 partidas pra calibrar seu perfil" — desenha o polígono em `opacity 0.4` com `strokeDasharray`, passa confiança
- **Champion sem pool dados:** "Ideal ainda sendo calculado pra [champion]" — só desenha polígono do player
- **Loading:** skeleton com outline do radar sem polígono, shimmer nos labels

### 2.5 Interação

- Hover num eixo → tooltip com valor bruto + percentil no elo (ex: "Farming: 7.8 CS/min — top 15% Diamante jungle")
- Click num eixo → abre modal "Como melhorar [EIXO]" com 3 drills/dicas da IA (**premium-gated**)

---

## 3. Insights de IA (Metis Analysis)

**Onde vivem:** embutidos em múltiplas telas (home, player dashboard, match detail, champion page). Não é uma tela própria — é um **componente recorrente** (`<AIInsightCard/>`) mais o **Chat Metis** em `/chat`.

### 3.1 Os 3 formatos de insight

#### A) Inline insight card (compacto)

Usado em listas (ex: dentro de cada match da match history). 1–2 linhas de texto. Sempre começa com um **verbo de ação** ou um **número**.

```tsx
<AIInsight
  severity="positive" | "neutral" | "negative" | "critical"
  icon="sparkles"
  title="Kayn performou acima da média"
  body="Você fez 3.4 KDA num elo onde a média é 2.1. Jungle pressure consistente."
  action={{ label:'Ver análise completa', href:'/matches/123#ai' }}
/>
```

Severity muda a cor da borda esquerda (verde / cinza / laranja / vermelho).

#### B) Match Deep Analysis (card grande)

Ao final da aba "Análise de Equipe" em `/matches/[id]`. **Estrutura canônica de 5 seções**:

```ts
type MatchAnalysis = {
  tldr: string;                    // 1–2 frases. "Você carregou o early com 3 ganks no top, mas ficou invisível no late."
  score: number;                   // 0..100 — "Metis Score" daquela partida. Pesa KDA, objetivos, teamfight, macro

  strengths: Highlight[];          // 2–3 pontos fortes
  weaknesses: Highlight[];         // 2–3 pontos de melhora
  keyMoments: KeyMoment[];         // 3 momentos cruciais com timestamp + explicação

  coaching: Coaching;              // 1 drill sugerido pra próxima sessão
};

type Highlight = {
  label: string;                   // "Agressão no early"
  value?: string;                  // "3 kills antes dos 10min"
  note: string;                    // 1 frase explicando
  eventIds?: number[];             // Liga com eventos da timeline
};

type KeyMoment = {
  t: number;                       // timestamp em segundos
  eventId?: number;                // se existir, abre o modal da timeline quando clicado
  title: string;
  analysis: string;                // 2–4 frases, formato markdown leve (**bold**, *italic*)
  impact: 'positive' | 'negative';
};

type Coaching = {
  drill: string;                   // "Treino de kiting em Practice Tool"
  goal: string;                    // "Manter distância de ADC enquanto dano"
  estimated_minutes: number;
};
```

Render: card 2-col no desktop. Esquerda = tldr + score + strengths. Direita = weaknesses + keyMoments (lista cronológica clicável). Embaixo = coaching em card destacado dourado.

#### C) Chat Metis (conversacional)

Em `/chat` e no modal "Perguntar à Metis sobre este momento" da timeline.

**Regras:**
- **Sempre streaming** — mensagens aparecem token a token
- **Pré-prompting por contexto:** se o usuário chega do modal de timeline event, primeira mensagem da IA **já vem pré-gerada** com o contexto do evento. Ex: "Sobre o teamfight aos 17:02 no mid: você pegou 3 kills mas o Thresh morreu cedo porque..."
- **Token counter sempre visível:** barra no topo do chat mostra `usado / total` do mês, mesma visual da /account
- **Code blocks, markdown, listas** suportados no render
- **Citações de partidas:** quando a IA menciona "no seu último jogo de Kayn", renderiza um mini-card clicável com link pra match
- **Rate limit por tier:**
  - Free: 2k tokens/mês, apenas 1 conversa ativa
  - Premium: 150k tokens/mês, histórico completo
  - Pro: 500k tokens/mês + API acesso

### 3.2 Backend — shape da API

```
POST /api/ai/match-analysis
  body: { matchId: string, puuid: string }
  response: MatchAnalysis
  cache: 7 dias por (matchId, puuid)
  cost: ~8k tokens (Claude Haiku ou similar)

POST /api/ai/chat
  body: { sessionId, message, context?: { type:'match'|'player'|'champion'|'event', id: string } }
  response: SSE stream — { delta: string } ou { done: true, usage: {tokens_in, tokens_out} }

POST /api/ai/inline-insight
  body: { scope: 'match'|'player'|'champion', id: string }
  response: AIInsight[]
  cache: 24h
```

### 3.3 Premium gate

- Free vê: `tldr` + `score` + **1** strength + **1** weakness + 1 keyMoment. O resto tem blur com botão "Destrave com Premium"
- Free vê 3 inline insights na home por dia, depois bloqueia
- Free **não** tem acesso ao chat (botão leva pra /pricing)

### 3.4 Copywriting

- Sempre em PT quando idioma = PT. EN é tradução direta.
- Tom: técnico mas amigável. **Nunca** "Excellent!" ou "Great job!". Prefira métrica concreta: "3.4 KDA, top 15% do elo".
- Nunca inventar números — se o backend não mandou a métrica, não citar.
- Usar nomes de campeão em EN mesmo em PT (Kayn, Monkey King, não "Rei Macaco").
- Não usar jargão que só pro joga vai entender ("gank do jg inv lane com bola de flash") — explicar em 1 termo.

### 3.5 Estados

- **Loading:** skeleton com 3 linhas shimmer na área de texto. Score fica `— / 100` com spinner.
- **Error:** "Análise indisponível no momento" + botão tentar de novo. Não quebrar o resto da tela.
- **Rate limited:** banner "Você atingiu o limite mensal. Reseta em X dias." + upgrade CTA.

---

## 4. Perfil do campeão (`/champions/[champion]`)

**Mockup:** `metis/screen-champion.jsx`. Página com **header hero + 4 tabs**.

### 4.1 Anatomia

```
┌─────────────────────────────────────────────────────────────┐
│ [Splash art background com gradient fade]                   │
│                                                             │
│  [Portrait 120] [Name Hero] [Role+Tier pills]  [Stats block]│
│                 [Lore short] [Tags]                         │
├─────────────────────────────────────────────────────────────┤
│ [Tab: Overview] [Builds] [Matchups] [Sinergias]             │
├─────────────────────────────────────────────────────────────┤
│ ... conteúdo da tab                                         │
└─────────────────────────────────────────────────────────────┘
```

### 4.2 Hero header

**Background:** splash art oficial do campeão (`ddragon/cdn/img/champion/splash/[Champion]_0.jpg`) com overlay `linear-gradient(to right, #0B0D12 0%, #0B0D12CC 50%, transparent 100%)` pra texto ficar legível à esquerda.

**Conteúdo (da esquerda):**
- Portrait 120×120 em rounded-16 com border accent
- Nome (Space Grotesk 40px, 700)
- Título ("a Lâmina Sombria") — 14px, muted, italic
- 2 pills: role principal (`TOP`) + tier na meta (`S+`)
- Tags do campeão: `Assassino · Lutador · Fighter`
- Lore curta (3 linhas max, `text-wrap: balance`)

**Direita:** bloco de stats principais (grid 2x2):
- Win Rate global (com delta vs patch anterior)
- Pick Rate
- Ban Rate
- KDA médio
- Todos tabulares, JetBrains Mono

### 4.3 Tab 1 · Overview

Grid 2 colunas:

**Coluna esquerda:**
- **Performance por elo** — bar chart horizontal: Iron / Bronze / … / Challenger cada um com sua WR
- **Curva de poder** — area chart minuto-a-minuto (level 1–18) — mostra onde o campeão é forte (early/mid/late)
- **Tendência nos últimos patches** — sparkline de WR dos últimos 5 patches

**Coluna direita:**
- **Stats base** — Q/W/E/R cooldowns, dano base, scaling — tabela densa
- **Runas principais** (as 2 mais populares) — com keystone destacada, % de uso
- **Feitiços** — Flash+Smite, Flash+Ignite etc com pickrate

### 4.4 Tab 2 · Builds

Tabela de builds com **agregação agrupada**:

```
[Build name "Full AD Lethality"] [Win rate 54.2%] [Pick rate 38%]
  Starting: [Dagas][Poções]
  Core (em ordem): [item1] → [item2] → [item3]
  Luxury 4th/5th/6th: variantes com %
  Runas: keystone + 2 runes secundárias
  Situational: [anti-heal][anti-shield][boots opts]
```

3–5 builds populares listadas. Cada uma expansível (accordion) pra mostrar matchup-specific adjustments.

**Futuro:** filtros empilhados (chips) — "contra Zed + mid + elo Platina+" recomputa builds filtradas.

### 4.5 Tab 3 · Matchups

Grid de cards, 4 colunas. Cada card:

```
┌──────────────────────┐
│ [Portrait]           │
│ [Champion Name]      │
│ ───                  │
│ WR: 47.2% (−2.8)     │
│ 1,240 partidas       │
│ ───                  │
│ [Good / Even / Bad]  │
└──────────────────────┘
```

Ordenação default: **piores matchups primeiro** (counter list). Toggle pra "melhores primeiro" (easy lanes).

- Good = WR > 52% vs esse champ
- Even = 48–52%
- Bad = < 48%

Cor do border-left muda com categoria: verde / amarelo / vermelho.

Hover num card → mini-tooltip com "Porquê": "Kayn tem kit de burst curto, Jax escala e counter-dueling é forte após 2 itens" — gerado pela IA, cache 1 semana.

### 4.6 Tab 4 · Sinergias

Grid 3 colunas:

- **Com jungle** — top 5 junglers que subiram a WR dele (ou vice-versa)
- **Com suporte** — top 5 suportes (pra ADCs/mids que jogam com duo support)
- **Com time (comp)** — sinergia de composição: "Em comps de dive: WR +4.2%"

### 4.7 Shape dos dados

```ts
type ChampionProfile = {
  id: string;                        // "Kayn"
  name: string;                      // "Kayn"
  title: string;                     // "a Lâmina Sombria"
  tags: string[];                    // ["Assassino", "Lutador"]
  lore: string;                      // string curta (já traduzida)

  roles: {
    role: 'TOP'|'JUNGLE'|'MID'|'BOT'|'SUP';
    pick_rate: number;               // % nesse role vs total
    primary: boolean;                // role principal?
  }[];

  tier: 'S+'|'S'|'A'|'B'|'C'|'D';
  tier_trend: 'up'|'flat'|'down';

  global_stats: {
    win_rate: number;
    win_rate_delta_patch: number;    // vs patch anterior
    pick_rate: number;
    ban_rate: number;
    kda: number;
    total_games: number;
  };

  // Overview
  by_elo: { elo: string; win_rate: number; games: number }[];
  power_curve: number[];             // 18 valores, 0..1
  patch_trend: number[];             // 5 valores de WR nos últimos patches

  // Base stats + abilities (do Data Dragon direto)
  abilities: { q,w,e,r,passive }: AbilityDetail;
  base_stats: { hp, mp, armor, mr, ad, as, ms, range };

  // Builds
  builds: BuildVariant[];

  // Matchups
  matchups: Matchup[];               // pode ser paginado

  // Synergies
  synergies: {
    jungle?: Synergy[];
    support?: Synergy[];
    comp?: { comp_type: string; win_rate_delta: number }[];
  };

  // Meta pra cards
  splash_url: string;                // CDN
  portrait_url: string;              // CDN
  last_updated: string;              // ISO, mostra em footer "Dados atualizados há X dias"
};

type BuildVariant = {
  name: string;                      // "Full AD Lethality"
  win_rate: number;
  pick_rate: number;                 // dentre jogadores do champ
  keystone: string;                  // "Conquistador"
  runes_secondary: string[];
  starting_items: number[];          // item ids
  core_items: number[];              // em ordem ideal
  luxury_options: { item: number; pick_rate: number }[];
  boots_options: { item: number; pick_rate: number }[];
  situational: { item: number; when: string }[];  // "contra heavy AP"
  spells: [string, string];          // ["Flash", "Smite"]
};

type Matchup = {
  opponent: string;                  // champion id
  role_matchup: 'lane'|'jungle';     // se é lane ou clashes de jungle
  win_rate: number;
  win_rate_delta_elo_avg: number;
  games: number;
  category: 'good'|'even'|'bad';
  note?: string;                     // gerado pela IA, cache 7d
};

type Synergy = {
  partner: string;                   // champion id
  win_rate_together: number;
  baseline_win_rate: number;         // wr do champ sozinho
  games: number;
};
```

### 4.8 Data Dragon — assets

- Splash: `https://ddragon.leagueoflegends.com/cdn/img/champion/splash/{id}_0.jpg`
- Portrait (quadrado): `https://ddragon.leagueoflegends.com/cdn/{version}/img/champion/{id}.png`
- Abilities: `.../img/spell/{id}Q.png` etc (o id Q/W/E/R não é o champion, vem do data dragon)
- Items: `.../img/item/{item_id}.png`

Mesmo padrão do helper `champImg()` e `itemImg()` já no frontend.

### 4.9 Estados

- **Champion sem dados suficientes** (< 100 partidas no patch): mostra banner no topo "Dados limitados — campeão com pouca presença neste patch". Tabs continuam, mas Matchups e Synergies ficam com "Insuficiente".
- **Loading:** skeleton do hero (splash com shimmer) + skeleton das tabs.
- **404 (champion id inválido):** página dedicada "Campeão não encontrado" com link pra tier list.

### 4.10 SEO (importante — essas páginas atraem tráfego orgânico)

- `<title>` = `[Champion] - Builds, Runas e Matchups · Metis`
- `<meta name="description">` dinâmica com WR/tier/role
- Open Graph: splash art como imagem, `og:title` + `og:description`
- Schema.org `Article` com `datePublished` = last_updated
- URL canônica: `/champions/kayn` (lowercase), redirect de `/champions/Kayn` → lowercase

### 4.11 Premium gate

- **Grátis:** Overview completo + 3 builds + 10 matchups + 3 synergies cada categoria
- **Premium:** builds filtrados por matchup/elo, "Porquê" expandido da IA em cada matchup, todas as synergies, export do build pra client LoL (copy as runes/items)

---

## 5. Convenções gerais

### 5.1 Tokens de cor — sempre usar `--m-*`

Nunca hardcode hex fora do design system. Os únicos lugares com hex literal são:
- Brand tier colors (card brand logos em /account)
- Drake colors (`DRAKE_COLORS` em timeline-data.jsx)
- Eloed ranks (RankBadge)

### 5.2 Tipografia

- **Números sempre tabulares:** classe `.tabular` (já definida), ou `font-variant-numeric: tabular-nums` inline. CRÍTICO pra KDA, %, counters.
- **Displays grandes:** `font-display` → Space Grotesk. Usar em h1/h2 de página, scores grandes, stats hero.
- **Monospace:** `font-mono` → JetBrains Mono. Pra códigos de cupom, PUUIDs, timestamps `00:00`, coordenadas.
- **Corpo:** Inter (default via scope).

### 5.3 i18n — preparar strings

Toda string user-facing vai pra `src/messages/{pt,en}.json`. Convenção de namespace flat por tela:

```json
{
  "account.subscription.title": "Assinatura",
  "account.subscription.next_bill": "Próxima cobrança em {date}",
  "account.tokens.used": "{used} / {total} tokens",
  "timeline.empty": "Nenhum evento com os filtros atuais."
}
```

**EN infla ~20%.** Desenhei pensando em PT curto; se uma string ficar apertada em EN, melhor reformular do que quebrar layout.

### 5.4 Acessibilidade

- Todos os botões interativos precisam de `aria-label` quando só têm ícone
- Modals (event modal, confirm delete) fazem focus trap + fecham com Esc (já implementei o Esc handler no EventModal)
- Radar chart tem `role="img"` + `aria-label="Perfil multi-eixo do jogador"` porque decodificá-lo é difícil pra leitor de tela — alternativa: mostrar tabela com os valores abaixo em `<details>`
- Contraste: todos os `--m-text-dim` estão em WCAG AA sobre `--m-bg` e `--m-surface`. `--m-muted` é só pra info descartável (timestamps, hints) — nunca pra info crítica

### 5.5 Performance

- `ChampPortrait`, `itemImg` devem **sempre** ter `loading="lazy"` quando fora do viewport inicial
- Match history, champion grid, tier list: virtualize com `react-window` se > 30 items
- Radar / Sparkline / Donut: componentes puros, `React.memo` com key em `value`
- Timeline: o hover state pode causar re-render em 20+ cards. Já está otimizado no mock (hover muda só o `hoveredId` único), mas se virar problema, mover pra portal ou CSS-only via `:has()`

### 5.6 Loading skeletons — padrão

Criar um componente `<Skeleton w h radius/>` compartilhado que faz shimmer animado. Todas as 4 features esperam loading states bem tratados — nunca spinner no meio da tela, sempre shimmer no shape do conteúdo.

### 5.7 Error boundaries

Cada feature grande (Timeline, RadarChart, ChampionProfile, AIInsight) deve estar envolvida em um `<ErrorBoundary>` próprio. Se uma parte crashar (ex: IA voltou lixo), o resto da página continua funcionando.

---

## 6. Prioridade de implementação sugerida

Se tiver que escolher uma ordem:

1. **Perfil do campeão (tab Overview + Matchups)** — SEO + tráfego orgânico, carrega o maior valor por hora de dev
2. **Inline AI insights** — barato (1 endpoint, cache 24h), apareceu em todo lugar e é o diferencial do Metis
3. **Timeline interativa** — visual wow, mas requer Riot Timeline API work + mapeamento robusto
4. **RadarChart / DualRadar** — mais simples de implementar (primitive pronto), mas depende do cálculo dos 8 eixos que é meia tarde de modelagem estatística
5. **Match Deep Analysis (card grande)** — caro em tokens, gate Premium, implementar depois que free funciona
6. **Chat Metis completo** — streaming + rate limiting + histórico são 2 semanas de trabalho

---

**Dúvidas? Pings direto no Claude Code sobre qual shape confirmar antes de gastar tempo em implementação.**
