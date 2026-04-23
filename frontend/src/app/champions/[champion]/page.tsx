'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { championIconUrl, roleIconPath, DDRAGON_VERSION } from '@/lib/ddragon'
import { apiFetch } from '@/lib/api'
import {
  AppHeader,
  Card,
  SectionLabel,
  Pill,
  Stat,
  Bar,
  Icon,
  ChampPortrait,
  type Role,
} from '@/components/design'

// ── Types ──────────────────────────────────────────────────────────
type Overview = {
  champion: string
  total_matches: number
  filters: { role: string | null; server: string | null; patch: string | null }
  stats: {
    winrate: number
    avg_kills: number
    avg_deaths: number
    avg_assists: number
    avg_gold: number
    avg_damage_per_minute: number
    avg_cs_per_minute: number
    avg_kill_participation: number
  } | null
}

type BuildItem = {
  item_id: number
  item_name: string
  pick_count: number
  win_count: number
  winrate_pct: number
  patch: string
}

type Matchup = {
  opponent: string
  games: number
  winrate: number
  winrate_diff?: number
}

type Synergy = {
  ally: string
  games: number
  winrate: number
}

type Tab = 'overview' | 'builds' | 'matchups' | 'synergies'

const ROLES: { v: '' | Role; label: string; iconRole: Role | null }[] = [
  { v: '',        label: 'Todas',   iconRole: null },
  { v: 'TOP',     label: 'Top',     iconRole: 'TOP' },
  { v: 'JUNGLE',  label: 'Jungle',  iconRole: 'JUNGLE' },
  { v: 'MIDDLE',  label: 'Mid',     iconRole: 'MIDDLE' },
  { v: 'BOTTOM',  label: 'ADC',     iconRole: 'BOTTOM' },
  { v: 'UTILITY', label: 'Suporte', iconRole: 'UTILITY' },
]

const SERVERS = [
  { value: '',      label: 'Todas as regiões' },
  { value: 'BR1',   label: 'BR' },
  { value: 'NA1',   label: 'NA' },
  { value: 'EUW1',  label: 'EUW' },
  { value: 'KR',    label: 'KR' },
  { value: 'EUNE1', label: 'EUNE' },
]

