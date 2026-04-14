'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { ChatMessage, type Message } from '@/components/ui/ChatMessage'
import { ChatInput } from '@/components/ui/ChatInput'
import { Swords, Lock, Zap } from 'lucide-react'
import Link from 'next/link'
import { Header } from '@/components/ui/Header'
import { apiFetch } from '@/lib/api'

type Usage = {
  tokens_used: number
  token_limit: number
  pct: number
  resets_at: string
}

export default function ChatPage() {
  const router = useRouter()
  const supabase = createClient()
  const bottomRef = useRef<HTMLDivElement>(null)

  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'metis',
      content: 'Ola, invocador. Sou a Metis — sua estrategista no Rift. Pode me perguntar sobre campeoes, builds, matchups ou estrategia. Como posso te ajudar hoje?',
    },
  ])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [isPremium, setIsPremium] = useState<boolean | null>(null)
  const [accessToken, setAccessToken] = useState<string | null>(null)
  const [usage, setUsage] = useState<Usage | null>(null)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) {
        router.replace('/auth')
        return
      }
      setAccessToken(session.access_token)
      const meta = session.user.app_metadata ?? {}
      const hasPremium = meta.is_premium === true || ['donor','premium','pro'].includes(meta.tier)
      setIsPremium(hasPremium)

      // Buscar uso de tokens
      if (hasPremium) {
        apiFetch(`/api/v1/chat/usage?supabase_token=${encodeURIComponent(session.access_token)}`)
          .then(r => r.ok ? r.json() : null)
          .then(d => { if (d) setUsage(d) })
          .catch(() => {})
      }
    })
  }, [])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function handleSend() {
    const text = input.trim()
    if (!text || loading || !accessToken) return

    setMessages(prev => [...prev, { role: 'user', content: text }])
    setInput('')
    setLoading(true)

    try {
      const res = await apiFetch('/api/v1/chat', {
        method: 'POST',
        body: JSON.stringify({ mensagem: text, supabase_token: accessToken }),
      })

      if (res.status === 429) {
        const err = await res.json()
        setMessages(prev => [...prev, { role: 'metis', content: `Limite diario atingido. ${err.detail}` }])
        return
      }

      if (!res.ok) throw new Error(`Erro ${res.status}`)

      const data = await res.json()
      setMessages(prev => [...prev, { role: 'metis', content: data.resposta }])

      if (data.usage) setUsage(data.usage)
    } catch {
      setMessages(prev => [
        ...prev,
        { role: 'metis', content: 'Nao consegui me conectar ao servidor. Tente novamente.' },
      ])
    } finally {
      setLoading(false)
    }
  }

  // Carregando sessao
  if (isPremium === null) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-metis-bg">
        <div className="flex gap-1">
          <span className="w-2 h-2 bg-metis-accent rounded-full animate-bounce [animation-delay:0ms]" />
          <span className="w-2 h-2 bg-metis-accent rounded-full animate-bounce [animation-delay:150ms]" />
          <span className="w-2 h-2 bg-metis-accent rounded-full animate-bounce [animation-delay:300ms]" />
        </div>
      </div>
    )
  }

  // Gate: sem plano pago
  if (!isPremium) {
    return (
      <div className="min-h-screen flex flex-col bg-metis-bg">
        <Header />
        <div className="flex-1 flex items-center justify-center px-4">
          <div className="max-w-sm text-center">
            <div className="w-16 h-16 rounded-full bg-metis-surface border border-metis-border flex items-center justify-center mx-auto mb-6">
              <Lock className="w-7 h-7 text-metis-accent" />
            </div>
            <h2 className="text-xl font-bold text-metis-text mb-2">Acesso ao Chat</h2>
            <p className="text-sm text-metis-text-dim mb-6 leading-relaxed">
              O Chat com a Metis requer plano Doador ou superior.
            </p>
            <Link href="/pricing" className="inline-block text-sm bg-metis-accent hover:bg-metis-accent-hover text-white px-4 py-2 rounded-lg transition-colors mr-3">
              Ver planos
            </Link>
            <Link href="/" className="inline-block text-sm text-metis-accent hover:underline">
              Voltar
            </Link>
          </div>
        </div>
      </div>
    )
  }

  const usagePct = usage?.pct ?? 0
  const barColor = usagePct >= 90 ? 'bg-red-500' : usagePct >= 70 ? 'bg-amber-500' : 'bg-metis-accent'

  return (
    <div className="min-h-screen flex flex-col bg-metis-bg">
      <Header />

      {/* Barra de uso de tokens */}
      {usage && (
        <div className="px-4 py-2 bg-metis-surface border-b border-metis-border">
          <div className="max-w-2xl mx-auto">
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-1.5 text-[10px] text-metis-text-dim">
                <Zap className="w-3 h-3" />
                <span>{usage.tokens_used.toLocaleString()} / {usage.token_limit.toLocaleString()} tokens hoje</span>
              </div>
              <span className="text-[10px] text-metis-muted">Reset {usage.resets_at}</span>
            </div>
            <div className="h-1.5 bg-metis-border/50 rounded-full overflow-hidden">
              <div
                className={`h-full ${barColor} rounded-full transition-all duration-500`}
                style={{ width: `${Math.min(usagePct, 100)}%` }}
              />
            </div>
          </div>
        </div>
      )}

      {/* Messages */}
      <main className="flex-1 overflow-y-auto chat-scroll px-4 py-6">
        <div className="max-w-2xl mx-auto flex flex-col gap-4">
          {messages.map((msg, i) => (
            <ChatMessage key={i} message={msg} />
          ))}

          {loading && (
            <div className="flex gap-3">
              <div className="w-8 h-8 rounded-full bg-metis-accent/20 flex items-center justify-center flex-shrink-0">
                <Swords className="w-4 h-4 text-metis-accent" />
              </div>
              <div className="bg-metis-surface border border-metis-border rounded-2xl rounded-tl-sm px-4 py-3">
                <div className="flex gap-1">
                  <span className="w-1.5 h-1.5 bg-metis-accent rounded-full animate-bounce [animation-delay:0ms]" />
                  <span className="w-1.5 h-1.5 bg-metis-accent rounded-full animate-bounce [animation-delay:150ms]" />
                  <span className="w-1.5 h-1.5 bg-metis-accent rounded-full animate-bounce [animation-delay:300ms]" />
                </div>
              </div>
            </div>
          )}

          <div ref={bottomRef} />
        </div>
      </main>

      {/* Input */}
      <footer className="px-4 py-4 border-t border-metis-border bg-metis-surface">
        <div className="max-w-2xl mx-auto">
          <ChatInput
            value={input}
            onChange={setInput}
            onSend={handleSend}
            disabled={loading || usagePct >= 100}
          />
          <p className="text-center text-xs text-metis-muted mt-2">
            A Metis so fala de League of Legends. Pode cometer erros — valide conselhos importantes.
          </p>
        </div>
      </footer>
    </div>
  )
}
