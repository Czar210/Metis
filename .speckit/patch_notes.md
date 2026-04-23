# Metis - Patch Notes

*Diário de mudanças significativas no ecossistema e na stack do projeto.*

## p-0.9.22 — DualRadar polish: primitive + tooltip + modal stub (2026-04-23)

Escopo **frontend-only** do p-0.9.22 planejado. Reescrita estatística dos 8 eixos canônicos + perfil ideal vindo de batch semanal fica pro ticket de backend futuro (HANDOFF-TECNICO seção 2.3).

### Promoção a primitive
- **`components/design/DualRadar.tsx`** — novo primitive. Antes vivia inline em `players/[puuid]/page.tsx` linhas 2017-2112 (~95 linhas). Agora exportado via barrel `@/components/design`.
- Props públicas: `axes: { label, player, ideal }[]`, `size`, `confidence: 'high'|'low'`, `playerLabel`, `idealLabel`, `onAxisClick`.

### Visual — alinhado com HANDOFF seção 2.2
- **Ideal = outline dashed**: `stroke-dasharray="3 3"`, opacity 0.7, `fill="none"`. Antes era preenchido igual ao player — ficava confuso visualmente.
- **Player com dots**: 3px nos vértices (4.5px no hover), cor `--m-accent`.
- **`confidence='low'`**: player polygon desenhado com `stroke-dasharray` + opacity 0.5, sinalizando baixa amostragem. Pronto pra backend enviar flag quando recomendações tiverem <10 partidas (hoje não usa ainda).

### Interação nova
- **Hover em qualquer área de eixo** (wedge invisível dividindo o círculo em N fatias) destaca o label, engrossa o dot e abre tooltip mostrando `player.toFixed(1) / ideal.toFixed(1)` com tipografia tabular.
- **Click em eixo** chama `onAxisClick(idx, axis)` — caller decide ação.
- **Legenda dinâmica**: antes `"Você" / "Campeão"`. Agora `"Seu perfil" / "Ideal pra {champion}"` usando nome do campeão recomendado. Linha do ideal na legenda é tracejada (match com o polygon).

### Integração no player dashboard
- **`app/players/[puuid]/page.tsx`**:
  - Import do novo primitive + helper `buildRadarAxes(player, champion, labels)` pra zipar os dois arrays em `DualRadarAxis[]`
  - Estado `radarImproveAxis: string | null` + componente interno `RadarImproveModal` com focus trap via Escape, backdrop click-to-close, ícone sparkles accent
  - Inline DualRadar deletado (95 linhas a menos)
- **i18n**: `players.legend_you` e `players.legend_champion` rebatizados pra alinhar com HANDOFF ("Seu perfil" / "Ideal pra {champion}"). Chaves novas: `radar_improve_title`, `radar_improve_soon`, `radar_improve_close`.

### Validação
- `npx tsc --noEmit` → 0 erros
- `npm run build` → 14 rotas, `/players/[puuid]` 9.90 kB (vs 9.85 kB antes)

### Não entregue (backend necessário — ticket futuro)
- 8 eixos canônicos (MECÂNICA, MACRO, FARMING, VISÃO, TEAMFIGHT, EARLY, AGRESSÃO, DUELING) com z-score por elo×role — hoje o backend envia `AGR/MAP/EFC/PRS/SBV/UTL/ERL/CST` em escala 0..10
- Perfil ideal via batch semanal dos top 100 OTPs do campeão naquele elo
- Percentile real no tooltip (`top 15% Diamante jungle` etc) — hoje só mostra valores brutos
- Drills personalizados com IA no modal "Como melhorar" — hoje é stub "em breve"

---

## p-0.9.21 — /auth redesign + OAuth stubs (2026-04-23)

Tela de login migrada para o design system novo (eram as únicas junto com admin — admin migrou em p-0.9.16). Agora todas as telas usam `.metis-scope` + primitives.

### Mudanças
- **`app/auth/page.tsx`** — reescrita completa. Saiu Tailwind + lucide-react, entrou design system (`Icon`, `Logo`, tokens `--m-*`). 3 modos internos: `login` / `signup` / `forgot`.
- **Novo modo "forgot password"**: link "Esqueci minha senha" no login → tela dedicada com `supabase.auth.resetPasswordForEmail`. Link expira em 1h (texto do Supabase), redireciona pra `/auth` de volta.
- **Mostrar/ocultar senha**: botão olho no input de senha (login + signup).
- **Requisitos de senha em tempo real no signup**: min 8 chars · 1 maiúscula · 1 dígito. Ícone `check`/`dot` verde ou muted conforme cumprido. Validação visual só — mantém `password.length < 6` do server (regra Supabase antiga).
- **OAuth Google + GitHub**: botões presentes, desabilitados com tag "Em breve" (traduzido). SVGs inline dos dois provedores (Google colorido oficial, GitHub mono currentColor).
- **Decoração**: grid de pontos accent + glow radial central, `maskImage` pra esmaecer nas bordas.
- i18n completa: namespace `auth.*` recebeu ~25 chaves novas (login_title, signup_sub, forgot_hint, pass_req_*, or_continue, coming_soon, etc).

### Validação
- `npx tsc --noEmit` → 0 erros
- `npm run build` → 14 rotas, `/auth` 3.92 kB (vs 2.76 kB antigo — +1.16 kB pelo modo forgot + provider SVGs)

### Não testado
- Fluxo visual em navegador — não rodei dev server. César/Takida devem validar antes de fechar ticket.

---

## p-0.9.20 — /account (Minha conta) (2026-04-23)

Nova rota autenticada `/account` substituindo o link direto `/admin` do avatar. Dropdown do header agora tem 3 itens: **Minha conta** → **Painel admin** (se admin) → **Sair**.

### Rota nova
- **`app/account/page.tsx`** — dashboard 2-col de conta:
  - **Hero identidade**: avatar gigante com glow da cor do tier, tier pill (Free/Doador/Premium/Pro), username (derivado do email), email, `member since` formatado por locale
  - **Card Assinatura**: tier com preço fake (Free null · Doador R$4,90 once · Premium R$24,90/mo · Pro R$44,90/mo), "ATIVO" pill, card fake com brand logo (Visa/Mastercard SVG inline), última 4 dígitos, validade, próxima cobrança, botões Upgrade (free→/pricing) ou Gerenciar (stub). Sem Stripe real — escopo fora do ticket.
  - **Card Uso do Chat Metis**: puxa `/api/v1/chat/usage` (endpoint existente). Barra fica vermelha a partir de 80%. Reseta em N dias derivado de `resets_at`.
  - **Card Cupons**: lista `/api/v1/coupons/public` — título (estilizado como código monospace tracejado), descrição, `valid_until` formatado, barra de dias restantes (vermelha se ≤10 dias). Botão copiar título (muda pro ícone check 1.5s). Input "Resgatar código" ainda stub — toast "Em breve" (não existe endpoint de redeem).
  - **Card Jogadores supervisionados**: query direta em `watched_players` com JOIN `players` (mesmo shape da home). Botões abrir dashboard + remover (delete direto, RLS cuida de isolamento). Empty state instruindo como adicionar.
  - **Card Preferências**: Idioma (wire pra `setLocale` server action), cor de accent (wire pra `useTheme`), região padrão (persiste em `localStorage` key `metis_region`). 3 rows com ícone à esquerda, controle à direita.
  - **Card Segurança**: email (read-only), senha (botão → `supabase.auth.resetPasswordForEmail`), sessões ativas (botão → `signOut({scope:'global'})` + redirect `/`). Seção vermelha "Deletar conta" com botão stub.
- **Auth gate**: middleware atualizado — `/account` agora exige login junto com `/chat` e `/admin`.

### Design system
- **`components/design/Icon.tsx`** — 13 ícones novos: `creditCard`, `info`, `copy`, `gift`, `calendar`, `mail`, `globe`, `palette`, `shieldCheck`, `key`, `lock`, `trash`, `refresh`. Todos Lucide-style, stroke 1.75.
- **`components/design/AppHeader.tsx`** — adicionado item **"Minha conta"** no dropdown, acima de "Painel admin".

### Tier resolution
- Lê `app_metadata.tier` (valores `'free'|'donor'|'premium'|'pro'`). Fallback: se só existir `is_premium === true`, mapeia pra `'premium'`. Pricing já usava esse padrão; agora `/account` também.
- **Decisão não-óbvia**: O bundle Claude Design usava `'doador'` (pt), o código existente usa `'donor'` (en). Mantive `'donor'` como valor interno pra não criar divergência — display respeita i18n via `account.tier_donor`.

### Fake cards
- Confirmado com César: Stripe não está integrado ainda. Todos os usuários com tier pago veem o mesmo cartão fake Visa/Mastercard. Quando Stripe entrar, basta trocar `FAKE_SUB` por fetch do backend.

### i18n
- **pt.json** + **en.json**: namespace `account.*` (~60 chaves) cobrindo eyebrow, title, member_since, tier_*, subscription.*, tokens.*, coupons.*, watched.*, preferences.*, security.*.
- **header.menu.account** adicionado também.

### Validação
- `npx tsc --noEmit` → 0 erros
- `npm run build` → 14 rotas, `/account` 6.42 kB, 201 kB first load

### Não testado
- UI em navegador — não rodei dev server. Validação visual fica com César.

### Pendente (fora do escopo deste ticket)
- Integração Stripe real (substitui `FAKE_SUB`)
- Endpoint de redeem de cupom (input hoje é stub)
- Alterar email (read-only)
- Listar sessões reais — Supabase JS não expõe sessões ativas; hoje só mostra "sessão atual detectada". Precisaria de endpoint server usando service role.
- Deletar conta real

---

## p-0.9.19.1 — Fix Vercel build + dropdown menu no avatar (2026-04-23)

### Bug fix
- **`.gitignore`** — regra `*.json` (linha 40) silenciosamente engoliu `frontend/src/messages/{pt,en}.json` no commit do p-0.9.19. Resultado: build local verde, Vercel falha com `Module not found: Can't resolve '../messages'` em `src/i18n/request.ts`. Adicionada exceção `!frontend/src/messages/*.json`.

### Feature pedida pelo César
- **`components/design/AppHeader.tsx`** — avatar do usuário logado agora abre dropdown (role="menu") em vez de link direto pra `/admin`/`/`. Menu com email + itens "Painel admin" (se `isAdmin`) + "Sair" (vermelho, chama `supabase.auth.signOut()` + redirect `/`). Fecha com click fora ou Escape.
- i18n: `header.menu.{open, admin_panel, sign_out, signing_out}` em pt/en.

---

## p-0.9.19 — i18n 100% das telas PT/EN (2026-04-23)

Todo o site agora fala PT e EN. Telas restantes do p-0.9.18 foram migradas. Build passou com 13 rotas, 0 erros typecheck.

