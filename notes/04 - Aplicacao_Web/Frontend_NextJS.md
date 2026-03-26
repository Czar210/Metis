# Frontend Next.js

Notas sobre a arquitetura do frontend do Metis: estrutura de rotas, páginas principais, integração com a API e deploy.

---

## Visão Geral

O frontend do Metis é uma aplicação **Next.js 14** usando o **App Router** (introduzido no Next.js 13). A escolha do App Router permite Server Components por padrão — componentes que renderizam no servidor sem JavaScript no cliente, o que melhora performance e SEO.

O deploy é feito na **Vercel**, que integra nativamente com Next.js (mesma empresa criadora) e oferece CI/CD automático via push no GitHub.

---

## App Router vs Pages Router

O Next.js tem dois sistemas de roteamento. O Metis usa o **App Router** (pasta `app/`):

| Característica | App Router (Metis) | Pages Router (legado) |
|---|---|---|
| Pasta raiz | `app/` | `pages/` |
| Server Components | Por padrão | Não existe |
| Layouts aninhados | Suportado nativo | Manual |
| Loading/Error states | `loading.tsx`, `error.tsx` | Implementação manual |
| Streaming SSR | Suportado | Limitado |

---

## Estrutura de Pastas

```
frontend/
├── app/
│   ├── layout.tsx              ← Layout raiz (header, nav, providers)
│   ├── page.tsx                ← Homepage (/)
│   ├── login/
│   │   └── page.tsx            ← Página de login (/login)
│   ├── chat/
│   │   ├── page.tsx            ← Interface principal de chat (/chat)
│   │   └── [champion]/
│   │       └── page.tsx        ← Chat filtrado por campeão (/chat/jinx)
│   └── champions/
│       ├── page.tsx            ← Listagem de campeões (/champions)
│       └── [slug]/
│           └── page.tsx        ← Perfil do campeão (/champions/jinx)
├── components/
│   ├── ChatInput.tsx           ← Input de pergunta + botão enviar
│   ├── ChatMessage.tsx         ← Bolha de mensagem (user / assistant)
│   ├── ChampionCard.tsx        ← Card de campeão na listagem
│   ├── SourcesPanel.tsx        ← Painel com os guias usados como fonte
│   └── ui/                     ← Componentes base (Button, Input, etc.)
├── lib/
│   ├── api.ts                  ← Funções de chamada à API do backend
│   ├── supabase.ts             ← Cliente Supabase (auth + realtime)
│   └── utils.ts                ← Utilitários gerais
├── hooks/
│   ├── useChat.ts              ← Lógica de estado do chat (mensagens, loading)
│   └── useAuth.ts              ← Estado de autenticação do usuário
└── public/
    └── champions/              ← Imagens dos campeões (splash arts otimizadas)
```

---

## Páginas Principais

### `/` — Homepage
Apresentação do Metis: o que é, como funciona, call-to-action para entrar no chat. Renderizada no servidor (Server Component) — sem estado, sem JS no cliente.

### `/login` — Autenticação
Formulário de login integrado com **Supabase Auth**. Suporta email/senha e futuramente OAuth (Google, Discord). Após login, redireciona para `/chat`.

```typescript
// lib/supabase.ts
import { createBrowserClient } from "@supabase/ssr"

export const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)
```

### `/chat` — Interface Principal
É aqui que acontece a magia. O usuário digita perguntas sobre League of Legends e recebe respostas geradas pelo Llama 3 com base nos guias do Mobafire. A interface exibe:

- Histórico de mensagens da sessão
- As fontes usadas na resposta (guias + autor + patch)
- Indicador de loading durante a geração da resposta

### `/champions` — Catálogo
Grid de cards com todos os campeões disponíveis no índice do Metis. Clicando em um campeão, o usuário é levado ao `/chat/[champion]` onde as perguntas são automaticamente filtradas para aquele campeão.

---

## Chamadas à API do Backend

Todas as chamadas ao backend FastAPI são centralizadas em `lib/api.ts`:

```typescript
// lib/api.ts
const API_BASE = process.env.NEXT_PUBLIC_API_URL  // URL do Railway via Cloudflare

export async function queryRAG(question: string, championSlug?: string) {
  const session = await supabase.auth.getSession()
  const token = session.data.session?.access_token

  const response = await fetch(`${API_BASE}/query`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${token}`,
    },
    body: JSON.stringify({ question, champion_slug: championSlug }),
  })

  if (!response.ok) throw new Error("Erro na consulta")
  return response.json()
}
```

---

## Estratégia de Deploy (Vercel)

O Vercel detecta o repositório Next.js automaticamente e configura o pipeline de build. Variáveis de ambiente são configuradas no painel da Vercel:

| Variável | Descrição |
|---|---|
| `NEXT_PUBLIC_API_URL` | URL do backend FastAPI no Railway |
| `NEXT_PUBLIC_SUPABASE_URL` | URL do projeto Supabase |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Chave pública do Supabase |

O prefixo `NEXT_PUBLIC_` é obrigatório no Next.js para que variáveis fiquem acessíveis no browser (client-side). Variáveis sem esse prefixo ficam disponíveis apenas no servidor.

### Preview Deployments
Cada pull request gera automaticamente um **preview deployment** na Vercel com URL única (ex: `metis-pr-42.vercel.app`). Isso facilita revisão de features antes do merge na main.

---

## Estilização

O Metis usa **Tailwind CSS** para estilização utilitária. A paleta segue o tema de League of Legends: tons de azul (Demacia/Iônia), dourado (Ouro Hextech) e fundo escuro.

Para componentes mais complexos (modais, dropdowns), é recomendado usar **shadcn/ui** — uma biblioteca de componentes acessíveis baseada em Radix UI + Tailwind, que não adiciona um bundle pesado porque os componentes são copiados direto para o projeto.

---

## Conceitos Relacionados

- [[Backend_FastAPI]] — a API que este frontend consome
- [[ADR-002 Supabase fonte única pra dados limpos]] — por que Supabase cuida da autenticação
- [[RAG]] — o sistema que gera as respostas exibidas no chat
