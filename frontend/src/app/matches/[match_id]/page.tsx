'use client'

import { useState, useEffect } from 'react'
import { useParams, useSearchParams } from 'next/navigation'
import Image from 'next/image'
import Link from 'next/link'
import { Swords, ArrowLeft, Clock, Sword, ChevronDown, ChevronUp, MessageSquare } from 'lucide-react'
import { ThemeSwitcher } from '@/components/ui/ThemeSwitcher'
import { championIconUrl, roleIconPath, DDRAGON_VERSION } from '@/lib/ddragon'
import { runeIconUrl } from '@/lib/runes'
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

      {/* Participantes */}
      {participants.map(p => (
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

  // ── Header ──────────────────────────────────────────────────
  const header = (
    <header className="flex items-center justify-between px-4 py-3 border-b border-metis-border bg-metis-surface">
      <div className="flex items-center gap-3">
        <Link href={puuid ? `/players/${encodeURIComponent(puuid)}` : '/'} className="text-metis-text-dim hover:text-metis-text transition-colors">
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <Link href="/" className="flex items-center gap-2">
          <Swords className="w-5 h-5 text-metis-accent" />
          <span className="font-bold text-metis-text tracking-tight">Metis</span>
        </Link>
      </div>
      <ThemeSwitcher />
    </header>
  )

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

      <main className="max-w-5xl mx-auto px-4 py-8">

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

        {/* Legenda das barras */}
        <div className="flex items-center gap-4 mb-4 text-[10px] text-metis-text-dim">
          <div className="flex items-center gap-1.5">
            <Sword className="w-3 h-3" />
            <span>Barra = dano aos campeões (relativo ao maior da partida)</span>
          </div>
        </div>

        {/* Scoreboard — 2 colunas no desktop */}
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

        {/* Timeline */}
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
                  <p className="text-sm text-metis-text-dim text-center py-8">
                    Carregando timeline…
                  </p>
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

        {/* Footer */}
        <p className="text-[11px] text-metis-text-dim text-center mt-8">
          ID: <span className="font-mono">{match_id}</span>
        </p>
      </main>
    </div>
  )
}
