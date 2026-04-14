'use client'

import { useState, useEffect } from 'react'
import { useParams, useSearchParams } from 'next/navigation'
import Image from 'next/image'
import Link from 'next/link'
import { ArrowLeft, Clock, Sword, ChevronDown, ChevronUp, MessageSquare } from 'lucide-react'
import { Header } from '@/components/ui/Header'
import { championIconUrl, roleIconPath, DDRAGON_VERSION } from '@/lib/ddragon'
import { runeIconUrl, RUNE_TREES } from '@/lib/runes'
import { TimelineChart } from '@/components/matches/TimelineChart'

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? ''

// ── Tipos ─────────────────────────────────────────────────────

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

type MatchMeta = {
  match_id: string
  game_version: string
  game_duration: number
  queue_id: number
  end_type: string
  created_at: string
}

type MatchDetails = {
  match_id: string
  meta: MatchMeta
  has_timeline: boolean
  max_damage: number
  blue_team: Participant[]
  red_team: Participant[]
}

// ── Helpers ───────────────────────────────────────────────────

function formatDuration(s: number) {
  const m = Math.floor(s / 60)
  const sec = s % 60
  return `${m}m ${sec.toString().padStart(2, '0')}s`
}

function formatGold(g: number) {
  return g >= 1000 ? `${(g / 1000).toFixed(1)}k` : String(g)
}

function csColor(cspm: number) {
  if (cspm >= 8) return 'text-green-400'
  if (cspm >= 6) return 'text-yellow-400'
  if (cspm >= 4) return 'text-metis-text-dim'
  return 'text-red-400'
}

const QUEUE_LABEL: Record<number, string> = { 420: 'SoloQ', 440: 'Flex' }
const POSITION_LABEL: Record<string, string> = {
  TOP: 'Top', JUNGLE: 'Jungle', MIDDLE: 'Mid',
  BOTTOM: 'ADC', UTILITY: 'Suporte', UNKNOWN: '—',
}
const ROLE_ORDER: Record<string, number> = {
  TOP: 0, JUNGLE: 1, MIDDLE: 2, BOTTOM: 3, UTILITY: 4, UNKNOWN: 5,
}
function sortByRole(participants: Participant[]): Participant[] {
  return [...participants].sort((a, b) =>
    (ROLE_ORDER[a.team_position] ?? 5) - (ROLE_ORDER[b.team_position] ?? 5)
  )
}

// ── Sub-componente: linha de participante ────────────────────

