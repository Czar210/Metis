'use client'

import Link from 'next/link'
import { AppHeader, Icon } from '@/components/design'

// ── Types ──────────────────────────────────────────────────────
type TagKind = 'novo' | 'melhoria' | 'fix' | 'big'

type Entry = {
  tag: TagKind
  text: string
}

type Release = {
  version: string
  date: string
  /** Título destacado da release (ex: "Big Update"). Omita se não tiver. */
  label?: string
  current?: boolean
  entries: Entry[]
}

// ── Data ───────────────────────────────────────────────────────
const RELEASES: Release[] = [
  {
    version: 'p-0.9.9',
    date: '04/2026',
    label: 'Redesign: Planos + Cupons',
    current: true,
    entries: [
      { tag: 'big',      text: 'Redesign completo da página de Planos com os 4 tier cards, toggle mensal/anual e novo footer de trust.' },
      { tag: 'novo',      text: 'Feature de Cupons — tabela dedicada no banco com validade e efeito, endpoint público e seção "Cupons disponíveis" na pricing.' },
      { tag: 'novo',      text: 'Primeiro cupom ao vivo: MESTRE2604 dá Premium com 10k tokens/dia até o fim de abril.' },
      { tag: 'melhoria', text: 'Comparativo, FAQ e card Times & Empresas agora usam o design system novo.' },
    ],
  },
  {
    version: 'p-0.9.8.1',
    date: '04/2026',
    label: 'Backend: Catálogo de Itens enriquecido',
    entries: [
      { tag: 'novo',      text: 'Tabela `items` no Supabase — nome, gold, tags, categoria, tendência em colunas dedicadas.' },
      { tag: 'novo',      text: 'Endpoint de itens retorna custo em ouro, tags e espaço para categoria curada.' },
      { tag: 'melhoria', text: 'Página de Itens ganhou colunas Categoria + Custo + Tendência e chips de tags no nome.' },
    ],
  },
  {
    version: 'p-0.9.8',
    date: '04/2026',
    label: 'Redesign: Itens',
    entries: [
      { tag: 'big',      text: 'Página de Itens redesenhada com 2 spotlights (mais comprados / top winrate) e tabela densa.' },
      { tag: 'melhoria', text: 'Filtros role, patch, busca e sort preservados e restilizados.' },
    ],
  },
  {
    version: 'p-0.9.7',
    date: '04/2026',
    label: 'Redesign: Tier List',
    entries: [
      { tag: 'big',      text: 'Tier List reimaginada como cards agrupados por tier (S+ → C) com portrait grande, WR colorido e grid KDA/Ban/Games.' },
      { tag: 'melhoria', text: 'Filtros de elo, role, patch range e busca em card único.' },
    ],
  },
  {
    version: 'p-0.9.6',
    date: '04/2026',
    label: 'Redesign: Home + Design System',
    entries: [
      { tag: 'big',      text: 'Nova home: hero com glow gold/cyan, spotlight top-3 do meta, tier snippet top-8 com filtro de role.' },
      { tag: 'novo',      text: 'Botão Entrar real no header + avatar quando logado.' },
      { tag: 'novo',      text: 'Ícones oficiais da Riot nos badges de role.' },
      { tag: 'melhoria', text: 'Modo claro removido — o novo design é dark-only com accent customizável.' },
      { tag: 'melhoria', text: 'Hover de botões, cards e linhas de volta em todo o redesign.' },
    ],
  },
  {
    version: 'p-0.9.5',
    date: '04/2026',
    label: 'Redesign: Fundação',
    entries: [
      { tag: 'big',      text: 'Fundação do novo design system — 18 primitives, nova paleta com accent gold LoL, fontes Space Grotesk e JetBrains Mono.' },
    ],
  },
  {
    version: 'p-0.9.4',
    date: '04/2026',
    entries: [
      { tag: 'novo',      text: 'Scraper de guias do Mobafire guardando HTML bruto no Cloudflare R2 — fundação pra análise semântica futura.' },
      { tag: 'fix',       text: 'Bug no scraper que retornava vazio pra todos os campeões foi corrigido.' },
    ],
  },
  {
    version: 'p-0.9.3',
    date: '04/2026',
    entries: [
      { tag: 'novo',      text: 'Painel admin ganhou botão "Atualizar Tier List" pra limpar cache de 24h.' },
      { tag: 'melhoria', text: 'Tier list agora filtra impopulares por padrão — toggle pra ver todos.' },
      { tag: 'melhoria', text: 'Banco ~28% mais leve — colunas redundantes removidas.' },
    ],
  },
  {
    version: 'p-0.9.2',
    date: '04/2026',
    entries: [
      { tag: 'novo',      text: 'Pickrate e banrate reais na tier list, com bans processados do JSON da partida.' },
    ],
  },
  {
    version: 'p-0.9.0',
    date: '04/2026',
    label: 'Big Update · Chat Metis',
    entries: [
      { tag: 'big',      text: 'Pre-release da 0.9.0 com foco em qualidade do Chat Metis.' },
      { tag: 'novo',      text: 'Guardrail de tópico — a Metis agora responde APENAS sobre League of Legends e rejeita perguntas fora do jogo.' },
      { tag: 'novo',      text: 'Personalidade definida: calma, analítica, nunca tóxica. Transforma derrotas em aprendizado.' },
      { tag: 'novo',      text: 'Limite diário de tokens por plano — Doador (5k), Premium (30k), Pro (100k).' },
      { tag: 'novo',      text: 'Barra de uso de tokens no chat — veja quanto do seu limite foi utilizado em tempo real.' },
      { tag: 'melhoria', text: 'Chat atualizado para Gemini 2.5 Flash — modelo mais capaz e com respostas mais precisas.' },
    ],
  },
  {
    version: 'Alpha v0.8.2',
    date: '04/2026',
    label: 'Security Update',
    entries: [
      { tag: 'big',      text: 'Atualização de segurança completa — todos os endpoints agora exigem autenticação interna.' },
      { tag: 'melhoria', text: 'API Key interna (X-API-Key) protege toda a API — acesso sem credencial retorna 403.' },
      { tag: 'melhoria', text: 'Mensagens de erro sanitizadas — detalhes internos não vazam mais para o cliente.' },
      { tag: 'melhoria', text: 'CORS restrito a métodos e headers específicos.' },
      { tag: 'melhoria', text: 'Chave do Gemini configurada de forma segura — nunca armazenada em logs.' },
      { tag: 'fix',       text: '.gitignore bloqueia .env*, *.key e *.pem — impossível commitar secrets por acidente.' },
    ],
  },
  {
    version: 'Alpha v0.8.1',
    date: '04/2026',
    entries: [
      { tag: 'melhoria', text: 'Recomendações de campeão agora usam 8 dimensões (modelo Neo-Artemis).' },
      { tag: 'melhoria', text: 'Scores mais realistas — fórmula combina cosseno com distância euclidiana.' },
      { tag: 'novo',      text: 'Radar chart nos detalhes da recomendação — veja seu perfil vs o campeão.' },
      { tag: 'novo',      text: 'Mapa completo de runas com ícones corretos na tab de Build.' },
    ],
  },
  {
    version: 'Alpha v0.8.0',
    date: '04/2026',
    label: 'Big Update',
    entries: [
      { tag: 'big',      text: 'Maior atualização desde o lançamento — nova interface, IA integrada, recomendações e monetização.' },
      { tag: 'novo',      text: 'Busca inteligente com autocomplete de jogadores.' },
      { tag: 'novo',      text: 'Página de Itens — ranking por winrate e popularidade.' },
      { tag: 'novo',      text: 'Recomendações por lane — Diana JG ≠ Diana Mid.' },
      { tag: 'novo',      text: 'Chat com IA Metis funcionando — conectado ao Gemini Flash Lite.' },
      { tag: 'novo',      text: 'Metis Score nas partidas — nota de performance por role.' },
      { tag: 'novo',      text: 'Análise de equipe na partida — gráficos comparando times.' },
      { tag: 'novo',      text: 'Tab de Build na partida — itens, feitiços e runas completos.' },
      { tag: 'novo',      text: 'Jogou com / Nemesis — com quem você joga mais, e contra quem.' },
      { tag: 'novo',      text: 'Histórico de nomes — detecta mudanças de nickname.' },
      { tag: 'novo',      text: 'Página de Planos com emblemas de elo (Silver a Challenger).' },
      { tag: 'melhoria', text: 'Tier List com badges de tier, filtro de patch e emblemas maiores.' },
      { tag: 'melhoria', text: 'Perfil expandido — 2 colunas, resumo da season, filtros.' },
    ],
  },
  {
    version: 'Alpha v0.7.0',
    date: '04/2026',
    entries: [
      { tag: 'novo',      text: 'Página de campeão em /champions/[nome] — overview, builds, matchups, sinergias.' },
      { tag: 'melhoria', text: 'Tier List: clicar no campeão abre a página dele.' },
      { tag: 'fix',       text: 'Ícones de lane e emblemas de elo na Tier List corrigidos.' },
    ],
  },
  {
    version: 'Alpha v0.6.5',
    date: '04/2026',
    entries: [
      { tag: 'novo',      text: 'Timeline da partida — CS/m, Ouro e XP ao longo do tempo.' },
      { tag: 'novo',      text: 'Seu jogador destacado na timeline com linha mais grossa.' },
    ],
  },
  {
    version: 'Alpha v0.6.1',
    date: '04/2026',
    entries: [
      { tag: 'novo', text: 'Tier List de campeões com filtros por posição, região e patch.' },
      { tag: 'novo', text: 'Histórico detalhado por jogador.' },
      { tag: 'novo', text: 'Cadastro com confirmação por e-mail.' },
      { tag: 'novo', text: 'Páginas "O que é novo?" e "Conheça a Equipe".' },
    ],
  },
  {
    version: 'Alpha v0.4.0',
    date: '04/2026',
    entries: [
      { tag: 'novo', text: 'Lançamento do site Metis.' },
      { tag: 'novo', text: 'Login com e-mail e senha.' },
      { tag: 'novo', text: 'Busca de jogadores por PUUID ou Riot ID.' },
    ],
  },
  {
    version: 'Alpha v0.1.0',
    date: '03/2026',
    entries: [
      { tag: 'novo', text: 'Criação do repositório e estrutura inicial.' },
    ],
  },
]

