'use client'

import { useState, useEffect } from 'react'
import Image from 'next/image'
import { useLocale, useTranslations } from 'next-intl'
import { DDRAGON_VERSION, roleIconPath } from '@/lib/ddragon'
import { apiFetch } from '@/lib/api'
import {
  AppHeader,
  Card,
  SectionLabel,
  Pill,
  Bar,
  Icon,
  type Role,
} from '@/components/design'
import { formatNumber } from '@/lib/format'
import type { Locale } from '@/i18n/config'

type RoleLabelKey = 'role_all' | 'role_top' | 'role_jungle' | 'role_mid' | 'role_adc' | 'role_sup'

type ItemStat = {
  item_id: number
  item_name: string
  picks: number
  wins: number
  winrate: number
  // Enriquecido a partir de p-0.9.8.1 (tabela `items` no Supabase).
  gold_cost?: number
  tags?: string[]
  category?: string | null
  trend?: 'up' | 'down' | 'flat' | null
}

const ROLES: { v: '' | Role; labelKey: RoleLabelKey; iconRole: Role | null }[] = [
  { v: '',        labelKey: 'role_all',    iconRole: null },
  { v: 'TOP',     labelKey: 'role_top',    iconRole: 'TOP' },
  { v: 'JUNGLE',  labelKey: 'role_jungle', iconRole: 'JUNGLE' },
  { v: 'MIDDLE',  labelKey: 'role_mid',    iconRole: 'MIDDLE' },
  { v: 'BOTTOM',  labelKey: 'role_adc',    iconRole: 'BOTTOM' },
  { v: 'UTILITY', labelKey: 'role_sup',    iconRole: 'UTILITY' },
]

const MIN_PICKS_FOR_WR_SPOTLIGHT = 10

function itemIconUrl(id: number) {
  return `https://ddragon.leagueoflegends.com/cdn/${DDRAGON_VERSION}/img/item/${id}.png`
}