// ── Page ───────────────────────────────────────────────────────────
export default function ChampionPage() {
  const params = useParams()
  const champion = decodeURIComponent(params.champion as string)

  const [tab, setTab] = useState<Tab>('overview')
  const [role, setRole] = useState<'' | Role>('')
  const [server, setServer] = useState('')
  const [patch, setPatch] = useState('')
  const [patches, setPatches] = useState<string[]>([])

  const [overview, setOverview] = useState<Overview | null>(null)
  const [overviewAll, setOverviewAll] = useState<Overview | null>(null)
  const [builds, setBuilds] = useState<BuildItem[]>([])
  const [matchups, setMatchups] = useState<Matchup[]>([])
  const [synergies, setSynergies] = useState<Synergy[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchAll = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const base = `/api/v1/champion/${encodeURIComponent(champion)}`
      const p = new URLSearchParams({ min_matches: '1' })
      if (role) p.set('role', role)
      if (server) p.set('server', server)
      if (patch) p.set('patch', patch)

      const [ovRes, bdRes, muRes, syRes] = await Promise.all([
        apiFetch(`${base}/overview?${p}`),
        apiFetch(`${base}/builds?${p}`),
        apiFetch(`${base}/matchups?${p}`),
        apiFetch(`${base}/synergies?${p}`),
      ])
      if (!ovRes.ok) throw new Error(`Overview ${ovRes.status}`)
      if (!bdRes.ok) throw new Error(`Builds ${bdRes.status}`)
      if (!muRes.ok) throw new Error(`Matchups ${muRes.status}`)
      if (!syRes.ok) throw new Error(`Synergies ${syRes.status}`)

      const [ov, bd, mu, sy] = await Promise.all([
        ovRes.json(), bdRes.json(), muRes.json(), syRes.json(),
      ])
      setOverview(ov)
      setBuilds(bd)
      setMatchups(mu)
      setSynergies(sy)

      if (role) {
        const allP = new URLSearchParams({ min_matches: '1' })
        if (server) allP.set('server', server)
        if (patch) allP.set('patch', patch)
        const allRes = await apiFetch(`${base}/overview?${allP}`)
        if (allRes.ok) setOverviewAll(await allRes.json())
      } else {
        setOverviewAll(ov)
      }
    } catch {
      setError('Não foi possível carregar dados do campeão.')
    } finally {
      setLoading(false)
    }
  }, [champion, role, server, patch])

  useEffect(() => { fetchAll() }, [fetchAll])

  useEffect(() => {
    apiFetch('/api/v1/stats/patches')
      .then((r) => (r.ok ? r.json() : []))
      .then(setPatches)
      .catch(() => {})
  }, [])

  // Role impopular: <5% das partidas do campeão
  const isUnpopularRole = useMemo(() => {
    if (!role || !overview || !overviewAll) return false
    const totalAll = overviewAll.total_matches || 1
    const totalRole = overview.total_matches || 0
    return totalRole / totalAll < 0.05
  }, [role, overview, overviewAll])

  return (
    <div className="metis-scope" style={{ minHeight: '100vh', background: 'var(--m-bg)' }}>
      <AppHeader active="tierlist" />

      {/* ══════════ Hero banner ══════════ */}
      <div
        style={{
          position: 'relative',
          borderBottom: '1px solid var(--m-border)',
          background: 'linear-gradient(180deg, rgba(139,127,255,0.12), transparent)',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            position: 'absolute',
            top: -60,
            right: -40,
            width: 280,
            height: 280,
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(139,127,255,0.25), transparent 70%)',
            filter: 'blur(50px)',
            pointerEvents: 'none',
          }}
        />
        <div style={{ maxWidth: 1200, margin: '0 auto', padding: '24px 28px', position: 'relative' }}>
          <Link
            href="/champions"
            className="m-hover-link"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 5,
              fontSize: 12,
              color: 'var(--m-text-dim)',
              textDecoration: 'none',
              marginBottom: 16,
            }}
          >
            ← Tier List
          </Link>
          <div
            style={{
              display: 'flex',
              alignItems: 'flex-end',
              gap: 20,
              flexWrap: 'wrap',
            }}
          >
            <div
              style={{
                width: 96,
                height: 96,
                borderRadius: 14,
                overflow: 'hidden',
                border: '2px solid rgba(139,127,255,0.4)',
                boxShadow: '0 0 40px rgba(139,127,255,0.25)',
                flexShrink: 0,
              }}
            >
              <Image
                src={championIconUrl(champion, DDRAGON_VERSION)}
                alt={champion}
                width={96}
                height={96}
                unoptimized
                style={{ objectFit: 'cover' }}
              />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <h1
                className="font-display"
                style={{ fontSize: 42, fontWeight: 700, letterSpacing: '-0.03em' }}
              >
                {champion}
              </h1>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  marginTop: 8,
                  fontSize: 12,
                  color: 'var(--m-text-dim)',
                  flexWrap: 'wrap',
                }}
              >
                {overview && (
                  <>
                    <span
                      className="tabular"
                      style={{ color: 'var(--m-text)', fontWeight: 600 }}
                    >
                      {overview.total_matches}
                    </span>
                    <span>partidas no banco Metis</span>
                  </>
                )}
                {isUnpopularRole && (
                  <span style={{ color: 'var(--m-orange)', fontWeight: 600 }}>
                    · Role impopular (&lt;5%)
                  </span>
                )}
              </div>
            </div>
            <Link
              href="/chat"
              className="m-hover-accent"
              style={{
                padding: '9px 14px',
                background: 'var(--m-accent)',
                border: 'none',
                borderRadius: 10,
                color: '#1a1510',
                fontSize: 12,
                fontWeight: 600,
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                textDecoration: 'none',
              }}
            >
              <Icon name="brain" size={13} />
              Perguntar à IA
            </Link>
          </div>
        </div>
      </div>

      {/* ══════════ Main ══════════ */}
      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '20px 28px 48px' }}>
        {/* Role pills */}
        <div style={{ display: 'flex', gap: 6, marginBottom: 14, flexWrap: 'wrap' }}>
          {ROLES.map((r) => {
            const active = role === r.v
            return (
              <button
                key={r.label}
                type="button"
                onClick={() => setRole(r.v)}
                className="m-hover-surface"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '6px 12px',
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
                {r.label}
              </button>
            )
          })}
          <div style={{ flex: 1 }} />
          <select
            value={server}
            onChange={(e) => setServer(e.target.value)}
            style={{
              padding: '6px 12px',
              background: 'var(--m-surface)',
              border: '1px solid var(--m-border)',
              borderRadius: 8,
              color: 'var(--m-text-dim)',
              fontSize: 12,
              fontFamily: 'inherit',
              outline: 'none',
            }}
          >
            {SERVERS.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
          <select
            value={patch}
            onChange={(e) => setPatch(e.target.value)}
            style={{
              padding: '6px 12px',
              background: 'var(--m-surface)',
              border: '1px solid var(--m-border)',
              borderRadius: 8,
              color: 'var(--m-text-dim)',
              fontSize: 12,
              fontFamily: 'inherit',
              outline: 'none',
            }}
          >
            <option value="">Todos os patches</option>
            {patches.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </div>

        {/* Tabs */}
        <div
          style={{
            display: 'flex',
            gap: 2,
            borderBottom: '1px solid var(--m-border)',
            marginBottom: 24,
            flexWrap: 'wrap',
          }}
        >
          {(
            [
              { id: 'overview',  l: 'Overview', ic: 'target'    },
              { id: 'builds',    l: 'Builds',   ic: 'sword'     },
              { id: 'matchups',  l: 'Matchups', ic: 'crosshair' },
              { id: 'synergies', l: 'Sinergias',ic: 'users'     },
            ] as const
          ).map((t) => {
            const active = tab === t.id
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                style={{
                  padding: '10px 16px',
                  background: 'transparent',
                  border: 'none',
                  color: active ? 'var(--m-accent)' : 'var(--m-text-dim)',
                  fontSize: 13,
                  fontWeight: active ? 600 : 500,
                  borderBottom: `2px solid ${active ? 'var(--m-accent)' : 'transparent'}`,
                  marginBottom: -1,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                }}
              >
                <Icon name={t.ic} size={13} />
                {t.l}
              </button>
            )
          })}
        </div>

        {/* Conteúdo */}
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
        ) : (
          <div
            style={{
              position: 'relative',
              opacity: isUnpopularRole ? 0.4 : 1,
              filter: isUnpopularRole ? 'grayscale(1)' : 'none',
              pointerEvents: isUnpopularRole ? 'none' : 'auto',
            }}
          >
            {isUnpopularRole && (
              <div
                style={{
                  position: 'absolute',
                  top: 30,
                  left: '50%',
                  transform: 'translateX(-50%)',
                  zIndex: 10,
                  padding: '16px 22px',
                  background: 'var(--m-surface)',
                  border: '1px solid rgba(251,146,60,0.35)',
                  borderRadius: 12,
                  maxWidth: 400,
                  textAlign: 'center',
                  pointerEvents: 'auto',
                  filter: 'grayscale(0)',
                  opacity: 1,
                }}
              >
                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--m-orange)', marginBottom: 4 }}>
                  Role impopular
                </div>
                <div style={{ fontSize: 11, color: 'var(--m-text-dim)', lineHeight: 1.5 }}>
                  {champion} tem menos de 5% das partidas nessa role. Os dados podem não ser representativos.
                </div>
              </div>
            )}

            {tab === 'overview'  && <OverviewTab  overview={overview} />}
            {tab === 'builds'    && <BuildsTab    builds={builds} />}
            {tab === 'matchups'  && <MatchupsTab  matchups={matchups} />}
            {tab === 'synergies' && <SynergiesTab synergies={synergies} />}
          </div>
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

