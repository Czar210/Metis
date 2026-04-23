'use client'

import { useEffect, useState } from 'react'
import { AppHeader, Stat, Icon } from '@/components/design'

// ── Dinâmico: GitHub API + cálculo local ────────────────────────
const REPO = 'Czar210/Metis'
// Primeiro commit do repo: `git log --reverse` retornou "2026-02-24".
const FIRST_COMMIT_DATE = new Date('2026-02-24T10:02:07-03:00')

/** Parseia o header Link do GitHub pra extrair o total de páginas (= total de commits). */
function totalCommitsFromLinkHeader(link: string | null): number | null {
  if (!link) return null
  const match = link.match(/<[^>]+[?&]page=(\d+)[^>]*>;\s*rel="last"/)
  return match ? parseInt(match[1], 10) : null
}

/** Estima linhas de código a partir de bytes por linguagem.
 *  Constantes empíricas (aprox chars/linha) por linguagem, com fallback 30. */
function estimateLines(bytesByLang: Record<string, number>): number {
  const charsPerLine: Record<string, number> = {
    TypeScript: 35, TSX: 35, JavaScript: 32, Python: 28,
    SQL: 45, CSS: 40, HTML: 50, Shell: 35, Dockerfile: 35,
  }
  let total = 0
  for (const [lang, bytes] of Object.entries(bytesByLang)) {
    total += bytes / (charsPerLine[lang] ?? 30)
  }
  return Math.round(total)
}

// ── Types ──────────────────────────────────────────────────────
type Member = {
  name: string
  initials: string
  color: string          // hex do accent do membro
  title: string
  company?: string
  tags: string[]
  quote?: string
  link: { label: string; href: string }
}

// ── Data ───────────────────────────────────────────────────────
const TEAM: Member[] = [
  {
    name: 'César Sibila',
    initials: 'CS',
    color: '#F5C842',
    title: 'Engenheiro de Dados',
    company: 'AI Engineer Jr @ Izii',
    tags: ['Tech Lead', 'Data Architect', 'CI/CD & Infra'],
    quote: 'Construo software como se fosse pra eu mesmo usar, e pra falar a verdade esse geralmente é o caso.',
    link: { label: 'Portfólio', href: 'https://cesarsibila.vercel.app/' },
  },
  {
    name: 'Enzo Takida',
    initials: 'ET',
    color: '#F87171',
    title: 'Data Analytics',
    tags: ['Frontend & UX', 'Supabase Auth', 'Design System'],
    link: { label: 'LinkedIn', href: 'https://www.linkedin.com/in/enzo-kikuji-takida/' },
  },
  {
    name: 'André Messina',
    initials: 'AM',
    color: '#4ADE80',
    title: 'Cientista de Dados Jr',
    company: 'Data Analytics @ Rappi',
    tags: ['Backend & AI Engineer', 'Arquitetura de Dados', 'Prompt Engineering'],
    link: { label: 'LinkedIn', href: 'https://www.linkedin.com/in/andre-messina-506179239/' },
  },
]