const TAG_META: Record<TagKind, { label: string; bg: string; fg: string }> = {
  big:      { label: 'BIG UPDATE', bg: 'rgba(139,127,255,0.15)',  fg: 'var(--m-violet)' },
  novo:     { label: 'NOVO',        bg: 'rgba(74,222,128,0.15)',   fg: 'var(--m-green)'  },
  melhoria: { label: 'MELHORIA',    bg: 'rgb(var(--m-accent-rgb) / 0.15)', fg: 'var(--m-accent)' },
  fix:      { label: 'FIX',         bg: 'rgba(96,165,250,0.15)',   fg: 'var(--m-blue)'   },
}

export default function ChangelogPage() {
  return (
    <div className="metis-scope" style={{ minHeight: '100vh', background: 'var(--m-bg)' }}>
      <AppHeader active="changelog" />

      <div style={{ maxWidth: 760, margin: '0 auto', padding: '40px 28px 48px' }}>
        {/* Header */}
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            fontSize: 11,
            color: 'var(--m-accent)',
            textTransform: 'uppercase',
            letterSpacing: '0.12em',
            fontWeight: 600,
            marginBottom: 14,
          }}
        >
          <Icon name="sparkles" size={12} /> Novidades
        </div>
        <h1
          className="font-display"
          style={{ fontSize: 40, fontWeight: 700, letterSpacing: '-0.03em', marginBottom: 8 }}
        >
          O que é novo?
        </h1>
        <p style={{ fontSize: 14, color: 'var(--m-text-dim)', marginBottom: 36 }}>
          Acompanhe as evoluções da Metis. Cada versão traz melhorias reais — sem promessas, só entregas.
        </p>

        {/* Timeline vertical */}
        <div style={{ position: 'relative', paddingLeft: 32 }}>
          <div
            style={{
              position: 'absolute',
              left: 9,
              top: 12,
              bottom: 12,
              width: 2,
              background: 'var(--m-border)',
            }}
          />
          {RELEASES.map((rel) => (
            <div key={rel.version} style={{ position: 'relative', marginBottom: 28 }}>
              {/* Node */}
              <div
                style={{
                  position: 'absolute',
                  left: -28,
                  top: 4,
                  width: 20,
                  height: 20,
                  borderRadius: '50%',
                  background: rel.current ? 'var(--m-accent)' : 'var(--m-surface)',
                  border: `2px solid ${rel.current ? 'var(--m-accent)' : 'var(--m-border-2)'}`,
                  boxShadow: rel.current ? '0 0 0 5px rgb(var(--m-accent-rgb) / 0.15)' : 'none',
                }}
              />

              {/* Version header */}
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 10 }}>
                <h2 className="font-display" style={{ fontSize: 22, fontWeight: 700 }}>
                  {rel.version}
                </h2>
                {rel.current && (
                  <span
                    style={{
                      padding: '2px 8px',
                      background: 'rgb(var(--m-accent-rgb) / 0.15)',
                      border: '1px solid rgb(var(--m-accent-rgb) / 0.3)',
                      borderRadius: 4,
                      fontSize: 10,
                      fontWeight: 600,
                      color: 'var(--m-accent)',
                      letterSpacing: '0.06em',
                    }}
                  >
                    ATUAL
                  </span>
                )}
                <div style={{ flex: 1 }} />
                <span style={{ fontSize: 12, color: 'var(--m-text-dim)' }}>{rel.date}</span>
              </div>

              {/* Label destaque (se houver) */}
              {rel.label && (
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: 8,
                    padding: '10px 12px',
                    background: 'rgba(139,127,255,0.06)',
                    border: '1px solid rgba(139,127,255,0.2)',
                    borderRadius: 8,
                    marginBottom: 10,
                  }}
                >
                  <span
                    style={{
                      padding: '2px 7px',
                      background: TAG_META.big.bg,
                      color: TAG_META.big.fg,
                      borderRadius: 4,
                      fontSize: 9,
                      fontWeight: 700,
                      letterSpacing: '0.06em',
                      flexShrink: 0,
                      marginTop: 1,
                    }}
                  >
                    {TAG_META.big.label}
                  </span>
                  <span style={{ fontSize: 13, color: 'var(--m-text)', lineHeight: 1.5 }}>{rel.label}</span>
                </div>
              )}

              {/* Entries box */}
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 8,
                  padding: '14px 16px',
                  background: 'var(--m-surface)',
                  border: '1px solid var(--m-border)',
                  borderRadius: 12,
                }}
              >
                {rel.entries.map((entry, i) => {
                  const m = TAG_META[entry.tag]
                  return (
                    <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                      <span
                        style={{
                          padding: '2px 7px',
                          background: m.bg,
                          color: m.fg,
                          borderRadius: 4,
                          fontSize: 9,
                          fontWeight: 700,
                          letterSpacing: '0.06em',
                          flexShrink: 0,
                          marginTop: 1,
                          minWidth: 68,
                          textAlign: 'center',
                        }}
                      >
                        {m.label}
                      </span>
                      <span style={{ fontSize: 12, color: 'var(--m-text-dim)', lineHeight: 1.55 }}>
                        {entry.text}
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div style={{ marginTop: 32, textAlign: 'center' }}>
          <p style={{ fontSize: 12, color: 'var(--m-text-dim)' }}>
            Metis está em pre-release — bugs fazem parte. Encontrou algo?{' '}
            <Link
              href="/chat"
              className="m-hover-link"
              style={{ color: 'var(--m-accent)', textDecoration: 'none' }}
            >
              Fale com a Metis.
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
