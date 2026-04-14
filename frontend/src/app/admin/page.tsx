'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import {
  Users, Trophy, Trash2, Clock, Database,
  TrendingUp, AlertTriangle, BarChart3,
} from 'lucide-react'
import { Header } from '@/components/ui/Header'
import { apiFetch } from '@/lib/api'

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
}

function StatCard({
  icon: Icon,
  label,
  value,
  sub,
  color = 'text-metis-accent',
}: {
  icon: React.ElementType
  label: string
  value: number | string
  sub?: string
  color?: string
}) {
  return (
    <div className="bg-metis-surface border border-metis-border rounded-xl p-5 flex flex-col gap-2">
      <div className="flex items-center gap-2 text-metis-text-dim">
        <Icon className={`w-4 h-4 ${color}`} />
        <span className="text-xs font-medium uppercase tracking-wide">{label}</span>
      </div>
      <span className={`text-3xl font-bold ${color}`}>
        {typeof value === 'number' ? value.toLocaleString('pt-BR') : value}
      </span>
      {sub && <span className="text-[11px] text-metis-text-dim">{sub}</span>}
    </div>
  )
}

export default function AdminPage() {
  const router = useRouter()
  const supabase = createClient()

  const [stats, setStats]     = useState<AdminStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState<string | null>(null)
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
  }, [])

  const header = <Header />

  if (loading) return (
    <div className="min-h-screen bg-metis-bg text-metis-text">
      {header}
      <div className="flex items-center justify-center py-32 text-metis-text-dim text-sm">
        Carregando painel…
      </div>
    </div>
  )

  if (error || !stats) return (
    <div className="min-h-screen bg-metis-bg text-metis-text">
      {header}
      <div className="flex flex-col items-center justify-center py-32 gap-3">
        <AlertTriangle className="w-8 h-8 text-red-400" />
        <p className="text-sm text-metis-text-dim">{error ?? 'Erro desconhecido.'}</p>
      </div>
    </div>
  )

  const cleanRate = stats.matches_clean + stats.matches_dirty_total > 0
    ? Math.round(stats.matches_clean / (stats.matches_clean + stats.matches_dirty_total) * 100)
    : 0

  return (
    <div className="min-h-screen bg-metis-bg text-metis-text">
      {header}

      <main className="max-w-5xl mx-auto px-6 py-10 space-y-8">

        {/* Título */}
        <div>
          <h1 className="text-xl font-bold text-metis-text">Visão Geral do Sistema</h1>
          <p className="text-sm text-metis-text-dim mt-1">
            Dados ao vivo do Supabase — atualizado agora
          </p>
        </div>

        {/* Cards principais */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            icon={Users}
            label="Jogadores"
            value={stats.players_total}
            sub="cadastrados no banco"
            color="text-metis-accent"
          />
          <StatCard
            icon={Trophy}
            label="Partidas limpas"
            value={stats.matches_clean}
            sub={`Taxa de aprovação: ${cleanRate}%`}
            color="text-green-400"
          />
          <StatCard
            icon={Trash2}
            label="Partidas descartadas"
            value={stats.matches_dirty_total}
            sub="remakes, fila errada, curtas"
            color="text-red-400"
          />
          <StatCard
            icon={Database}
            label="Timelines salvas"
            value={stats.timelines_saved}
            sub={`de ${stats.matches_clean} partidas limpas`}
            color="text-purple-400"
          />
        </div>

        {/* Cards secundários */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            icon={TrendingUp}
            label="Sincronizações 24h"
            value={stats.synced_last_24h}
            sub="jogadores atualizados hoje"
            color="text-yellow-400"
          />
          <StatCard
            icon={TrendingUp}
            label="Sincronizações 7d"
            value={stats.synced_last_7d}
            sub="jogadores atualizados na semana"
            color="text-yellow-400"
          />
          <StatCard
            icon={BarChart3}
            label="Participantes"
            value={stats.participants_total}
            sub="linhas em match_participants"
            color="text-metis-accent"
          />
          <StatCard
            icon={Clock}
            label="Cooldown de sync"
            value="5 min"
            sub="por jogador por sincronização"
            color="text-metis-text-dim"
          />
        </div>

        {/* Breakdown dirty matches */}
        <div className="bg-metis-surface border border-metis-border rounded-xl p-6">
          <h2 className="text-sm font-semibold text-metis-text mb-4 flex items-center gap-2">
            <Trash2 className="w-4 h-4 text-red-400" />
            Partidas descartadas — por motivo
          </h2>
          <div className="space-y-3">
            {Object.entries(stats.matches_dirty_by_reason).map(([reason, count]) => {
              const total = stats.matches_dirty_total || 1
              const pct = Math.round((count / total) * 100)
              return (
                <div key={reason}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-metis-text">
                      {REASON_LABEL[reason] ?? reason}
                    </span>
                    <span className="text-xs text-metis-text-dim">
                      {count.toLocaleString('pt-BR')} ({pct}%)
                    </span>
                  </div>
                  <div className="w-full bg-metis-border/30 rounded-full h-1.5">
                    <div
                      className="h-full rounded-full bg-red-500/60"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              )
            })}
            {Object.keys(stats.matches_dirty_by_reason).length === 0 && (
              <p className="text-xs text-metis-text-dim">Nenhuma partida descartada ainda.</p>
            )}
          </div>
        </div>

        {/* Footer */}
        <p className="text-[11px] text-metis-text-dim text-center">
          Metis Admin · acesso restrito
        </p>
      </main>
    </div>
  )
}