// ── Overview tab ──────────────────────────────────────────────────
function OverviewTab({ overview }: { overview: Overview | null }) {
  if (!overview || overview.stats === null) {
    return (
      <Card>
        <p style={{ fontSize: 13, color: 'var(--m-text-dim)' }}>
          Sem dados suficientes com os filtros selecionados.
        </p>
      </Card>
    )
  }
  const s = overview.stats
  const kda = s.avg_deaths === 0 ? '∞' : ((s.avg_kills + s.avg_assists) / s.avg_deaths).toFixed(2)

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 20 }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {/* KPIs */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
          <Card>
            <SectionLabel icon="target">Winrate</SectionLabel>
            <div
              className="tabular font-display"
              style={{
                fontSize: 34,
                fontWeight: 700,
                color:
                  s.winrate > 52
                    ? 'var(--m-green)'
                    : s.winrate > 48
                    ? 'var(--m-accent)'
                    : 'var(--m-red)',
              }}
            >
              {s.winrate.toFixed(1)}%
            </div>
            <div style={{ marginTop: 6 }}>
              <Bar
                value={Math.max(0, s.winrate - 40)}
                max={25}
                color={s.winrate > 52 ? 'var(--m-green)' : 'var(--m-accent)'}
                height={4}
              />
            </div>
            <div style={{ fontSize: 11, color: 'var(--m-text-dim)', marginTop: 6 }}>
              média role: 50.0%
            </div>
          </Card>

          <Card>
            <SectionLabel icon="sword">KDA</SectionLabel>
            <div className="tabular font-display" style={{ fontSize: 34, fontWeight: 700 }}>
              {kda}
            </div>
            <div className="tabular" style={{ fontSize: 11, color: 'var(--m-text-dim)', marginTop: 4 }}>
              <span style={{ color: 'var(--m-green)' }}>{s.avg_kills.toFixed(1)}</span> /{' '}
              <span style={{ color: 'var(--m-red)' }}>{s.avg_deaths.toFixed(1)}</span> /{' '}
              <span style={{ color: 'var(--m-cyan)' }}>{s.avg_assists.toFixed(1)}</span>
            </div>
            <div style={{ fontSize: 10, color: 'var(--m-muted)', marginTop: 8 }}>média por partida</div>
          </Card>

          <Card>
            <SectionLabel icon="crosshair">CS / min</SectionLabel>
            <div className="tabular font-display" style={{ fontSize: 34, fontWeight: 700 }}>
              {s.avg_cs_per_minute.toFixed(1)}
            </div>
            <div style={{ marginTop: 6 }}>
              <Bar value={Math.min(10, s.avg_cs_per_minute)} max={10} color="var(--m-accent)" height={4} />
            </div>
            <div style={{ fontSize: 11, color: 'var(--m-text-dim)', marginTop: 6 }}>
              {s.avg_cs_per_minute >= 8
                ? 'ótimo farm'
                : s.avg_cs_per_minute >= 6
                ? 'média da role'
                : 'abaixo — focar em last hits'}
            </div>
          </Card>

          <Card>
            <SectionLabel icon="zap">DPM</SectionLabel>
            <div className="tabular font-display" style={{ fontSize: 34, fontWeight: 700 }}>
              {Math.round(s.avg_damage_per_minute)}
            </div>
            <div style={{ fontSize: 11, color: 'var(--m-text-dim)', marginTop: 6 }}>
              ouro médio: {(s.avg_gold / 1000).toFixed(1)}k · KP {Math.round(s.avg_kill_participation * 100)}%
            </div>
          </Card>
        </div>

        {/* Curva de poder — placeholder */}
        <Card>
          <SectionLabel icon="trending">Curva de poder por tempo de jogo</SectionLabel>
          <div
            style={{
              padding: '28px 14px',
              textAlign: 'center',
              color: 'var(--m-muted)',
              fontSize: 12,
              lineHeight: 1.6,
            }}
          >
            <Icon name="clock" size={20} style={{ opacity: 0.5, marginBottom: 6 }} />
            <div>
              Em breve — precisa de eventos de timeline parsed (Bloco 0 do roadmap de analytics).
              <br />
              Enquanto isso, a aba Builds e Matchups já estão funcionais.
            </div>
          </div>
        </Card>
      </div>

      {/* Sidebar */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <Card accent>
          <SectionLabel icon="brain">Insight da Metis</SectionLabel>
          <p style={{ fontSize: 12, color: 'var(--m-text)', lineHeight: 1.55 }}>
            <span style={{ color: 'var(--m-accent)', fontWeight: 600 }}>
              {overview.champion}
            </span>{' '}
            tem{' '}
            <span
              style={{
                color: s.winrate > 52 ? 'var(--m-green)' : s.winrate < 48 ? 'var(--m-red)' : 'var(--m-text)',
                fontWeight: 600,
              }}
            >
              {s.winrate.toFixed(1)}% WR
            </span>{' '}
            em {overview.total_matches} partidas no banco. Pergunte à Metis sobre counter-picks, timings e builds.
          </p>
          <Link
            href="/chat"
            className="m-hover-accent"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
              width: '100%',
              marginTop: 12,
              padding: '8px 12px',
              background: 'var(--m-accent)',
              border: 'none',
              borderRadius: 8,
              color: '#1a1510',
              fontSize: 11,
              fontWeight: 600,
              textDecoration: 'none',
            }}
          >
            Explorar no chat →
          </Link>
        </Card>

        <Card>
          <SectionLabel icon="activity">Estatísticas adicionais</SectionLabel>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 6 }}>
            <Stat size="sm" label="Kill partic." value={`${Math.round(s.avg_kill_participation * 100)}%`} />
            <Stat size="sm" label="Ouro médio" value={`${(s.avg_gold / 1000).toFixed(1)}k`} />
            <Stat size="sm" label="Avg Kills" value={s.avg_kills.toFixed(1)} accent="var(--m-green)" />
            <Stat size="sm" label="Avg Deaths" value={s.avg_deaths.toFixed(1)} accent="var(--m-red)" />
          </div>
        </Card>
      </div>
    </div>
  )
}

