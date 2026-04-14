'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { ChatMessage, type Message } from '@/components/ui/ChatMessage'
import { ChatInput } from '@/components/ui/ChatInput'
import { Swords, Lock } from 'lucide-react'
import Link from 'next/link'
import { Header } from '@/components/ui/Header'

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? ''

export default function ChatPage() {
  const router = useRouter()
  const supabase = createClient()
  const bottomRef = useRef<HTMLDivElement>(null)

  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'metis',
      content: 'Olá, invocador. Sou a Metis — sua estrategista no Rift. Como posso te ajudar hoje?',
    },
  ])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [userEmail, setUserEmail] = useState<string | null>(null)
  const [isPremium, setIsPremium] = useState<boolean | null>(null) // null = carregando

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) {
        router.replace('/auth')
        return
      }
      setUserEmail(user.email ?? null)
      // is_premium é setado via service role no app_metadata
      const premium = user.app_metadata?.is_premium === true
      setIsPremium(premium)
    })
  }, [])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function handleSend() {
    const text = input.trim()
    if (!text || loading) return

    setMessages(prev => [...prev, { role: 'user', content: text }])
    setInput('')
    setLoading(true)

    try {
      const res = await fetch(`${API_URL}/api/v1/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mensagem: text }),
      })

      if (!res.ok) throw new Error(`Erro ${res.status}`)

      const data = await res.json()
      setMessages(prev => [...prev, { role: 'metis', content: data.resposta }])
    } catch {
      setMessages(prev => [
        ...prev,
        { role: 'metis', content: 'Não consegui me conectar ao servidor. Tente novamente.' },
      ])
    } finally {
      setLoading(false)
    }
  }

  async function handleLogout() {
    await supabase.auth.signOut()
    router.replace('/auth')
  }

  // Carregando sessão
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

  // Gate: logado mas sem premium
  if (!isPremium) {
    return (
      <div className="min-h-screen flex flex-col bg-metis-bg">
        <Header />

        <div className="flex-1 flex items-center justify-center px-4">
          <div className="max-w-sm text-center">
            <div className="w-16 h-16 rounded-full bg-metis-surface border border-metis-border flex items-center justify-center mx-auto mb-6">
              <Lock className="w-7 h-7 text-metis-accent" />
            </div>
            <h2 className="text-xl font-bold text-metis-text mb-2">Acesso Premium</h2>
            <p className="text-sm text-metis-text-dim mb-6 leading-relaxed">
              O Chat Tático com a Metis é exclusivo para contas Premium.
              Entre em contato com a equipe para solicitar seu acesso.
            </p>
            <Link
              href="/"
              className="inline-block text-sm text-metis-accent hover:underline"
            >
              ← Voltar para a busca
            </Link>
          </div>
        </div>
      </div>
    )
  }

  // Chat premium
  return (
    <div className="min-h-screen flex flex-col bg-metis-bg">
      <Header />

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
            disabled={loading}
          />
          <p className="text-center text-xs text-metis-muted mt-2">
            Metis pode cometer erros. Valide conselhos táticos importantes.
          </p>
        </div>
      </footer>
    </div>
  )
}
