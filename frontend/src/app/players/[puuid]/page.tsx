'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Swords, Star, StarOff, ArrowLeft } from 'lucide-react'
import Link from 'next/link'

export default function PlayerPage() {
  const params = useParams()
  const router = useRouter()
  const puuid = decodeURIComponent(params.puuid as string)
  const supabase = createClient()

  const [userId, setUserId] = useState<string | null>(null)
  const [watched, setWatched] = useState(false)
  const [watchLabel, setWatchLabel] = useState('')
  const [showLabelInput, setShowLabelInput] = useState(false)
  const [savingWatch, setSavingWatch] = useState(false)

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return
      setUserId(user.id)
      // checa se já está em supervisão
      supabase
        .from('watched_players')
        .select('label')
        .eq('puuid', puuid)
        .maybeSingle()
        .then(({ data }) => {
          if (data) {
            setWatched(true)
            setWatchLabel(data.label ?? '')
          }
        })
    })
  }, [puuid])

  async function handleToggleWatch() {
    if (!userId) {
      router.push('/auth')
      return
    }
    if (watched) {
      setSavingWatch(true)
      await supabase.from('watched_players').delete().eq('puuid', puuid)
      setWatched(false)
      setWatchLabel('')
      setSavingWatch(false)
    } else {
      setShowLabelInput(true)
    }
  }

  async function handleSaveWatch() {
    if (!userId) return
    setSavingWatch(true)
    await supabase.from('watched_players').upsert(
      { user_id: userId, puuid, label: watchLabel || null },
      { onConflict: 'user_id,puuid' }
    )
    setWatched(true)
    setShowLabelInput(false)
    setSavingWatch(false)
  }

  return (
    <div className="min-h-screen bg-metis-bg text-metis-text">
      {/* Header */}
      <header className="flex items-center justify-between px-4 py-3 border-b border-metis-border bg-metis-surface">
        <div className="flex items-center gap-2">
          <Swords className="w-5 h-5 text-metis-accent" />
          <span className="font-bold text-metis-text tracking-tight">Metis</span>
        </div>
        <Link href="/" className="text-xs text-metis-text-dim hover:text-metis-text transition-colors flex items-center gap-1">
          <ArrowLeft className="w-3.5 h-3.5" />
          Voltar
        </Link>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-10">
        {/* Cabeçalho do jogador */}
        <div className="bg-metis-surface border border-metis-border rounded-xl p-6 mb-6">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="text-xs text-metis-text-dim uppercase tracking-wide font-medium mb-1">PUUID</p>
              <p className="font-mono text-xs text-metis-text break-all">{puuid}</p>
              {watched && watchLabel && (
                <p className="mt-2 text-sm font-semibold text-metis-accent">{watchLabel}</p>
              )}
            </div>
            <button
              onClick={handleToggleWatch}
              disabled={savingWatch}
              title={watched ? 'Remover supervisão' : 'Adicionar à supervisão'}
              className="flex-shrink-0 flex items-center gap-1.5 text-xs border rounded-lg px-3 py-2 transition-colors disabled:opacity-50
                         border-metis-border text-metis-text-dim hover:border-metis-accent hover:text-metis-accent"
            >
              {watched ? (
                <>
                  <StarOff className="w-4 h-4" />
                  <span className="hidden sm:block">Remover</span>
                </>
              ) : (
                <>
                  <Star className="w-4 h-4" />
                  <span className="hidden sm:block">Supervisionar</span>
                </>
              )}
            </button>
          </div>

          {/* Input de label ao adicionar */}
          {showLabelInput && (
            <div className="mt-4 flex gap-2">
              <input
                type="text"
                value={watchLabel}
                onChange={e => setWatchLabel(e.target.value)}
                placeholder="Apelido (opcional)"
                className="flex-1 bg-metis-bg border border-metis-border rounded-lg px-3 py-2 text-sm text-metis-text placeholder-metis-muted outline-none focus:border-metis-accent transition-colors"
              />
              <button
                onClick={handleSaveWatch}
                disabled={savingWatch}
                className="bg-metis-accent hover:bg-metis-accent-hover text-white px-3 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
              >
                Salvar
              </button>
            </div>
          )}
        </div>

        {/* Stats — placeholder até integração com API */}
        <div className="bg-metis-surface border border-metis-border rounded-xl p-6 text-center">
          <p className="text-metis-text-dim text-sm">
            Estatísticas do jogador em breve.
          </p>
          <p className="text-xs text-metis-text-dim mt-1">
            A integração com a API de histórico está prevista para o próximo milestone.
          </p>
        </div>
      </main>
    </div>
  )
}