function ParticipantRow({
  p,
  maxDamage,
  isHighlighted,
  matchId,
}: {
  p: Participant
  maxDamage: number
  isHighlighted: boolean
  matchId: string
}) {
  const kda = p.deaths === 0
    ? '∞'
    : ((p.kills + p.assists) / p.deaths).toFixed(2)

  const cspm      = p.cs_per_minute ?? 0
  const items     = p.items ?? Array(7).fill(0)
  const damage    = p.total_damage_dealt_to_champions ?? 0
  const damageBar = Math.round((damage / maxDamage) * 100)
  const keystoneUrl = p.rune_keystone ? runeIconUrl(p.rune_keystone, DDRAGON_VERSION) : null
  const roleIcon    = roleIconPath(p.team_position)
  const playerName  = p.players
    ? `${p.players.game_name}#${p.players.tag_line}`
    : p.puuid.slice(0, 12) + '…'

  return (
    <div className={`flex flex-col gap-1.5 px-3 py-2.5 border-b border-metis-border/40 last:border-b-0 ${
      isHighlighted ? 'bg-metis-accent/5' : 'hover:bg-metis-bg/30'
    } transition-colors`}>

      {/* Linha 1 — campeão + nome + KDA */}
      <div className="flex items-center gap-2 min-w-0">
        {/* Ícone do campeão com nível */}
        <div className="relative w-9 h-9 rounded-md overflow-hidden border border-metis-border flex-shrink-0">
          <Image
            src={championIconUrl(p.champion_name, DDRAGON_VERSION)}
            alt={p.champion_name}
            fill className="object-cover" unoptimized
          />
          {p.champion_level && (
            <span className="absolute bottom-0 right-0 text-[8px] font-bold bg-black/70 text-white px-0.5 rounded-tl leading-none py-0.5">
              {p.champion_level}
            </span>
          )}
        </div>

        {/* Nome + posição */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1">
            {roleIcon && (
              <Image src={roleIcon} alt={p.team_position} width={11} height={11} unoptimized className="opacity-50 flex-shrink-0" />
            )}
            <Link
              href={`/players/${encodeURIComponent(p.puuid)}`}
              className={`text-xs font-medium truncate hover:underline ${
                isHighlighted ? 'text-metis-accent' : 'text-metis-text'
              }`}
            >
              {playerName}
            </Link>
          </div>
          <span className="text-[10px] text-metis-text-dim">{p.champion_name}</span>
        </div>

        {/* KDA */}
        <div className="text-right flex-shrink-0">
          <p className="text-xs font-semibold text-metis-text">
            {p.kills}/{p.deaths}/{p.assists}
          </p>
          <p className="text-[10px] text-metis-text-dim">{kda} KDA</p>
        </div>

        {/* Metis Score — cores de elo (2 tons) */}
        {p.metis_score != null && (() => {
          const s = p.metis_score
          return (
            <div
              className="flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center text-xs font-bold border"
              style={
                s >= 100 ? { background: 'linear-gradient(135deg, rgba(34,211,238,0.2), rgba(212,175,55,0.15))', borderColor: 'rgba(34,211,238,0.5)', color: '#22d3ee' } :        /* Challenger: ciano + dourado */
                s >= 90  ? { background: 'linear-gradient(135deg, rgba(239,68,68,0.2), rgba(156,163,175,0.15))', borderColor: 'rgba(239,68,68,0.5)', color: '#ef4444' } :          /* GM: vermelho + cinza metalico */
                s >= 80  ? { background: 'rgba(168,85,247,0.15)', borderColor: 'rgba(168,85,247,0.4)', color: '#a855f7' } :                                                        /* Master: roxo */
                s >= 70  ? { background: 'rgba(30,64,175,0.2)', borderColor: 'rgba(30,64,175,0.5)', color: '#3b82f6' } :                                                           /* Diamond: azul escuro */
                s >= 60  ? { background: 'rgba(16,185,129,0.15)', borderColor: 'rgba(16,185,129,0.4)', color: '#10b981' } :                                                        /* Emerald: esmeralda */
                s >= 50  ? { background: 'rgba(20,184,166,0.15)', borderColor: 'rgba(20,184,166,0.4)', color: '#14b8a6' } :                                                        /* Platinum: teal */
                s >= 40  ? { background: 'rgba(212,175,55,0.15)', borderColor: 'rgba(212,175,55,0.4)', color: '#d4af37' } :                                                        /* Gold: dourado */
                s >= 30  ? { background: 'rgba(203,213,225,0.1)', borderColor: 'rgba(203,213,225,0.3)', color: '#cbd5e1' } :                                                       /* Silver: cinza claro */
                s >= 20  ? { background: 'rgba(154,82,40,0.15)', borderColor: 'rgba(154,82,40,0.4)', color: '#b45a2a' } :                                                          /* Bronze: laranja escuro */
                           { background: 'linear-gradient(135deg, rgba(120,113,108,0.15), rgba(168,162,158,0.1))', borderColor: 'rgba(120,113,108,0.4)', color: '#a8a29e' }         /* Iron: stone + cinza */
              }
            >
              {Math.round(s)}
            </div>
          )
        })()}
      </div>

      {/* Linha 2 — CS + ouro + dano */}
      <div className="flex items-center gap-3 text-[10px] text-metis-text-dim flex-wrap">
        {p.total_cs !== null && (
          <span className={`font-medium ${csColor(cspm)}`}>
            {p.total_cs}cs <span className="text-metis-text-dim font-normal">({cspm.toFixed(1)}/m)</span>
          </span>
        )}
        <span>{formatGold(p.gold_earned)} ouro</span>
        {p.vision_score !== null && <span>VS {p.vision_score}</span>}
      </div>

      {/* Linha 3 — Barra de dano */}
      <div className="flex items-center gap-2">
        <div className="flex-1 bg-metis-border/30 rounded-full h-1.5 overflow-hidden">
          <div
            className={`h-full rounded-full ${p.win ? 'bg-blue-500/70' : 'bg-red-500/70'}`}
            style={{ width: `${damageBar}%` }}
          />
        </div>
        <span className="text-[10px] text-metis-text-dim flex-shrink-0 w-12 text-right">
          {damage >= 1000 ? `${(damage / 1000).toFixed(1)}k` : damage}
        </span>
      </div>

      {/* Linha 4 — Items + keystone */}
      <div className="flex items-center gap-0.5">
        {items.map((id, i) =>
          id > 0 ? (
            <Image
              key={i}
              src={`https://ddragon.leagueoflegends.com/cdn/${DDRAGON_VERSION}/img/item/${id}.png`}
              alt={String(id)} width={22} height={22}
              className="rounded border border-metis-border/50"
              unoptimized
            />
          ) : (
            <div key={i} className="w-[22px] h-[22px] rounded border border-metis-border/20 bg-metis-bg/40" />
          )
        )}
        {keystoneUrl && (
          <Image
            src={keystoneUrl}
            alt="Keystone" width={20} height={20}
            className="ml-1.5 rounded-full border border-metis-border/40 bg-metis-bg"
            unoptimized
          />
        )}
      </div>
    </div>
  )
}

// ── Componente: coluna de time ────────────────────────────────

function TeamColumn({
  participants,
  win,
  label,
  maxDamage,
  highlightedPuuid,
  matchId,
}: {
  participants: Participant[]
  win: boolean
  label: string
  maxDamage: number
  highlightedPuuid: string | null
  matchId: string
}) {
  return (
    <div className={`rounded-xl border overflow-hidden ${
      win
        ? 'border-blue-500/30 bg-blue-500/5'
        : 'border-red-500/30  bg-red-500/5'
    }`}>
      {/* Header do time */}
      <div className={`flex items-center gap-2 px-3 py-2 border-b ${
        win ? 'border-blue-500/20 bg-blue-500/10' : 'border-red-500/20 bg-red-500/10'
      }`}>
        <span className={`text-xs font-bold ${win ? 'text-blue-400' : 'text-red-400'}`}>
          {label}
        </span>
        <span className={`text-[10px] px-1.5 py-0.5 rounded font-semibold ${
          win
            ? 'bg-blue-500/20 text-blue-300'
            : 'bg-red-500/20  text-red-300'
        }`}>
          {win ? 'Vitória' : 'Derrota'}
        </span>
      </div>

      {/* Participantes — ordenados por role */}
      {sortByRole(participants).map(p => (
        <ParticipantRow
          key={p.puuid}
          p={p}
          maxDamage={maxDamage}
          isHighlighted={p.puuid === highlightedPuuid}
          matchId={matchId}
        />
      ))}
    </div>
  )
}

// ── Página principal ──────────────────────────────────────────

export default function MatchPage() {
  const { match_id } = useParams() as { match_id: string }
  const searchParams = useSearchParams()
  const puuid = searchParams.get('puuid')

  const [match, setMatch]       = useState<MatchDetails | null>(null)
  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState<string | null>(null)
  const [tab, setTab]           = useState<'scoreboard' | 'analysis' | 'build'>('scoreboard')

  // ── Timeline ─────────────────────────────────────────────────
  type TimelineFrame = {
    t_min: number; t_ms: number
    p: Record<string, { cs: number; cspm: number; gold: number; level: number; xp: number }>
  }
  const [showTimeline, setShowTimeline]     = useState(false)
  const [timelineFrames, setTimelineFrames] = useState<TimelineFrame[] | null>(null)
  const [timelineLoading, setTimelineLoading] = useState(false)
  const [timelineError, setTimelineError]   = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`${API_URL}/api/v1/match/${match_id}`)
        if (res.status === 404) { setError('Partida não encontrada.'); return }
        if (!res.ok) { setError('Erro ao carregar partida.'); return }
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
    if (showTimeline) { setShowTimeline(false); return }
    setShowTimeline(true)
    if (timelineFrames !== null) return  // já carregado
    setTimelineLoading(true)
    setTimelineError(null)
    try {
      const res = await fetch(`${API_URL}/api/v1/match/${match_id}/timeline`)
      if (!res.ok) { setTimelineError('Não foi possível carregar a timeline.'); return }
      const data = await res.json()
      setTimelineFrames(data.frames ?? [])
    } catch {
      setTimelineError('Erro ao conectar ao servidor.')
    } finally {
      setTimelineLoading(false)
    }
  }

  const header = <Header />

  // ── Loading ──────────────────────────────────────────────────
  if (loading) return (
    <div className="min-h-screen bg-metis-bg text-metis-text">
      {header}
      <div className="flex items-center justify-center py-32 text-metis-text-dim text-sm">
        Carregando partida…
      </div>
    </div>
  )

  // ── Erro ────────────────────────────────────────────────────
  if (error || !match) return (
    <div className="min-h-screen bg-metis-bg text-metis-text">
      {header}
      <div className="flex flex-col items-center justify-center py-32 gap-3">
        <p className="text-metis-text-dim text-sm">{error ?? 'Partida não encontrada.'}</p>
        <Link href="/" className="text-xs text-metis-accent hover:underline">Voltar ao início</Link>
      </div>
    </div>
  )

  const { meta, blue_team, red_team, max_damage, has_timeline } = match
  const blueWin = blue_team[0]?.win ?? true
  const queueLabel = QUEUE_LABEL[meta.queue_id] ?? 'Ranqueada'

  return (
    <div className="min-h-screen bg-metis-bg text-metis-text">
      {header}

      <main className="max-w-[85%] mx-auto px-4 py-8">

        {/* Meta da partida */}
        <div className="mb-6">
          <div className="flex items-center gap-3 flex-wrap mb-1">
            <span className="text-xs font-medium text-metis-text-dim uppercase tracking-wide">
              {queueLabel}
            </span>
            <span className="text-metis-border">·</span>
            <span className="flex items-center gap-1 text-xs text-metis-text-dim">
              <Clock className="w-3 h-3" />
              {formatDuration(meta.game_duration)}
            </span>
            <span className="text-metis-border">·</span>
            <span className="text-xs text-metis-text-dim">Patch {meta.game_version}</span>
          </div>
          <div className="flex items-center gap-3">
            <span className={`text-lg font-bold ${blueWin ? 'text-blue-400' : 'text-red-400'}`}>
              {blueWin ? 'Time Azul venceu' : 'Time Vermelho venceu'}
            </span>
            <div className="flex items-center gap-2 ml-auto">
              {has_timeline && (
                <span className="text-[10px] border border-metis-border text-metis-text-dim px-2 py-0.5 rounded">
                  Timeline disponível
                </span>
              )}
              {puuid && (
                <Link
                  href={`/chat?match_id=${match_id}&puuid=${puuid}`}
                  className="flex items-center gap-1.5 text-xs bg-metis-accent hover:bg-metis-accent-hover text-white px-3 py-1.5 rounded-lg transition-colors font-medium"
                >
                  <MessageSquare className="w-3.5 h-3.5" />
                  Analisar com IA
                </Link>
              )}
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-4 border-b border-metis-border">
          {([
            { key: 'scoreboard' as const, label: 'Scoreboard' },
            { key: 'analysis' as const,   label: 'Analise de Equipe' },
            { key: 'build' as const,      label: 'Build' },
          ]).map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px ${
                tab === t.key
                  ? 'border-metis-accent text-metis-accent'
                  : 'border-transparent text-metis-text-dim hover:text-metis-text'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Tab: Scoreboard */}
        {tab === 'scoreboard' && (
          <>
            <div className="flex items-center gap-4 mb-4 text-[10px] text-metis-text-dim">
              <div className="flex items-center gap-1.5">
                <Sword className="w-3 h-3" />
                <span>Barra = dano aos campeoes | Quadrado = Metis Score</span>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <TeamColumn
                participants={blue_team}
                win={blueWin}
                label="Time Azul"
                maxDamage={max_damage}
                highlightedPuuid={puuid}
                matchId={match_id}
              />
              <TeamColumn
                participants={red_team}
                win={!blueWin}
                label="Time Vermelho"
                maxDamage={max_damage}
                highlightedPuuid={puuid}
                matchId={match_id}
              />
            </div>

            {/* Timeline colapsavel */}
            {has_timeline && (
              <div className="mt-6 rounded-xl border border-metis-border overflow-hidden">
                <button
                  onClick={handleToggleTimeline}
                  className="w-full flex items-center justify-between px-4 py-3 bg-metis-surface hover:bg-metis-border/20 transition-colors"
                >
                  <span className="text-sm font-semibold text-metis-text">Timeline da Partida</span>
                  {showTimeline
                    ? <ChevronUp className="w-4 h-4 text-metis-text-dim" />
                    : <ChevronDown className="w-4 h-4 text-metis-text-dim" />
                  }
                </button>

                {showTimeline && (
                  <div className="px-4 py-4 bg-metis-surface/50">
                    {timelineLoading && (
                      <p className="text-sm text-metis-text-dim text-center py-8">Carregando timeline...</p>
                    )}
                    {timelineError && (
                      <p className="text-sm text-red-400 text-center py-4">{timelineError}</p>
                    )}
                    {!timelineLoading && !timelineError && timelineFrames && (
                      <TimelineChart
                        frames={timelineFrames}
                        participants={[...blue_team, ...red_team]}
                        highlightedPuuid={puuid}
                      />
                    )}
                  </div>
                )}
              </div>
            )}
          </>
        )}

        {/* Tab: Analise de Equipe */}
        {tab === 'analysis' && (
          <TeamAnalysis blue={blue_team} red={red_team} blueWin={blueWin} />
        )}

        {/* Tab: Build */}
        {tab === 'build' && (
          <BuildTab participants={sortByRole([...blue_team, ...red_team])} />
        )}

        {/* Footer */}
        <p className="text-[11px] text-metis-text-dim text-center mt-8">
          ID: <span className="font-mono">{match_id}</span>
        </p>
      </main>
    </div>
  )
}