export default function ItemsPage() {
  const t = useTranslations('items')
  const locale = useLocale() as Locale
  const [data, setData] = useState<ItemStat[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [role, setRole] = useState<'' | Role>('')
  const [patches, setPatches] = useState<string[]>([])
  const [patch, setPatch] = useState('')
  const [search, setSearch] = useState('')
  const [sortBy, setSortBy] = useState<'picks' | 'winrate'>('picks')

  useEffect(() => {
    apiFetch('/api/v1/stats/patches')
      .then((r) => (r.ok ? r.json() : []))
      .then(setPatches)
      .catch(() => {})
  }, [])

  useEffect(() => {
    async function load() {
      setLoading(true)
      setError(null)
      try {
        const params = new URLSearchParams({ min_picks: '3' })
        if (role) params.set('role', role)
        if (patch) params.set('patch', patch)
        const res = await apiFetch(`/api/v1/items/ranking?${params}`)
        if (!res.ok) throw new Error(`Erro ${res.status}`)
        setData(await res.json())
      } catch {
        setError(t('error_load'))
      } finally {
        setLoading(false)
      }
    }
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [role, patch])

  // Spotlight: top 3 por picks + top 3 por WR (com amostra mínima).
  const top3Picks = [...data].sort((a, b) => b.picks - a.picks).slice(0, 3)
  const top3WR = [...data]
    .filter((x) => x.picks >= MIN_PICKS_FOR_WR_SPOTLIGHT)
    .sort((a, b) => b.winrate - a.winrate)
    .slice(0, 3)

  // Lista filtrada por busca + sort.
  const searchLower = search.trim().toLowerCase()
  const filtered = data
    .filter((i) => (searchLower ? i.item_name.toLowerCase().includes(searchLower) : true))
    .sort((a, b) => (sortBy === 'picks' ? b.picks - a.picks : b.winrate - a.winrate))

  const maxPicks = data.reduce((m, i) => Math.max(m, i.picks), 0) || 1

  return (
    <div className="metis-scope" style={{ minHeight: '100vh', background: 'var(--m-bg)' }}>
      <AppHeader active="items" />

      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '28px 28px 48px' }}>
        {/* Title */}
        <div style={{ marginBottom: 20 }}>
          <div
            style={{
              fontSize: 11,
              color: 'var(--m-text-dim)',
              textTransform: 'uppercase',
              letterSpacing: '0.1em',
              fontWeight: 600,
              marginBottom: 8,
            }}
          >
            {patch ? t('eyebrow_patch', { patch }) : t('eyebrow_all_patches')}
          </div>
          <h1
            className="font-display"
            style={{ fontSize: 40, fontWeight: 700, letterSpacing: '-0.03em', marginBottom: 6 }}
          >
            {t('title')}
          </h1>
          <p style={{ fontSize: 14, color: 'var(--m-text-dim)' }}>
            {t('subtitle_part1')}{' '}
            <span className="tabular" style={{ color: 'var(--m-text)', fontWeight: 600 }}>
              {formatNumber(data.length, locale)}
            </span>{' '}
            {t('subtitle_part2')}
          </p>
        </div>

        {/* Spotlight duplo: top picks + top WR */}
        {!loading && !error && data.length > 0 && (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(420px, 1fr))',
              gap: 16,
              marginBottom: 24,
            }}
          >
            <Card>
              <SectionLabel
                icon="flame"
                right={
                  <span
                    style={{
                      fontSize: 10,
                      color: 'var(--m-muted)',
                      textTransform: 'uppercase',
                      letterSpacing: '0.06em',
                    }}
                  >
                    {t('spotlight_popular')}
                  </span>
                }
              >
                {t('spotlight_popular_title')}
              </SectionLabel>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {top3Picks.map((it, i) => (
                  <div
                    key={it.item_id}
                    style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 4px' }}
                  >
                    <div
                      className="tabular font-display"
                      style={{
                        fontSize: 24,
                        fontWeight: 700,
                        color: 'var(--m-accent)',
                        width: 28,
                        textAlign: 'right',
                      }}
                    >
                      {i + 1}
                    </div>
                    <Image
                      src={itemIconUrl(it.item_id)}
                      alt={it.item_name}
                      width={44}
                      height={44}
                      unoptimized
                      style={{
                        borderRadius: 8,
                        border: '1px solid var(--m-border-2)',
                        flexShrink: 0,
                      }}
                    />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 600 }}>{it.item_name}</div>
                      <div style={{ fontSize: 11, color: 'var(--m-text-dim)', marginTop: 2 }}>
                        {it.gold_cost ? `${formatNumber(it.gold_cost, locale)}g` : `id ${it.item_id}`}
                        {it.category && ` · ${it.category}`}
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div className="tabular" style={{ fontSize: 13, fontWeight: 600 }}>
                        {formatNumber(it.picks, locale)}
                      </div>
                      <div style={{ fontSize: 10, color: 'var(--m-muted)' }}>{t('picks_label')}</div>
                    </div>
                  </div>
                ))}
              </div>
            </Card>

            <Card>
              <SectionLabel
                icon="trending"
                right={
                  <span
                    style={{
                      fontSize: 10,
                      color: 'var(--m-green)',
                      textTransform: 'uppercase',
                      letterSpacing: '0.06em',
                    }}
                  >
                    {t('spotlight_efficient')}
                  </span>
                }
              >
                {t('spotlight_wr_title', { min: MIN_PICKS_FOR_WR_SPOTLIGHT })}
              </SectionLabel>
              {top3WR.length === 0 ? (
                <p style={{ fontSize: 12, color: 'var(--m-text-dim)', padding: '20px 4px' }}>
                  {t('spotlight_wr_empty')}
                </p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {top3WR.map((it, i) => (
                    <div
                      key={it.item_id}
                      style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 4px' }}
                    >
                      <div
                        className="tabular font-display"
                        style={{
                          fontSize: 24,
                          fontWeight: 700,
                          color: 'var(--m-green)',
                          width: 28,
                          textAlign: 'right',
                        }}
                      >
                        {i + 1}
                      </div>
                      <Image
                        src={itemIconUrl(it.item_id)}
                        alt={it.item_name}
                        width={44}
                        height={44}
                        unoptimized
                        style={{
                          borderRadius: 8,
                          border: '1px solid var(--m-border-2)',
                          flexShrink: 0,
                        }}
                      />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 600 }}>{it.item_name}</div>
                        <div style={{ fontSize: 11, color: 'var(--m-text-dim)', marginTop: 2 }}>
                          {it.gold_cost ? `${formatNumber(it.gold_cost, locale)}g · ` : ''}
                          {it.picks} {t('picks_label')} · {it.wins}{t('wins_suffix')}
                        </div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div
                          className="tabular"
                          style={{ fontSize: 15, fontWeight: 700, color: 'var(--m-green)' }}
                        >
                          {it.winrate.toFixed(1)}%
                        </div>
                        <div style={{ fontSize: 10, color: 'var(--m-muted)' }}>{t('winrate_label')}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </div>
        )}

        {/* Filtros */}
        <Card pad={16} style={{ marginBottom: 16 }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center' }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                flex: '1 1 240px',
                padding: '8px 12px',
                background: 'var(--m-bg)',
                border: '1px solid var(--m-border)',
                borderRadius: 10,
              }}
            >
              <Icon name="search" size={14} style={{ color: 'var(--m-text-dim)' }} />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={t('search_placeholder')}
                style={{
                  flex: 1,
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--m-text)',
                  fontSize: 13,
                  outline: 'none',
                  fontFamily: 'inherit',
                }}
              />
            </div>

            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
              {ROLES.map((r) => {
                const active = role === r.v
                return (
                  <button
                    key={r.labelKey}
                    type="button"
                    onClick={() => setRole(r.v)}
                    className="m-hover-surface"
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 6,
                      padding: '7px 12px',
                      borderRadius: 8,
                      background: active ? 'var(--m-accent)' : 'transparent',
                      color: active ? '#1a1510' : 'var(--m-text-dim)',
                      border: `1px solid ${active ? 'var(--m-accent)' : 'var(--m-border)'}`,
                      fontSize: 12,
                      fontWeight: 600,
                      cursor: 'pointer',
                      fontFamily: 'inherit',
                    }}
                  >
                    {r.iconRole && (
                      <Image
                        src={roleIconPath(r.iconRole)}
                        alt=""
                        width={13}
                        height={13}
                        unoptimized
                        style={{ objectFit: 'contain', filter: active ? 'brightness(0.2)' : 'none' }}
                      />
                    )}
                    {t(r.labelKey)}
                  </button>
                )
              })}
            </div>

            <select
              value={patch}
              onChange={(e) => setPatch(e.target.value)}
              style={{
                padding: '7px 12px',
                background: 'var(--m-bg)',
                border: '1px solid var(--m-border)',
                borderRadius: 8,
                color: 'var(--m-text)',
                fontSize: 12,
                fontFamily: 'inherit',
                outline: 'none',
              }}
            >
              <option value="">{t('all_patches')}</option>
              {patches.map((p) => (
                <option key={p} value={p}>
                  {t('patch_option', { patch: p })}
                </option>
              ))}
            </select>

            <div style={{ marginLeft: 'auto', display: 'flex', gap: 4, alignItems: 'center' }}>
              <span
                style={{
                  fontSize: 11,
                  color: 'var(--m-muted)',
                  marginRight: 4,
                  textTransform: 'uppercase',
                  letterSpacing: '0.08em',
                  fontWeight: 600,
                }}
              >
                {t('sort_label')}
              </span>
              <Pill color="accent" active={sortBy === 'picks'} onClick={() => setSortBy('picks')}>
                {t('sort_popular')}
              </Pill>
              <Pill color="accent" active={sortBy === 'winrate'} onClick={() => setSortBy('winrate')}>
                {t('sort_winrate')}
              </Pill>
            </div>
          </div>
        </Card>

        {/* Tabela */}
        {loading ? (
          <div style={{ display: 'flex', gap: 6, padding: '80px 0', justifyContent: 'center' }}>
            {[0, 150, 300].map((d) => (
              <span
                key={d}
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                  background: 'var(--m-accent)',
                  animation: 'm-bounce 1.4s infinite ease-in-out both',
                  animationDelay: `${d}ms`,
                }}
              />
            ))}
          </div>
        ) : error ? (
          <Card>
            <p style={{ fontSize: 13, color: 'var(--m-text-dim)' }}>{error}</p>
          </Card>
        ) : filtered.length === 0 ? (
          <Card>
            <p style={{ fontSize: 13, color: 'var(--m-text-dim)' }}>
              {t('empty_filtered')}
            </p>
          </Card>
        ) : (
          <Card pad={0}>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '42px 1.6fr 100px 80px 140px 140px 100px',
                gap: 12,
                padding: '10px 20px',
                fontSize: 10,
                color: 'var(--m-muted)',
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
                fontWeight: 600,
                borderBottom: '1px solid var(--m-border)',
              }}
            >
              <span>#</span>
              <span>{t('col_item')}</span>
              <span>{t('col_category')}</span>
              <span className="tabular">{t('col_cost')}</span>
              <span className="tabular">{t('col_picks')}</span>
              <span>{t('col_winrate')}</span>
              <span>{t('col_trend')}</span>
            </div>
            {filtered.map((it, i) => {
              const tags = it.tags ?? []
              return (
                <div
                  key={it.item_id}
                  className="m-hover-row"
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '42px 1.6fr 100px 80px 140px 140px 100px',
                    gap: 12,
                    padding: '12px 20px',
                    alignItems: 'center',
                    borderBottom: '1px solid rgba(34,40,56,0.4)',
                  }}
                >
                  <span
                    className="tabular font-display"
                    style={{ fontSize: 16, fontWeight: 700, color: 'var(--m-text-dim)' }}
                  >
                    {i + 1}
                  </span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
                    <Image
                      src={itemIconUrl(it.item_id)}
                      alt={it.item_name}
                      width={36}
                      height={36}
                      unoptimized
                      style={{
                        borderRadius: 7,
                        border: '1px solid var(--m-border-2)',
                        flexShrink: 0,
                      }}
                    />
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ fontSize: 13, fontWeight: 500 }}>{it.item_name}</div>
                      {tags.length > 0 && (
                        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 3 }}>
                          {tags.slice(0, 3).map((t) => (
                            <span
                              key={t}
                              style={{
                                fontSize: 9,
                                padding: '1px 6px',
                                background: 'var(--m-surface-2)',
                                border: '1px solid var(--m-border-2)',
                                borderRadius: 3,
                                color: 'var(--m-text-dim)',
                              }}
                            >
                              {t}
                            </span>
                          ))}
                          {tags.length > 3 && (
                            <span style={{ fontSize: 9, color: 'var(--m-muted)', padding: '1px 4px' }}>
                              +{tags.length - 3}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                  {it.category ? (
                    <span
                      style={{
                        fontSize: 11,
                        color: 'var(--m-text-dim)',
                        background: 'var(--m-surface-2)',
                        border: '1px solid var(--m-border-2)',
                        borderRadius: 6,
                        padding: '3px 8px',
                        justifySelf: 'start',
                      }}
                    >
                      {it.category}
                    </span>
                  ) : (
                    <span style={{ fontSize: 11, color: 'var(--m-muted)' }}>—</span>
                  )}
                  <span
                    className="tabular"
                    style={{ fontSize: 12, fontWeight: 500, color: 'var(--m-accent)' }}
                  >
                    {it.gold_cost ? `${formatNumber(it.gold_cost, locale)}g` : '—'}
                  </span>
                  <div>
                    <div className="tabular" style={{ fontSize: 13, fontWeight: 600 }}>
                      {formatNumber(it.picks, locale)}
                    </div>
                    <Bar value={it.picks} max={maxPicks} color="var(--m-accent)" height={3} />
                  </div>
                  <div>
                    <div
                      className="tabular"
                      style={{
                        fontSize: 14,
                        fontWeight: 700,
                        color:
                          it.winrate > 52
                            ? 'var(--m-green)'
                            : it.winrate > 48
                            ? 'var(--m-text)'
                            : 'var(--m-red)',
                      }}
                    >
                      {it.winrate.toFixed(1)}%
                    </div>
                    <Bar
                      value={it.winrate - 40}
                      max={25}
                      color={
                        it.winrate > 52
                          ? 'var(--m-green)'
                          : it.winrate > 48
                          ? 'var(--m-accent)'
                          : 'var(--m-red)'
                      }
                      height={3}
                    />
                  </div>
                  <span
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 4,
                      fontSize: 11,
                      fontWeight: 600,
                      color:
                        it.trend === 'up'
                          ? 'var(--m-green)'
                          : it.trend === 'down'
                          ? 'var(--m-red)'
                          : 'var(--m-muted)',
                    }}
                  >
                    {it.trend === 'up' ? t('trend_up')
                      : it.trend === 'down' ? t('trend_down')
                      : it.trend === 'flat' ? t('trend_flat')
                      : '—'}
                  </span>
                </div>
              )
            })}
          </Card>
        )}
      </div>

      <style jsx>{`
        @keyframes m-bounce {
          0%, 80%, 100% { transform: scale(0); }
          40% { transform: scale(1); }
        }
      `}</style>
    </div>
  )
}
