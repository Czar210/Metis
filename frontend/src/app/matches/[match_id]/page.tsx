'use client'

import { useState, useEffect } from 'react'
import { useParams, useSearchParams } from 'next/navigation'
import Image from 'next/image'
import Link from 'next/link'
import { championIconUrl, roleIconPath, DDRAGON_VERSION } from '@/lib/ddragon'
import { runeIconUrl, RUNE_TREES } from '@/lib/runes'
import { TimelineChart } from '@/components/matches/TimelineChart'
import { apiFetch } from '@/lib/api'
import {
  AppHeader,
  Card,
  SectionLabel,
  Pill,
  Bar,
  Icon,
  Donut,
  ChampPortrait,
  ROLES_PT,
  type Role,
} from '@/components/design'

// ── Types ─────────────────────────────────────────────────────
type Participant = {
  puuid: string
  champion_name: string
  team_position: string
  team_id: number
  win: boolean
  kills: number
  deaths: number
  assists: number
  gold_earned: number
  total_damage_dealt_to_champions: number | null
  vision_score: number | null
  total_cs: number | null
  cs_per_minute: number | null
  champion_level: number | null
  items: number[] | null
  rune_keystone: number | null
  summoner1_id: number | null
  summoner2_id: number | null
  players: { game_name: string; tag_line: string } | null
  metis_score?: number
  rune_primary?: number | null
  rune_secondary?: number | null
  runes_raw?: unknown
  kill_participation?: number | null
  damage_per_minute?: number | null
}

type Ban = {
  team_id: number
  champion_id: number
  champion_name: string
  pick_turn: number
}

type MatchMeta = {
  match_id: string
  game_version: string
  game_duration: number
  queue_id: number
  end_type: string
  created_at: string
  bans?: Ban[]
}

type MatchDetails = {
  match_id: string
  meta: MatchMeta
  has_timeline: boolean
  max_damage: number
  blue_team: Participant[]
  red_team: Participant[]
}

type TimelineFrame = {
  t_min: number
  t_ms: number
  p: Record<string, { cs: number; cspm: number; gold: number; level: number; xp: number }>
}

type Tab = 'overview' | 'teams' | 'builds'

// ── Helpers ───────────────────────────────────────────────────
function formatDuration(s: number): string {
  const m = Math.floor(s / 60)
  const sec = s % 60
  return `${m}:${sec.toString().padStart(2, '0')}`
}

const QUEUE_LABEL: Record<number, string> = { 420: 'Ranked Solo/Duo', 440: 'Ranked Flex' }

const ROLE_ORDER: Record<string, number> = {
  TOP: 0, JUNGLE: 1, MIDDLE: 2, BOTTOM: 3, UTILITY: 4, UNKNOWN: 5,
}
const sortByRole = (list: Participant[]) =>
  [...list].sort(
    (a, b) => (ROLE_ORDER[a.team_position] ?? 5) - (ROLE_ORDER[b.team_position] ?? 5)
  )

const SUMMONER_SPELL: Record<number, string> = {
  1: 'SummonerBoost', 3: 'SummonerExhaust', 4: 'SummonerFlash', 6: 'SummonerHaste',
  7: 'SummonerHeal', 11: 'SummonerSmite', 12: 'SummonerTeleport', 14: 'SummonerDot',
  21: 'SummonerBarrier', 32: 'SummonerSnowball',
}

type RuneStyle = {
  description: string
  style: number
  selections: { perk: number; var1: number; var2: number; var3: number }[]
}

// ── Metis Score color (baseado em tier de elo) ────────────────
function metisScoreStyle(s: number) {
  if (s >= 100) return { bg: 'linear-gradient(135deg, rgba(34,211,238,0.2), rgba(212,175,55,0.15))', bd: 'rgba(34,211,238,0.5)', fg: '#22d3ee' }
  if (s >= 90)  return { bg: 'linear-gradient(135deg, rgba(239,68,68,0.2), rgba(156,163,175,0.15))', bd: 'rgba(239,68,68,0.5)',  fg: '#ef4444' }
  if (s >= 80)  return { bg: 'rgba(168,85,247,0.15)',  bd: 'rgba(168,85,247,0.4)',  fg: '#a855f7' }
  if (s >= 70)  return { bg: 'rgba(30,64,175,0.2)',    bd: 'rgba(30,64,175,0.5)',   fg: '#3b82f6' }
  if (s >= 60)  return { bg: 'rgba(16,185,129,0.15)',  bd: 'rgba(16,185,129,0.4)',  fg: '#10b981' }
  if (s >= 50)  return { bg: 'rgba(20,184,166,0.15)',  bd: 'rgba(20,184,166,0.4)',  fg: '#14b8a6' }
  if (s >= 40)  return { bg: 'rgba(212,175,55,0.15)',  bd: 'rgba(212,175,55,0.4)',  fg: '#d4af37' }
  if (s >= 30)  return { bg: 'rgba(203,213,225,0.1)',  bd: 'rgba(203,213,225,0.3)', fg: '#cbd5e1' }
  if (s >= 20)  return { bg: 'rgba(154,82,40,0.15)',   bd: 'rgba(154,82,40,0.4)',   fg: '#b45a2a' }
  return           { bg: 'linear-gradient(135deg, rgba(120,113,108,0.15), rgba(168,162,158,0.1))', bd: 'rgba(120,113,108,0.4)', fg: '#a8a29e' }
}

