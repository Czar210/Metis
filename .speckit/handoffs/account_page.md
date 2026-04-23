# Handoff Claude Design — Metis (p-0.9.20+)

## Contexto do projeto
Metis é dashboard de analytics de League of Legends + IA tática. Stack:
Next.js 15 App Router, React 19, TS strict, Tailwind v3, design system
próprio (`src/components/design/`, tokens CSS `--m-*`, fontes Space Grotesk
display + Inter UI + JetBrains Mono tabular). Dark-only, accent trocável
(azul/roxo/verde/vermelho/dourado) via `ThemeSwitcher`. i18n PT/EN via
`next-intl` cookie-based (namespace flat por tela em
`src/messages/{pt,en}.json`).

## Status do redesign
Redesign Metis 1.0 está FECHADO. Todas estas telas já têm o visual novo
em produção (estilo dark accent gold, cards com border sutil, Space
Grotesk nos títulos, eyebrow uppercase com ícone):

- Home (busca jogador + stats strip + meta spotlight + tier list top-8 + sidebar)
- Tier List (`/champions` — cards agrupados por tier S+/S/A/B/C/D com z-score)
- Champion Detail (hero + 4 tabs: Overview, Builds, Matchups, Sinergias)
- Itens (spotlights populares/WR + tabela densa)
- Planos (4 tier cards Free/Doador/Premium/Pro + cupons + comparativo + FAQ)
- Changelog (timeline vertical com spine + nodes + tags coloridas)
- Team (3 cards com glow decorativo)
- Chat Metis (token bar + bubbles + gate premium)
- Player Dashboard (banner, 4 KPIs, winrate cumulativo, recomendações
  Neo-Artemis com DualRadar 8 eixos, match history, sidebar rica)
- Match Detail (3 tabs + TeamBlock com Metis Score + SplitDonut + timeline)
- Admin (KPIs + breakdown dirty matches)

Design tokens canônicos (já expostos em `:root.metis-scope`):

    --m-bg             fundo geral
    --m-surface        cards, header, inputs
    --m-surface-2      hover/elevated
    --m-border         borda sutil
    --m-border-2       borda forte
    --m-text           texto principal
    --m-text-dim       labels secundários
    --m-muted          terciário
    --m-accent         cor de destaque (trocável)
    --m-accent-rgb     mesmo em RGB pra alpha
    --m-green          sucesso
    --m-red            erro/destaque negativo
    --m-violet         IA/timelines
    --m-gold           destaque premium

Primitives prontos em `src/components/design/`:
Card, SectionLabel, Stat, Bar, StackedBar, Sparkline, AreaChart, Donut,
RadarChart (usado em DualRadar), Pill, TierBadge, RankBadge, RoleGlyph,
ChampPortrait, Icon (set Lucide-style inline), LangSwitcher, Logo.

Header (`AppHeader`) tem dropdown no avatar com "Painel admin" (só se
`app_metadata.is_admin`) e "Sair". Login em estado logado = inicial do
email num círculo.

## Modelo de acesso
- Anon: home, tier list, champion page, itens, changelog, team, pricing, match detail, player page pública
- Logado: tudo anon + chat (com gate premium), supervisão de jogadores (`watched_players`)
- Premium (`app_metadata.is_premium`): destrava chat Metis
- Admin (`app_metadata.is_admin`): `/admin` + badge visual

## O que precisa ser desenhado AGORA

### 1. `/account` — Minha conta (NOVA — prioridade)
Usuário logado chega aqui pelo dropdown do avatar ("Minha conta"). Deve
mostrar:

- Header identidade: avatar/inicial grande, email, data de cadastro,
  tier atual (Free/Premium/Pro) com pill colorida
- Card "Assinatura": plano atual, valor/mês, próxima cobrança, método
  de pagamento, botão "Upgrade" (se Free/Doador) ou "Gerenciar" (se
  Premium/Pro). Nota: integração de pagamento ainda é **stub** — premium
  hoje é setado manualmente pelo time via service role. Desenhar como se
  fosse real.
- Card "Uso do Chat Metis": barra de tokens consumidos no mês (mesma
  visual do `/chat`), limite do tier, reset em X dias