// ── Tab: Analise de Equipe ──────────────────────────────────────

function DonutChart({ blue, red, label }: { blue: number; red: number; label: string }) {
  const total = blue + red || 1
  const bluePct = Math.round((blue / total) * 100)
  const redPct = 100 - bluePct
  const blueAngle = (bluePct / 100) * 360

  return (
    <div className="flex flex-col items-center gap-2">
      <span className="text-xs font-medium text-metis-text-dim uppercase tracking-wide">{label}</span>
      <div className="relative w-24 h-24">
        <svg viewBox="0 0 36 36" className="w-full h-full -rotate-90">
          <circle cx="18" cy="18" r="14" fill="none" stroke="rgb(239 68 68 / 0.4)" strokeWidth="4" />
          <circle
            cx="18" cy="18" r="14" fill="none"
            stroke="rgb(59 130 246 / 0.8)" strokeWidth="4"
            strokeDasharray={`${bluePct * 0.88} ${100 * 0.88}`}
            strokeLinecap="round"
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-xs font-bold text-blue-400">{blue >= 1000 ? `${(blue/1000).toFixed(1)}k` : blue}</span>
          <span className="text-xs font-bold text-red-400">{red >= 1000 ? `${(red/1000).toFixed(1)}k` : red}</span>
        </div>
      </div>
    </div>
  )
}

