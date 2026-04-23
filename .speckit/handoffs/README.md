# Handoffs

Briefs auto-contidos que o César manda pro **Claude Design** (sessão
separada) quando precisa de JSX/TSX de uma tela nova ou redesenho.

## O que é um handoff
Um arquivo `.md` com tudo que o Claude Design precisa pra desenhar sem
acesso ao repo:

- Contexto do projeto (stack, status atual do redesign)
- Design tokens canônicos (`--m-*`) e primitives disponíveis
- Modelo de acesso (anon / logado / premium / admin)
- O que desenhar AGORA (escopo claro, lista de cards/seções)
- Contexto do FUTURO (features que virão — design deve acomodar)
- Restrições não-negociáveis (dark-only, sem libs UI externas, i18n, etc.)
- Entregáveis esperados (TSX inline style, copy em PT, estados)

## Fluxo
1. Engenharia (Claude Code) escreve o handoff aqui
2. César cola no Claude Design
3. Claude Design devolve JSX/TSX
4. Engenharia integra: cria rota, wire com Supabase, i18n PT/EN, link no header
5. Handoff fica versionado pra referência e reuso

## Naming
`<tela_ou_feature>.md` em snake_case. Ex: `account_page.md`,
`recommendations.md`, `match_timeline_map.md`.

## Handoffs atuais
- [account_page.md](account_page.md) — brief que nós mandamos pro Claude Design
  (prioridade `/account`, `/auth` opcional, contexto de recomendação de
  campeões e timeline interativa)
- [metis-1-0/](metis-1-0/) — bundle devolvido pelo Claude Design (Metis 1.0).
  Contém:
  - `HANDOFF-TECNICO.md` — contrato detalhado de 4 sistemas (Timeline,
    Radar, AI Insights, Champion profile) com shapes de dados + estados
  - `metis/*.jsx` — mockups de todas as telas (screen-account,
    screen-auth, timeline, screen-champion, etc.)
  - `chats/chat1.md` — transcript da sessão de design
  - `metis-design.html` — arquivo raiz que o Claude Design tinha aberto
    (geralmente é o principal; neste bundle é o index do canvas)