### Telas traduzidas nesta versão
- **team** (`app/team/page.tsx`) — eyebrow, título, cards dos membros (title/tags/quote/link por id), stats footer
- **auth** (`app/auth/page.tsx`) — toggle login/signup, labels, placeholders, validações, tela pós-cadastro
- **changelog** (`app/changelog/page.tsx`) — restructured RELEASES: cada release tem `id` e as entries passam a ser indexadas por `releases.<id>.entry_N`. Labels de tag (NOVO/MELHORIA/FIX/BIG UPDATE) via dict
- **items** (`app/items/page.tsx`) — eyebrow, título, spotlights (populares + WR), filtros de role/patch, tabela, tendências
- **pricing** (`app/pricing/page.tsx`) — 4 tier cards (Free/Doador/Premium/Pro) com features por ID + índice, cupons, trust footer, comparativo, FAQ, Times & Empresas
- **chat** (`app/chat/page.tsx`) — welcome, quick prompts, input placeholder, gate premium, usage bar, disclaimer
- **champions** (`app/champions/page.tsx`) — tier list completa: filtros de role/server/patch range/elo, cards por tier, z_score tooltip
- **champion detail** (`app/champions/[champion]/page.tsx`) — hero, 4 tabs (Overview, Builds, Matchups, Sinergias), KPIs, difficulty labels dinâmicos
- **players dashboard** (`app/players/[puuid]/page.tsx`) — **2110 linhas** (~2073 original). Banner, 4 KPIs, winrate cumulativo, tabela campeões, recomendações Neo-Artemis com DualRadar (8 eixos com axis labels i18n), match history com `formatRelativeDate` promovido a hook `useFormatRelativeDate()`, sidebar rica (Roles, Play profile, Ask Metis, Played With, Nemesis)
- **match detail** (`app/matches/[match_id]/page.tsx`) — **1595 linhas**. 3 tabs (Overview, Team Analysis, Builds & Runes), TeamBlock com Metis Score, SplitDonut por métrica, timeline reusada

### Componentes compartilhados
- **ThemeSwitcher** — tooltip e labels de cores (Azul/Roxo/Verde/Vermelho/Dourado)
- **TimelineChart** — labels de métrica (Ouro/Gold, CS/m, XP) e aria-label

### Dicionários
- **pt.json**: ~650 chaves, 15 namespaces (`common`, `header`, `home`, `admin`, `team`, `auth`, `changelog`, `items`, `pricing`, `champion`, `champions`, `chat`, `players`, `match`, `timeline`)
- **en.json**: mesma estrutura, traduções naturais (não literais). Termos técnicos de LoL (KDA, CS, DPM, Metis Score, runas) mantidos em inglês em ambos locales

### Padrões adotados
- `ROLE_I18N_KEY: Record<Role, 'role_top' | 'role_jungle' | ...>` mapeamento local em cada tela substitui o `ROLES_PT` do design system (que continua exportado mas será removido quando a tier list legada for limpa)
- `formatNumber(n, locale)` substitui todos os `.toLocaleString('pt-BR')` em código novo
- `new Date().toLocaleDateString('pt-BR', ...)` → usa `locale === 'pt' ? 'pt-BR' : 'en-US'`
- Ícones de role Riot (top/jungle/mid/bot/sup) são universais, só os labels text traduzem
- Códigos de servidor (BR1, NA1, etc) e rank (Iron, Gold, Master) ficam em inglês — universais
- Release labels/entries do changelog indexados por ID (ex: `changelog.releases.p_0_9_9.entry_0`) ao invés de string inline — mantém dados no JSON

### Decisões não-óbvias
- **Victory/Defeat em match detail**: PT coloca adjetivo depois do substantivo ("Vitória azul"), EN coloca antes ("Blue victory"). Agent manteve a ordem PT em ambos ("Victory blue") pra preservar o layout JSX com team name destacado no meio. Natural-sounding EN reordering fica pra backlog.
- **QUEUE_LABEL do match**: movido de const top-level pra dentro do componente (precisava de `t()`). Sem mudança de comportamento.
- **Sync message color** no players dashboard: antes usava `syncMsg.startsWith('Erro')` pra colorir vermelho. Agora usa boolean state `syncIsError` — desacopla a cor do texto literal.
- **formatRelativeDate** virou hook `useFormatRelativeDate()` porque precisa acessar `t` e `locale`.

### Validação
- `npx tsc --noEmit` → 0 erros
- `npm run build` → passou, 13 rotas estáticas geradas
- Cache do switcher PT↔EN persiste via cookie `NEXT_LOCALE`
- Bundle sizes estáveis (sem crescimento significativo):
  - Home: 195 kB (vs 196 kB antes — ganhou ~1 kB de economy em shared chunks)
  - Players: 203 kB, Match: 202 kB, Champion detail: 198 kB

### Pendente (não-bloqueante)
- Layout natural EN pros casos "Vitória azul / Blue victory" (reordenar JSX condicional)
- Revisar traduções EN da feature list do pricing (revisão do César)
- `StatsTable` e `components/ui/Header` são dead code — removíveis em próxima limpeza

---

## p-0.9.18 — i18n Foundation + Piloto PT/EN (2026-04-23)

Site agora fala português e inglês. Arquitetura cookie-based via `next-intl` — URL-based fica documentado em `.speckit/plano_i18n_url_future.md` pra eventual migração futura.

### Infra nova
- **Dependência:** `next-intl ^3.x` (padrão de facto pra Next.js 15 App Router, funciona em RSC)
- **`src/i18n/config.ts`** — `SUPPORTED_LOCALES = ['pt', 'en']`, default `pt`, cookie `NEXT_LOCALE`
- **`src/i18n/request.ts`** — `getRequestConfig` lê cookie via `next/headers`, carrega JSON dinâmico
- **`src/i18n/actions.ts`** — server action `setLocale(locale)` grava cookie + `revalidatePath('/', 'layout')`
- **`src/messages/pt.json` + `en.json`** — dicionários flat por namespace (`common`, `header`, `home`, `admin`)
- **`src/lib/format.ts`** — `formatNumber(value, locale)` (usa `Intl.NumberFormat` com BCP47 `pt-BR`/`en-US`), substitui `toLocaleString('pt-BR')` espalhado

### Integração
- **`next.config.ts`** — wrapped com `createNextIntlPlugin('./src/i18n/request.ts')`
- **`app/layout.tsx`** — agora async, wraps com `<NextIntlClientProvider>`, `<html lang>` dinâmico do locale, metadata via `getTranslations`

### Componente novo
- **`components/design/LangSwitcher.tsx`** — pill group PT/EN (accent background quando active), usa `useTransition` pra server action sem flash, acessibilidade via `aria-label`/`title`
- Posição no header: logo após o botão "Chat Metis", antes do avatar/login (conforme pedido)

### Telas piloto traduzidas
- **AppHeader** — nav labels (Home/Tier List/Itens/Planos/Equipe), botão Chat Metis, CTA Entrar, tooltips
- **Home (`app/page.tsx`)** — hero, subtítulo, stats strip, meta spotlight, tier list top-8 (com filtro de role i18n), sidebar watched/ask_metis/changelog
- **Admin (`app/admin/page.tsx`)** — eyebrow, título, 8 KPI cards, breakdown de motivos (`REASON_LABEL` virou chave i18n), mensagens de cache refresh, footer com flag

### Formatação numérica localizada
- Antes: `1.234` fixo (pt-BR) em todo lugar
- Agora: `1.234` em PT, `1,234` em EN — via `formatNumber(n, locale)` onde quer que haja `toLocaleString` nas telas piloto

### Padrão adotado pras demais telas (p-0.9.19+)
```tsx
const t = useTranslations('namespace')
const locale = useLocale() as Locale
// JSX: {t('key')} ou t('key', { vars })
// números: formatNumber(n, locale)
```

### Fallback e resiliência
- Chave ausente em `en.json` → cai pra pt automaticamente (comportamento padrão do next-intl). Nunca mostra a chave crua pro usuário.
- Cookie com valor desconhecido (`isLocale` type guard) → usa default `pt`

### Validação
- `npx tsc --noEmit` → 0 erros
- `npm run build` → passou, 13 rotas geradas, bundle da home +5.57 kB (base 196 kB), admin +2.76 kB
- Switch no header: PT → EN → persiste após F5 → números reformatam

### Próximas telas (pendentes pra p-0.9.19+)
champions (tier list completa), chat, pricing, player dashboard, champion page, match detail, changelog, team, auth, matches

---

## p-0.9.17 — Tier List por z-score + filtro de nicho (2026-04-22)

Tier agora é calculado estatisticamente (desvios padrão) e filtro de relevância permite nichos legítimos sem poluir com outliers.

### Backend — `stats_service.py`
- **`_assign_tiers` reescrito**: percentil → **z-score** do winrate dentro da role
  - S+ ≥ +2σ · S ≥ +1σ · A ≥ 0 · B ≥ -1σ · C ≥ -2σ · D < -2σ
  - Se meta balanceado (stddev baixo), ninguém é S+ — sem "S+ forçado"
- **Filtro de significância** novo: entra se `total_matches >= min_matches` **OU** (`role_share >= min_role_share` AND `total_matches >= min_matches_relative`)
  - Miss Fortune em JUNGLE com 2 matches: cortada (role_share muito baixa + sample baixo)
  - Volibear em JUNGLE com 13 matches e 100% role_share: **entra** (nicho legítimo)
- **Response** inclui 2 campos novos: `z_score` (float) e `role_share` (% float)

### Backend — `routes/stats.py`
- `/api/v1/stats/tierlist` ganhou 2 query params: `min_role_share` (default 0.15) e `min_matches_relative` (default 10)
- Backwards compat: `min_matches` segue existindo como piso absoluto

### Frontend
- **Home** (`app/page.tsx`): substitui `getTier(winrate)` local por `resolveTier(c)` que prefere `c.tier` do backend, com fallback legado pro pior caso
- **Tier List** (`app/champions/page.tsx`): cards mostram `z_score` em formato `+1.8σ` ou `-0.5σ` como sub-label (cor verde/vermelho, tooltip "Desvios padrão acima da média da role")
- **TIER_COLORS**: tier `D` adicionado (vermelho escuro) pra cobrir z < -2σ
- **TIER_ORDER + byTier**: incluem D

### Distribuição esperada (sanity)
Em JUNGLE patch 16.7 no banco atual:
```
S+: 1 (Volibear +3.22σ, 76.9% WR, 100% role_share)
S:  9
A:  13
B:  23
C:  5
D:  1 (Gragas JG -3.01σ, 25% WR)
```

---

## p-0.9.16 — Admin redesign + bugfix avatar (2026-04-22)

Última tela fora do redesign original (admin não estava no handoff do Claude Design) + bugfix urgente do avatar do header.

### Bugfix — `AppHeader.tsx`
- Avatar linkava pra `/admin` pra todo mundo. Agora condiciona em `user.app_metadata?.is_admin === true`
- Usuário normal: link vai pra `/` (home), title "Minha conta"
- Usuário admin: link vai pra `/admin`, avatar ganha borda accent
- Listener `onAuthStateChange` agora também atualiza `isAdmin` (reage a login/logout)

### Redesign — `app/admin/page.tsx`
- AppHeader novo substitui Header antigo
- Header da página: eyebrow accent "// Painel Admin · acesso restrito" + h1 Space Grotesk "Visão geral do sistema"
- Botão "Invalidar cache da tier list" em accent com spinner animado durante execução + mensagem de feedback inline
- **8 KPI cards** (2 rows de 4) com Stat primitive e cores semânticas (accent, green, red, violet)
- Card "Partidas descartadas · por motivo" com bars horizontais vermelhas e % do total
- Auth check preservado (redirect pra `/` se não é admin, `/auth` se deslogado)
- Footer sutil mencionando requisito `app_metadata.is_admin = true`

### Redesign Metis 1.0 — **AGORA SIM 100% COMPLETO**
11 telas migradas ao todo (10 do handoff + admin fora do handoff).

---

## p-0.9.15 — Redesign: Match Detail + Fim do Redesign 🎉 (2026-04-22)

**Décima e última tela do redesign.** Match detail completo com 3 tabs (Overview / Análise de Equipe / Builds & Runas). Toda a lógica preservada (fetch match + timeline lazy, Metis Score, bans, runas_raw parsing, summoner spells, highlight de jogador via `?as=puuid`).

