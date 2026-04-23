'use client'

import { useEffect, useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { AppHeader, Stat, Icon } from '@/components/design'
import { formatNumber } from '@/lib/format'
import type { Locale } from '@/i18n/config'

// ── Dinâmico: GitHub API + cálculo local ────────────────────────
const REPO = 'Czar210/Metis'
// Primeiro commit do repo: `git log --reverse` retornou "2026-02-24".
const FIRST_COMMIT_DATE = new Date('2026-02-24T10:02:07-03:00')

function totalCommitsFromLinkHeader(link: string | null): number | null {
  if (!link) return null
  const match = link.match(/<[^>]+[?&]page=(\d+)[^>]*>;\s*rel="last"/)
  return match ? parseInt(match[1], 10) : null
}

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
type MemberId = 'cesar' | 'takida' | 'andre'
type Member = {
  id: MemberId
  name: string
  initials: string
  color: string
  company?: string
  tagCount: number
  hasQuote: boolean
  link: { labelKey: 'portfolio' | 'linkedin'; href: string }
}

const TEAM: Member[] = [
  {
    id: 'cesar',
    name: 'César Sibila',
    initials: 'CS',
    color: '#F5C842',
    company: 'AI Engineer Jr @ Izii',
    tagCount: 3,
    hasQuote: true,
    link: { labelKey: 'portfolio', href: 'https://cesarsibila.vercel.app/' },
  },
  {
    id: 'takida',
    name: 'Enzo Takida',
    initials: 'ET',
    color: '#F87171',
    tagCount: 3,
    hasQuote: false,
    link: { labelKey: 'linkedin', href: 'https://www.linkedin.com/in/enzo-kikuji-takida/' },
  },
  {
    id: 'andre',
    name: 'André Messina',
    initials: 'AM',
    color: '#4ADE80',
    company: 'Data Analytics @ Rappi',
    tagCount: 3,
    hasQuote: false,
    link: { labelKey: 'linkedin', href: 'https://www.linkedin.com/in/andre-messina-506179239/' },
  },
]

export default function TeamPage() {
  const t = useTranslations('team')
  const locale = useLocale() as Locale
  const [commitCount, setCommitCount] = useState<number | null>(null)
  const [lineCount, setLineCount] = useState<number | null>(null)

  const daysBuilding = Math.max(
    1,
    Math.floor((Date.now() - FIRST_COMMIT_DATE.getTime()) / 86_400_000)
  )
  const redBulls = daysBuilding * 4

  useEffect(() => {
    fetch(`https://api.github.com/repos/${REPO}/commits?per_page=1`)
      .then((r) => {
        const linkHeader = r.headers.get('link') ?? r.headers.get('Link')
        const n = totalCommitsFromLinkHeader(linkHeader)
        if (n !== null) setCommitCount(n)
        else if (r.ok) {
          r.json().then((d) => {
            if (Array.isArray(d)) setCommitCount(d.length)
          })
        }
      })
      .catch(() => {})

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
            {t('eyebrow')}
          </div>
          <h1
            className="font-display"
            style={{ fontSize: 44, fontWeight: 700, letterSpacing: '-0.03em', marginBottom: 12 }}
          >
            {t('title_part1')} <span style={{ color: 'var(--m-accent)' }}>{t('title_highlight')}</span>
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
            {t('subtitle')}
          </p>
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
            gap: 16,
          }}
        >
          {TEAM.map((m) => {
            const title = t(`members.${m.id}.title`)
            const tags = Array.from({ length: m.tagCount }, (_, i) =>
              t(`members.${m.id}.tag_${i + 1}` as `members.cesar.tag_1`)
            )
            const quote = m.hasQuote ? t(`members.${m.id}.quote` as `members.cesar.quote`) : null

            return (
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
                      {title}
                    </div>
                    {m.company && (
                      <div style={{ fontSize: 10, color: 'var(--m-text-dim)', marginTop: 1 }}>
                        {m.company}
                      </div>
                    )}
                  </div>
                </div>

                <div
                  style={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    gap: 6,
                    marginBottom: 16,
                    position: 'relative',
                  }}
                >
                  {tags.map((tag) => (
                    <span
                      key={tag}
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
                      {tag}
                    </span>
                  ))}
                </div>

                {quote ? (
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
                    &quot;{quote}&quot;
                  </blockquote>
                ) : (
                  <div style={{ flex: 1 }} />
                )}

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
                  {t(m.link.labelKey)}
                  <Icon name="arrowRight" size={12} />
                </a>
              </div>
            )
          })}
        </div>

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
            label={t('stats.days_building')}
            value={formatNumber(daysBuilding, locale)}
            sub={t('stats.days_building_sub')}
          />
          <Stat
            size="lg"
            label={t('stats.commits')}
            value={commitCount !== null ? formatNumber(commitCount, locale) : '—'}
            sub={commitCount !== null ? t('stats.commits_done') : t('stats.loading')}
          />
          <Stat
            size="lg"
            label={t('stats.lines_of_code')}
            value={lineCount !== null ? formatLines(lineCount) : '—'}
            sub={lineCount !== null ? t('stats.lines_sub') : t('stats.loading')}
            accent="var(--m-cyan)"
          />
          <Stat
            size="lg"
            label={t('stats.red_bulls')}
            value={formatNumber(redBulls, locale)}
            sub={t('stats.red_bulls_sub')}
            accent="var(--m-accent)"
          />
        </div>
      </div>
    </div>
  )
}