// ── Builds tab ────────────────────────────────────────────────────
function BuildsTab({ builds }: { builds: BuildItem[] }) {
  if (builds.length === 0) {
    return (
      <Card>
        <p style={{ fontSize: 13, color: 'var(--m-text-dim)' }}>
          Sem dados de builds com os filtros selecionados.
        </p>
      </Card>
    )
  }

  // Top 6 por picks = build recomendada
  const top6 = [...builds].sort((a, b) => b.pick_count - a.pick_count).slice(0, 6)
  const maxPicks = builds.reduce((m, b) => Math.max(m, b.pick_count), 0) || 1

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 20 }}>
      <Card pad={0}>
        <div style={{ padding: '16px 20px 12px' }}>
          <SectionLabel icon="sword">Itens mais usados</SectionLabel>
        </div>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 90px 110px 80px',
            gap: 12,
            padding: '8px 20px',
            fontSize: 10,
            color: 'var(--m-muted)',
            textTransform: 'uppercase',
            letterSpacing: '0.06em',
            fontWeight: 600,
            borderTop: '1px solid var(--m-border)',
            borderBottom: '1px solid var(--m-border)',
          }}
        >
          <span>Item</span>
          <span className="tabular">Picks</span>
          <span>Winrate</span>
          <span>Patch</span>
        </div>
        {builds.map((b) => (
          <div
            key={`${b.item_id}-${b.patch}`}
            className="m-hover-row"
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 90px 110px 80px',
              gap: 12,
              padding: '10px 20px',
              alignItems: 'center',
              borderBottom: '1px solid rgba(34,40,56,0.4)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
              <Image
                src={`https://ddragon.leagueoflegends.com/cdn/${DDRAGON_VERSION}/img/item/${b.item_id}.png`}
                alt={b.item_name}
                width={32}
                height={32}
                unoptimized
                style={{
                  borderRadius: 6,
                  border: '1px solid var(--m-border-2)',
                  flexShrink: 0,
                }}
              />
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 500 }}>{b.item_name}</div>
              </div>
            </div>
            <div>
              <div className="tabular" style={{ fontSize: 13, fontWeight: 600 }}>
                {b.pick_count}
              </div>
              <Bar value={b.pick_count} max={maxPicks} color="var(--m-accent)" height={3} />
            </div>
            <div>
              <div
                className="tabular"
                style={{
                  fontSize: 14,
                  fontWeight: 700,
                  color:
                    b.winrate_pct > 52
                      ? 'var(--m-green)'
                      : b.winrate_pct > 48
                      ? 'var(--m-text)'
                      : 'var(--m-red)',
                }}
              >
                {b.winrate_pct.toFixed(1)}%
              </div>
              <Bar
                value={Math.max(0, b.winrate_pct - 35)}
                max={30}
                color={
                  b.winrate_pct > 52
                    ? 'var(--m-green)'
                    : b.winrate_pct > 48
                    ? 'var(--m-accent)'
                    : 'var(--m-red)'
                }
                height={3}
              />
            </div>
            <span style={{ fontSize: 11, color: 'var(--m-text-dim)' }}>{b.patch}</span>
          </div>
        ))}
      </Card>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <Card>
          <SectionLabel icon="sparkles">Build mais comum</SectionLabel>
          <div
            style={{
              fontSize: 11,
              color: 'var(--m-text-dim)',
              marginBottom: 10,
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
              fontWeight: 600,
            }}
          >
            Top 6 itens por picks
          </div>
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
            {top6.map((b, i) => (
              <div key={b.item_id} style={{ display: 'flex', alignItems: 'center' }}>
                <Image
                  src={`https://ddragon.leagueoflegends.com/cdn/${DDRAGON_VERSION}/img/item/${b.item_id}.png`}
                  alt={b.item_name}
                  width={40}
                  height={40}
                  unoptimized
                  title={`${b.item_name} · ${b.winrate_pct.toFixed(1)}% WR`}
                  style={{
                    borderRadius: 6,
                    border: '1px solid var(--m-border-2)',
                    flexShrink: 0,
                  }}
                />
                {i < top6.length - 1 && (
                  <Icon
                    name="chevronRight"
                    size={12}
                    style={{ color: 'var(--m-muted)', margin: '0 2px' }}
                  />
                )}
              </div>
            ))}
          </div>
        </Card>

        <Card>
          <SectionLabel icon="zap">Runas</SectionLabel>
          <div
            style={{
              padding: '16px 8px',
              fontSize: 11,
              color: 'var(--m-muted)',
              textAlign: 'center',
              lineHeight: 1.6,
            }}
          >
            Em breve — agregação de runas por campeão (Bloco 4 do roadmap).
          </div>
        </Card>
      </div>
    </div>
  )
}

