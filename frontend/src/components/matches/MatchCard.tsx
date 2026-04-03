import Image from 'next/image'
import Link from 'next/link'
import { Eye, MessageSquare } from 'lucide-react'
import { championIconUrl, roleIconPath, DDRAGON_VERSION } from '@/lib/ddragon'
import { runeIconUrl } from '@/lib/runes'

export type MatchData = {
  champion_name: string
  team_position: string
  team_id: number | null
  win: boolean
  kills: number
  deaths: number
  assists: number
  gold_earned: number
  total_damage_dealt_to_champions: number
  vision_score: number | null
  kill_participation: number | null
  damage_per_minute: number | null
  total_cs: number | null
  cs_per_minute: number | null
  champion_level: number | null
  items: number[] | null
  rune_keystone: number | null
  summoner1_id: number | null
  summoner2_id: number | null
  matches: {
    match_id: string
    game_version: string
    game_duration: number
    queue_id: number
    end_type: string
    created_at: string
  }
}

// ── Helpers ───────────────────────────────────────────────────

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}m ${s.toString().padStart(2, '0')}s`
}

function formatGold(gold: number): string {
  return gold >= 1000 ? `${(gold / 1000).toFixed(1)}k` : String(gold)
}

function formatRelativeDate(isoStr: string): string {
  const diff = Date.now() - new Date(isoStr).getTime()
  const mins  = Math.floor(diff / 60_000)
  const hours = Math.floor(diff / 3_600_000)
  const days  = Math.floor(diff / 86_400_000)
  if (mins  <  1)  return 'agora'
  if (mins  < 60)  return `há ${mins}m`
  if (hours < 24)  return `há ${hours}h`
  if (days  <  7)  return `há ${days} dia${days > 1 ? 's' : ''}`
  return new Date(isoStr).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })
}

function csColor(cspm: number): string {
  if (cspm >= 8) return 'text-green-400'
  if (cspm >= 6) return 'text-yellow-400'
  if (cspm >= 4) return 'text-metis-text-dim'
  return 'text-red-400'
}

const QUEUE_LABEL: Record<number, string> = { 420: 'SoloQ', 440: 'Flex' }
const END_TYPE_LABEL: Record<string, string> = {
  late_ff:  'Rendição',
  early_ff: 'Rendição antecipada',
}
const POSITION_LABEL: Record<string, string> = {
  TOP: 'Top', JUNGLE: 'Jungle', MIDDLE: 'Mid',
  BOTTOM: 'ADC', UTILITY: 'Suporte', UNKNOWN: '—',
}

// ── Componente ────────────────────────────────────────────────

type Props = { match: MatchData; puuid: string }

export function MatchCard({ match, puuid }: Props) {
  const { matches: meta } = match
  const win  = match.win
  const cspm = match.cs_per_minute ?? 0
  const kda  = match.deaths === 0
    ? '∞'
    : ((match.kills + match.assists) / match.deaths).toFixed(2)

  const items       = match.items ?? Array(7).fill(0)
  const keystoneUrl = match.rune_keystone ? runeIconUrl(match.rune_keystone, DDRAGON_VERSION) : null
  const roleIcon    = roleIconPath(match.team_position)
  const queueLabel  = QUEUE_LABEL[meta.queue_id] ?? 'Ranqueada'
  const endLabel    = END_TYPE_LABEL[meta.end_type] ?? ''
  const dateLabel   = formatRelativeDate(meta.created_at)

  const accent = win
    ? 'border-blue-500/30 bg-blue-500/5'
    : 'border-red-500/30  bg-red-500/5'
  const bar = win ? 'bg-blue-500' : 'bg-red-500'

  return (
    <div className={`rounded-xl border px-4 py-3 transition-colors ${accent}`}>
      <div className="flex items-start gap-3">
        {/* Barra lateral resultado */}
        <div className={`w-1 self-stretch rounded-full flex-shrink-0 mt-0.5 ${bar}`} />

        {/* Ícone do campeão */}
        <div className="relative w-12 h-12 rounded-lg overflow-hidden flex-shrink-0 border border-metis-border">
          <Image
            src={championIconUrl(match.champion_name, DDRAGON_VERSION)}
            alt={match.champion_name}
            fill className="object-cover" unoptimized
          />
          {/* Nível */}
          {match.champion_level && (
            <span className="absolute bottom-0 right-0 text-[9px] font-bold bg-black/70 text-white px-1 rounded-tl">
              {match.champion_level}
            </span>
          )}
        </div>

        {/* Conteúdo principal */}
        <div className="flex-1 min-w-0">

          {/* Linha 1 — campeão + resultado + queue */}
          <div className="flex items-center gap-1.5 flex-wrap mb-0.5">
            <span className="text-sm font-semibold text-metis-text">{match.champion_name}</span>
            {roleIcon && (
              <Image src={roleIcon} alt={match.team_position} width={13} height={13} unoptimized className="opacity-60" />
            )}
            <span className="text-xs text-metis-text-dim">{POSITION_LABEL[match.team_position] ?? match.team_position}</span>
            <span className={`text-[11px] font-semibold px-1.5 py-0.5 rounded ${
              win ? 'text-blue-400 bg-blue-400/10' : 'text-red-400 bg-red-400/10'
            }`}>
              {win ? 'Vitória' : 'Derrota'}
            </span>
            <span className="text-[11px] text-metis-text-dim">{queueLabel}</span>
          </div>

          {/* Linha 2 — KDA + CS + VS */}
          <div className="flex items-center gap-3 text-xs text-metis-text-dim flex-wrap">
            <span>
              <span className="text-metis-text font-medium">
                {match.kills}/{match.deaths}/{match.assists}
              </span>
              <span className="ml-1">({kda} KDA)</span>
            </span>

            {match.total_cs !== null && (
              <span className={`font-medium ${csColor(cspm)}`}>
                {match.total_cs}cs
                <span className="ml-0.5 text-[10px]">({cspm.toFixed(1)}/m)</span>
              </span>
            )}

            {match.vision_score !== null && (
              <span>VS {match.vision_score}</span>
            )}

            <span className="hidden sm:inline">{formatGold(match.gold_earned)} ouro</span>
          </div>

          {/* Linha 3 — Items + Keystone */}
          <div className="flex items-center gap-0.5 mt-2 flex-wrap">
            {items.map((id, i) =>
              id > 0 ? (
                <Image
                  key={i}
                  src={`https://ddragon.leagueoflegends.com/cdn/${DDRAGON_VERSION}/img/item/${id}.png`}
                  alt={String(id)} width={28} height={28}
                  className="rounded border border-metis-border/50"
                  unoptimized
                />
              ) : (
                <div
                  key={i}
                  className="w-7 h-7 rounded border border-metis-border/20 bg-metis-bg/40"
                />
              )
            )}

            {keystoneUrl && (
              <Image
                src={keystoneUrl}
                alt="Keystone" width={24} height={24}
                className="ml-2 rounded-full border border-metis-border/40 bg-metis-bg"
                unoptimized
              />
            )}
          </div>

          {/* Linha 4 — Metadados da partida */}
          <div className="flex items-center gap-2 mt-2 text-[11px] text-metis-text-dim flex-wrap">
            <span>{formatDuration(meta.game_duration)}</span>
            {endLabel && <><span>·</span><span>{endLabel}</span></>}
            <span>·</span>
            <span>Patch {meta.game_version}</span>
            <span>·</span>
            <span>{dateLabel}</span>
          </div>
        </div>

        {/* Botões */}
        <div className="flex flex-col gap-1.5 flex-shrink-0 self-start">
          <Link
            href={`/matches/${meta.match_id}?puuid=${puuid}`}
            className="flex items-center gap-1 text-[11px] border border-metis-border text-metis-text-dim
                       hover:border-metis-accent hover:text-metis-accent px-2.5 py-1.5 rounded-lg transition-colors"
          >
            <Eye className="w-3 h-3" />
            <span className="hidden sm:block">Detalhes</span>
          </Link>
          <Link
            href={`/chat?match_id=${meta.match_id}&puuid=${puuid}`}
            className="flex items-center gap-1 text-[11px] border border-metis-border text-metis-text-dim
                       hover:border-metis-accent hover:text-metis-accent px-2.5 py-1.5 rounded-lg transition-colors"
          >
            <MessageSquare className="w-3 h-3" />
            <span className="hidden sm:block">Analisar</span>
          </Link>
        </div>
      </div>
    </div>
  )
}