- Card "Cupons ativos": código + efeito + validade. Input "Resgatar
  código". Tabela `coupons` já existe no Supabase.
- Card "Jogadores supervisionados": lista dos PUUIDs em `watched_players`
  com label livre, botão remover, link pro dashboard do player
- Card "Preferências": idioma (já tem LangSwitcher, mas duplicar aqui
  faz sentido), cor de accent (ThemeSwitcher), região padrão (BR1/NA1/…)
- Card "Conta": email (read-only por enquanto), botão "Alterar senha"
  (fluxo Supabase), botão "Sair de todos os dispositivos", botão
  perigoso "Deletar conta" (stub)

Layout sugerido: 2 colunas no desktop (identidade + assinatura na
esquerda larga, cards de uso e supervisão na direita), 1 coluna mobile.

### 2. `/auth` — Login/cadastro (OPCIONAL — ficou fora do redesign 1.0)
Tela atual é funcional mas visual antigo (não usa design system novo).
Se for migrar, seguir a estética das outras: fundo `--m-bg`, card
central com `--m-surface`, logo no topo, toggle login/signup com pill
group (igual LangSwitcher), inputs com border `--m-border-2`, botão
primário accent, link pra "esqueci senha" e OAuth providers (Google —
ainda não habilitado mas já desenhar o botão).

## Contexto pro FUTURO (design deve acomodar, não precisa entregar agora)

### Recomendação de campeões (feature maior, vem depois do /account)
Já existe embrião em `/players/[puuid]` (Neo-Artemis com DualRadar 8
eixos). Evolução planejada — desenhar com isso em mente pra não quebrar
linguagem:

- **Onde vai viver:** provavelmente `/recommendations` (nova rota) E como
  módulo embutido na home do usuário logado
- **Input do usuário:** role preferida, champion pool atual (multi-select
  com ChampPortrait), elo alvo, estilo de jogo (tags: aggressive/safe/
  scaling/early), opcional: draft do inimigo (5 portraits)
- **Output:** ranking de campeões com:
  - ChampPortrait grande + nome
  - "Match score" (0–100) com breakdown radar (synergy/counter/meta/
    curve/user_fit)
  - Por que: bullet points curtos gerados pela IA (precisa gate premium
    pro texto completo, preview pros free)
  - Build recomendada (3 itens core) + runas
  - Matchup highlights (top 2 counters do champ, top 2 que ele counteriza)
- **Estado "cold start"** (usuário sem histórico): onboarding com wizard
  de 3 steps

### Timeline interativa com mapa (Bloco 0, vem com backend de eventos)
Em `/matches/[id]` hoje tem timeline simples. Futuro: mapa de Summoner's
Rift (SVG) com dots de posição dos jogadores por minuto + scrubber
horizontal. Eventos (kills, objetivos, torres) aparecem como marcadores
no scrubber E no mapa. Já existem os primitives de curva temporal.

### Builds filtradas em matchup específico
Em `/champions/[champion]` tab Builds hoje é agregado. Futuro:
filtros cruzados "Ahri com Luden contra Zed mid elo Platina+". Desenhar
já pensando em UI de filtros empilhados (chips removíveis tipo gmail).

## Restrições / não-negociáveis
- Dark mode only — não desenhar modo claro
- Mobile deve funcionar, mas desktop 1440 é o alvo principal
- Sem libs de UI externas (shadcn/MUI banidas — design system próprio)
- i18n: todo texto vai pra JSON, então strings curtas são preferidas
  porque EN costuma inflar 15-30%
- Tabular numbers com JetBrains Mono (já tem classe `.tabular`)
- Ícones: set inline Lucide-style (paths em `Icon.tsx`), pedir ícone
  novo se faltar em vez de importar pacote
- Acessibilidade: foco visível, ARIA em menus/dropdowns, contraste
  WCAG AA mínimo

## Entregáveis esperados
- JSX/TSX com inline styles (mesmo padrão de `src/components/design/*`
  e `src/app/*/page.tsx`)
- Copy em PT. EN fica com o time de engenharia durante integração.
- Estados: loading skeleton, erro, vazio ("nenhum jogador supervisionado
  ainda"), sucesso