// ── Matchups tab ──────────────────────────────────────────────────
function MatchupsTab({ matchups }: { matchups: Matchup[] }) {
  if (matchups.length === 0) {
    return (
      <Card>
        <p style={{ fontSize: 13, color: 'var(--m-text-dim)' }}>
          Sem dados de matchups. Tente filtrar por lane pra resultados mais precisos.
        </p>
      </Card>
    )
  }

  return (
    <Card pad={0}>
      <div
        style={{
          padding: '16px 20px 12px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <SectionLabel icon="crosshair">Matchups · oponente na lane</SectionLabel>
        <div style={{ display: 'flex', gap: 4 }}>
          <Pill active>Todos</Pill>
        </div>
      </div>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 90px 100px 110px 1fr',
          gap: 12,
          padding: '8px 20px',
          fontSize: 10,
          color: 'var(--m-muted)',
          textTransform: 'uppercase',
          letterSpacing: '0.06em',
          fontWeight: 600,
          borderTop: '1px solid var(--m-border)',
          borderBottom: '1px solid var(--m-border)',
        }}
      >
        <span>Oponente</span>
        <span className="tabular">Partidas</span>
        <span>Winrate</span>
        <span>vs média</span>
        <span>Dificuldade</span>
      </div>
      {matchups.map((m) => {
        const vs = m.winrate_diff ?? 0
        const diffColor =
          vs > 2 ? 'var(--m-green)' : vs < -2 ? 'var(--m-red)' : 'var(--m-text-dim)'
        const difficultyLabel =
          vs > 5 ? 'Fácil' : vs < -10 ? 'Muito difícil' : vs < -2 ? 'Difícil' : 'Neutro'
        return (
          <Link
            key={m.opponent}
            href={`/champions/${encodeURIComponent(m.opponent)}`}
            className="m-hover-row"
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 90px 100px 110px 1fr',
              gap: 12,
              padding: '10px 20px',
              alignItems: 'center',
              borderBottom: '1px solid rgba(34,40,56,0.4)',
              textDecoration: 'none',
              color: 'inherit',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
              <ChampPortrait name={m.opponent} size={32} />
              <span style={{ fontSize: 13, fontWeight: 500 }}>{m.opponent}</span>
            </div>
            <span className="tabular" style={{ fontSize: 13, fontWeight: 600 }}>
              {m.games}
            </span>
            <div
              className="tabular"
              style={{
                fontSize: 14,
                fontWeight: 700,
                color:
                  m.winrate > 52
                    ? 'var(--m-green)'
                    : m.winrate > 45
                    ? 'var(--m-accent)'
                    : 'var(--m-red)',
              }}
            >
              {m.winrate.toFixed(1)}%
            </div>
            <span className="tabular" style={{ fontSize: 13, fontWeight: 600, color: diffColor }}>
              {vs > 0 ? '+' : ''}
              {vs.toFixed(1)}%
            </span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div
                style={{
                  flex: 1,
                  height: 6,
                  borderRadius: 3,
                  background: 'var(--m-border)',
                  overflow: 'hidden',
                  position: 'relative',
                }}
              >
                <div
                  style={{
                    position: 'absolute',
                    left: '50%',
                    top: 0,
                    bottom: 0,
                    width: 1,
                    background: 'var(--m-muted)',
                  }}
                />
                <div
                  style={{
                    position: 'absolute',
                    left: vs >= 0 ? '50%' : `${Math.max(0, 50 + vs)}%`,
                    width: `${Math.min(Math.abs(vs), 50)}%`,
                    height: '100%',
                    background: vs >= 0 ? 'var(--m-green)' : 'var(--m-red)',
                  }}
                />
              </div>
              <span
                style={{
                  fontSize: 10,
                  color: 'var(--m-text-dim)',
                  minWidth: 72,
                  textAlign: 'right',
                }}
              >
                {difficultyLabel}
              </span>
            </div>
          </Link>
        )
      })}
    </Card>
  )
}

