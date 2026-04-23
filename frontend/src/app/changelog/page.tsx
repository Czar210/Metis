'use client'

import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { AppHeader, Icon } from '@/components/design'

// ── Types ──────────────────────────────────────────────────────
type TagKind = 'novo' | 'melhoria' | 'fix' | 'big'

type Release = {
  /** Chave i18n em `changelog.releases.<id>`. */
  id: string
  version: string
  date: string
  hasLabel?: boolean
  current?: boolean
  entries: TagKind[]
}

// ── Data (entries em ordem, textos vêm via i18n) ───────────────
const RELEASES: Release[] = [
  {
    id: 'p_0_9_22',
    version: 'p-0.9.22',
    date: '04/2026',
    hasLabel: true,
    current: true,
    entries: ['melhoria', 'melhoria', 'novo'],
  },
  {
    id: 'p_0_9_21',
    version: 'p-0.9.21',
    date: '04/2026',
    hasLabel: true,
    entries: ['big', 'novo', 'melhoria'],
  },
  {
    id: 'p_0_9_20',
    version: 'p-0.9.20',
    date: '04/2026',
    hasLabel: true,
    entries: ['big', 'novo', 'novo', 'novo'],
  },
  {
    id: 'p_0_9_19_1',
    version: 'p-0.9.19.1',
    date: '04/2026',
    hasLabel: true,
    entries: ['novo', 'fix'],
  },
  {
    id: 'p_0_9_19',
    version: 'p-0.9.19',
    date: '04/2026',
    hasLabel: true,
    entries: ['melhoria', 'novo'],
  },
  {
    id: 'p_0_9_18',
    version: 'p-0.9.18',
    date: '04/2026',
    hasLabel: true,
    entries: ['big', 'novo', 'novo'],
  },
  {
    id: 'p_0_9_17',
    version: 'p-0.9.17',
    date: '04/2026',
    hasLabel: true,
    entries: ['melhoria', 'novo'],
  },
  {
    id: 'p_0_9_16',
    version: 'p-0.9.16',
    date: '04/2026',
    hasLabel: true,
    entries: ['melhoria', 'fix'],
  },
  {
    id: 'p_0_9_15',
    version: 'p-0.9.15',
    date: '04/2026',
    hasLabel: true,
    entries: ['big', 'novo', 'novo', 'novo'],
  },
  {
    id: 'p_0_9_14',
    version: 'p-0.9.14',
    date: '04/2026',
    hasLabel: true,
    entries: ['novo', 'novo'],
  },
  {
    id: 'p_0_9_13',
    version: 'p-0.9.13',
    date: '04/2026',
    hasLabel: true,
    entries: ['big', 'novo', 'novo', 'novo', 'novo', 'novo'],
  },
  {
    id: 'p_0_9_12',
    version: 'p-0.9.12',
    date: '04/2026',
    hasLabel: true,
    entries: ['novo', 'novo'],
  },
  {
    id: 'p_0_9_11',
    version: 'p-0.9.11',
    date: '04/2026',
    hasLabel: true,
    entries: ['novo'],
  },
  {
    id: 'p_0_9_10',
    version: 'p-0.9.10',
    date: '04/2026',
    hasLabel: true,
    entries: ['novo'],
  },
  {
    id: 'p_0_9_9',
    version: 'p-0.9.9',
    date: '04/2026',
    hasLabel: true,
    entries: ['big', 'novo', 'novo', 'melhoria'],
  },
  {
    id: 'p_0_9_8_1',
    version: 'p-0.9.8.1',
    date: '04/2026',
    hasLabel: true,
    entries: ['novo', 'novo', 'melhoria'],
  },
  {
    id: 'p_0_9_8',
    version: 'p-0.9.8',
    date: '04/2026',
    hasLabel: true,
    entries: ['big', 'melhoria'],
  },
  {
    id: 'p_0_9_7',
    version: 'p-0.9.7',
    date: '04/2026',
    hasLabel: true,
    entries: ['big', 'melhoria'],
  },
  {
    id: 'p_0_9_6',
    version: 'p-0.9.6',
    date: '04/2026',
    hasLabel: true,
    entries: ['big', 'novo', 'novo', 'melhoria', 'melhoria'],
  },
  {
    id: 'p_0_9_5',
    version: 'p-0.9.5',
    date: '04/2026',
    hasLabel: true,
    entries: ['big'],
  },
  {
    id: 'p_0_9_4',
    version: 'p-0.9.4',
    date: '04/2026',
    entries: ['novo', 'fix'],
  },
  {
    id: 'p_0_9_3',
    version: 'p-0.9.3',
    date: '04/2026',
    entries: ['novo', 'melhoria', 'melhoria'],
  },
  {
    id: 'p_0_9_2',
    version: 'p-0.9.2',
    date: '04/2026',
    entries: ['novo'],
  },
  {
    id: 'p_0_9_0',
    version: 'p-0.9.0',
    date: '04/2026',
    hasLabel: true,
    entries: ['big', 'novo', 'novo', 'novo', 'novo', 'melhoria'],
  },
  {
    id: 'alpha_v0_8_2',
    version: 'Alpha v0.8.2',
    date: '04/2026',
    hasLabel: true,
    entries: ['big', 'melhoria', 'melhoria', 'melhoria', 'melhoria', 'fix'],
  },
  {
    id: 'alpha_v0_8_1',
    version: 'Alpha v0.8.1',
    date: '04/2026',
    entries: ['melhoria', 'melhoria', 'novo', 'novo'],
  },
  {
    id: 'alpha_v0_8_0',
    version: 'Alpha v0.8.0',
    date: '04/2026',
    hasLabel: true,
    entries: ['big', 'novo', 'novo', 'novo', 'novo', 'novo', 'novo', 'novo', 'novo', 'novo', 'novo', 'melhoria', 'melhoria'],
  },
  {
    id: 'alpha_v0_7_0',
    version: 'Alpha v0.7.0',
    date: '04/2026',
    entries: ['novo', 'melhoria', 'fix'],
  },
  {
    id: 'alpha_v0_6_5',
    version: 'Alpha v0.6.5',
    date: '04/2026',
    entries: ['novo', 'novo'],
  },
  {
    id: 'alpha_v0_6_1',
    version: 'Alpha v0.6.1',
    date: '04/2026',
    entries: ['novo', 'novo', 'novo', 'novo'],
  },
  {
    id: 'alpha_v0_4_0',
    version: 'Alpha v0.4.0',
    date: '04/2026',
    entries: ['novo', 'novo', 'novo'],
  },
  {
    id: 'alpha_v0_1_0',
    version: 'Alpha v0.1.0',
    date: '03/2026',
    entries: ['novo'],
  },
]

