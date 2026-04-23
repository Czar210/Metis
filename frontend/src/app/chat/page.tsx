'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useLocale, useTranslations } from 'next-intl'
import { createClient } from '@/lib/supabase/client'
import { apiFetch } from '@/lib/api'
import { AppHeader, Bar, Icon } from '@/components/design'
import { formatNumber } from '@/lib/format'
import type { Locale } from '@/i18n/config'

// ── Types ──────────────────────────────────────────────────────
type Message = {
  role: 'user' | 'metis'
  content: string
}

type Usage = {
  tokens_used: number
  token_limit: number
  pct: number
  resets_at: string
}

// ── Page ───────────────────────────────────────────────────────
export default function ChatPage() {
  const router = useRouter()
  const supabase = createClient()
  const t = useTranslations('chat')
  const locale = useLocale() as Locale
  const bottomRef = useRef<HTMLDivElement>(null)

  const WELCOME: Message = { role: 'metis', content: t('welcome') }
  const QUICK_PROMPTS = [
    t('quick_prompt_1'),
    t('quick_prompt_2'),
    t('quick_prompt_3'),
    t('quick_prompt_4'),
  ]

  const [messages, setMessages] = useState<Message[]>([WELCOME])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [isPremium, setIsPremium] = useState<boolean | null>(null)
  const [userTier, setUserTier] = useState<string>('Pro')
  const [userName, setUserName] = useState<string | null>(null)
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
      const hasPremium =
        meta.is_premium === true || ['donor', 'premium', 'pro'].includes(meta.tier as string)
      setIsPremium(hasPremium)
      setUserTier(typeof meta.tier === 'string' ? meta.tier : hasPremium ? 'premium' : 'free')
      setUserName(session.user.email?.split('@')[0] ?? null)

      if (hasPremium) {
        apiFetch(`/api/v1/chat/usage?supabase_token=${encodeURIComponent(session.access_token)}`)
          .then((r) => (r.ok ? r.json() : null))
          .then((d) => {
            if (d) setUsage(d)
          })
          .catch(() => {})
      }
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function handleSend(text?: string) {
    const msg = (text ?? input).trim()
    if (!msg || loading || !accessToken) return

    setMessages((prev) => [...prev, { role: 'user', content: msg }])
    setInput('')
    setLoading(true)

    try {
      const res = await apiFetch('/api/v1/chat', {
        method: 'POST',
        body: JSON.stringify({ mensagem: msg, supabase_token: accessToken }),
      })

      if (res.status === 429) {
        const err = await res.json()
        setMessages((prev) => [
          ...prev,
          { role: 'metis', content: `${t('rate_limit_prefix')} ${err.detail}` },
        ])
        return
      }

      if (!res.ok) throw new Error(`Erro ${res.status}`)

      const data = await res.json()
      setMessages((prev) => [...prev, { role: 'metis', content: data.resposta }])
      if (data.usage) setUsage(data.usage)
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: 'metis', content: t('connection_error') },
      ])
    } finally {
      setLoading(false)
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  // ── Loading inicial ─────────────────────────────────────────
  if (isPremium === null) {
    return (
      <div
        className="metis-scope"
        style={{
          minHeight: '100vh',
          background: 'var(--m-bg)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <div style={{ display: 'flex', gap: 6 }}>
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

  // ── Gate: sem plano pago ────────────────────────────────────
  if (!isPremium) {
    return (
      <div className="metis-scope" style={{ minHeight: '100vh', background: 'var(--m-bg)' }}>
        <AppHeader active="home" />
        <div
          style={{
            minHeight: 'calc(100vh - 80px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '40px 20px',
          }}
        >
          <div style={{ maxWidth: 420, textAlign: 'center' }}>
            <div
              style={{
                width: 72,
                height: 72,
                borderRadius: '50%',
                background: 'var(--m-surface)',
                border: '1px solid rgb(var(--m-accent-rgb) / 0.4)',
                boxShadow: '0 0 0 1px rgb(var(--m-accent-rgb) / 0.15), 0 20px 40px -20px rgb(var(--m-accent-rgb) / 0.35)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 22px',
                color: 'var(--m-accent)',
              }}
            >
              <Icon name="brain" size={32} />
            </div>
            <h2 className="font-display" style={{ fontSize: 26, fontWeight: 700, marginBottom: 8 }}>
              {t('gate_title')}
            </h2>
            <p style={{ fontSize: 13, color: 'var(--m-text-dim)', lineHeight: 1.55, marginBottom: 22 }}>
              {t('gate_description_part1')} <strong style={{ color: 'var(--m-accent)' }}>{t('gate_description_plan')}</strong> {t('gate_description_part2')}
            </p>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
              <Link
                href="/pricing"
                className="m-hover-accent"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '10px 18px',
                  background: 'var(--m-accent)',
                  color: '#1a1510',
                  borderRadius: 10,
                  fontSize: 13,
                  fontWeight: 600,
                  textDecoration: 'none',
                }}
              >
                {t('gate_cta_plans')}
                <Icon name="arrowRight" size={13} />
              </Link>
              <Link
                href="/"
                className="m-hover-surface"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  padding: '10px 16px',
                  background: 'transparent',
                  border: '1px solid var(--m-border-2)',
                  color: 'var(--m-text-dim)',
                  borderRadius: 10,
                  fontSize: 13,
                  fontWeight: 500,
                  textDecoration: 'none',
                }}
              >
                {t('gate_cta_back')}
              </Link>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // ── Chat ativo ──────────────────────────────────────────────
  const usagePct = usage?.pct ?? 0
  const barColor =
    usagePct >= 90 ? 'var(--m-red)' : usagePct >= 70 ? 'var(--m-orange)' : 'var(--m-accent)'

  return (
    <div
      className="metis-scope"
      style={{
        minHeight: '100vh',
        background: 'var(--m-bg)',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <AppHeader active="home" />

      {/* Token bar */}
      <div
        style={{
          padding: '8px 28px',
          borderBottom: '1px solid var(--m-border)',
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          background: 'var(--m-surface)',
          flexWrap: 'wrap',
        }}
      >
        <Icon name="bolt" size={13} style={{ color: 'var(--m-accent)' }} />
        {usage ? (
          <>
            <span style={{ fontSize: 11, color: 'var(--m-text-dim)' }}>
              <span className="tabular" style={{ color: 'var(--m-text)', fontWeight: 600 }}>
                {formatNumber(usage.tokens_used, locale)}
              </span>{' '}
              / {formatNumber(usage.token_limit, locale)} {t('usage_today')}
            </span>
            <div style={{ flex: 1, maxWidth: 220 }}>
              <Bar value={Math.min(usagePct, 100)} max={100} color={barColor} height={4} />
            </div>
            <span style={{ fontSize: 10, color: 'var(--m-muted)' }}>
              {t('usage_reset', { at: usage.resets_at, tier: userTier })}
            </span>
          </>
        ) : (
          <span style={{ fontSize: 11, color: 'var(--m-text-dim)' }}>
            {t('usage_loading')}
          </span>
        )}
        <div style={{ flex: 1 }} />
        <span style={{ fontSize: 11, color: 'var(--m-text-dim)' }}>
          {t('summoner')} <span style={{ color: 'var(--m-text)' }}>{userName ?? '—'}</span>
        </span>
      </div>

      {/* Messages area */}
      <main
        className="chat-scroll"
        style={{
          flex: 1,
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <div
          style={{
            maxWidth: 800,
            width: '100%',
            margin: '0 auto',
            padding: '28px 20px 20px',
            flex: 1,
          }}
        >
          {messages.map((msg, i) => (
            <ChatMsg key={i} msg={msg} />
          ))}

          {loading && (
            <div style={{ display: 'flex', gap: 12, marginBottom: 20, alignItems: 'flex-start' }}>
              <div
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 8,
                  background: 'rgb(var(--m-accent-rgb) / 0.15)',
                  border: '1px solid rgb(var(--m-accent-rgb) / 0.3)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--m-accent)',
                  flexShrink: 0,
                }}
              >
                <Icon name="brain" size={16} />
              </div>
              <div
                style={{
                  padding: '12px 14px',
                  background: 'var(--m-surface)',
                  border: '1px solid var(--m-border)',
                  borderRadius: 12,
                  display: 'flex',
                  gap: 4,
                }}
              >
                {[0, 150, 300].map((d) => (
                  <span
                    key={d}
                    style={{
                      width: 6,
                      height: 6,
                      borderRadius: '50%',
                      background: 'var(--m-accent)',
                      animation: 'm-chat-dot 1.4s infinite ease-in-out both',
                      animationDelay: `${d}ms`,
                    }}
                  />
                ))}
              </div>
            </div>
          )}

          <div ref={bottomRef} />
        </div>
      </main>

      {/* Input area */}
      <footer
        style={{
          borderTop: '1px solid var(--m-border)',
          background: 'var(--m-surface)',
          padding: '14px 28px 18px',
        }}
      >
        <div style={{ maxWidth: 800, margin: '0 auto' }}>
          <div
            style={{
              display: 'flex',
              gap: 8,
              alignItems: 'center',
              padding: '10px 12px',
              background: 'var(--m-bg)',
              border: '1px solid var(--m-border-2)',
              borderRadius: 12,
            }}
          >
            <Icon name="messageCircle" size={16} style={{ color: 'var(--m-text-dim)' }} />
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={loading || usagePct >= 100}
              rows={1}
              placeholder={t('input_placeholder')}
              style={{
                flex: 1,
                background: 'transparent',
                border: 'none',
                color: 'var(--m-text)',
                fontSize: 13,
                outline: 'none',
                fontFamily: 'inherit',
                resize: 'none',
                lineHeight: 1.5,
                maxHeight: 120,
                padding: '4px 0',
              }}
            />
            <button
              type="button"
              onClick={() => handleSend()}
              disabled={loading || !input.trim() || usagePct >= 100}
              className="m-hover-accent"
              style={{
                width: 32,
                height: 32,
                padding: 0,
                background: 'var(--m-accent)',
                border: 'none',
                borderRadius: 8,
                color: '#1a1510',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: loading || !input.trim() ? 'not-allowed' : 'pointer',
                opacity: loading || !input.trim() || usagePct >= 100 ? 0.4 : 1,
                flexShrink: 0,
              }}
            >
              <Icon name="send" size={14} />
            </button>
          </div>

          {/* Quick prompts */}
          <div style={{ display: 'flex', gap: 6, marginTop: 10, flexWrap: 'wrap' }}>
            {QUICK_PROMPTS.map((q) => (
              <button
                key={q}
                type="button"
                onClick={() => handleSend(q)}
                disabled={loading || usagePct >= 100}
                className="m-hover-surface"
                style={{
                  padding: '5px 10px',
                  background: 'var(--m-surface-2)',
                  border: '1px solid var(--m-border-2)',
                  borderRadius: 999,
                  color: 'var(--m-text-dim)',
                  fontSize: 11,
                  cursor: loading ? 'not-allowed' : 'pointer',
                  fontFamily: 'inherit',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 4,
                  opacity: loading || usagePct >= 100 ? 0.5 : 1,
                }}
              >
                <Icon name="sparkles" size={10} style={{ color: 'var(--m-accent)' }} />
                {q}
              </button>
            ))}
          </div>

          <div
            style={{
              fontSize: 10,
              color: 'var(--m-muted)',
              textAlign: 'center',
              marginTop: 10,
            }}
          >
            {t('disclaimer')}
          </div>
        </div>
      </footer>

      <style jsx>{`
        @keyframes m-chat-dot {
          0%, 80%, 100% { opacity: 0.3; transform: scale(0.6); }
          40% { opacity: 1; transform: scale(1); }
        }
      `}</style>
    </div>
  )
}

// ── Inline ChatMsg component ────────────────────────────────────
function ChatMsg({ msg }: { msg: Message }) {
  const isUser = msg.role === 'user'
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: isUser ? 'row-reverse' : 'row',
        gap: 12,
        marginBottom: 20,
        alignItems: 'flex-start',
      }}
    >
      {!isUser && (
        <div
          style={{
            width: 32,
            height: 32,
            borderRadius: 8,
            background: 'rgb(var(--m-accent-rgb) / 0.15)',
            border: '1px solid rgb(var(--m-accent-rgb) / 0.3)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--m-accent)',
            flexShrink: 0,
          }}
        >
          <Icon name="brain" size={16} />
        </div>
      )}
      <div
        style={{
          flex: isUser ? '0 1 auto' : 1,
          maxWidth: isUser ? '72%' : '92%',
        }}
      >
        <div
          style={{
            background: isUser ? 'var(--m-accent)' : 'var(--m-surface)',
            border: isUser ? 'none' : '1px solid var(--m-border)',
            padding: '12px 14px',
            borderRadius: 12,
            color: isUser ? '#1a1510' : 'var(--m-text)',
            fontSize: 13,
            lineHeight: 1.55,
            whiteSpace: 'pre-wrap',
          }}
        >
          {msg.content}
        </div>
      </div>
    </div>
  )
}
