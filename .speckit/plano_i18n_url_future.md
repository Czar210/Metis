# Plano Futuro — Migração i18n para URL-based routing

> **Status:** backlog (não iniciar sem demanda explícita)
> **Pré-requisito:** p-0.9.18 (cookie-based) já em produção e estável
> **Gatilho de retomada:** surgir landing pública indexável ou share-links de tier lists por idioma viralizarem

## Por que este plano existe

Em p-0.9.18 (abril 2026) adotamos i18n **cookie-based** pra Metis (pt/en). Decisão foi pragmática: o app é majoritariamente logado (chat, admin, perfil), então SEO por idioma não compensava o refactor de mover toda a árvore `app/*` pra `app/[locale]/*`.

Se no futuro:
- surgir uma landing pública indexável (`/` sem auth com tier list embutida)
- share-links de build/tier list forem compartilhados em Discord/Twitter e o idioma do viewer importar
- SEO orgânico virar canal real de aquisição

…o custo de manter cookie-based passa a ser maior que o de migrar. Este doc guia essa migração.

## Arquitetura alvo

- URLs: `/pt/champions`, `/en/champions`, `/pt/chat/123`, etc.
- `/` redireciona pro locale do cookie (ou `pt` default) via middleware
- `<html lang>` derivado do segmento de rota, não mais do cookie
- Sitemap.xml gera uma entrada por (rota × locale)
- `hreflang` tags no `<head>` pra SEO cross-language

## Mudanças principais

### Estrutura
- Mover `app/(public)/*`, `app/(auth)/*`, `app/admin/*`, `app/champions/*`, etc. todos pra dentro de `app/[locale]/*`
- `app/[locale]/layout.tsx` recebe `params.locale` e passa pro `NextIntlClientProvider`
- Remover `getLocale()` do `i18n/request.ts` (virá de `params` agora)

### next-intl
- Adicionar `createNavigation()` helper pra substituir `next/link` e `useRouter`:
  ```ts
  import {createNavigation} from 'next-intl/navigation'
  export const {Link, useRouter, usePathname, redirect} = createNavigation({locales, defaultLocale})
  ```
- Todo `import Link from 'next/link'` vira `import {Link} from '@/i18n/navigation'`
- Middleware `middleware.ts` de `next-intl` pra detectar locale e redirecionar `/` → `/pt`

### LangSwitcher
- Deixa de escrever cookie — chama `router.replace(pathname, {locale: 'en'})`
- Cookie `NEXT_LOCALE` ainda pode persistir preferência pra primeiro acesso, mas URL é fonte da verdade

### Backend / APIs
- Rotas de API do Next (`/api/*`) ficam fora de `[locale]` (não traduzidas)
- FastAPI não muda

### SEO
- `app/[locale]/layout.tsx` gera `<html lang={locale}>` e meta tags alternativas:
  ```tsx
  <link rel="alternate" hrefLang="pt" href="https://metis.gg/pt" />
  <link rel="alternate" hrefLang="en" href="https://metis.gg/en" />
  <link rel="alternate" hrefLang="x-default" href="https://metis.gg" />
  ```
- `robots.txt` e `sitemap.xml` listam ambos locales

## Armadilhas conhecidas

1. **Links externos antigos** que apontam pra `/champions` sem locale: middleware redireciona pra `/pt/champions` (ou idioma do header `Accept-Language`). Sem quebra, mas muda a URL final.
2. **Supabase Auth redirects** (`redirect_to=/admin`) — validar que o locale é preservado ou default aplicado.
3. **Server actions** — se usarem `redirect('/path')`, trocar pro helper de `@/i18n/navigation` pra não perder locale.
4. **`usePathname()`** — em next-intl retorna pathname *sem* prefixo de locale (`/champions`, não `/pt/champions`). Cuidado em lógica que compara strings.
5. **Testes e2e** — todas as rotas em testes ganham prefixo. Ajustar Playwright/Cypress se existirem.

## Estimativa

- Refactor estrutural: 1 dia
- Migração de imports (`next/link` → `@/i18n/navigation`): 2-4h
- Middleware + sitemap + hreflang: 2h
- Validação + fix de regressões: 1 dia
- **Total:** ~3 dias focados

## Critérios pra considerar migração

Só disparar quando pelo menos 2 dos 3 se aplicarem:
- [ ] Analytics mostra ≥ 5% do tráfego vindo de busca orgânica
- [ ] Landing pública (sem auth) já existe e é o canal principal de aquisição
- [ ] Pedidos recorrentes de usuários por share-link no idioma do destinatário

Até lá, cookie-based resolve.