const TAG_STYLE: Record<TagKind, { bg: string; fg: string; minWidth: number }> = {
  big:      { bg: 'rgba(139,127,255,0.15)',           fg: 'var(--m-violet)', minWidth: 78 },
  novo:     { bg: 'rgba(74,222,128,0.15)',            fg: 'var(--m-green)',  minWidth: 68 },
  melhoria: { bg: 'rgb(var(--m-accent-rgb) / 0.15)',  fg: 'var(--m-accent)', minWidth: 78 },
  fix:      { bg: 'rgba(96,165,250,0.15)',            fg: 'var(--m-blue)',   minWidth: 68 },
}

export default function ChangelogPage() {
  const t = useTranslations('changelog')

  const tagLabel: Record<TagKind, string> = {
    big: t('tag_big'),
    novo: t('tag_novo'),
    melhoria: t('tag_melhoria'),
    fix: t('tag_fix'),
  }

  return (
    <div className="metis-scope" style={{ minHeight: '100vh', background: 'var(--m-bg)' }}>
      <AppHeader active="changelog" />

      <div style={{ maxWidth: 760, margin: '0 auto', padding: '40px 28px 48px' }}>
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
          <Icon name="sparkles" size={12} /> {t('eyebrow')}
        </div>
        <h1
          className="font-display"
          style={{ fontSize: 40, fontWeight: 700, letterSpacing: '-0.03em', marginBottom: 8 }}
        >
          {t('title')}
        </h1>
        <p style={{ fontSize: 14, color: 'var(--m-text-dim)', marginBottom: 36 }}>
          {t('subtitle')}
        </p>

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
            <div key={rel.id} style={{ position: 'relative', marginBottom: 28 }}>
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
                    {t('label_current')}
                  </span>
                )}
                <div style={{ flex: 1 }} />
                <span style={{ fontSize: 12, color: 'var(--m-text-dim)' }}>{rel.date}</span>
              </div>

              {rel.hasLabel && (
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
                      background: TAG_STYLE.big.bg,
                      color: TAG_STYLE.big.fg,
                      borderRadius: 4,
                      fontSize: 9,
                      fontWeight: 700,
                      letterSpacing: '0.06em',
                      flexShrink: 0,
                      marginTop: 1,
                    }}
                  >
                    {tagLabel.big}
                  </span>
                  <span style={{ fontSize: 13, color: 'var(--m-text)', lineHeight: 1.5 }}>
                    {t(`releases.${rel.id}.label` as 'releases.p_0_9_9.label')}
                  </span>
                </div>
              )}

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
                {rel.entries.map((tag, i) => {
                  const s = TAG_STYLE[tag]
                  return (
                    <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                      <span
                        style={{
                          padding: '2px 7px',
                          background: s.bg,
                          color: s.fg,
                          borderRadius: 4,
                          fontSize: 9,
                          fontWeight: 700,
                          letterSpacing: '0.06em',
                          flexShrink: 0,
                          marginTop: 1,
                          minWidth: s.minWidth,
                          textAlign: 'center',
                        }}
                      >
                        {tagLabel[tag]}
                      </span>
                      <span style={{ fontSize: 12, color: 'var(--m-text-dim)', lineHeight: 1.55 }}>
                        {t(`releases.${rel.id}.entry_${i}` as 'releases.p_0_9_9.entry_0')}
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </div>

        <div style={{ marginTop: 32, textAlign: 'center' }}>
          <p style={{ fontSize: 12, color: 'var(--m-text-dim)' }}>
            {t('footer_part1')}{' '}
            <Link
              href="/chat"
              className="m-hover-link"
              style={{ color: 'var(--m-accent)', textDecoration: 'none' }}
            >
              {t('footer_link')}
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