export default function TeamPage() {
  const [commitCount, setCommitCount] = useState<number | null>(null)
  const [lineCount, setLineCount] = useState<number | null>(null)

  // Dias construindo: diff entre hoje e o primeiro commit (cálculo local, não API).
  const daysBuilding = Math.max(
    1,
    Math.floor((Date.now() - FIRST_COMMIT_DATE.getTime()) / 86_400_000)
  )
  // Red Bulls do André = 4 por dia.
  const redBulls = daysBuilding * 4

  useEffect(() => {
    // GitHub API pública (60 req/h por IP, sem auth).
    // Total de commits: abrimos a lista com per_page=1 e lemos o header Link → ?page=N&rel="last"
    fetch(`https://api.github.com/repos/${REPO}/commits?per_page=1`)
      .then((r) => {
        const linkHeader = r.headers.get('link') ?? r.headers.get('Link')
        const n = totalCommitsFromLinkHeader(linkHeader)
        if (n !== null) setCommitCount(n)
        else if (r.ok) {
          // Se só tem 1 página, não vem Link header — contar via length.
          r.json().then((d) => {
            if (Array.isArray(d)) setCommitCount(d.length)
          })
        }
      })
      .catch(() => {})

    // Bytes por linguagem → estimativa de linhas
    fetch(`https://api.github.com/repos/${REPO}/languages`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d: Record<string, number> | null) => {
        if (d) setLineCount(estimateLines(d))
      })
      .catch(() => {})
  }, [])

  const formatLines = (n: number): string => {
    if (n >= 1000) return `${(n / 1000).toFixed(1)}k`
    return String(n)
  }

  return (
    <div className="metis-scope" style={{ minHeight: '100vh', background: 'var(--m-bg)' }}>
      <AppHeader active="team" />

      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '52px 28px 48px' }}>
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: 44 }}>
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              fontSize: 11,
              color: 'var(--m-accent)',
              textTransform: 'uppercase',
              letterSpacing: '0.14em',
              fontWeight: 700,
              marginBottom: 14,
            }}
          >
            // Equipe
          </div>
          <h1
            className="font-display"
            style={{ fontSize: 44, fontWeight: 700, letterSpacing: '-0.03em', marginBottom: 12 }}
          >
            Quem faz a <span style={{ color: 'var(--m-accent)' }}>Metis</span>
          </h1>
          <p
            style={{
              fontSize: 15,
              color: 'var(--m-text-dim)',
              maxWidth: 540,
              margin: '0 auto',
              lineHeight: 1.55,
            }}
          >
            Três pessoas construindo algo que gostariam de ter tido quando estavam aprendendo o jogo.
          </p>
        </div>

        {/* Cards */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
            gap: 16,
          }}
        >
          {TEAM.map((m) => (
            <div
              key={m.name}
              style={{
                padding: 24,
                background: 'var(--m-surface)',
                border: `1px solid ${m.color}33`,
                borderRadius: 16,
                position: 'relative',
                overflow: 'hidden',
                display: 'flex',
                flexDirection: 'column',
              }}
            >
              {/* Glow decorativo */}
              <div
                style={{
                  position: 'absolute',
                  top: -40,
                  right: -40,
                  width: 140,
                  height: 140,
                  borderRadius: '50%',
                  background: `radial-gradient(circle, ${m.color}22, transparent 70%)`,
                  filter: 'blur(30px)',
                  pointerEvents: 'none',
                }}
              />

              {/* Header do card */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  marginBottom: 14,
                  position: 'relative',
                }}
              >
                <div
                  style={{
                    width: 48,
                    height: 48,
                    borderRadius: '50%',
                    background: m.color,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#0B0D12',
                    fontSize: 16,
                    fontWeight: 800,
                    flexShrink: 0,
                  }}
                >
                  {m.initials}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="font-display" style={{ fontSize: 17, fontWeight: 600 }}>
                    {m.name}
                  </div>
                  <div style={{ fontSize: 11, color: m.color, fontWeight: 600, marginTop: 2 }}>
                    {m.title}
                  </div>
                  {m.company && (
                    <div style={{ fontSize: 10, color: 'var(--m-text-dim)', marginTop: 1 }}>
                      {m.company}
                    </div>
                  )}
                </div>
              </div>

              {/* Tags */}
              <div
                style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: 6,
                  marginBottom: 16,
                  position: 'relative',
                }}
              >
                {m.tags.map((t) => (
                  <span
                    key={t}
                    style={{
                      padding: '3px 10px',
                      background: `${m.color}1a`,
                      border: `1px solid ${m.color}40`,
                      borderRadius: 999,
                      fontSize: 10,
                      color: m.color,
                      fontWeight: 500,
                    }}
                  >
                    {t}
                  </span>
                ))}
              </div>

              {/* Quote (opcional) */}
              {m.quote ? (
                <blockquote
                  style={{
                    margin: 0,
                    padding: '10px 12px',
                    background: 'var(--m-bg)',
                    border: '1px solid var(--m-border)',
                    borderLeft: `2px solid ${m.color}`,
                    borderRadius: 8,
                    fontSize: 12,
                    color: 'var(--m-text-dim)',
                    fontStyle: 'italic',
                    lineHeight: 1.5,
                    marginBottom: 14,
                    position: 'relative',
                  }}
                >
                  &quot;{m.quote}&quot;
                </blockquote>
              ) : (
                <div style={{ flex: 1 }} />
              )}

              {/* Link */}
              <a
                href={m.link.href}
                target="_blank"
                rel="noopener noreferrer"
                className="m-hover-outline"
                style={{
                  width: '100%',
                  padding: '9px 12px',
                  background: 'transparent',
                  border: `1px solid ${m.color}`,
                  borderRadius: 8,
                  color: m.color,
                  fontSize: 12,
                  fontWeight: 600,
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 6,
                  textDecoration: 'none',
                  position: 'relative',
                }}
              >
                {m.link.label}
                <Icon name="arrowRight" size={12} />
              </a>
            </div>
          ))}
        </div>

        {/* Stats footer */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
            gap: 14,
            marginTop: 36,
            padding: 24,
            background: 'var(--m-surface)',
            border: '1px solid var(--m-border)',
            borderRadius: 16,
          }}
        >
          <Stat
            size="lg"
            label="Dias construindo"
            value={daysBuilding.toLocaleString('pt-BR')}
            sub="desde 24/02/2026"
          />
          <Stat
            size="lg"
            label="Commits"
            value={commitCount !== null ? commitCount.toLocaleString('pt-BR') : '—'}
            sub={commitCount !== null ? 'tudo versionado' : 'carregando...'}
          />
          <Stat
            size="lg"
            label="Linhas de código"
            value={lineCount !== null ? formatLines(lineCount) : '—'}
            sub={lineCount !== null ? 'estimado do GitHub /languages' : 'carregando...'}
            accent="var(--m-cyan)"
          />
          <Stat
            size="lg"
            label="Red Bulls (André)"
            value={redBulls.toLocaleString('pt-BR')}
            sub="A Energia do guerreiro"
            accent="var(--m-accent)"
          />
        </div>
      </div>
    </div>
  )
}