// ══════════════ PAGE ═══════════════════════════════════════════
export default function MatchPage() {
  const { match_id } = useParams() as { match_id: string }
  const searchParams = useSearchParams()
  const highlightPuuid = searchParams.get('as') ?? searchParams.get('puuid')

  const [match, setMatch] = useState<MatchDetails | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [tab, setTab] = useState<Tab>('overview')

  const [showTimeline, setShowTimeline] = useState(false)
  const [timelineFrames, setTimelineFrames] = useState<TimelineFrame[] | null>(null)
  const [timelineLoading, setTimelineLoading] = useState(false)
  const [timelineError, setTimelineError] = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      try {
        const res = await apiFetch(`/api/v1/match/${match_id}`)
        if (res.status === 404) {
          setError('Partida não encontrada.')
          return
        }
        if (!res.ok) {
          setError('Erro ao carregar partida.')
          return
        }
        setMatch(await res.json())
      } catch {
        setError('Não foi possível conectar ao servidor.')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [match_id])

  async function handleToggleTimeline() {
    if (showTimeline) {
      setShowTimeline(false)
      return
    }
    setShowTimeline(true)
    if (timelineFrames !== null) return
    setTimelineLoading(true)
    setTimelineError(null)
    try {
      const res = await apiFetch(`/api/v1/match/${match_id}/timeline`)
      if (!res.ok) {
        setTimelineError('Não foi possível carregar a timeline.')
        return
      }
      const data = await res.json()
      setTimelineFrames(data.frames ?? [])
    } catch {
      setTimelineError('Erro ao conectar ao servidor.')
    } finally {
      setTimelineLoading(false)
    }
  }

  // ── Loading / erro ─────────────────────────────────────────
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

  if (error || !match) {
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
          <p style={{ fontSize: 13, color: 'var(--m-text-dim)' }}>
            {error ?? 'Partida não encontrada.'}
          </p>
          <Link
            href="/"
            className="m-hover-link"
            style={{ fontSize: 12, color: 'var(--m-accent)', textDecoration: 'none' }}
          >
            Voltar ao início
          </Link>
        </div>
      </div>
    )
  }

  const { meta, blue_team, red_team, max_damage, has_timeline } = match
  const blueWin = blue_team[0]?.win ?? true
  const queueLabel = QUEUE_LABEL[meta.queue_id] ?? 'Ranqueada'
  const winColor = blueWin ? 'var(--m-green)' : 'var(--m-red)'
  const winLabel = blueWin ? 'azul' : 'vermelho'
  const allParticipants = [...blue_team, ...red_team]
  const highlighted = highlightPuuid
    ? allParticipants.find((p) => p.puuid === highlightPuuid)
    : null

  return (
    <div className="metis-scope" style={{ minHeight: '100vh', background: 'var(--m-bg)' }}>
      <AppHeader active="home" />

      {/* ══════════ Banner ══════════ */}
      <div
        style={{
          background: blueWin
            ? 'linear-gradient(180deg, rgba(74,222,128,0.1), transparent)'
            : 'linear-gradient(180deg, rgba(248,113,113,0.08), transparent)',
          borderBottom: '1px solid var(--m-border)',
        }}
      >
        <div style={{ maxWidth: 1260, margin: '0 auto', padding: '20px 28px 16px' }}>
          {/* Breadcrumb */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              fontSize: 11,
              color: 'var(--m-text-dim)',
              marginBottom: 14,
              flexWrap: 'wrap',
            }}
          >
            {highlighted?.players && (
              <>
                <Link
                  href={`/players/${encodeURIComponent(`${highlighted.players.game_name}#${highlighted.players.tag_line}`)}`}
                  className="m-hover-link"
                  style={{ color: 'var(--m-text-dim)', textDecoration: 'none' }}
                >
                  {highlighted.players.game_name}#{highlighted.players.tag_line}
                </Link>
                <Icon name="chevronRight" size={10} />
              </>
            )}
            <span>Partida</span>
            <Icon name="chevronRight" size={10} />
            <span className="font-mono" style={{ color: 'var(--m-accent)' }}>
              {match_id}
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
            <div
              style={{
                width: 56,
                height: 56,
                borderRadius: 10,
                background: blueWin ? 'rgba(74,222,128,0.15)' : 'rgba(248,113,113,0.1)',
                border: `1px solid ${winColor}55`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <Icon
                name={blueWin ? 'check' : 'x'}
                size={28}
                style={{ color: winColor }}
                strokeWidth={2.5}
              />
            </div>
            <div style={{ minWidth: 0 }}>
              <h1 className="font-display" style={{ fontSize: 24, fontWeight: 700 }}>
                Vitória <span style={{ color: winColor }}>{winLabel}</span> · em {formatDuration(meta.game_duration)}
              </h1>
              <div
                style={{
                  display: 'flex',
                  gap: 14,
                  fontSize: 12,
                  color: 'var(--m-text-dim)',
                  marginTop: 4,
                  flexWrap: 'wrap',
                }}
              >
                <span>{queueLabel}</span>
                <span>·</span>
                <span>Patch {meta.game_version}</span>
              </div>
            </div>
            <div style={{ flex: 1 }} />
            {highlightPuuid && (
              <Link
                href={`/chat?match_id=${match_id}&puuid=${highlightPuuid}`}
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
                <Icon name="brain" size={14} />
                Analisar com IA
              </Link>
            )}
          </div>

          {/* Bans */}
          {meta.bans && meta.bans.length > 0 && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 14,
                marginTop: 14,
                padding: '8px 14px',
                background: 'var(--m-surface)',
                border: '1px solid var(--m-border)',
                borderRadius: 10,
                flexWrap: 'wrap',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span
                  style={{
                    fontSize: 10,
                    fontWeight: 700,
                    color: 'var(--m-green)',
                    letterSpacing: '0.06em',
                    textTransform: 'uppercase',
                  }}
                >
                  Bans Azul
                </span>
                <div style={{ display: 'flex', gap: 4 }}>
                  {meta.bans.filter((b) => b.team_id === 100).map((b, i) => (
                    <div
                      key={i}
                      style={{
                        width: 26,
                        height: 26,
                        borderRadius: 5,
                        overflow: 'hidden',
                        border: '1px solid rgba(74,222,128,0.3)',
                        filter: 'grayscale(0.8)',
                        opacity: 0.65,
                        position: 'relative',
                      }}
                    >
                      <Image
                        src={championIconUrl(b.champion_name, DDRAGON_VERSION)}
                        alt={b.champion_name}
                        fill
                        unoptimized
                        style={{ objectFit: 'cover' }}
                      />
                    </div>
                  ))}
                </div>
              </div>
              <div style={{ width: 1, height: 20, background: 'var(--m-border)' }} />
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span
                  style={{
                    fontSize: 10,
                    fontWeight: 700,
                    color: 'var(--m-red)',
                    letterSpacing: '0.06em',
                    textTransform: 'uppercase',
                  }}
                >
                  Bans Vermelho
                </span>
                <div style={{ display: 'flex', gap: 4 }}>
                  {meta.bans.filter((b) => b.team_id === 200).map((b, i) => (
                    <div
                      key={i}
                      style={{
                        width: 26,
                        height: 26,
                        borderRadius: 5,
                        overflow: 'hidden',
                        border: '1px solid rgba(248,113,113,0.3)',
                        filter: 'grayscale(0.8)',
                        opacity: 0.65,
                        position: 'relative',
                      }}
                    >
                      <Image
                        src={championIconUrl(b.champion_name, DDRAGON_VERSION)}
                        alt={b.champion_name}
                        fill
                        unoptimized
                        style={{ objectFit: 'cover' }}
                      />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ══════════ Tabs ══════════ */}
      <div
        style={{
          maxWidth: 1260,
          margin: '0 auto',
          padding: '0 28px',
          borderBottom: '1px solid var(--m-border)',
        }}
      >
        <div style={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
          {(
            [
              { id: 'overview', l: 'Overview',          ic: 'list' },
              { id: 'teams',    l: 'Análise de Equipe', ic: 'pieChart' },
              { id: 'builds',   l: 'Builds & Runas',    ic: 'sword' },
            ] as const
          ).map((t) => {
            const active = tab === t.id
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                style={{
                  padding: '12px 18px',
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
      </div>

      {/* ══════════ Content ══════════ */}
      {tab === 'overview' && (
        <MatchOverview
          match={match}
          highlightPuuid={highlightPuuid}
          hasTimeline={has_timeline}
          showTimeline={showTimeline}
          timelineFrames={timelineFrames}
          timelineLoading={timelineLoading}
          timelineError={timelineError}
          onToggleTimeline={handleToggleTimeline}
        />
      )}
      {tab === 'teams' && <MatchTeamAnalysis blue={blue_team} red={red_team} blueWin={blueWin} />}
      {tab === 'builds' && (
        <MatchBuilds participants={sortByRole([...blue_team, ...red_team])} />
      )}

      <div
        style={{
          maxWidth: 1260,
          margin: '0 auto',
          padding: '0 28px 32px',
          textAlign: 'center',
          fontSize: 10,
          color: 'var(--m-muted)',
        }}
      >
        ID: <span className="font-mono">{match_id}</span>
      </div>
    </div>
  )
}

// ══════════ Overview tab ═══════════════════════════════════════
function MatchOverview({
  match,
  highlightPuuid,
  hasTimeline,
  showTimeline,
  timelineFrames,
  timelineLoading,
  timelineError,
  onToggleTimeline,
}: {
  match: MatchDetails
  highlightPuuid: string | null
  hasTimeline: boolean
  showTimeline: boolean
  timelineFrames: TimelineFrame[] | null
  timelineLoading: boolean
  timelineError: string | null
  onToggleTimeline: () => void
}) {
  const { blue_team, red_team, max_damage } = match
  const blueWin = blue_team[0]?.win ?? true
  const duration = match.meta.game_duration

  const sum = (team: Participant[], field: keyof Participant) =>
    team.reduce((acc, p) => acc + (Number(p[field]) || 0), 0)

  const blueGold = sum(blue_team, 'gold_earned')
  const redGold = sum(red_team, 'gold_earned')
  const blueKills = sum(blue_team, 'kills')
  const redKills = sum(red_team, 'kills')

  return (
    <div
      style={{
        maxWidth: 1260,
        margin: '0 auto',
        padding: '24px 28px 48px',
        display: 'flex',
        flexDirection: 'column',
        gap: 20,
      }}
    >
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 360px', gap: 20 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20, minWidth: 0 }}>
          {/* Times */}
          <Card pad={0}>
            <div style={{ padding: '16px 20px 12px' }}>
              <SectionLabel icon="shield">Times</SectionLabel>
            </div>
            <TeamBlock
              team={blue_team}
              color="var(--m-green)"
              label={`Azul · ${blueWin ? 'Vitória' : 'Derrota'}`}
              goldTotal={blueGold}
              kills={blueKills}
              maxDamage={max_damage}
              highlightPuuid={highlightPuuid}
              duration={duration}
            />
            <div style={{ height: 1, background: 'var(--m-border)' }} />
            <TeamBlock
              team={red_team}
              color="var(--m-red)"
              label={`Vermelho · ${!blueWin ? 'Vitória' : 'Derrota'}`}
              goldTotal={redGold}
              kills={redKills}
              maxDamage={max_damage}
              highlightPuuid={highlightPuuid}
              duration={duration}
            />
          </Card>

          {/* Timeline */}
          {hasTimeline && (
            <Card pad={0}>
              <button
                type="button"
                onClick={onToggleTimeline}
                className="m-hover-surface"
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '14px 20px',
                  background: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <Icon name="activity" size={14} style={{ color: 'var(--m-accent)' }} />
                  <span
                    style={{
                      fontSize: 11,
                      fontWeight: 600,
                      textTransform: 'uppercase',
                      letterSpacing: '0.08em',
                      color: 'var(--m-text-dim)',
                    }}
                  >
                    Timeline da partida
                  </span>
                  <span
                    style={{
                      fontSize: 10,
                      padding: '2px 7px',
                      background: 'rgb(var(--m-accent-rgb) / 0.1)',
                      border: '1px solid rgb(var(--m-accent-rgb) / 0.25)',
                      color: 'var(--m-accent)',
                      borderRadius: 4,
                      fontWeight: 600,
                      letterSpacing: '0.04em',
                      textTransform: 'uppercase',
                    }}
                  >
                    Frames por minuto
                  </span>
                </div>
                <Icon
                  name={showTimeline ? 'chevronUp' : 'chevronDown'}
                  size={14}
                  style={{ color: 'var(--m-text-dim)' }}
                />
              </button>
              {showTimeline && (
                <div style={{ padding: '0 20px 20px' }}>
                  {timelineLoading && (
                    <div
                      style={{
                        padding: '32px 0',
                        textAlign: 'center',
                        fontSize: 12,
                        color: 'var(--m-text-dim)',
                      }}
                    >
                      Carregando timeline...
                    </div>
                  )}
                  {timelineError && (
                    <div
                      style={{
                        padding: '16px 0',
                        textAlign: 'center',
                        fontSize: 12,
                        color: 'var(--m-red)',
                      }}
                    >
                      {timelineError}
                    </div>
                  )}
                  {!timelineLoading && !timelineError && timelineFrames && (
                    <TimelineChart
                      frames={timelineFrames}
                      participants={[...blue_team, ...red_team]}
                      highlightedPuuid={highlightPuuid}
                    />
                  )}
                  <div
                    style={{
                      fontSize: 10,
                      color: 'var(--m-muted)',
                      textAlign: 'center',
                      marginTop: 10,
                      lineHeight: 1.5,
                    }}
                  >
                    Timeline interativa com mapa e eventos posicionais em breve — depende do parsing
                    de eventos do Riot timeline (Bloco 0 do roadmap de analytics profundo).
                  </div>
                </div>
              )}
            </Card>
          )}
        </div>

        {/* RIGHT */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <Card accent>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 10 }}>
              <div
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: 8,
                  background: 'rgb(var(--m-accent-rgb) / 0.15)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--m-accent)',
                }}
              >
                <Icon name="brain" size={15} />
              </div>
              <div>
                <div className="font-display" style={{ fontSize: 13, fontWeight: 600 }}>
                  Análise da Metis
                </div>
                <div style={{ fontSize: 10, color: 'var(--m-text-dim)' }}>
                  IA tática · em breve
                </div>
              </div>
            </div>
            <p style={{ fontSize: 12, color: 'var(--m-text-dim)', lineHeight: 1.55, marginBottom: 10 }}>
              A análise narrativa automática chega quando o Bloco 0 do roadmap entregar o parsing de eventos da timeline. Enquanto isso, pergunte diretamente à Metis sobre esta partida.
            </p>
            {highlightPuuid && (
              <Link
                href={`/chat?match_id=${match.match_id}&puuid=${highlightPuuid}`}
                className="m-hover-accent"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 6,
                  width: '100%',
                  padding: '9px 12px',
                  background: 'var(--m-accent)',
                  border: 'none',
                  borderRadius: 8,
                  color: '#1a1510',
                  fontSize: 12,
                  fontWeight: 600,
                  textDecoration: 'none',
                }}
              >
                <Icon name="messageCircle" size={13} />
                Perguntar à Metis
              </Link>
            )}
          </Card>

          <Card>
            <SectionLabel icon="activity">Resumo rápido</SectionLabel>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10, marginTop: 6 }}>
              {[
                { l: 'Duração', v: formatDuration(duration), c: 'var(--m-text)' },
                {
                  l: 'Kills',
                  v: `${blueKills}-${redKills}`,
                  c: blueWin ? 'var(--m-green)' : 'var(--m-red)',
                },
                {
                  l: 'Ouro total',
                  v: `${((blueGold + redGold) / 1000).toFixed(1)}k`,
                  c: 'var(--m-accent)',
                },
                {
                  l: 'Dif. ouro',
                  v: `${blueGold > redGold ? '+' : ''}${((blueGold - redGold) / 1000).toFixed(1)}k`,
                  c: blueGold > redGold ? 'var(--m-green)' : 'var(--m-red)',
                },
              ].map((s, i) => (
                <div
                  key={i}
                  style={{
                    padding: '10px 12px',
                    background: 'var(--m-bg)',
                    border: '1px solid var(--m-border)',
                    borderRadius: 8,
                  }}
                >
                  <div
                    style={{
                      fontSize: 9,
                      color: 'var(--m-muted)',
                      textTransform: 'uppercase',
                      letterSpacing: '0.08em',
                      fontWeight: 600,
                      marginBottom: 3,
                    }}
                  >
                    {s.l}
                  </div>
                  <div
                    className="tabular font-display"
                    style={{
                      fontSize: 20,
                      fontWeight: 700,
                      color: s.c,
                      letterSpacing: '-0.02em',
                    }}
                  >
                    {s.v}
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </div>
  )
}

// ── TeamBlock ─────────────────────────────────────────────────
function TeamBlock({
  team,
  color,
  label,
  goldTotal,
  kills,
  maxDamage,
  highlightPuuid,
  duration,
}: {
  team: Participant[]
  color: string
  label: string
  goldTotal: number
  kills: number
  maxDamage: number
  highlightPuuid: string | null
  duration: number
}) {
  const sorted = sortByRole(team)
  const bgGradient = color === 'var(--m-green)'
    ? 'linear-gradient(90deg, rgba(74,222,128,0.06), transparent)'
    : 'linear-gradient(90deg, rgba(248,113,113,0.06), transparent)'
  return (
    <div>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          padding: '10px 20px',
          background: bgGradient,
          flexWrap: 'wrap',
          gap: 10,
        }}
      >
        <div style={{ width: 3, height: 24, background: color, borderRadius: 2 }} />
        <div
          style={{
            fontSize: 12,
            fontWeight: 600,
            color,
            textTransform: 'uppercase',
            letterSpacing: '0.06em',
          }}
        >
          {label}
        </div>
        <div style={{ flex: 1 }} />
        <div
          style={{
            display: 'flex',
            gap: 14,
            fontSize: 11,
            color: 'var(--m-text-dim)',
            flexWrap: 'wrap',
          }}
        >
          <span>
            <span className="tabular" style={{ color: 'var(--m-text)', fontWeight: 600 }}>
              {(goldTotal / 1000).toFixed(1)}k
            </span>{' '}
            ouro
          </span>
          <span>
            <span className="tabular" style={{ color: 'var(--m-text)', fontWeight: 600 }}>
              {kills}
            </span>{' '}
            kills
          </span>
        </div>
      </div>
      {sorted.map((p, i) => {
        const isYou = p.puuid === highlightPuuid
        const kda =
          p.deaths === 0 ? '∞' : ((p.kills + p.assists) / p.deaths).toFixed(2)
        const damage = p.total_damage_dealt_to_champions ?? 0
        const damageBar = maxDamage > 0 ? (damage / maxDamage) * 100 : 0
        const cspm = p.cs_per_minute ?? 0
        const keystoneUrl = p.rune_keystone
          ? runeIconUrl(p.rune_keystone, DDRAGON_VERSION)
          : null
        const scoreStyle = p.metis_score != null ? metisScoreStyle(p.metis_score) : null
        const items = (p.items ?? []).filter((id) => id > 0).slice(0, 6)

        return (
          <div
            key={p.puuid}
            style={{
              display: 'grid',
              gridTemplateColumns: '28px 36px 1.2fr 110px 140px 150px 80px',
              gap: 12,
              padding: '10px 20px',
              alignItems: 'center',
              borderTop: i ? '1px solid rgba(34,40,56,0.4)' : 'none',
              background: isYou ? 'rgb(var(--m-accent-rgb) / 0.05)' : 'transparent',
            }}
          >
            <Image
              src={roleIconPath(p.team_position)}
              alt={p.team_position}
              width={16}
              height={16}
              unoptimized
              style={{ objectFit: 'contain', opacity: 0.8 }}
            />
            <div style={{ position: 'relative' }}>
              <ChampPortrait name={p.champion_name} size={32} />
              {p.champion_level && (
                <span
                  style={{
                    position: 'absolute',
                    bottom: -2,
                    right: -2,
                    fontSize: 8,
                    fontWeight: 700,
                    background: 'var(--m-bg)',
                    color: 'var(--m-text)',
                    padding: '1px 4px',
                    borderRadius: 3,
                    border: '1px solid var(--m-border-2)',
                    lineHeight: 1,
                  }}
                >
                  {p.champion_level}
                </span>
              )}
            </div>
            <div style={{ minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <Link
                  href={`/players/${encodeURIComponent(p.puuid)}`}
                  className="m-hover-link"
                  style={{
                    fontSize: 12,
                    fontWeight: isYou ? 700 : 500,
                    color: isYou ? 'var(--m-accent)' : 'var(--m-text)',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    textDecoration: 'none',
                  }}
                >
                  {p.players
                    ? `${p.players.game_name}#${p.players.tag_line}`
                    : `${p.puuid.slice(0, 12)}…`}
                </Link>
                {isYou && (
                  <span
                    style={{
                      fontSize: 9,
                      fontWeight: 600,
                      padding: '2px 5px',
                      background: 'var(--m-accent)',
                      color: '#1a1510',
                      borderRadius: 3,
                      letterSpacing: '0.04em',
                    }}
                  >
                    VOCÊ
                  </span>
                )}
              </div>
              <div style={{ fontSize: 10, color: 'var(--m-text-dim)', marginTop: 1 }}>
                {p.champion_name} · {ROLES_PT[p.team_position as Role] ?? p.team_position}
              </div>
            </div>
            <div className="tabular" style={{ fontSize: 13, fontWeight: 600 }}>
              <span>{p.kills}</span>
              <span style={{ color: 'var(--m-muted)' }}> / </span>
              <span style={{ color: 'var(--m-red)' }}>{p.deaths}</span>
              <span style={{ color: 'var(--m-muted)' }}> / </span>
              <span>{p.assists}</span>
              <span style={{ fontSize: 10, color: 'var(--m-text-dim)', marginLeft: 6 }}>
                {kda}
              </span>
            </div>
            <div>
              <div className="tabular" style={{ fontSize: 11, fontWeight: 500 }}>
                {damage.toLocaleString('pt-BR')} dano
              </div>
              <Bar value={damage} max={maxDamage} color={color} height={3} />
              <div
                className="tabular"
                style={{ fontSize: 10, color: 'var(--m-text-dim)', marginTop: 2 }}
              >
                {p.total_cs ?? 0} cs · {cspm.toFixed(1)}/m
              </div>
            </div>
            <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap', alignItems: 'center' }}>
              {items.length === 0
                ? Array.from({ length: 6 }, (_, i) => (
                    <div
                      key={i}
                      style={{
                        width: 22,
                        height: 22,
                        borderRadius: 4,
                        background: 'var(--m-surface-2)',
                        border: '1px solid var(--m-border-2)',
                      }}
                    />
                  ))
                : items.map((id, i) => (
                    <div
                      key={i}
                      style={{
                        width: 22,
                        height: 22,
                        borderRadius: 4,
                        background: 'var(--m-surface-2)',
                        border: '1px solid var(--m-border-2)',
                        backgroundImage: `url(https://ddragon.leagueoflegends.com/cdn/${DDRAGON_VERSION}/img/item/${id}.png)`,
                        backgroundSize: 'cover',
                      }}
                    />
                  ))}
              {keystoneUrl && (
                <div
                  style={{
                    width: 20,
                    height: 20,
                    marginLeft: 4,
                    borderRadius: '50%',
                    border: '1px solid var(--m-border-2)',
                    background: `var(--m-bg) url(${keystoneUrl}) center/contain no-repeat`,
                  }}
                />
              )}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end' }}>
              {scoreStyle && (
                <div
                  title={`Metis Score ${Math.round(p.metis_score!)}`}
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 8,
                    background: scoreStyle.bg,
                    border: `1px solid ${scoreStyle.bd}`,
                    color: scoreStyle.fg,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 12,
                    fontWeight: 700,
                  }}
                >
                  {Math.round(p.metis_score!)}
                </div>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ══════════ Team Analysis tab ══════════════════════════════════
function MatchTeamAnalysis({
  blue,
  red,
  blueWin,
}: {
  blue: Participant[]
  red: Participant[]
  blueWin: boolean
}) {
  const sum = (team: Participant[], field: keyof Participant) =>
    team.reduce((acc, p) => acc + (Number(p[field]) || 0), 0)

  const metrics = [
    { key: 'kills',  label: 'Abates',           fmt: (v: number) => v.toString() },
    { key: 'gold_earned', label: 'Ouro total',  fmt: (v: number) => `${(v / 1000).toFixed(1)}k` },
    { key: 'total_damage_dealt_to_champions', label: 'Dano a campeões', fmt: (v: number) => `${(v / 1000).toFixed(1)}k` },
    { key: 'vision_score', label: 'Score de visão', fmt: (v: number) => v.toString() },
    { key: 'total_cs', label: 'Creep score',    fmt: (v: number) => v.toString() },
  ] as const

  const maxDmgOverall = Math.max(
    ...[...blue, ...red].map((p) => p.total_damage_dealt_to_champions ?? 0),
    1
  )

  return (
    <div
      style={{
        maxWidth: 1260,
        margin: '0 auto',
        padding: '24px 28px 48px',
        display: 'grid',
        gridTemplateColumns: '1fr 320px',
        gap: 20,
      }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20, minWidth: 0 }}>
        <Card>
          <SectionLabel
            icon="pieChart"
            right={
              <div style={{ display: 'flex', gap: 12, fontSize: 11 }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                  <span
                    style={{
                      width: 10,
                      height: 10,
                      borderRadius: 2,
                      background: 'var(--m-green)',
                    }}
                  />
                  <span style={{ color: 'var(--m-text-dim)' }}>
                    Azul · {blueWin ? 'Vitória' : 'Derrota'}
                  </span>
                </span>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                  <span
                    style={{
                      width: 10,
                      height: 10,
                      borderRadius: 2,
                      background: 'var(--m-red)',
                    }}
                  />
                  <span style={{ color: 'var(--m-text-dim)' }}>
                    Vermelho · {!blueWin ? 'Vitória' : 'Derrota'}
                  </span>
                </span>
              </div>
            }
          >
            Comparação por métrica
          </SectionLabel>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
              gap: 14,
              marginTop: 4,
            }}
          >
            {metrics.map((m) => {
              const b = sum(blue, m.key as keyof Participant)
              const r = sum(red, m.key as keyof Participant)
              const total = b + r || 1
              const blueWon = b > r
              return (
                <div
                  key={m.key}
                  style={{
                    padding: '16px 12px 14px',
                    background: 'var(--m-bg)',
                    border: '1px solid var(--m-border)',
                    borderRadius: 12,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                  }}
                >
                  <div
                    style={{
                      fontSize: 10,
                      color: 'var(--m-muted)',
                      textTransform: 'uppercase',
                      letterSpacing: '0.08em',
                      fontWeight: 600,
                      marginBottom: 10,
                      textAlign: 'center',
                    }}
                  >
                    {m.label}
                  </div>
                  <SplitDonut blue={b} red={r} size={120} />
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      width: '100%',
                      marginTop: 12,
                      padding: '0 4px',
                    }}
                  >
                    <div style={{ textAlign: 'left' }}>
                      <div
                        className="tabular font-display"
                        style={{
                          fontSize: 15,
                          fontWeight: 700,
                          color: blueWon ? 'var(--m-green)' : 'var(--m-text)',
                        }}
                      >
                        {m.fmt(b)}
                      </div>
                      <div style={{ fontSize: 10, color: 'var(--m-text-dim)' }}>
                        {((b / total) * 100).toFixed(0)}%
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div
                        className="tabular font-display"
                        style={{
                          fontSize: 15,
                          fontWeight: 700,
                          color: !blueWon ? 'var(--m-red)' : 'var(--m-text)',
                        }}
                      >
                        {m.fmt(r)}
                      </div>
                      <div style={{ fontSize: 10, color: 'var(--m-text-dim)' }}>
                        {((r / total) * 100).toFixed(0)}%
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </Card>

        {/* Bar por jogador — dano */}
        <Card>
          <SectionLabel icon="barChart">Dano a campeões · por jogador</SectionLabel>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 7, marginTop: 4 }}>
            {[...blue, ...red]
              .sort(
                (a, b) =>
                  (b.total_damage_dealt_to_champions ?? 0) -
                  (a.total_damage_dealt_to_champions ?? 0)
              )
              .map((p) => {
                const dmg = p.total_damage_dealt_to_champions ?? 0
                const teamColor = p.team_id === 100 ? 'var(--m-green)' : 'var(--m-red)'
                return (
                  <div
                    key={p.puuid}
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '28px 150px 1fr 80px',
                      gap: 10,
                      alignItems: 'center',
                    }}
                  >
                    <ChampPortrait name={p.champion_name} size={26} />
                    <div style={{ minWidth: 0 }}>
                      <div
                        style={{
                          fontSize: 12,
                          fontWeight: 500,
                          color: 'var(--m-text)',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                        }}
                      >
                        {p.players
                          ? `${p.players.game_name}#${p.players.tag_line}`
                          : p.champion_name}
                      </div>
                      <div style={{ fontSize: 10, color: 'var(--m-text-dim)' }}>
                        {p.champion_name}
                      </div>
                    </div>
                    <div
                      style={{
                        height: 18,
                        borderRadius: 4,
                        background: 'var(--m-bg)',
                        border: '1px solid var(--m-border)',
                        overflow: 'hidden',
                      }}
                    >
                      <div
                        style={{
                          height: '100%',
                          width: `${(dmg / maxDmgOverall) * 100}%`,
                          background:
                            p.team_id === 100
                              ? 'linear-gradient(90deg, rgba(74,222,128,0.2), var(--m-green))'
                              : 'linear-gradient(90deg, rgba(248,113,113,0.2), var(--m-red))',
                        }}
                      />
                    </div>
                    <div
                      className="tabular"
                      style={{
                        fontSize: 12,
                        fontWeight: 600,
                        textAlign: 'right',
                        color: teamColor,
                      }}
                    >
                      {dmg.toLocaleString('pt-BR')}
                    </div>
                  </div>
                )
              })}
          </div>
        </Card>
      </div>

      {/* Sidebar */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <Card>
          <SectionLabel icon="target">Perfil dos times</SectionLabel>
          <p style={{ fontSize: 11, color: 'var(--m-text-dim)', lineHeight: 1.55, marginTop: 6 }}>
            Análise semântica dos perfis (AD/AP, Controle, Mobilidade, Pick) chega quando o endpoint
            de classificação de composição for implementado. Por ora, a comparação por métricas ao
            lado já dá uma leitura objetiva.
          </p>
        </Card>

        <Card accent>
          <SectionLabel icon="brain">Leitura da Metis</SectionLabel>
          <p style={{ fontSize: 12, color: 'var(--m-text)', lineHeight: 1.55 }}>
            Time{' '}
            <b
              style={{
                color: blueWin ? 'var(--m-green)' : 'var(--m-red)',
              }}
            >
              {blueWin ? 'azul' : 'vermelho'}
            </b>{' '}
            venceu. Para análise narrativa completa (timings, viradas, erros), peça pra Metis no
            chat — com o match_id na URL ela já pega o contexto.
          </p>
        </Card>
      </div>
    </div>
  )
}

// ── SplitDonut pra Team Analysis ──────────────────────────────
function SplitDonut({ blue, red, size = 120 }: { blue: number; red: number; size?: number }) {
  const total = blue + red || 1
  const r = size / 2 - 8
  const circ = 2 * Math.PI * r
  const bluePct = blue / total
  const winner = blue > red ? 'blue' : 'red'
  return (
    <div style={{ position: 'relative', width: size, height: size }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={size / 2} cy={size / 2} r={r} stroke="var(--m-border)" strokeWidth="8" fill="none" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke="var(--m-green)"
          strokeWidth="10"
          fill="none"
          strokeDasharray={`${circ * bluePct} ${circ}`}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke="var(--m-red)"
          strokeWidth="10"
          fill="none"
          strokeDasharray={`${circ * (1 - bluePct)} ${circ}`}
          strokeDashoffset={`${-circ * bluePct}`}
        />
      </svg>
      <div
        style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexDirection: 'column',
        }}
      >
        <div
          className="tabular font-display"
          style={{
            fontSize: 16,
            fontWeight: 700,
            color: winner === 'blue' ? 'var(--m-green)' : 'var(--m-red)',
          }}
        >
          {(bluePct * 100).toFixed(0)}:{((1 - bluePct) * 100).toFixed(0)}
        </div>
      </div>
    </div>
  )
}

// ══════════ Builds tab ═════════════════════════════════════════
function MatchBuilds({ participants }: { participants: Participant[] }) {
  return (
    <div style={{ maxWidth: 1260, margin: '0 auto', padding: '24px 28px 48px' }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          marginBottom: 14,
          flexWrap: 'wrap',
        }}
      >
        <SectionLabel icon="sword">Itens · Runas · Summoners por jogador</SectionLabel>
        <div style={{ flex: 1 }} />
        <Pill active>Todos</Pill>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {participants.map((p) => (
          <BuildRow key={p.puuid} p={p} />
        ))}
      </div>
    </div>
  )
}

function BuildRow({ p }: { p: Participant }) {
  const teamColor = p.team_id === 100 ? 'var(--m-green)' : 'var(--m-red)'
  const items = p.items ?? []
  const keystoneUrl = p.rune_keystone
    ? runeIconUrl(p.rune_keystone, DDRAGON_VERSION)
    : null
  const spell1 = SUMMONER_SPELL[p.summoner1_id ?? 0]
  const spell2 = SUMMONER_SPELL[p.summoner2_id ?? 0]

  const runeStyles: RuneStyle[] = (() => {
    const raw = p.runes_raw as { styles?: RuneStyle[] } | null
    return raw?.styles ?? []
  })()
  const primaryStyle = runeStyles[0]
  const secondaryStyle = runeStyles[1]

  const itemIconSrc = (id: number) =>
    id > 0 ? `https://ddragon.leagueoflegends.com/cdn/${DDRAGON_VERSION}/img/item/${id}.png` : null

  return (
    <div
      style={{
        padding: '14px 18px',
        background: 'var(--m-surface)',
        border: `1px solid ${p.team_id === 100 ? 'rgba(74,222,128,0.25)' : 'rgba(248,113,113,0.25)'}`,
        borderLeft: `3px solid ${teamColor}`,
        borderRadius: 10,
        display: 'grid',
        gridTemplateColumns: 'auto 36px 200px 1fr 240px 60px',
        gap: 14,
        alignItems: 'center',
      }}
    >
      <Image
        src={roleIconPath(p.team_position)}
        alt={p.team_position}
        width={18}
        height={18}
        unoptimized
        style={{ objectFit: 'contain', opacity: 0.8 }}
      />
      <ChampPortrait name={p.champion_name} size={36} />
      <div style={{ minWidth: 0 }}>
        <Link
          href={`/players/${encodeURIComponent(p.puuid)}`}
          className="m-hover-link"
          style={{
            fontSize: 13,
            fontWeight: 500,
            color: 'var(--m-text)',
            textDecoration: 'none',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            display: 'block',
          }}
        >
          {p.players
            ? `${p.players.game_name}#${p.players.tag_line}`
            : p.champion_name}
        </Link>
        <div style={{ fontSize: 10, color: 'var(--m-text-dim)', marginTop: 2 }}>
          {p.champion_name} · {ROLES_PT[p.team_position as Role] ?? p.team_position}
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap' }}>
        {/* Items 0-5 */}
        {Array.from({ length: 6 }, (_, i) => {
          const id = items[i] ?? 0
          const src = itemIconSrc(id)
          return (
            <div
              key={i}
              style={{
                width: 30,
                height: 30,
                borderRadius: 5,
                background: src ? `var(--m-surface-2) url(${src}) center/cover` : 'var(--m-surface-2)',
                border: '1px solid var(--m-border-2)',
                flexShrink: 0,
              }}
            />
          )
        })}
        {/* Trinket */}
        {items[6] > 0 && (
          <>
            <div style={{ width: 1, height: 24, background: 'var(--m-border)', margin: '0 4px' }} />
            <div
              style={{
                width: 26,
                height: 26,
                borderRadius: '50%',
                background: `var(--m-surface-2) url(${itemIconSrc(items[6])}) center/cover`,
                border: '1px solid var(--m-border-2)',
                flexShrink: 0,
              }}
            />
          </>
        )}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        {/* Keystone */}
        {keystoneUrl && (
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: '50%',
              background: `var(--m-bg) url(${keystoneUrl}) center/contain no-repeat`,
              border: '1.5px solid var(--m-border-2)',
              flexShrink: 0,
            }}
          />
        )}
        {/* Primary + secondary labels */}
        <div style={{ minWidth: 0, flex: 1 }}>
          {primaryStyle && (
            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--m-text)' }}>
              {RUNE_TREES[primaryStyle.style]?.name ?? 'Primária'}
            </div>
          )}
          {secondaryStyle && (
            <div
              style={{
                fontSize: 9,
                color: 'var(--m-text-dim)',
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
              }}
            >
              / {RUNE_TREES[secondaryStyle.style]?.name ?? 'Secundária'}
            </div>
          )}
        </div>
        {/* Summoners */}
        <div style={{ display: 'flex', gap: 3, flexShrink: 0 }}>
          {spell1 && (
            <Image
              src={`https://ddragon.leagueoflegends.com/cdn/${DDRAGON_VERSION}/img/spell/${spell1}.png`}
              alt=""
              width={22}
              height={22}
              unoptimized
              style={{ borderRadius: 4, border: '1px solid var(--m-border-2)' }}
            />
          )}
          {spell2 && (
            <Image
              src={`https://ddragon.leagueoflegends.com/cdn/${DDRAGON_VERSION}/img/spell/${spell2}.png`}
              alt=""
              width={22}
              height={22}
              unoptimized
              style={{ borderRadius: 4, border: '1px solid var(--m-border-2)' }}
            />
          )}
        </div>
      </div>
      <div
        className="tabular"
        style={{ fontSize: 12, fontWeight: 600, textAlign: 'center', color: teamColor }}
      >
        {p.win ? 'V' : 'D'}
      </div>
    </div>
  )
}
