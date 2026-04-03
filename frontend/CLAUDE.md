# CLAUDE.md — Frontend (Next.js)

> Contexto específico para trabalho no `/frontend`. Leia também o `CLAUDE.md` da raiz.

## Stack

- **Next.js 15** (App Router) + **React 19** — hospedado no Vercel
- **TypeScript** com strict mode
- **Tailwind CSS v3** para estilização
- **@supabase/ssr** para autenticação SSR com cookies
- **lucide-react** para ícones

## Estrutura

```
frontend/
├── src/
│   ├── app/
│   │   ├── layout.tsx                    # Root layout (fonte, metadata, globals.css)
│   │   ├── page.tsx                      # Home pública — busca de jogador + supervisão
│   │   ├── auth/page.tsx                 # Login Email/Senha via Supabase Auth
│   │   ├── chat/page.tsx                 # Chat IA (gate premium, messages state, fetch FastAPI)
│   │   └── players/[puuid]/page.tsx      # Stats públicas de jogador + toggle supervisão
│   ├── components/ui/
│   │   ├── ChatInput.tsx       # Textarea + botão Send (Enter atalho)
│   │   └── ChatMessage.tsx     # Bolha user (azul) vs metis (surface)
│   └── lib/supabase/
│       ├── client.ts           # createBrowserClient — use em Client Components
│       └── server.ts           # createServerClient — use em Server Components / Actions
├── middleware.ts               # Protege /chat (sem sessão → /auth); /auth com sessão → /
├── .env.example                # Template das 3 variáveis necessárias
├── next.config.ts
├── tailwind.config.ts          # Cores metis-bg, metis-surface, metis-accent...
└── package.json
```

## Variáveis de Ambiente

Copie `frontend/.env.example` → `frontend/.env` e preencha:

| Variável | Descrição |
|----------|-----------|
| `NEXT_PUBLIC_SUPABASE_URL` | URL do projeto Supabase |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Chave anon pública do Supabase |
| `NEXT_PUBLIC_API_URL` | URL do backend FastAPI no Railway |

## Padrões de Desenvolvimento

### Supabase Auth
- **Client Components:** use `createClient()` de `@/lib/supabase/client`
- **Server Components / Route Handlers:** use `createClient()` de `@/lib/supabase/server`
- Nunca use o client de browser em Server Components — o Next.js vai reclamar

### Rotas protegidas
O `middleware.ts` já trata redirecionamentos:
- Sem sessão → `/auth`
- Com sessão em `/auth` → `/chat`
- Para novas rotas protegidas, nada precisa ser feito — o middleware cobre tudo

### Comunicação com o FastAPI
- URL base em `NEXT_PUBLIC_API_URL`
- Sempre `Content-Type: application/json`
- Quando o backend tiver auth, incluir `Authorization: Bearer <token>` (pendente M4)

### Cores (Tailwind)

| Token | Uso |
|-------|-----|
| `metis-bg` | Fundo geral da página (`#0d0f14`) |
| `metis-surface` | Cards, header, footer, inputs (`#161b27`) |
| `metis-border` | Bordas (`#1e2533`) |
| `metis-accent` | Botões primários, links, avatares Metis (`#4f8ef7`) |
| `metis-text` | Texto principal (`#e2e8f0`) |
| `metis-text-dim` | Labels, textos secundários (`#8892a4`) |

## Comandos

```bash
cd frontend
npm install       # instalar dependências
npm run dev       # dev server em localhost:3000
npm run build     # build de produção
npx tsc --noEmit  # checar tipos sem compilar
```

## Modelo de Acesso

| Rota | Anon | Login | Login + Premium |
|------|------|-------|-----------------|
| `/` — Home/busca de jogador | ✅ | ✅ | ✅ |
| `/players/[puuid]` — Stats públicas + supervisão | ✅ | ✅ | ✅ |
| `/auth` — Login | ✅ | → `/` | → `/` |
| `/chat` — IA Tática | ❌ → `/auth` | gate premium | ✅ |

**Premium:** setado via service role em `app_metadata.is_premium = true`. Concedido manualmente pelo time enquanto não existe compra.

**Supervisão (`watched_players`):** qualquer usuário logado pode marcar PUUIDs com label livre. RLS garante isolamento por `user_id`.

## Status (M3)

| Tela | Status | Arquivo |
|------|--------|---------|
| Home pública (busca + supervisão) | ✅ Implementado | `src/app/page.tsx` |
| Login (Email/Senha) | ✅ Implementado | `src/app/auth/page.tsx` |
| Chat com FastAPI (gate premium) | ✅ Implementado | `src/app/chat/page.tsx` |
| Player Stats (placeholder) | ✅ Implementado | `src/app/players/[puuid]/page.tsx` |
| Histórico de Partidas | ⬜ Pendente | `src/app/history/` |
| Tier List / Estatísticas | ⬜ Pendente | `src/app/champions/` |
| Deploy Vercel | ⬜ Pendente (Takida) | — |

## NUNCA
- Não use `@/lib/supabase/client` em Server Components
- Não hardcode URLs do backend — use `NEXT_PUBLIC_API_URL`
- Não adicione bibliotecas de UI (shadcn, MUI, etc.) sem alinhamento com Takida
- Não modifique o `middleware.ts` sem entender o fluxo de cookies do `@supabase/ssr`