### Frontend — `app/matches/[match_id]/page.tsx`
- **Banner**: ícone grande verde/vermelho dependendo de quem venceu (check/x), headline "Vitória X · em MM:SS" com accent na cor do vencedor, meta (queue label, patch), breadcrumb com jogador em destaque (se URL tiver `?as=puuid`)
- **Bans**: card com "Bans Azul" + "Bans Vermelho" (grayscale + opacity), separados por divisor
- **Tabs** com ícones: Overview / Análise de Equipe / Builds & Runas
- **Overview (1fr 360px grid)**:
  - Card **Times** com dois `TeamBlock` (azul em cima, vermelho embaixo): header colorido com label/gold/kills totais + grid 7-col por jogador (role icon / portrait+level / nome+champ / KDA / dano+bar+CS / items 6 + keystone / Metis Score colorido por tier de elo)
  - Card **Timeline** colapsável: abre/fecha carregando `TimelineChart` (reusado do legado — funciona com frames CS/Gold/XP por minuto). Nota explícita que timeline interativa com mapa/eventos chega com o Bloco 0 do roadmap
  - **Sidebar**: "Análise da Metis" accent card (placeholder + CTA `/chat` com `match_id` na URL) + "Resumo rápido" 4 stats (Duração, Kills, Ouro total, Dif. ouro)
- **Team Analysis**:
  - Grid auto-fit com `SplitDonut` inline pra 5 métricas (Abates, Ouro, Dano, Visão, CS) — círculo split azul/vermelho + valores + %
  - Card **Dano por jogador** com bars ordenadas do maior pro menor
  - Sidebar com "Perfil dos times" (placeholder honesto) + "Leitura da Metis" accent
- **Builds & Runas**:
  - Grid por jogador: role icon · portrait · nome · 6 items + trinket · keystone + árvore primária/secundária · summoner spells · V/D

### Lógica preservada
Fetch do endpoint `/api/v1/match/{id}`, lazy fetch de `/timeline` ao expandir, parse de `runes_raw.styles` pra árvores primária e secundária, `SUMMONER_SPELL` map, Metis Score com 10 faixas de cor (Iron → Challenger), breadcrumb de jogador ativo via query param.

### Desvio consciente do design
O handoff pede uma **timeline interativa** com minimap SVG, heatmap de kills, 768 linhas de eventos posicionais, modal de evento, scrubbing. **Não é viável agora** — o backend só retorna frames progressivos por minuto, não eventos com coordenadas. Placeholder explícito vinculado ao roadmap (Bloco 0 — parsing de eventos do Riot timeline). Quando esse bloco entregar, posso voltar e implementar a timeline completa.

### Build final
```
Route (app)                              Size  First Load JS
├ ƒ /matches/[match_id]                  9.84 kB         191 kB
├ ƒ /players/[puuid]                       10 kB         191 kB
├ ƒ /champions/[champion]                5.71 kB         187 kB
```
- `npm run build` passa 13/13 rotas, `npx tsc --noEmit` limpo
- Smoke test: `/matches/BR1_3229307733` responde HTTP 200

---

## 🎉 Redesign Metis 1.0 — COMPLETO

Em **7 versões** (p-0.9.5 fundação + p-0.9.6 a p-0.9.15 uma tela por versão), o redesign inteiro baseado no handoff do Claude Design foi entregue:

| Versão | Tela | Status |
|--------|------|--------|
| p-0.9.5  | Fundação (tokens + 18 primitives + fontes) | ✅ |
| p-0.9.6  | Home | ✅ |
| p-0.9.7  | Tier List | ✅ |
| p-0.9.8  | Itens | ✅ |
| p-0.9.8.1 | Backend: catálogo de itens (tabela + sync) | ✅ |
| p-0.9.9  | Planos + Cupons (feature nova) | ✅ |
| p-0.9.10 | Changelog | ✅ |
| p-0.9.11 | Team | ✅ |
| p-0.9.12 | Chat Metis + easter egg de cupom | ✅ |
| p-0.9.13 | Player Dashboard | ✅ |
| p-0.9.14 | Champion Page (4 sub-tabs) | ✅ |
| p-0.9.15 | Match Detail (3 tabs) | ✅ |

**O que sobra no design system:** o sistema antigo `--metis-*` + classes tailwind `bg-metis-*` ainda vivem no `globals.css` porque `/admin` e `/auth` não foram migradas (estão fora do handoff). Manter como está — só revisitar se a prioridade mudar.

**Pró-0.10.0**: com o redesign entregue, próximos blocos naturais são (a) Bloco 0 do roadmap analytics (parsing de eventos → destrava timeline interativa + builds filtradas + matchup profundo) ou (b) retomar bloqueios do M2 (Mobafire scraper, process_timelines cron).

---

## p-0.9.14 — Redesign: Champion Page (2026-04-22)

Nona tela do redesign. 4 sub-tabs (Overview / Builds / Matchups / Sinergias) com toda a lógica de filtros preservada (role, server, patch) + detecção de role impopular mantida.

### Frontend — `app/champions/[champion]/page.tsx`
- **Hero banner violet**: portrait 96px com glow violet, título do campeão em Space Grotesk 42px, contagem de partidas no banco, aviso de role impopular quando aplicável, CTA "Perguntar à IA" (link `/chat`) + breadcrumb "← Tier List"
- **Filtros**: 6 pills de role com ícones PNG oficiais + selects de servidor e patch
- **Tabs**: Overview / Builds / Matchups / Sinergias — underline accent, ícones por tab
- **Role impopular**: overlay central alaranjado quando `total_role / total_all < 5%`, grayscale + opacity no conteúdo, pointer-events bloqueado exceto no aviso

### Sub-tab Overview
- **4 KPI cards** (Winrate / KDA / CS/min / DPM) com barras comparativas e labels contextuais
- **Curva de poder** — card placeholder anotando que depende do parsing de eventos de timeline (Bloco 0 do roadmap)
- **Sidebar**: "Insight da Metis" accent card + "Estatísticas adicionais" (Kill partic., Ouro médio, Avg Kills/Deaths)

### Sub-tab Builds
- **Tabela principal**: item (portrait 32px + nome) + Picks (+ bar) + Winrate (+ bar colorida) + Patch
- **Sidebar**: "Build mais comum" (top 6 itens por picks, com setas `→` entre eles) + placeholder de Runas (Bloco 4 do roadmap)

### Sub-tab Matchups
- Tabela 5-col: oponente (ChampPortrait) · partidas · winrate · vs média (diff colorido) · barra de dificuldade centralizada em 50% (verde à direita = fácil, vermelho à esquerda = difícil)
- Labels: "Fácil" (>+5%) / "Neutro" / "Difícil" (<-2%) / "Muito difícil" (<-10%)
- Row é Link pra `/champions/[oponente]`

### Sub-tab Synergies
- Tabela 4-col: aliado · partidas · winrate · barra de sinergia + label (Excelente >60 / Ok >45 / Evitar)
- **Duo sugerido** (card accent sidebar): champ atual + sinergy de maior WR, contador de partidas, CTA de chat

### Dados omitidos (anotados como "em breve")
- **Champion title** ("A Caçadora Noturna") — DDragon tem, mas requer fetch extra. Deixei fora
- **Power curve** — precisa eventos de timeline parsed
- **Ability order** — precisa `SKILL_LEVEL_UP` do parsing
- **Radar do campeão** — precisa endpoint de perfil 8D por campeão (temos só do player)
- **Runas recomendadas** — agregação por campeão ainda não existe

### Verificação
- `npx tsc --noEmit` limpo
- Smoke test: `/champions/Kayn` HTTP 200 · markers "Kayn" (7x), "Overview/Matchups/Sinergias", breadcrumb, CTA IA todos renderizados

### Próxima (última!)
`p-0.9.15` — Match detail + timeline interativa. Fecha o redesign.

---

## p-0.9.13 — Redesign: Player Dashboard (2026-04-22)

Oitava tela do redesign — a mais densa até agora. Toda a lógica preservada (resolve Riot ID, fallback de nomes antigos, sync Riot com cooldown, watched toggle, pagination, 10+ fetches paralelos). Reescrita visual completa com o design system.

### Frontend — `app/players/[puuid]/page.tsx` (~1300 linhas novas)
- **Banner**: avatar quadrado 88px (profile_icon_id da Riot ou fallback com inicial em gradient da cor do tier), nome em Space Grotesk 28px + tag cinza, badge de server, orb circular do tier com nome, histórico de nomes antigos, label de watched
- **Ações**: botão "Supervisionar" (surface com star accent) + "Analisar com IA" (accent filled, link pra `/chat`)
- **Input de apelido** abaixo do banner quando `showLabelInput`, sync row com select de server (quando não conhecido) + botão "Ver partidas novas" com cooldown de 5min countdown + mensagem de feedback
- **4 KPI cards** (grid auto-fit 200px min):
  - Winrate: Donut + WinLossDots das últimas 10 partidas
  - KDA médio: valor + breakdown k/d/a colorido
  - CS/min: valor + barra comparativa
  - Score de visão: valor + barra
- **Winrate cumulativo** (card novo, substitui o LP chart do design — que requer dado de LP que não temos): AreaChart das últimas 20 partidas com delta vs início
- **Tabela de campeões**: Card com filtros no header (season, patch, role), grid 5-col (Campeão, Jogos, WR com W/L, KDA, CS/m), links pra `/champions/[nome]`, "Ver todos" toggle
- **Recomendações Neo-Artemis**: expansível com DualRadar (player vs champion em 8 dimensões), razões inline, confidence colorido por threshold
- **Match history**: Card denso com `MatchRow` inline — linha colorida win/loss, ChampPortrait com role badge, items (6 slots), KDA + KP%, CS + CS/min, level final; link pra `/matches/[id]?as=puuid`; "Carregar mais" com loading dots
- **Sidebar direita**:
  - Season summary (total de partidas + WR global + unique champs)
  - Role distribution com StackedBar + lista de roles com ícones PNG oficiais
  - Perfil de jogo (RadarChart 8 eixos, usa `player_profile` da primeira recomendação)
  - Ask Metis teaser (card accent com CTA `/chat`)
  - Allies (5 primeiros, link pra perfil)
  - Nemeses (5 primeiros, indicador vermelho, lista de champs usados)
- **Not in DB**: bloco especial quando Riot ID não está no banco, com orientação pra sincronizar
- Hover em tudo que é clicável (rows, botões, links)

### Componente legado removido
- `components/matches/MatchCard.tsx` — `MatchRow` agora vive inline na page. `runes.ts` continua pro `/matches/[match_id]` que ainda não foi migrado

### Verificação
- `npx tsc --noEmit` limpo
- Smoke test: `/players/Zaras%230210` responde HTTP 200 com banner completo, botões de ação, Supervisionar/Analisar, nome renderizado 5x
- 10+ fetches em paralelo preservados (history, frequent-allies, nemesis, name-history, recommendations, seasons, patches, champion-stats, watched_players, player lookup)

### Observação sobre o design original
O handoff pede um LP chart com histórico de LP. Não temos endpoint/tabela pra isso hoje; substituí por **winrate cumulativo** das últimas 20 partidas — métrica útil, computável com dados que já temos, e visualmente compatível com o AreaChart.

### Última tela não migrada
`/champions/[champion]` (p-0.9.14) + `/matches/[match_id]` (p-0.9.15 · timeline interativa).

---

## p-0.9.12 — Redesign: Chat Metis + Easter egg de cupom (2026-04-22)

Sétima tela do redesign. Lógica de chat 100% preservada (auth check, gate premium, usage tracking, handling de 429, scroll automático) — só o chrome visual foi reescrito pelo design system.

