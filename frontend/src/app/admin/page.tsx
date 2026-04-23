'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useLocale, useTranslations } from 'next-intl'
import { createClient } from '@/lib/supabase/client'
import { apiFetch } from '@/lib/api'
import {
  AppHeader,
  Card,
  SectionLabel,
  Stat,
  Bar,
  Icon,
} from '@/components/design'
import { formatNumber } from '@/lib/format'
import type { Locale } from '@/i18n/config'

// ── Types ──────────────────────────────────────────────────────
type AdminStats = {
  players_total: number
  matches_clean: number
  matches_dirty_total: number
  matches_dirty_by_reason: Record<string, number>
  participants_total: number
  timelines_saved: number
  synced_last_24h: number
  synced_last_7d: number
}

const REASON_KEY: Record<string, string> = {
  remake:       'reason_remake',
  short_game:   'reason_short_game',
  wrong_queue:  'reason_wrong_queue',
  invalid_json: 'reason_invalid_json',
  afk_status:   'reason_afk_status',
}

// ── Page ───────────────────────────────────────────────────────
export default function AdminPage() {
  const router = useRouter()
  const supabase = createClient()
  const t = useTranslations('admin')
  const tCommon = useTranslations('common')
  const locale = useLocale() as Locale

  const [stats, setStats] = useState<AdminStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const [refreshMsg, setRefreshMsg] = useState<string | null>(null)
  const [refreshMsgIsError, setRefreshMsgIsError] = useState(false)

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.replace('/auth'); return }
      if (!user.app_metadata?.is_admin) { router.replace('/'); return }

      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.replace('/auth'); return }

      try {
        const res = await apiFetch('/api/v1/admin/stats', {
          headers: { Authorization: `Bearer ${session.access_token}` },
        })
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        setStats(await res.json())
      } catch (e) {
        setError(t('load_error', { message: e instanceof Error ? e.message : tCommon('error_unknown') }))
      } finally {
        setLoading(false)
      }
    }
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function handleRefreshCache() {
    setRefreshing(true)
    setRefreshMsg(null)
    setRefreshMsgIsError(false)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { setRefreshing(false); return }
      const res = await apiFetch('/api/v1/admin/refresh-cache', {
        method: 'POST',
        headers: { Authorization: `Bearer ${session.access_token}` },
      })
      const d = await res.json()
      setRefreshMsg(t('cache_updated', { count: d.cleared ?? 0 }))
    } catch {
      setRefreshMsg(t('cache_error'))
      setRefreshMsgIsError(true)
    } finally {
      setRefreshing(false)
      setTimeout(() => setRefreshMsg(null), 5000)
    }
  }

  if (loading) {
    return (
      <div className="metis-scope" style={{ minHeight: '100vh', background: 'var(--m-bg)' }}>
        <AppHeader active="home" />
        <div style={{ padding: '80px 0', display: 'flex', justifyContent: 'center', gap: 6 }}>
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
        <style jsx>{`
          @keyframes m-bounce {
            0%, 80%, 100% { transform: scale(0); }
            40% { transform: scale(1); }
          }
        `}</style>
      </div>
    )
  }

  if (error || !stats) {
    return (
      <div className="metis-scope" style={{ minHeight: '100vh', background: 'var(--m-bg)' }}>
        <AppHeader active="home" />
        <div
          style={{
            padding: '80px 20px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 14,
          }}
        >
          <div
            style={{
              width: 52,
              height: 52,
              borderRadius: 12,
              background: 'rgba(248,113,113,0.1)',
              border: '1px solid rgba(248,113,113,0.3)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--m-red)',
            }}
          >
            <Icon name="x" size={26} />
          </div>
          <p style={{ fontSize: 13, color: 'var(--m-text-dim)' }}>{error ?? tCommon('error_unknown')}</p>
        </div>
      </div>
    )
  }

  const cleanRate =
    stats.matches_clean + stats.matches_dirty_total > 0
      ? Math.round(stats.matches_clean / (stats.matches_clean + stats.matches_dirty_total) * 100)
      : 0

  return (
    <div className="metis-scope" style={{ minHeight: '100vh', background: 'var(--m-bg)' }}>
      <AppHeader active="home" />

      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '32px 28px 48px' }}>
        {/* Header + refresh button */}
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-end',
            justifyContent: 'space-between',
            marginBottom: 24,
            gap: 16,
            flexWrap: 'wrap',
          }}
        >
          <div>
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                fontSize: 11,
                color: 'var(--m-accent)',
                textTransform: 'uppercase',
                letterSpacing: '0.12em',
                fontWeight: 700,
                marginBottom: 8,
              }}
            >
              <Icon name="settings" size={12} /> {t('eyebrow')}
            </div>
            <h1
              className="font-display"
              style={{ fontSize: 36, fontWeight: 700, letterSpacing: '-0.03em' }}
            >
              {t('title')}
            </h1>
            <p style={{ fontSize: 13, color: 'var(--m-text-dim)', marginTop: 4 }}>
              {t('subtitle')}
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {refreshMsg && (
              <span
                style={{
                  fontSize: 11,
                  color: refreshMsgIsError ? 'var(--m-red)' : 'var(--m-green)',
                }}
              >
                {refreshMsg}
              </span>
            )}
            <button
              type="button"
              onClick={handleRefreshCache}
              disabled={refreshing}
              className="m-hover-accent"
              style={{
                padding: '9px 16px',
                background: 'var(--m-accent)',
                color: '#1a1510',
                border: 'none',
                borderRadius: 10,
                fontSize: 12,
                fontWeight: 600,
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                cursor: refreshing ? 'not-allowed' : 'pointer',
                fontFamily: 'inherit',
                opacity: refreshing ? 0.55 : 1,
              }}
            >
              <span
                style={{
                  display: 'inline-block',
                  animation: refreshing ? 'm-spin 1s linear infinite' : 'none',
                }}
              >
                <Icon name="compass" size={13} />
              </span>
              {refreshing ? t('refreshing') : t('refresh_cache')}
            </button>
          </div>
        </div>

        {/* KPIs principais */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: 12,
            marginBottom: 20,
          }}
        >
          <Card>
            <SectionLabel icon="users">{t('kpi.players')}</SectionLabel>
            <Stat
              size="lg"
              label=""
              value={formatNumber(stats.players_total, locale)}
              sub={t('kpi.players_sub')}
            />
          </Card>
          <Card>
            <SectionLabel icon="check">{t('kpi.clean_matches')}</SectionLabel>
            <Stat
              size="lg"
              label=""
              value={formatNumber(stats.matches_clean, locale)}
              sub={t('kpi.clean_matches_sub', { rate: cleanRate })}
              accent="var(--m-green)"
            />
          </Card>
          <Card>
            <SectionLabel icon="x">{t('kpi.dirty_matches')}</SectionLabel>
            <Stat
              size="lg"
              label=""
              value={formatNumber(stats.matches_dirty_total, locale)}
              sub={t('kpi.dirty_matches_sub')}
              accent="var(--m-red)"
            />
          </Card>
          <Card>
            <SectionLabel icon="activity">{t('kpi.timelines')}</SectionLabel>
            <Stat
              size="lg"
              label=""
              value={formatNumber(stats.timelines_saved, locale)}
              sub={t('kpi.timelines_sub', { total: formatNumber(stats.matches_clean, locale) })}
              accent="var(--m-violet)"
            />
          </Card>
        </div>

        {/* KPIs secundários */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: 12,
            marginBottom: 24,
          }}
        >
          <Card>
            <SectionLabel icon="trending">{t('kpi.sync_24h')}</SectionLabel>
            <Stat
              size="lg"
              label=""
              value={formatNumber(stats.synced_last_24h, locale)}
              sub={t('kpi.sync_24h_sub')}
              accent="var(--m-accent)"
            />
          </Card>
          <Card>
            <SectionLabel icon="trending">{t('kpi.sync_7d')}</SectionLabel>
            <Stat
              size="lg"
              label=""
              value={formatNumber(stats.synced_last_7d, locale)}
              sub={t('kpi.sync_7d_sub')}
              accent="var(--m-accent)"
            />
          </Card>
          <Card>
            <SectionLabel icon="barChart">{t('kpi.participants')}</SectionLabel>
            <Stat
              size="lg"
              label=""
              value={formatNumber(stats.participants_total, locale)}
              sub={t('kpi.participants_sub')}
            />
          </Card>
          <Card>
            <SectionLabel icon="clock">{t('kpi.sync_cooldown')}</SectionLabel>
            <Stat size="lg" label="" value={t('kpi.sync_cooldown_value')} sub={t('kpi.sync_cooldown_sub')} />
          </Card>
        </div>

        {/* Breakdown dirty matches */}
        <Card>
          <SectionLabel icon="filter">{t('dirty.title')}</SectionLabel>
          {Object.keys(stats.matches_dirty_by_reason).length === 0 ? (
            <p style={{ fontSize: 12, color: 'var(--m-text-dim)' }}>
              {t('dirty.empty')}
            </p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 8 }}>
              {Object.entries(stats.matches_dirty_by_reason)
                .sort((a, b) => b[1] - a[1])
                .map(([reason, count]) => {
                  const total = stats.matches_dirty_total || 1
                  const pct = Math.round((count / total) * 100)
                  const key = REASON_KEY[reason]
                  return (
                    <div key={reason}>
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          marginBottom: 6,
                        }}
                      >
                        <span style={{ fontSize: 12, color: 'var(--m-text)', fontWeight: 500 }}>
                          {key ? t(`dirty.${key}`) : reason}
                        </span>
                        <span
                          className="tabular"
                          style={{ fontSize: 11, color: 'var(--m-text-dim)' }}
                        >
                          {formatNumber(count, locale)} · {pct}%
                        </span>
                      </div>
                      <Bar value={pct} max={100} color="var(--m-red)" height={5} />
                    </div>
                  )
                })}
            </div>
          )}
        </Card>

        <p
          style={{
            fontSize: 10,
            color: 'var(--m-muted)',
            textAlign: 'center',
            marginTop: 24,
            letterSpacing: '0.04em',
          }}
        >
          {t.rich('footer_note', {
            flag: () => <code style={{ color: 'var(--m-accent)' }}>app_metadata.is_admin = true</code>,
          })}
        </p>
      </div>

      <style jsx>{`
        @keyframes m-spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  )
}