// ── Synergies tab ─────────────────────────────────────────────────
function SynergiesTab({ synergies }: { synergies: Synergy[] }) {
  if (synergies.length === 0) {
    return (
      <Card>
        <p style={{ fontSize: 13, color: 'var(--m-text-dim)' }}>
          Sem dados de sinergias com os filtros selecionados.
        </p>
      </Card>
    )
  }

  const best = [...synergies].sort((a, b) => b.winrate - a.winrate)[0]

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 20 }}>
      <Card pad={0}>
        <div style={{ padding: '16px 20px 12px' }}>
          <SectionLabel icon="users">Sinergias · aliado no mesmo time</SectionLabel>
        </div>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 90px 100px 1fr',
            gap: 12,
            padding: '8px 20px',
            fontSize: 10,
            color: 'var(--m-muted)',
            textTransform: 'uppercase',
            letterSpacing: '0.06em',
            fontWeight: 600,
            borderTop: '1px solid var(--m-border)',
            borderBottom: '1px solid var(--m-border)',
          }}
        >
          <span>Aliado</span>
          <span className="tabular">Partidas</span>
          <span>Winrate</span>
          <span>Sinergia</span>
        </div>
        {synergies.map((s) => (
          <Link
            key={s.ally}
            href={`/champions/${encodeURIComponent(s.ally)}`}
            className="m-hover-row"
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 90px 100px 1fr',
              gap: 12,
              padding: '10px 20px',
              alignItems: 'center',
              borderBottom: '1px solid rgba(34,40,56,0.4)',
              textDecoration: 'none',
              color: 'inherit',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
              <ChampPortrait name={s.ally} size={32} />
              <span style={{ fontSize: 13, fontWeight: 500 }}>{s.ally}</span>
            </div>
            <span className="tabular" style={{ fontSize: 13, fontWeight: 600 }}>
              {s.games}
            </span>
            <div
              className="tabular"
              style={{
                fontSize: 14,
                fontWeight: 700,
                color:
                  s.winrate > 55
                    ? 'var(--m-green)'
                    : s.winrate > 45
                    ? 'var(--m-text)'
                    : 'var(--m-red)',
              }}
            >
              {s.winrate.toFixed(1)}%
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ flex: 1 }}>
                <Bar
                  value={s.winrate}
                  max={100}
                  height={6}
                  color={
                    s.winrate > 55
                      ? 'var(--m-green)'
                      : s.winrate > 45
                      ? 'var(--m-accent)'
                      : 'var(--m-red)'
                  }
                />
              </div>
              <span
                style={{
                  fontSize: 10,
                  color: 'var(--m-text-dim)',
                  minWidth: 58,
                  textAlign: 'right',
                }}
              >
                {s.winrate > 60 ? 'Excelente' : s.winrate > 45 ? 'Ok' : 'Evitar'}
              </span>
            </div>
          </Link>
        ))}
      </Card>

      {/* Duo sugerido */}
      {best && (
        <Card accent>
          <SectionLabel icon="sparkles">Duo sugerido</SectionLabel>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 0' }}>
            <ChampPortrait name={synergies[0]?.ally ?? 'Ahri'} size={48} />
            <Icon name="plus" size={16} style={{ color: 'var(--m-accent)' }} />
            <ChampPortrait name={best.ally} size={48} />
          </div>
          <div
            className="tabular font-display"
            style={{ fontSize: 24, fontWeight: 700, color: 'var(--m-green)' }}
          >
            {best.winrate.toFixed(1)}% WR
          </div>
          <div style={{ fontSize: 11, color: 'var(--m-text-dim)', marginTop: 4 }}>
            {best.games} partidas juntos no banco — maior winrate entre as sinergias deste campeão.
          </div>
          <Link
            href="/chat"
            className="m-hover-accent"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
              width: '100%',
              marginTop: 12,
              padding: '8px 12px',
              background: 'var(--m-accent)',
              border: 'none',
              borderRadius: 8,
              color: '#1a1510',
              fontSize: 11,
              fontWeight: 600,
              textDecoration: 'none',
            }}
          >
            Perguntar à IA sobre este duo
          </Link>
        </Card>
      )}
    </div>
  )
}