function TeamAnalysis({ blue, red, blueWin }: { blue: Participant[]; red: Participant[]; blueWin: boolean }) {
  const sum = (team: Participant[], field: string) =>
    team.reduce((acc, p) => acc + (Number((p as Record<string, unknown>)[field]) || 0), 0)

  const metrics = [
    { label: 'Abates',          blueVal: sum(blue, 'kills'),                            redVal: sum(red, 'kills') },
    { label: 'Ouro',            blueVal: sum(blue, 'gold_earned'),                      redVal: sum(red, 'gold_earned') },
    { label: 'Dano',            blueVal: sum(blue, 'total_damage_dealt_to_champions'),  redVal: sum(red, 'total_damage_dealt_to_champions') },
    { label: 'Visao',           blueVal: sum(blue, 'vision_score'),                     redVal: sum(red, 'vision_score') },
    { label: 'CS',              blueVal: sum(blue, 'total_cs'),                         redVal: sum(red, 'total_cs') },
  ]

  return (
    <div>
      <div className="flex items-center justify-center gap-6 mb-6 text-xs">
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-full bg-blue-500" />
          <span className="text-metis-text-dim">{blueWin ? 'Vencedora' : 'Perdedora'}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-full bg-red-500" />
          <span className="text-metis-text-dim">{!blueWin ? 'Vencedora' : 'Perdedora'}</span>
        </div>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-6">
        {metrics.map(m => (
          <DonutChart key={m.label} blue={m.blueVal} red={m.redVal} label={m.label} />
        ))}
      </div>

      {/* Barras detalhadas por jogador para cada metrica */}
      <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 gap-6">
        {metrics.map(m => (
          <div key={m.label} className="bg-metis-surface border border-metis-border rounded-xl p-4">
            <h3 className="text-xs font-semibold text-metis-text-dim uppercase tracking-wide mb-3">{m.label}</h3>
            <div className="space-y-1.5">
              {sortByRole(blue).map(p => {
                const val = Number((p as Record<string, unknown>)[
                  m.label === 'Abates' ? 'kills' :
                  m.label === 'Ouro' ? 'gold_earned' :
                  m.label === 'Dano' ? 'total_damage_dealt_to_champions' :
                  m.label === 'Visao' ? 'vision_score' : 'total_cs'
                ]) || 0
                const max = Math.max(m.blueVal, m.redVal) || 1
                return (
                  <div key={p.puuid} className="flex items-center gap-2">
                    <Image src={championIconUrl(p.champion_name, DDRAGON_VERSION)} alt="" width={18} height={18} className="rounded flex-shrink-0" unoptimized />
                    <div className="flex-1 bg-metis-border/30 rounded-full h-2 overflow-hidden">
                      <div className="h-full bg-blue-500/70 rounded-full" style={{ width: `${(val / max) * 100}%` }} />
                    </div>
                    <span className="text-[10px] text-metis-text-dim w-10 text-right">{val >= 1000 ? `${(val/1000).toFixed(1)}k` : val}</span>
                  </div>
                )
              })}
              {sortByRole(red).map(p => {
                const val = Number((p as Record<string, unknown>)[
                  m.label === 'Abates' ? 'kills' :
                  m.label === 'Ouro' ? 'gold_earned' :
                  m.label === 'Dano' ? 'total_damage_dealt_to_champions' :
                  m.label === 'Visao' ? 'vision_score' : 'total_cs'
                ]) || 0
                const max = Math.max(m.blueVal, m.redVal) || 1
                return (
                  <div key={p.puuid} className="flex items-center gap-2">
                    <Image src={championIconUrl(p.champion_name, DDRAGON_VERSION)} alt="" width={18} height={18} className="rounded flex-shrink-0" unoptimized />
                    <div className="flex-1 bg-metis-border/30 rounded-full h-2 overflow-hidden">
                      <div className="h-full bg-red-500/70 rounded-full" style={{ width: `${(val / max) * 100}%` }} />
                    </div>
                    <span className="text-[10px] text-metis-text-dim w-10 text-right">{val >= 1000 ? `${(val/1000).toFixed(1)}k` : val}</span>
                  </div>
                )
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Tab: Build ──────────────────────────────────────────────────

const SUMMONER_SPELL: Record<number, string> = {
  1: 'SummonerBoost', 3: 'SummonerExhaust', 4: 'SummonerFlash', 6: 'SummonerHaste',
  7: 'SummonerHeal', 11: 'SummonerSmite', 12: 'SummonerTeleport', 14: 'SummonerDot',
  21: 'SummonerBarrier', 32: 'SummonerSnowball', 39: 'SummonerSnowURFSnowball_Mark',
}

const SUMMONER_NAMES: Record<number, string> = {
  1: 'Purificar', 3: 'Exaurir', 4: 'Flash', 6: 'Fantasma',
  7: 'Curar', 11: 'Golpear', 12: 'Teleporte', 14: 'Incendiar',
  21: 'Barreira', 32: 'Bola de Neve',
}

type RuneStyle = {
  style: number
  selections: { perk: number; var1: number; var2: number; var3: number }[]
}

function BuildTab({ participants }: { participants: Participant[] }) {
  return (
    <div className="space-y-4">
      {participants.map(p => {
        const items = p.items ?? Array(7).fill(0)
        const spell1 = SUMMONER_SPELL[p.summoner1_id ?? 0]
        const spell2 = SUMMONER_SPELL[p.summoner2_id ?? 0]

        // Parse runes_raw para todas as runas
        const runeStyles: RuneStyle[] = (() => {
          const raw = p.runes_raw as { styles?: RuneStyle[] } | null
          return raw?.styles ?? []
        })()
        const primaryStyle = runeStyles[0]
        const secondaryStyle = runeStyles[1]

        return (
          <div key={p.puuid} className={`bg-metis-surface border rounded-xl p-4 ${
            p.win ? 'border-blue-500/20' : 'border-red-500/20'
          }`}>
            {/* Header */}
            <div className="flex items-center gap-3 mb-4">
              <div className="relative w-10 h-10 rounded-lg overflow-hidden border border-metis-border flex-shrink-0">
                <Image src={championIconUrl(p.champion_name, DDRAGON_VERSION)} alt={p.champion_name} fill className="object-cover" unoptimized />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-metis-text">
                  {p.players ? `${p.players.game_name}#${p.players.tag_line}` : p.champion_name}
                </p>
                <p className="text-xs text-metis-text-dim">
                  {p.champion_name} — {POSITION_LABEL[p.team_position] ?? p.team_position}
                </p>
              </div>

              {/* Summoner Spells */}
              <div className="flex gap-1 flex-shrink-0">
                {spell1 && (
                  <Image
                    src={`https://ddragon.leagueoflegends.com/cdn/${DDRAGON_VERSION}/img/spell/${spell1}.png`}
                    alt={SUMMONER_NAMES[p.summoner1_id ?? 0] ?? spell1} width={28} height={28}
                    title={SUMMONER_NAMES[p.summoner1_id ?? 0]}
                    className="rounded border border-metis-border/50" unoptimized
                  />
                )}
                {spell2 && (
                  <Image
                    src={`https://ddragon.leagueoflegends.com/cdn/${DDRAGON_VERSION}/img/spell/${spell2}.png`}
                    alt={SUMMONER_NAMES[p.summoner2_id ?? 0] ?? spell2} width={28} height={28}
                    title={SUMMONER_NAMES[p.summoner2_id ?? 0]}
                    className="rounded border border-metis-border/50" unoptimized
                  />
                )}
              </div>

              <span className={`text-xs font-bold px-2 py-1 rounded flex-shrink-0 ${
                p.win ? 'bg-blue-500/20 text-blue-300' : 'bg-red-500/20 text-red-300'
              }`}>
                {p.win ? 'V' : 'D'}
              </span>
            </div>

            {/* Items com nomes */}
            <div className="mb-4">
              <p className="text-[10px] text-metis-text-dim uppercase tracking-wide mb-2">Itens Finais</p>
              <div className="flex items-center gap-1.5 flex-wrap">
                {items.slice(0, 6).map((id: number, i: number) =>
                  id > 0 ? (
                    <div key={i} className="flex items-center gap-1.5 bg-metis-bg/50 rounded-lg px-2 py-1 border border-metis-border/30">
                      <Image
                        src={`https://ddragon.leagueoflegends.com/cdn/${DDRAGON_VERSION}/img/item/${id}.png`}
                        alt={String(id)} width={28} height={28}
                        className="rounded border border-metis-border/50" unoptimized
                      />
                      <span className="text-[10px] text-metis-text-dim">{i + 1}o</span>
                    </div>
                  ) : null
                )}
                {/* Trinket (slot 6) */}
                {items[6] > 0 && (
                  <div className="ml-2">
                    <Image
                      src={`https://ddragon.leagueoflegends.com/cdn/${DDRAGON_VERSION}/img/item/${items[6]}.png`}
                      alt="Trinket" width={24} height={24}
                      className="rounded-full border border-metis-border/50 opacity-70" unoptimized
                    />
                  </div>
                )}
              </div>
            </div>

            {/* Runas completas */}
            <div>
              <p className="text-[10px] text-metis-text-dim uppercase tracking-wide mb-2">Runas</p>
              <div className="flex gap-6">
                {/* Arvore primaria */}
                {primaryStyle && (
                  <div>
                    <p className={`text-[10px] font-medium mb-1.5 ${RUNE_TREES[primaryStyle.style]?.color ?? 'text-metis-text-dim'}`}>
                      {RUNE_TREES[primaryStyle.style]?.name ?? 'Primaria'}
                    </p>
                    <div className="flex gap-1">
                      {primaryStyle.selections.map((sel, i) => {
                        const url = runeIconUrl(sel.perk, DDRAGON_VERSION)
                        return url ? (
                          <Image
                            key={i} src={url} alt={`Runa ${sel.perk}`}
                            width={i === 0 ? 32 : 24} height={i === 0 ? 32 : 24}
                            className={`rounded-full border bg-metis-bg ${i === 0 ? 'border-metis-accent/50' : 'border-metis-border/40'}`}
                            unoptimized
                          />
                        ) : (
                          <div key={i} className={`rounded-full border border-metis-border/30 bg-metis-bg/50 flex items-center justify-center text-[8px] text-metis-text-dim ${i === 0 ? 'w-8 h-8' : 'w-6 h-6'}`}>
                            {sel.perk}
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}

                {/* Arvore secundaria */}
                {secondaryStyle && (
                  <div>
                    <p className={`text-[10px] font-medium mb-1.5 ${RUNE_TREES[secondaryStyle.style]?.color ?? 'text-metis-text-dim'}`}>
                      {RUNE_TREES[secondaryStyle.style]?.name ?? 'Secundaria'}
                    </p>
                    <div className="flex gap-1">
                      {secondaryStyle.selections.map((sel, i) => {
                        const url = runeIconUrl(sel.perk, DDRAGON_VERSION)
                        return url ? (
                          <Image
                            key={i} src={url} alt={`Runa ${sel.perk}`}
                            width={24} height={24}
                            className="rounded-full border border-metis-border/40 bg-metis-bg"
                            unoptimized
                          />
                        ) : (
                          <div key={i} className="w-6 h-6 rounded-full border border-metis-border/30 bg-metis-bg/50 flex items-center justify-center text-[8px] text-metis-text-dim">
                            {sel.perk}
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
