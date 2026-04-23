'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
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

const REASON_LABEL: Record<string, string> = {
  remake:      'Remakes (< 5 min)',
  short_game:  'Partida curta (5–15 min)',
  wrong_queue: 'Fila errada (ARAM, etc.)',
  invalid_json: 'JSON inválido',
  afk_status:  'AFK detectado',
}

// ── Page ───────────────────────────────────────────────────────
export default function AdminPage() {
  const router = useRouter()
  const supabase = createClient()

  const [stats, setStats] = useState<AdminStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const [refreshMsg, setRefreshMsg] = useState<string | null>(null)

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
        setError(`Falha ao carregar estatísticas: ${e instanceof Error ? e.message : 'erro desconhecido'}`)
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
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { setRefreshing(false); return }
      const res = await apiFetch('/api/v1/admin/refresh-cache', {
        method: 'POST',
        headers: { Authorization: `Bearer ${session.access_token}` },
      })
      const d = await res.json()
      setRefreshMsg(`Cache atualizado — ${d.cleared ?? 0} entradas removidas`)
    } catch {
      setRefreshMsg('Erro ao atualizar cache')
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
          <p style={{ fontSize: 13, color: 'var(--m-text-dim)' }}>{error ?? 'Erro desconhecido.'}</p>
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
              <Icon name="settings" size={12} /> Painel Admin · acesso restrito
            </div>
            <h1
              className="font-display"
              style={{ fontSize: 36, fontWeight: 700, letterSpacing: '-0.03em' }}
            >
              Visão geral do sistema
            </h1>
            <p style={{ fontSize: 13, color: 'var(--m-text-dim)', marginTop: 4 }}>
              Dados ao vivo do Supabase · pipeline + ETL + cache
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {refreshMsg && (
              <span
                style={{
                  fontSize: 11,
                  color: refreshMsg.startsWith('Erro') ? 'var(--m-red)' : 'var(--m-green)',
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
              {refreshing ? 'Atualizando...' : 'Invalidar cache da tier list'}
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
            <SectionLabel icon="users">Jogadores</SectionLabel>
            <Stat
              size="lg"
              label=""
              value={stats.players_total.toLocaleString('pt-BR')}
              sub="cadastrados no banco"
            />
          </Card>
          <Card>
            <SectionLabel icon="check">Partidas limpas</SectionLabel>
            <Stat
              size="lg"
              label=""
              value={stats.matches_clean.toLocaleString('pt-BR')}
              sub={`taxa de aprovação: ${cleanRate}%`}
              accent="var(--m-green)"
            />
          </Card>
          <Card>
            <SectionLabel icon="x">Partidas descartadas</SectionLabel>
            <Stat
              size="lg"
              label=""
              value={stats.matches_dirty_total.toLocaleString('pt-BR')}
              sub="remakes, fila errada, curtas"
              accent="var(--m-red)"
            />
          </Card>
          <Card>
            <SectionLabel icon="activity">Timelines salvas</SectionLabel>
            <Stat
              size="lg"
              label=""
              value={stats.timelines_saved.toLocaleString('pt-BR')}
              sub={`de ${stats.matches_clean.toLocaleString('pt-BR')} partidas limpas`}
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
            <SectionLabel icon="trending">Sincronizações 24h</SectionLabel>
            <Stat
              size="lg"
              label=""
              value={stats.synced_last_24h.toLocaleString('pt-BR')}
              sub="jogadores atualizados hoje"
              accent="var(--m-accent)"
            />
          </Card>
          <Card>
            <SectionLabel icon="trending">Sincronizações 7d</SectionLabel>
            <Stat
              size="lg"
              label=""
              value={stats.synced_last_7d.toLocaleString('pt-BR')}
              sub="semana"
              accent="var(--m-accent)"
            />
          </Card>
          <Card>
            <SectionLabel icon="barChart">Participantes</SectionLabel>
            <Stat
              size="lg"
              label=""
              value={stats.participants_total.toLocaleString('pt-BR')}
              sub="linhas em match_participants"
            />
          </Card>
          <Card>
            <SectionLabel icon="clock">Cooldown de sync</SectionLabel>
            <Stat size="lg" label="" value="5 min" sub="por jogador/request" />
          </Card>
        </div>

        {/* Breakdown dirty matches */}
        <Card>
          <SectionLabel icon="filter">Partidas descartadas · por motivo</SectionLabel>
          {Object.keys(stats.matches_dirty_by_reason).length === 0 ? (
            <p style={{ fontSize: 12, color: 'var(--m-text-dim)' }}>
              Nenhuma partida descartada ainda.
            </p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 8 }}>
              {Object.entries(stats.matches_dirty_by_reason)
                .sort((a, b) => b[1] - a[1])
                .map(([reason, count]) => {
                  const total = stats.matches_dirty_total || 1
                  const pct = Math.round((count / total) * 100)
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
                          {REASON_LABEL[reason] ?? reason}
                        </span>
                        <span
                          className="tabular"
                          style={{ fontSize: 11, color: 'var(--m-text-dim)' }}
                        >
                          {count.toLocaleString('pt-BR')} · {pct}%
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
          Metis Admin · visível apenas pra contas com <code style={{ color: 'var(--m-accent)' }}>app_metadata.is_admin = true</code>
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