### Frontend — `app/chat/page.tsx`
- **Token bar compacta no topo**: ícone bolt accent + `X / Y tokens hoje` + bar de progresso (muda cor: accent < 70%, orange >= 70%, red >= 90%) + hora de reset + plano + nick do invocador
- **Gate premium** (quando usuário sem plano): card central com ícone cérebro em glow, headline "Chat com a Metis", explicação do benefício, botões "Ver planos" (accent) e "Voltar" (outline)
- **Thread de mensagens**:
  - Bubble do usuário em accent gold, alinhada direita, `72%` max width
  - Bubble da Metis com avatar cérebro em box accent e border, `92%` max width, `whiteSpace: pre-wrap` pra preservar quebras
  - Indicador de "digitando" durante `loading` com 3 dots animados e mesmo estilo do message
- **Input area**:
  - Textarea com ícone messageCircle + botão send (accent) + `Enter` envia (Shift+Enter faz quebra)
  - Row de 4 quick prompts ("Review minha última derrota", "Quem contra Kayn?", "Como farmar melhor?", "Builds pra ADC") — clicam direto pra enviar
  - Disclaimer final "A Metis só fala de League of Legends..."
- Todos os botões com `m-hover-accent` / `m-hover-surface` adequados

### Componentes legados removidos
- `components/ui/ChatInput.tsx` e `components/ui/ChatMessage.tsx` — inline agora dentro da page, menos indireção
- Nenhum outro arquivo consumia esses componentes, remoção limpa

### Backend — `backend/services/coupon_service.py` (easter egg)
- Campo `code` NÃO é mais retornado em `/api/v1/coupons/public` — cupons visíveis mostram o benefício mas o código fica secreto. A pessoa precisa descobrir/adivinhar pra resgatar.
- Frontend `/pricing` renderiza `? ? ? ? ? ? ?` em mono com borda tracejada + legenda italic "descubra o código" ao lado
- Decisão César, 2026-04-22: engajamento através de mistério — o Modo Mestre de Abril aparece listado mas o código `MESTRE2604` só aparece quando descoberto

### Verificação
- `npx tsc --noEmit` limpo
- `/chat` sem sessão → HTTP 307 pra `/auth` (middleware faz o redirect corretamente)
- Endpoint público de cupons confirmado sem `code` no response

### Telas ainda não migradas
`/players/[puuid]`, `/champions/[champion]`, `/matches/[match_id]` — últimas 3 versões p-0.9.13 → p-0.9.15.

---

## p-0.9.11 — Redesign: Team (2026-04-22)

Sexta tela do redesign. Conteúdo preservado (3 membros com mesmas cores semânticas, títulos, empresas, tags e links); visual inteiramente reescrito pelo design system.

### Frontend — `app/team/page.tsx`
- **Header centralizado**: eyebrow "// Equipe" em accent + h1 Space Grotesk "Quem faz a Metis" com "Metis" em accent
- **3 cards responsivos** (grid `auto-fit minmax(280px)`):
  - Glow radial decorativo na cor do membro (blur 30px)
  - Avatar circular 48px na cor accent do membro com iniciais
  - Nome + título + empresa (quando existe)
  - Tags em chips com borda/fundo na cor do membro
  - Quote em blockquote com barra lateral (quando existe, do César)
  - Botão de link (Portfolio/LinkedIn) com hover outline
- **Stats footer**: 4 cards grid (Dias construindo / Commits / Linhas / Cafés) usando `Stat` primitive — accent cyan e gold em 2 deles
- Cores preservadas: César gold `#F5C842`, Enzo vermelho `#F87171`, André verde `#4ADE80`

---

## p-0.9.10 — Redesign: Changelog (2026-04-22)

Quinta tela do redesign. Timeline vertical com spine + nodes + cards de entries coloridos por tag.

### Frontend — `app/changelog/page.tsx`
- **Header**: eyebrow "Novidades" + h1 Space Grotesk "O que é novo?"
- **Timeline vertical** com spine de 2px, nodes circulares no lado esquerdo, node do current release em gold com glow radial
- **Por release**:
  - Header com `h2` da versão + pill "ATUAL" quando apropriado + data alinhada à direita
  - Label destaque (ex: "Big Update", "Security Update") em card violet com tag BIG UPDATE
  - Box de entries com tags coloridas por tipo: `BIG UPDATE` (violet), `NOVO` (green), `MELHORIA` (accent), `FIX` (blue)
- **Conteúdo atualizado**: adicionei as entries p-0.9.5 → p-0.9.9 (todo o redesign), preservei as entries históricas (p-0.9.0 em diante)
- **Footer** com link pra `/chat` pra reportar bugs

### Tags & cores
| Tag | Cor | Uso |
|-----|-----|-----|
| `BIG UPDATE` | violet | Mudanças estruturais (redesign, infra, segurança) |
| `NOVO` | green | Feature nova |
| `MELHORIA` | accent (segue switcher) | Feature existente melhorada |
| `FIX` | blue | Bug resolvido |

### Verificação (ambas)
- `npx tsc --noEmit` limpo
- `/changelog` HTTP 200 · 17 labels "BIG UPDATE" renderizadas · timeline completa
- `/team` HTTP 200 · 3 membros + stats footer + botões de link

### Telas ainda não migradas
`/chat`, `/players/[puuid]`, `/champions/[champion]`, `/matches/[match_id]` — p-0.9.12 → p-0.9.15.

---

## p-0.9.9 — Redesign: Planos + Cupons (2026-04-22)

Quarta tela do redesign + feature nova: **sistema de cupons** (tabela no Supabase + endpoint + UI).

### Database — `database/migrations/002_create_coupons_table.sql`
- Nova tabela `coupons` com: `code` (PK), `title`, `description`, `effect` (JSONB flexível), `valid_from/until`, `max_uses` + `uses_count`, `public_list`, `active`, `created_at`
- Índice parcial em `valid_until` pra cupons listáveis
- **RLS**: `coupons_public_select` pra leitura pública filtrando `public_list AND active AND valid_until > now()`. Writes só via service_role
- **Seed de teste**: `MESTRE2604 — Modo Mestre de Abril` (Premium com 10k tokens/dia até 30/04, max 100 usos)

### Backend — `backend/services/coupon_service.py` + `backend/api/routes/coupon.py`
- `GET /api/v1/coupons/public` retorna cupons visíveis (public_list, active, não expirados, com usos disponíveis)
- Filtro adicional em Python pra `uses_count < max_uses` (a RLS simples não cobre bem)
- Registrado no `main.py` junto dos outros routers
- Resgate (mutation) fica pra versão futura — por ora só listagem

### Frontend — `app/pricing/page.tsx` (reescrito)
- **Header** com badge "Planos Metis", headline `Suba de Elo no Metis` (accent em "Metis"), toggle mensal/anual dentro de pill container
- **4 tier cards** responsivos com orb circular em glow radial na cor do tier, diamante interno, nome + rank em caps, preço R$ grande em Space Grotesk, CTA com hover adequado (accent pra pago, surface pro Free). Card do Premium com glow e badge "Mais popular"
- **Seção "Cupons disponíveis"** (só aparece se a API retornar cupons): card com icon de medalha, código em `font-mono` estilizado, título, descrição, validade formatada em pt-BR, contador de "N restantes" quando `max_uses` definido
- **Footer de trust** (3 cards): Cancele quando quiser / Ativação imediata / IA atualizada — novo, do handoff
- **Preservados do visual antigo reestilizados**: Comparativo tabular, FAQ (5 perguntas), Card "Para Times e Empresas" com CTA mailto
- Período `yearly` calcula preço anual com 20% OFF (`price * 12 * 0.8`)

### Validação
- Migration aplicada via MCP — RLS + índices confirmados
- Cupom de teste inserido e retornando no endpoint: `GET /api/v1/coupons/public` responde com `[{ code, title, description, effect, valid_until, max_uses, uses_count }]`
- Frontend SSR de `/pricing` responde HTTP 200 (63KB), markers "Planos Metis", "Mais popular", "Comparativo", "Para Times" todos presentes
- Cupons aparecem após hidratação client-side (fetch via `apiFetch`)
- `tsc --noEmit` limpo

### Fora de escopo (combinado antes)
- Checkout/pagamento — botões continuam "decorativos"
- Aplicar efeito do cupom no user_metadata via fluxo de resgate
- Admin UI pra criar cupons — por ora inserção via SQL

### Operacional
Pra adicionar um cupom novo, César roda SQL tipo:
```sql
INSERT INTO coupons (code, title, description, effect, valid_until, public_list)
VALUES ('SEUCUPOM', 'Nome', 'Descrição...',
        '{"tier":"premium","tokens_per_day":5000}'::jsonb,
        '2026-05-31 23:59:59-03', true);
```

### Telas ainda não migradas
`/changelog`, `/team`, `/chat`, `/players/[puuid]`, `/champions/[champion]`, `/matches/[match_id]` — próximas versões p-0.9.10 → p-0.9.15.

---

## p-0.9.8.1 — Backend: Enriquecer catálogo de itens (2026-04-22)

Patch cirúrgico antes da p-0.9.9. Introduz a tabela `items` no Supabase como fonte de verdade pro catálogo (nome/gold/tags/categoria/tendência), removendo a dependência do JSON estático em runtime. Frontend `/items` consome os novos campos.

### Database — `database/migrations/001_create_items_table.sql`
- **Nova tabela `items`** com: `item_id` (PK), `name`, `gold_total/base/sell`, `purchasable`, `tags` (jsonb), `plaintext`, `category` (nullable · curadoria manual), `trend` (nullable · 'up'/'down'/'flat'), `updated_at`
- Índice parcial em `category` (só rows populadas) e GIN em `tags`
- RLS: `items_select_public` pra leitura pública; writes só via service_role
- 688 itens populados via sync inicial (patch 16.4.1 do Data Dragon)

### Scripts — `scripts/processing/sync_items.py` (novo)
- Lê `data/static/item.json` e faz upsert em lote (batch default 200) na tabela `items`
- **Não toca** `category` nem `trend` no upsert — preserva curadoria manual/cálculos futuros
- Rodável via `python -m scripts.processing.sync_items` ou CI agendado
- Idempotente via `on_conflict=item_id`

### Backend — `backend/services/item_service.py`
- **Removido** `_load_item_dict` que lia `item.json` estático em runtime
- **Novo** `_load_items_catalog(db)` que query tabela `items` via supabase-py
- `buscar_item_ranking` agora retorna campos adicionais: `gold_cost`, `tags`, `category`, `trend` (None até populado/calculado)
- Assinatura pública do endpoint `/api/v1/items/ranking` retrocompatível (campos só adicionados)

### Frontend — `app/items/page.tsx`
- Tabela ganhou 2 colunas: **Categoria** (pill escuro ou `—` quando NULL) e **Custo** (`1100g` em accent) e **Tendência** (`▲ em alta` / `▼ em queda` / `━ estável` / `—`)
- **Tags** agora aparecem como chips pequenos abaixo do nome do item (top 3 + contador `+N`)
- Spotlights também mostram custo em gold
- Type `ItemStat` atualizado (campos opcionais pra ficar retrocompatível com qualquer consumidor que não recarregue)

### Verificação
- Migration aplicada via Supabase MCP (`apply_migration`) — 11 colunas + RLS + índices confirmados
- Sync popularmente concluído: 688 rows upserted em ~3s
- Spot check: `Lâmina de Doran` (1055) tem `gold_total=450, tags=[Health, Damage, LifeSteal, SpellVamp, Lane]`
- Endpoint `/api/v1/items/ranking` responde 200 com os 4 novos campos
- `tsc --noEmit` + `npm run build` limpos
- Dev server em 8002 + frontend em 3000 (ajuste temporário de `NEXT_PUBLIC_API_URL` devido a sockets zombies na 8000)

### TODO futuro
- Script de cálculo de `trend` (delta WR entre patches) — fica pra quando o backlog de analytics profundo virar prioridade
- Curadoria de `category` — César popula `Lendário / Botas / Inicial / Utilitário / Consumível / Lenda-Jungle / etc` quando quiser

---

## p-0.9.8 — Redesign: Itens (2026-04-22)

Terceira tela do redesign. Lógica de filtros preservada (role, patch, busca client-side, sort picks/winrate); visual redesenhado com 2 spotlights computados client-side + tabela densa.

### Frontend — `app/items/page.tsx`
- **Title block**: subtítulo dinâmico `patch X · Banco Metis`, headline `Estatísticas de Itens`, contador de itens no recorte
- **Spotlight duplo** (grid `auto-fit minmax(420px, 1fr)`):
  - Card **"Mais comprados"**: top 3 itens por `picks` com rank gold + ícone 44px + total de picks
  - Card **"Top winrate (min 10 picks)"**: top 3 itens por `winrate` filtrando amostra pequena, rank verde + WR destacado
- **Filter bar em Card único**: busca + 6 pills de role (ícones oficiais) + select de patch + pills de sort (Popular / Winrate)
- **Tabela em Card**: grid 5 colunas (# / Item / Picks+bar / Winrate+bar / Vitórias) com hover row, cores semânticas no WR (>52 verde, >48 neutro, senão vermelho)
- **Empty states**: loading dots, erro, "nenhum item encontrado"

### O que NÃO entrou (API não fornece ainda)
Categoria, custo em gold, tags e tendência (up/down/flat) do design original foram omitidos — não estão no endpoint `/api/v1/items/ranking`. Quando entrarem (provavelmente no Bloco 2 do roadmap de analytics profundo), volto e completo a página.

### Verificação
- `npx tsc --noEmit` limpo
- Smoke test: `/items` responde HTTP 200 com `.metis-scope`, h1 "Estatísticas de Itens", 25KB SSR

---

## p-0.9.7 — Redesign: Tier List (2026-04-22)

Segunda tela do redesign. Toda a lógica de filtros da versão antiga preservada (patch range, server, elo, role, busca, toggle impopulares). Visual completamente reescrito pra casar com o design do handoff (`screen-tierlist.jsx`).

### Frontend — `app/champions/page.tsx`
- **Title block**: subtítulo dinâmico com `patch · elo · região`, headline `Tier List` em Space Grotesk, contador de partidas real do recorte, pill de toggle "Campeões populares / Ocultar impopulares"
- **Barra de filtros em 2 linhas** (dentro de um Card unificado):
  - Linha 1: busca + 6 pills de role (ícones PNG oficiais) + select de servidor + patch range (inicial → final)
  - Linha 2: row de 11 pills de elo com emblemas Riot (Todos → Challenger), ainda com aviso "filtro em breve" quando algum é selecionado
- **Agrupamento por tier** (S+/S/A/B/C) substituindo a StatsTable única:
  - Badge gigante do tier à esquerda (72px) com cor semântica (gold/orange/green/blue/muted)
  - Grid responsivo à direita (`repeat(auto-fill, minmax(260px, 1fr))`) com cards de campeão
  - Cada card: `ChampPortrait` 48px com badge de role (PNG oficial) + nome + role_label + WR% grande + bar de WR + pickrate + grid KDA/Ban/Games
  - Cards são `<Link>` pra `/champions/[champion]` com hover (`m-hover-card`)
- **Empty states**: loading dots, erro, "nenhum campeão com os filtros atuais" com link pra mostrar impopulares
- **Deriva tier local** quando a API não retorna (com thresholds: 54/52/50/48)

### StatsTable legada
`components/stats/StatsTable.tsx` ainda existe mas não é mais consumida. Será removida quando o Player dashboard (p-0.9.13) também parar de depender dela — por ora, mantém pra não quebrar nada.

### Verificação
- `npx tsc --noEmit` limpo
- Smoke test: `/champions` responde HTTP 200 com `.metis-scope`, h1 "Tier List", filtros completos, 33KB SSR (cards renderizam após fetch client-side)

---

## p-0.9.6 — Redesign: Home + Ajustes do Design System (2026-04-22)

Primeira tela do redesign consumindo a fundação p-0.9.5. Lógica de dados 100% preservada (Supabase auth, watched_players, autocomplete debounced, tierlist via API); só o chrome visual foi reescrito. Rodada também incluiu refinamentos no design system que afetam todas as próximas telas.

### Frontend — `app/page.tsx`
- **Hero novo**: badge "Patch X.Y · ao vivo" (do endpoint `/api/v1/stats/patches`), headline `Space Grotesk 52px` com accent, search + servidor (9 regiões) + botão Analisar com hover, suggestions inline com autocomplete, strip de 4 stats (`Partidas analisadas`, `Jogadores mapeados`, `Chat IA`, `Status`) puxando counts reais do Supabase via `count:exact, head:true`, decorativos em blur (radial gradient gold + cyan)
- **Main grid 2-col (2fr : 1fr)**:
  - Esquerda: Card **Destaques do meta** (top 3 campeões em spotlight com `min_matches=10` pra evitar 100% WR de sample pequeno) + Card **Tier list · top 8 com filtro de role** (pills Todos/Top/Jungle/Mid/ADC/Sup usando ícones oficiais da Riot, pool de 60 campeões pra filtrar sem refetch)
  - Direita: Card **Em supervisão** (watched_players, gated para login com CTA `/auth`) + Card **Pergunte à Metis** (accent glow, 3 prompt buttons → `/chat`) + Card **Novidades recentes** (últimas 4 entradas do changelog inline)
- **Links reais** pra `/champions/[champion]` em cada card do spotlight e da tier list

### Design system — ajustes que afetam todas as telas do redesign
- **AppHeader com auth real**: botão "Entrar →" (hover outline em accent) quando deslogado, avatar circular com inicial do email quando logado (link pra `/admin`); auto-descobre via `supabase.auth.getUser()` + escuta `onAuthStateChange`
- **ThemeSwitcher mantido** no AppHeader — 5 cores de accent (azul/roxo/verde/vermelho/dourado), persiste em localStorage e em `user_metadata` do Supabase
- **Modo claro removido**: o redesign é dark-only por design. `ThemeProvider` simplificado (só `color`, sem `mode`), `[data-mode="light"]` e derivados tirados do `globals.css`, script inline do layout não seta mais `data-mode`
- **`--m-accent` segue o switcher**: expõe `--m-accent-rgb` pra uso em `rgb(var(--m-accent-rgb) / 0.x)` em backgrounds translúcidos. Glows decorativos e tier badge S+ continuam gold fixo (intencional — convenções universais)
- **Ícones oficiais de role**: `ChampPortrait` agora renderiza PNGs `/roles/position-*.png` da Riot em vez do SVG inline `RoleGlyph` (que continua disponível pra uso fora de portraits)
- **Hover utilities**: 6 classes no `globals.css` (`m-hover-accent`, `m-hover-surface`, `m-hover-outline`, `m-hover-row`, `m-hover-card`, `m-hover-link`) pra compensar ausência de `:hover` em style inline — aplicadas em todos os botões/linhas/links clicáveis

### Verificação
- `npm run build` passa (13/13 rotas)
- `npx tsc --noEmit` limpo
- Smoke test em `npm run dev`: HTTP 200, SSR renderiza `.metis-scope`, fontes carregam, hero + spotlight + watched + switcher + auth state todos funcionando

### Telas ainda não migradas
`/champions`, `/items`, `/pricing`, `/changelog`, `/team`, `/chat`, `/players/[puuid]`, `/champions/[champion]`, `/matches/[match_id]` continuam no visual antigo — chegam nas próximas versões p-0.9.7 → p-0.9.15.

---

## p-0.9.5 — Redesign: Fundação (2026-04-22)

Ponto de partida do redesign baseado no handoff do Claude Design (10 telas). Esta versão é **fundação apenas** — nenhuma página muda ainda. As próximas versões (p-0.9.6 → p-0.9.15) consomem o novo sistema, uma tela por versão.

### Frontend
- **Novo sistema de tokens** em `globals.css` (`--m-bg`, `--m-accent` gold LoL, `--m-cyan`, `--m-violet`, etc.) isolado dentro de `.metis-scope` — coexiste com o sistema antigo `--metis-*` sem conflito
- **Fontes adicionais**: Space Grotesk (display) e JetBrains Mono (tabular/code) expostas como CSS variables via `next/font/google`. Inter passou a ser CSS variable também
- **Helpers CSS**: `.metis-scope`, `.font-display`, `.font-mono`, `.tabular`, `.metis-grid-bg`

### components/design/ (novo) — design system portado do handoff
- **Primitives**: `Card`, `SectionLabel`, `Pill`, `Stat`, `Bar`, `WinLossDots`, `Sparkline`, `Donut`, `StackedBar`
- **Charts**: `AreaChart` (progressão LP), `RadarChart` (perfil de jogo/campeão)
- **Game-specific**: `ChampPortrait` (via Data Dragon), `RoleGlyph`, `TierBadge`, `RankBadge`
- **Chrome**: `AppHeader` (nav com 5 itens + CTA Chat), `Logo`, `Icon` (~40 glyphs inline estilo Lucide — sem custo de bundle adicional)
- **Tokens TS**: `TIER_COLORS`, `ROLES_PT`, `RANK_COLORS`, `PILL_COLORS` em `tokens.ts`
- **Barrel export** `components/design/index.ts`

### Verificação
- `npx tsc --noEmit` limpo
- `npm run build` passa (13/13 rotas, sem warnings novos)
- Todas as páginas existentes continuam renderizando idêntico — os novos tokens só ativam dentro de `.metis-scope`

### Próxima versão
`p-0.9.6` — Home redesign (primeira tela a consumir `.metis-scope` + primitives)

---

## p-0.9.4 — Bronze HTML Guides + Bug Fix Playwright (2026-04-20)

### Scripts
- **BUG FIX `fetch_guides.py`**: `'/build/'` → `'/builds/'` em `get_elite_guide_urls` — bug silencioso que fazia o scraper retornar `[]` para todos os campeões e nunca scrapeava nada
- **Bronze HTML**: `scrape_mobafire_guide` agora salva o HTML cru em `guides/html/{champion}_{url_slug}.html.gz` no R2 imediatamente após `page.content()`, antes de qualquer parsing (arquitetura medalhão correta)
- **Idempotência R2**: checa se `guides/html/{file_name}.html.gz` já existe no R2 antes de abrir o browser para aquela URL — evita re-scraping em runs futuras
- **`_build_file_name()`**: nova função auxiliar que gera nome de arquivo seguro a partir do campeão + slug final da URL (em vez de depender do nome do autor antes de parsear)

### r2_storage.py
- `check_html_exists(s3_client, folder, file_name)` — head_object em `.html.gz`
- `compress_and_upload_html(html_str, folder, file_name, s3_client)` — gzip de HTML string + upload

### CI/CD
- **`fetch_guides.yml`**: schedule alterado de `*/3 * *` (a cada 3 dias) para `* * 1` (toda segunda-feira às 04:00 UTC)

---

## p-0.9.3 — Filtro de Impopulares, Compressao, Admin Refresh, ETL Invertido (2026-04-14)

### Banco de Dados
- **Coluna `challenges` JSONB removida** do `match_participants` — economiza ~15 MB (54% da tabela)
- Campos uteis ja extraidos em colunas proprias: `solo_kills`, `damage_per_minute`, `kill_participation`, `early_laning_phase_gold_exp_advantage`
- Tamanho por partida nova: ~57 KB (era ~80 KB) — **28% menor**
- Partidas por GB: ~18.000 (era ~13.000)

### Backend
- **`POST /api/v1/admin/refresh-cache`** — invalida o cache da tier list manualmente
- `recommendation_service.py` atualizado pra ler colunas diretas em vez do challenges JSONB

### Frontend — Tier List
- **Filtro de impopulares**: por padrao mostra so campeoes com >=30 partidas E >=5% pickrate na role
- **Toggle "Ver impopulares"** pra mostrar os que ficaram fora

### Frontend — Pagina de Campeao
- **Role impopular cinza**: se o campeao tem <5% das partidas naquela role, todo o conteudo fica cinza + grayscale com aviso

### Frontend — Admin
- **Botao "Atualizar Tier List"** no painel admin — limpa cache de 24h

### Scripts
- **ETL invertido**: processa do mais recente pro mais antigo (ordena por LastModified DESC)
- **`--refresh-cache`** flag no `local_etl.py` — invalida cache do backend apos processar

---

## p-0.9.2 — Bans, Pickrate, Banrate, ETL Local (2026-04-14)

### Banco de Dados
- **Coluna `bans` JSONB** na tabela `matches` — armazena bans de ambos os times (team_id, champion_name, champion_id, pick_turn)
- **View `champion_ban_stats`** — agregacao de bans por campeao pra queries rapidas
- **Index GIN** na coluna bans pra performance

### Backend
- **Extracao de bans** no `riot_service.py` — parseia `info.teams[].bans` usando mapa estatico `champion.json` (172 campeoes)
- **Pickrate** na tierlist — `total_matches / total_unique_matches * 100` por campeao+role
- **Banrate** na tierlist — `ban_count / total_unique_matches * 100` por campeao
- **KDA** calculado no backend — `(kills + assists) / max(deaths, 0.1)`
- **Cache 24h** nas queries de tierlist e patches (in-memory com TTL)

### Frontend — Tier List
- **Colunas atualizadas**: Tier, Winrate, Pickrate, Banrate, KDA, Partidas
- **Auto-seleciona patch mais recente** ao abrir (home e tier list)
- **Banrate** mostra `—` quando nao ha dados de ban (partidas antigas)

### Frontend — Match Detail
- **Secao de bans** acima das tabs — icones dos campeoes banidos em grayscale (Azul vs Vermelho)

### Scripts
- **`scripts/local_etl.py`** — script pra rodar limpeza de partidas localmente no PC
  - `python scripts/local_etl.py --count 50 --skip-existing`
  - Baixa do R2, processa (Bronze → Prata) e envia pro Supabase

---

## p-0.9.1 — Tier por Role, Auto-Patch (2026-04-14)

### Backend
- **Tier badges POR ROLE** — agrupamento por (champion, role), percentil calculado dentro de cada role
- Viktor Mid pode ser S+ enquanto Viktor Top e B
- **Cache 24h** na tierlist e patches

### Frontend
- **Role icon + label** na tabela da tier list ao lado do nome do campeao
- **Auto-seleciona patch mais recente** como filtro padrao ao abrir

---

## p-0.9.0 — Guardrail LoL, Token Limits, Chat Seguro (2026-04-14)

### Backend — Chat
- **Guardrail real** — classificador LLM (~88 tokens) verifica se a mensagem e sobre LoL ANTES de gerar resposta
- Se off-topic: rejeita imediatamente sem gastar tokens da resposta completa
- **Personalidade Metis**: calma, analitica, nunca toxica, transforma derrotas em aprendizado, nunca fala de receitas/politica/etc
- **Limites de tokens por tier**: Doador 5k, Premium 30k, Pro 100k tokens/dia — reset meia-noite UTC
- **Contagem de tokens real** via `usage_metadata` do Gemini
- **Autenticacao por usuario**: chat exige `supabase_token` — sem login = 401, tier free = 403
- **Endpoint `/api/v1/chat/usage`** — retorna uso de tokens atual do usuario

### Frontend — Chat
- **Barra de uso de tokens** no topo do chat (verde → amber 70% → vermelho 90%)
- Input desabilitado ao atingir 100% do limite
- Gate atualizado: redireciona pra `/pricing` em vez de texto generico

### Seguranca (v0.8.2)
- **API key middleware** (`X-API-Key`) em todos os endpoints exceto /health
- **Erros sanitizados** — mensagens genericas pro cliente, detalhes so no log
- **CORS restrito** — GET/POST/OPTIONS + headers especificos
- **Gemini key segura** — configurada no SDK init, nunca armazenada no objeto
- **.gitignore reforçado** — `.env*`, `*.key`, `*.pem`

### Outras (v0.8.1, v0.8.3)
- **Recomendacoes 8D** (modelo Neo-Artemis) com radar chart expandivel
- **Mapa completo de runas** (~70 runas, todas as arvores + stat shards)
- **Gemini 2.5 Flash** como modelo padrao (migrado de google-generativeai pra google-genai SDK)
- **Conta Pro** `puczaras@metis.gg` setada no Supabase

---

## v0.8.0 — Mega Update: Header, Tier List, Player Page, Match Detail, Itens, IA, Pricing (2026-04-14)

### Frontend — Infraestrutura
- **Header compartilhado** (`Header.tsx`): extraido de 9 paginas, logo Metis clicavel em todas as telas, removido botao "Inicio"
- **Barra superior** maior (py-4, text-sm, icones w-4), botoes maiores
- **Light mode** melhorado: text-dim mais escuro, bordas mais visiveis
- **Cor S+ gold** (amber-400) nos tier badges

### Frontend — Tier List
- **Tier badges** (S+/S/A/B/C/D) calculados por percentil dinamico no backend
- **Tabela simplificada**: #, Campeao, Tier, Winrate, Partidas, KDA, DPM
- **Dropdown de patch** (busca patches reais do banco via `GET /api/v1/stats/patches`)
- **Range de patch** com dois selects (patch inicial + patch final)
- **Emblemas de elo** maiores com scale por elo (zoom 4.5x, overflow hidden)
- **Labels claros**: "Todas as Roles", "Todas as Regioes"

### Frontend — Pagina de Campeao
- **Dropdown de patch** substituiu input livre
- **Winrate normalizado** nos matchups (coluna "vs Media")

### Frontend — Player Page
- **Busca inteligente**: input unico `Nick#Tag` na home
- **Autocomplete** com debounce 300ms, icone do jogador, servidor, nome antigo
- **Seletor de servidor** na busca
- **Layout expandido** (max-w-7xl), grid 2 colunas (sidebar 380px + historico)
- **2 resumos lado a lado**: ultimas 20 partidas + temporada completa
- **Campeoes jogados** com filtros: temporada (S1/S2/S3-2026), patch, role
- **Melhor campeao** da temporada destacado acima da tabela
- **Jogou recentemente com**: aliados com >=2 jogos, W/D, icone circular, "ver todos"
- **Nemesis**: oponentes >=2x, campeoes usados, "ver todos"
- **Recomendacoes de campeao por lane** via similaridade de cosseno (Diana JG != Diana Mid)
- **Nomes antigos**: historico de nicks detectado no sync, redirect por nome antigo
- **Badge de elo** ao lado do nick, PUUID escondido
- **Supervisao**: icone do jogador + nome (sem PUUID) na home

### Frontend — Match Page
- **Layout 85%** da tela
- **Ordenacao por role** (TOP > JG > MID > ADC > SUP) sempre
- **Metis Score** por role (pesos variam: ADC pesa mais dano, SUP pesa mais visao)
- **Cores de elo** no Metis Score: gradient 2 tons (Iron stone+cinza, GM vermelho+metalico, Challenger ciano+dourado)
- **3 tabs**: Scoreboard, Analise de Equipe, Build
- **Tab Analise de Equipe**: donut charts SVG (kills, gold, dano, visao, CS) + barras por jogador
- **Tab Build**: items com ordem (1o-6o + trinket), summoner spells com nome PT-BR, runas completas (primaria + secundaria com cores de arvore)

### Frontend — Itens
- **Nova pagina `/items`** com tabela de itens: icone, nome, picks, winrate
- **Filtros**: busca por nome, role, patch, ordenacao por popularidade ou winrate
- **Link "Itens"** no header

### Frontend — Pricing
- **Nova pagina `/pricing`** com 4 tiers: Free (Silver), Doador (Emerald), Premium (Master), Pro (Challenger)
- **Emblemas de elo** no topo de cada card
- **Toggle mensal/anual** (20% off)
- **Tabela comparativa** de beneficios
- **FAQ** com 5 perguntas
- **Link "Planos"** no header

### Backend — Novos Endpoints
- `GET /api/v1/stats/patches` — patches disponiveis no banco
- `GET /api/v1/stats/tierlist` — agora aceita `patches` (comma-separated) e retorna `tier`
- `GET /api/v1/player/search` — busca por nome atual e antigo, com "formerly"
- `GET /api/v1/player/name-history` — historico de nomes
- `GET /api/v1/player/seasons` — temporadas disponiveis
- `GET /api/v1/player/champion-stats` — filtros: role, patch, season
- `GET /api/v1/player/frequent-allies` — aliados com >=N jogos juntos
- `GET /api/v1/player/nemesis` — oponentes enfrentados >=N vezes
- `GET /api/v1/player/recommendations` — recomendacoes por lane com reasons
- `GET /api/v1/items/ranking` — ranking global de itens com winrate
- `POST /api/v1/chat` — agora usa LLM real (Gemini Flash Lite ou Ollama)

### Backend — Servicos Novos
- `llm_adapter.py` — adapter multi-LLM: GeminiAdapter + OllamaAdapter + system prompt Metis
- `player_service.py` — champion-stats, frequent-allies, nemesis
- `recommendation_service.py` — recomendacoes por lane via similaridade de cosseno 6D
- `item_service.py` — ranking de itens agregado de match_participants

### Banco de Dados (Supabase)
- **`player_name_history`** — historico de nomes (puuid, old_game_name, old_tag_line, changed_at)
- **`user_riot_accounts`** — vinculo conta Riot <-> usuario Metis
- **`subscriptions`** — plano (free/donor/premium/pro), status, pagamento, vencimento
- **`payment_history`** — historico de pagamentos
- **`user_badges`** — badges publicas no perfil
- **Deteccao automatica** de mudanca de nome no sync

### Dependencias
- `google-generativeai` instalado para Gemini Flash Lite

---

## v0.7.2 — process_timelines com eventos completos + fix Mobafire CI (2026-04-03)

### Scripts — process_timelines.py
- `extrair_dados_timeline()` agora extrai dados completos por tipo de evento:
  - **CHAMPION_KILL:** `secondary_participant_id` (PUUID da vítima via `victimId`) + `assisting_participant_ids` (array de PUUIDs dos assistentes)
  - **ELITE_MONSTER_KILL:** `details` JSONB com `monsterType` e `monsterSubType`
  - **BUILDING_KILL:** `details` JSONB com `buildingType`, `laneType`, `towerType` e `teamId`
- Migration: colunas `secondary_participant_id TEXT`, `assisting_participant_ids TEXT[]`, `details JSONB` adicionadas à tabela `critical_events` (nullable — compatível com timelines já processadas)

### Scripts — fetch_guides.py + fetch_guides.yml (Mobafire)
- **BUG-015 resolvido:** `fetch_guides.yml` referenciava `secrets.CLOUDFLARE_R2_ACCOUNT_ID` (inexistente) — o correto é `secrets.R2_ACCOUNT_ID`, alinhado com todos os outros workflows do projeto. R2 client nunca conectava em CI.
- `CLOUDFLARE_R2_BUCKET_NAME` hardcoded como `"metis"` (igual ao `process_matches.yml`) — remove dependência de secret desnecessário.
- **BUG-016 resolvido:** `chromium.launch()` sem `--no-sandbox` crashava silenciosamente no container Ubuntu do GitHub Actions. Adicionado `args=["--no-sandbox", "--disable-dev-shm-usage"]` quando `headless=True`. Adicionados `viewport` e `locale` ao contexto para reduzir detecção de headless pelo Mobafire.

---

## v0.7.1 — Bugfixes: ordenação do histórico + data real de partida (2026-04-03)

### Backend
- **BUG-013 resolvido:** `GET /api/v1/player/history` ordenava por `matches.created_at` (timestamp de inserção no Supabase) — partidas mais antigas synced primeiro ficavam no topo. Corrigido para ordenar por `match_participants.match_id desc` (coluna direta, sem foreign_table — PostgREST não respeitava o order no join).
- **BUG-014 resolvido:** `'NoneType' object has no attribute 'data'` no sync — `execute()` do Supabase retornava `None` em `_match_exists()` e no check de cooldown. Adicionados null guards (`if clean and clean.data`).
- **Migration:** `game_end_timestamp BIGINT` adicionado à tabela `matches` para armazenar o timestamp real do fim da partida (epoch ms da Riot API).
- `riot_service.py` popula `game_end_timestamp` com `info.gameEndTimestamp` em `_processar_e_salvar`.

### Frontend
- **`MatchCard`** usa `game_end_timestamp` no lugar de `created_at` para o label de data relativa ("há 2h", "há 3 dias"). Partidas antigas sem o campo mostram `—`.

---

## v0.7.0 — Endpoints de Campeão + Página de Campeão + Fix de ícones (2026-04-03)

### Backend
- **`GET /api/v1/champion/{champion}/overview`** — stats médias do campeão (winrate, KDA, DPM, CS/m, KP, gold) com filtros role/server/patch/min_matches; retorna `stats=null` sem 404 quando há dados insuficientes
- **`GET /api/v1/champion/{champion}/builds`** — itens mais frequentes via view `champion_item_stats`, ordenados por pick_count; filtros patch/min_picks
- **`GET /api/v1/champion/{champion}/matchups`** — winrate do campeão contra cada oponente na mesma lane (2 queries + agregação Python); filtros role/patch/min_matches
- **`GET /api/v1/champion/{champion}/synergies`** — winrate com aliados na mesma partida; mesma estratégia do matchups; exclui auto-sinergia
- Arquivos novos: `backend/api/routes/champion.py` + `backend/services/champion_service.py`
- Router registrado em `backend/main.py`
- Testes: `tests/test_champion_api.py` — 18 testes cobrindo os 4 endpoints

### Frontend
- **`/champions/[champion]`** — página de campeão com tabs Overview / Builds / Matchups / Sinergias; filtros globais role/server/patch; ícone via DDragon CDN; fetch paralelo dos 4 endpoints
- **`StatsTable`** — nome do campeão na Tier List agora é link clicável para `/champions/{champion}`
- **`MatchCard`** — botão "Campeão" (BarChart2) adicionado nos botões laterais → `/champions/{champion_name}`

### Bugfix
- Ícones de role e elo (Tier List) estavam sendo servidos como arquivos stub de 111–162 bytes; substituídos por assets reais baixados do CommunityDragon CDN

---

## v0.6.7 — Bugfix: API travando + maybe_single() + ícone Zaras (2026-04-03)

### Backend — riot_service.py
- **BUG-009 resolvido:** rotas `/sync` e `/update-history` trocadas de `async def` para `def` — FastAPI passa para thread pool, event loop não trava durante sync (era 60s+ bloqueado)
- **BUG-010 resolvido:** cooldown check em `atualizar_historico` trocou `.maybe_single()` por `.limit(1).order(last_synced_at)` — evita 406 quando há múltiplos registros com o mesmo Riot ID
- **BUG-011 resolvido:** `_match_exists()` trocou `.maybe_single()` por `.limit(1)` nas tabelas `matches` e `matches_dirty` — evita NoneType crash em caso de 406

### Banco — Zaras#0210
- **Ícone populado:** `profile_icon_id = 7` (era null), agora `/players/Zaras%230210` exibe o avatar corretamente
- **Diagnóstico de PUUID duplicado** (BUG-012): dois registros — `BgAPcGAE...` (legítimo, BR1) e `dtGYQZ8cj4D...` (fantasma, sem server). Pendente aval para limpeza.

### Diagnóstico do sistema (checagem completa)
- Backend: ✅ UP · Tierlist: ✅ 58 campeões · Admin endpoint: ✅ estruturalmente OK
- Banco: 308 players, 37 matches, 370 participants, 2 dirty, 0 timelines (histórico pré-feature)
- Últimas 15 partidas do Zaras são Arena (queue 1700) — filtradas corretamente por `wrong_queue`

---

## v0.6.6 — Rate Limit de Sync + Painel Admin (2026-04-03)

### Backend
- **`SyncCooldownError`** em `riot_service.py` — cooldown de 5 min por jogador (verificado por `game_name + tag_line` antes de chamar a Riot API); `last_synced_at` gravado no upsert de `players`
- **`GET /api/v1/admin/stats`** — novo endpoint protegido; valida JWT via `supabase.auth.get_user(token)`, exige `app_metadata.is_admin = true`; retorna: `players_total`, `matches_clean`, `matches_dirty_total`, `matches_dirty_by_reason`, `participants_total`, `timelines_saved`, `synced_last_24h`, `synced_last_7d`
- `player.py` — captura `SyncCooldownError` nos endpoints `/sync` e `/update-history`, retorna HTTP 429 com `{ retry_after_seconds }`

### Banco de dados
- **Coluna `last_synced_at TIMESTAMPTZ`** adicionada em `players` (migration `add_last_synced_at_to_players`)
- **Usuário admin** criado: `admin@metis.gg` / `nimda`, `app_metadata.is_admin = true`

### Frontend
- **`/admin`** — dashboard protegido (requer sessão via middleware + `is_admin` no componente): 8 cards de stats, breakdown de dirty matches com barras de proporção, botão de logout
- **`/auth`** — campo email aceita `"admin"` e mapeia silenciosamente para `admin@metis.gg`
- **`/players/[puuid]`** — botão "Ver partidas novas" exibe countdown reativo (`2m 47s`), desabilitado durante cooldown; cooldown persiste em `localStorage` entre reloads; ativado tanto após sync bem-sucedido quanto em resposta a 429 do backend
- **`middleware.ts`** — `/admin` adicionado às rotas que exigem sessão

---

## v0.6.5 — Timeline da Partida (CS/m, Gold, XP) (2026-04-03)

### Backend — match.py
- **`GET /api/v1/match/{match_id}/timeline`** — novo endpoint com lazy-cache:
  - Cache hit: retorna `match_timelines.frames` sem chamar a Riot API
  - Cache miss: busca `server` do jogador via `match_participants → players`, chama Riot API (`match.by_id` para ordem dos PUUIDs + `match.timeline_by_match`), parseia, salva e retorna
  - Respostas: 404 (partida inexistente), 422 (sem server), 500 (sem `RIOT_API_KEY`), 502 (erro Riot API)
- Helper `_parse_timeline_frames(frames_raw, puuids_ordered)` — parsing puro extraído para reutilização
- Helper `_get_routing_region(server)` — copiado de `riot_service.py` para evitar acoplamento circular

### Frontend — TimelineChart.tsx [NEW]
- Componente SVG puro (`viewBox 600x190`, responsivo com `width="100%"`)
- Tabs: **CS/m | Ouro | XP** com troca reativa
- Uma linha por participante; time azul = tons de azul, time vermelho = tons de vermelho
- Jogador destacado (via `highlightedPuuid`) recebe linha mais grossa e opacidade total
- Grid horizontal com labels formatados (gold: `12.3k`, xp: `8k`, cspm: `7.5`)
- Labels do eixo X em minutos (step adaptativo: 3 / 5 / 10 min)
- Legenda com cor e nome de cada jogador; jogador destacado em negrito

### Frontend — `/matches/[match_id]/page.tsx`
- Seção colapsável "Timeline da Partida" abaixo do scoreboard (visível apenas quando `has_timeline = true`)
- Fetch lazy: só busca `/timeline` ao abrir pela primeira vez; re-aberturas usam cache de estado
- Estados: carregando, erro, e chart renderizado

### Testes
- `tests/test_match_api.py` — 10 novos testes em `TestMatchTimeline` (30 total no arquivo):
  cache hit / cache miss / salva no banco / frames parseados / 404 / 422 / 500 / 502

### Totais acumulados
- **247 testes passando** (10 novos nesta versão)

---

## v0.6.4 — Histórico Rico: Items, Runas, CS/m + Resumo do Jogador (2026-04-03)

### Banco de dados
- **`match_participants`** — 12 novas colunas: `team_id`, `items` (JSONB), `summoner1_id`, `summoner2_id`, `rune_keystone`, `rune_primary`, `rune_secondary`, `runes_raw` (JSONB), `total_cs`, `cs_per_minute`, `champion_level`, `items_purchased`
- **Nova tabela `match_timelines`** — JSONB com snapshots por minuto por PUUID (`cs`, `cspm`, `gold`, `level`, `xp`); RLS pública; PK em `match_id`

### Backend — riot_service.py
- `_processar_e_salvar()` extrai e salva items, runas (keystone + árvores + raw), CS/m, team_id e summoner spells de cada participante
- Nova função `_salvar_timeline()` — busca `lol_watcher.match.timeline_by_match()`, converte `participantId → PUUID` via `metadata.participants`, filtra frames por minuto, salva em `match_timelines`; falha silenciosa (não bloqueia sync)
- `atualizar_historico()` chama `_salvar_timeline()` imediatamente após cada partida nova salva

### Backend — player.py
- `GET /api/v1/player/history` select expandido: `team_id`, `vision_score`, `kill_participation`, `damage_per_minute`, `total_cs`, `cs_per_minute`, `champion_level`, `items`, `rune_keystone`, `summoner1_id`, `summoner2_id`

### Frontend — MatchCard reescrito
- Items (7 slots com slots vazios), keystone (DDragon perk-images), nível final sobrepostos no ícone
- CS/m colorido por performance (verde/amarelo/cinza/vermelho)
- Data relativa ("há 2 dias"), patch ("Patch 16.7"), duração e end_type em rodapé do card
- Queue label ("SoloQ" / "Flex"), badge vitória/derrota
- Botões "Detalhes" (→ `/matches/[id]`) e "Analisar" (→ `/chat`)

### Frontend — Player Page
- Bloco de resumo (`useMemo`) acima do histórico: winrate colorido, KDA médio, CS/m médio, campeão mais jogado com ícone e WR
- `useMemo` atualiza automaticamente ao "Carregar mais"

### Novos arquivos
- `frontend/src/lib/runes.ts` — mapa `keystoneId → DDragon perk-image path`

### Arquivos alterados
- `backend/services/riot_service.py` — `_processar_e_salvar()`, `_salvar_timeline()`, `atualizar_historico()`
- `backend/api/routes/player.py` — select expandido
- `frontend/src/components/matches/MatchCard.tsx` — reescrito
- `frontend/src/app/players/[puuid]/page.tsx` — imports + `useMemo` + bloco de resumo
- Supabase migration: `add_items_runes_cs_timeline`

---

## v0.6.3 — Separação de Dados Sujos + Paginação de Histórico (2026-04-03)

### Arquitetura de dados — matches_dirty
- **Nova tabela `matches_dirty`** no Supabase: registra partidas descartadas pela Camada Prata com campo `reason` (remake, short_game, wrong_queue:N, invalid_json) + snapshot parcial do JSON para debug
- **`riot_service.py`** — filtro duplo: (1) somente queue_id 420 (SoloQ) e 440 (Flex) são aceitas na tabela `matches`; (2) duração < 300s = remake, < 900s = short_game — ambas vão para `matches_dirty`
- **Filosofia:** pipeline coleta tudo, Camada Prata decide. Dados descartados não somem — ficam rastreáveis em `matches_dirty` sem poluir a análise

### Backend — paginação
- `GET /api/v1/player/history` ganha parâmetro `offset` (default 0) + retorna `has_more: bool`
- `limit` default sobe de 10 → 15 para carga inicial
- Resposta inclui `offset` e `limit` para o cliente calcular próxima página

### Frontend — player page
- Carga inicial: 15 partidas
- Botão "Carregar mais" (10 por clique) — visível só quando `has_more: true`; loading state inline
- Badge "Somente SoloQ / Flex" no header da seção de histórico
- Mensagem de empty state atualizada para explicar a filtragem

### Arquivos alterados
- `backend/services/riot_service.py` — `RANKED_QUEUE_IDS`, `_salvar_dirty()`, filtros em `_processar_e_salvar()`
- `backend/api/routes/player.py` — offset + has_more + limit 15
- `frontend/src/app/players/[puuid]/page.tsx` — paginação + badge SoloQ/Flex
- Supabase migration: `create_matches_dirty`

## v0.6.2 — Temas, Home Preenchida e Navegação Livre (2026-04-03)

### Produto
- **Changelog público** — `/changelog` atualizado com entrada v0.6.2 (temas, destaques do meta, navegação)
- **Home page** — seção "Destaques do Meta" com top 6 campeões do tierlist (ícone, nome, winrate colorido), falha silenciosa se backend offline
- **Navegação** — Tier List visível para todos (sem login); header de todas as páginas tem links para Início, O que é novo, Equipe; badge "Alpha v0.6.2" no header

### Temas de cor
- **4 temas:** Azul (padrão), Roxo, Verde, Vermelho
- **ThemeProvider** — context + localStorage + `data-theme` no `<html>` com `suppressHydrationWarning`
- **ThemeSwitcher** — 4 dots coloridos no header com ring de seleção, visível em todas as páginas
- **Implementação CSS:** tokens migrados de hex fixo para `rgb(var(--metis-*) / <alpha-value>)` — suporta modificadores de opacidade do Tailwind (ex: `bg-metis-accent/20`)

### Arquivos alterados
- `globals.css` — 4 blocos `[data-theme]` com variáveis RGB
- `tailwind.config.ts` — todos os tokens agora usam `rgb(var(...))`
- `src/components/ui/ThemeProvider.tsx` — [NEW]
- `src/components/ui/ThemeSwitcher.tsx` — [NEW]
- `src/app/layout.tsx` — ThemeProvider + suppressHydrationWarning
- `src/app/page.tsx` — top campeões + ThemeSwitcher + nav universal
- `src/app/champions/page.tsx` — ThemeSwitcher + nav universal no header

## v0.6.0 — Frontend Completo + Correções de Infra (2026-04-03)

### Frontend — Novas telas implementadas
- **`/players/[puuid]`** — histórico de partidas com `GET /api/v1/player/history`; componente `MatchCard` (azul=vitória, vermelho=derrota, KDA, ouro, DPM, duração, botão "Analisar")
- **`/champions`** — Tier List global com filtros por role (botões), servidor (select), patch (input) e elo (emblemas Data Dragon, filtro UI-only); tabela `StatsTable` sortável por qualquer coluna
- **`/auth`** — tela de cadastro adicionada (toggle Login ↔ Criar conta), validação client-side, tela "Verifique seu email" pós-signup; callback de email confirmation em `auth/callback/route.ts`
- **`next.config.ts`** — `remotePatterns` adicionado para `ddragon.leagueoflegends.com` (imagens de campeões e emblemas de elo)
- **Deploy Vercel** — configurado Root Directory `frontend`, Framework Next.js, env vars setadas; `package.json` e `package-lock.json` force-added ao git

### Backend — Novos endpoints
- **`GET /api/v1/stats/tierlist`** — retorna todos os campeões com stats agregadas (winrate, KDA, ouro, DPM), filtros: role, server, patch, min_matches
- **`GET /api/v1/player/history`** — histórico de partidas de um PUUID com nested select PostgREST (match_participants → matches)
- **`buscar_tierlist()`** em `stats_service.py` — agregação Python via `defaultdict`, sem nova query por campeão

### Bugfixes de infra
- **BUG-007** — `riot_service.py` importava `_normalizar_patch` de `scripts.processing.process_matches`; crashava o Railway (ModuleNotFoundError). Função inlinalizada, import removido.
- **BUG-008** — `requirements.txt` com encoding UTF-16 LE corrompido. Regenerado com `pip freeze` em UTF-8 limpo.

### Tooling
- **`setup.ps1`** — script PowerShell de bootstrap: cria/valida `.venv`, instala `requirements.txt`, roda `npm install` no frontend. Flags: `-Freeze` (atualiza requirements), `-Backend` (sobe uvicorn após setup).

### Produto — Changelog público e Equipe
- **`/changelog`** — página pública de patch notes em linguagem de produto (sem jargão técnico), timeline visual com badges por tipo (novo/melhoria/fix)
- **`/team`** — página da equipe: César (dourado), Enzo (vermelho), André (verde) — com cargo, empresa, roles no Metis, frase e links
- **Header da home** — botões "O que é novo" (Sparkles) e "Equipe" (Users) sempre visíveis, antes do separador de auth
- **Convenção**: a partir de agora, toda feature de produto entra em `/changelog` junto com o `.speckit/patch_notes.md`

### CI/CD — GitHub Actions
- `fetch_high_elo_matches.yml` — cron meia-noite BRT, timeout 280min, MAX_PLAYERS 400, `FORCE_JAVASCRIPT_ACTIONS_TO_NODE24`
- `fetch_pros_matches.yml` — cron 19h BRT a cada 2 dias, blocklist sem `academy`
- `process_matches.yml` — cron 11h BRT, paginação 1000-row corrigida em `_get_processed_ids()`
- `process_timelines.yml` — novo Action, cron 12h BRT, loop completo com `_get_processed_timeline_ids()`

## v0.5.0 - Modelo de Acesso e Produto Final (2026-04-03)

### Produto: acesso público + premium + supervisão
- **Modelo de acesso reestruturado:** `/` e `/players/[puuid]` são públicos; `/chat` exige login + `app_metadata.is_premium`
- **`middleware.ts`** — simplificado: só bloqueia `/chat` sem sessão; `/auth` com sessão redireciona para `/` (não `/chat`)
- **`src/app/page.tsx`** — home pública: busca de jogador por PUUID/Riot ID + lista de supervisão para usuários logados
- **`src/app/chat/page.tsx`** — gate de premium antes do chat (tela `Lock` com mensagem clara para não-premium)
- **`src/app/players/[puuid]/page.tsx`** — stats públicas placeholder + toggle de supervisão (Star/StarOff) com label livre
- **Supabase migration `create_watched_players`** — tabela `watched_players` com UNIQUE(user_id, puuid) + RLS "own rows"
- `npx tsc --noEmit` — zero erros

### Regras de acesso
| Rota | Anon | Login | Premium |
|------|------|-------|---------|
| `/` | ✅ | ✅ | ✅ |
| `/players/[puuid]` | ✅ | ✅ | ✅ |
| `/chat` | ❌→/auth | gate | ✅ |

### Concessão de premium
- Via Supabase service role: `auth.admin.updateUserById(userId, { app_metadata: { is_premium: true } })`
- Concedido manualmente pelo time enquanto não existe fluxo de compra

## v0.4.0 - Base do Frontend Next.js 15 (2026-04-03)

### Novo: Frontend scaffoldado do zero
- Next.js **15** + React 19 + TypeScript strict + Tailwind CSS v3
- `@supabase/ssr` com `createBrowserClient` (client) e `createServerClient` (server/middleware)
- `middleware.ts` — refresh de sessão Supabase + redirect automático auth↔chat
- `src/app/auth/page.tsx` — Login Email/Senha via `supabase.auth.signInWithPassword`
- `src/app/chat/page.tsx` — histórico de mensagens (useState), loading dots, fetch para FastAPI
- `src/components/ui/ChatInput.tsx` — textarea + Send (Enter atalho)
- `src/components/ui/ChatMessage.tsx` — bolha user vs metis com avatares lucide
- `frontend/.env.example` e `frontend/CLAUDE.md` criados
- `npx tsc --noEmit` — zero erros, zero vulnerabilidades npm

### Ajustes de documentação
- `README.md` — seção de setup de deps (pip + npm) adicionada, Pinecone removido da stack
- `requirements.txt` — são dumps de `pip freeze` com resíduos de Pinecone/LangChain; **não editar manualmente** — regenerar com `pip freeze > requirements.txt` após limpar o venv quando necessário

## v0.3.0 - Revisão Coluna [Revisão] + Stats API + Builds de Itens (2026-04-03)

### Revisão de Cards (César + Claude)
- **pgvector + Tabela Ouro:** verificado via Supabase MCP — aprovado.
- **Endpoint Sincronizar Partidas (`/sync` + `/update-history`):** 3 bugs corrigidos no `riot_service.py`:
  - `game_version` agora usa `_normalizar_patch()` (consistência com pipeline Bronze→Prata)
  - `team_position` defaulta para `"UNKNOWN"` quando vazio/None
  - `match_participants` upsert com `on_conflict="match_id,puuid"` (sem duplicatas no re-sync)
- **Endpoint Stats/Champions:** não existia no codebase — criado do zero.
- **Testes Funcionais API Metis (M5):** 28/28 passando em `tests/test_funcionais_api_metis.py`.

### Novo: GET /api/v1/stats/champions
- `backend/services/stats_service.py` — agregação Python sobre nested select PostgREST
- `backend/api/routes/stats.py` — Query Params: `champion` (required), `role`, `server`, `patch`, `elo`, `min_matches`
- Filtro `?elo=` aceito mas sem efeito (sem dados de rank por partida no schema)
- `tests/test_stats_api.py` — 17 testes

### Novo: Modelagem e Ingestão de Itens (champion_builds)
- Supabase migration `create_champion_builds` — tabela + UNIQUE + view `champion_item_stats` (winrate_pct automático)
- Supabase migration `fn_upsert_champion_builds` — RPC com `ON CONFLICT DO UPDATE SET pick_count += 1, win_count += won`
- `process_matches.py` — `_get_item_dict()` com lazy cache + `extrair_builds_partida()` (função pura) + chamada RPC em `processar_partida()`
- `database/metis_v1.3.dbml` — tabela `champion_builds` adicionada ao schema
- `tests/test_process_builds.py` — 16 testes

### Totais da sessão
- **140/140 testes passando**
- Novos arquivos: `stats_service.py`, `routes/stats.py`, `test_stats_api.py`, `test_process_builds.py`, `test_funcionais_api_metis.py`
- Migrações Supabase aplicadas: `create_champion_builds`, `fn_upsert_champion_builds`

## v0.2.0 - Revisão das mudanças do André + Correção de Testabilidade (2026-04-02)
- Revisão e aprovação das mudanças do André (CORS, health check, ChatRequest, bugs.md)
- Escrita de 15 testes funcionais cobrindo todas as mudanças (`tests/test_api_andre_changes.py`)
- BUG-001 resolvido: `process_timelines.py` refatorado com injeção de dependência (`db_client`), função `extrair_dados_timeline()` extraída (parsing puro) e lazy init do Supabase
- BUG-002 resolvido: pasta `scripts/Processing` renomeada para `processing` (case fix Windows)
- Adicionados `__init__.py` em todos os pacotes de `scripts/`
- Configurado `[tool.pytest.ini_options]` no `pyproject.toml` (pythonpath + testpaths)
- Total: 17/17 testes passando

## v0.1.0 - Saneamento e Pivot Estrutural
- Pivot oficializado: Abandono do Pinecone em favor do `Supabase (PostgreSQL + pgvector)`
- Introdução do orquestrador `OpenRAG`.
- Implementação inicial da pasta `.speckit` para centralização de estado do AI Context Director.
- Remoção de trackers de tarefas genéricos em favor de Milestones atômicos (`plano_atual.md`).
