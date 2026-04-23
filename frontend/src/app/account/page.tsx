'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useLocale, useTranslations } from 'next-intl'
import { createClient } from '@/lib/supabase/client'
import { apiFetch } from '@/lib/api'
import {
  AppHeader,
  Card,
  SectionLabel,
  Bar,
  ChampPortrait,
  Icon,
} from '@/components/design'
import { useTheme, type AccentColor } from '@/components/ui/ThemeProvider'
import { setLocale } from '@/i18n/actions'
import { SUPPORTED_LOCALES, LOCALE_LABELS, type Locale } from '@/i18n/config'
import { formatNumber } from '@/lib/format'

// ── Tipos ──────────────────────────────────────────────────────

type Tier = 'free' | 'donor' | 'premium' | 'pro'

type Usage = {
  tokens_used: number
  token_limit: number
  pct: number
  resets_at: string
}

type Coupon = {
  title: string
  description: string | null
  effect: Record<string, unknown>
  valid_until: string
  max_uses: number | null
  uses_count: number
}

type Watched = {
  puuid: string
  label: string | null
  players?: { game_name: string; tag_line: string; profile_icon_id: number | null } | null
}

// Stub de dados de cobrança enquanto o Stripe não está integrado.
// Card fake por tier — confirmado pelo César (p-0.9.20).
const FAKE_SUB: Record<Tier, { price: string; period: 'monthly' | 'once' | null; nextBill: string | null; cardBrand: 'visa' | 'mastercard' | null; cardLast4: string | null; cardExp: string | null } | null> = {
  free:    null,
  donor:   { price: 'R$ 4,90',  period: 'once',    nextBill: null,                  cardBrand: 'visa',       cardLast4: '4242', cardExp: '08/28' },
  premium: { price: 'R$ 24,90', period: 'monthly', nextBill: '2026-05-23T00:00:00', cardBrand: 'visa',       cardLast4: '4242', cardExp: '08/28' },
  pro:     { price: 'R$ 44,90', period: 'monthly', nextBill: '2026-05-23T00:00:00', cardBrand: 'mastercard', cardLast4: '8823', cardExp: '11/27' },
}

const TIER_META: Record<Tier, { color: string; badgeBg: string; badgeBd: string; icon: 'sparkles' | 'zap' | 'gift' | null }> = {
  free:    { color: 'var(--m-text-dim)', badgeBg: 'rgba(138,147,166,0.12)', badgeBd: 'rgba(138,147,166,0.3)',  icon: null },
  donor:   { color: 'var(--m-cyan)',     badgeBg: 'rgba(91,227,212,0.12)',  badgeBd: 'rgba(91,227,212,0.35)',  icon: 'gift' },
  premium: { color: 'var(--m-accent)',   badgeBg: 'rgb(var(--m-accent-rgb) / 0.12)', badgeBd: 'rgb(var(--m-accent-rgb) / 0.35)', icon: 'sparkles' },
  pro:     { color: 'var(--m-violet)',   badgeBg: 'rgba(139,127,255,0.12)', badgeBd: 'rgba(139,127,255,0.35)', icon: 'zap' },
}

const REGIONS = ['BR1', 'NA1', 'EUW', 'KR', 'LAN', 'LAS'] as const

const ACCENTS: { id: AccentColor; hex: string }[] = [
  { id: 'blue',   hex: '#3b82f6' },
  { id: 'purple', hex: '#8b5cf6' },
  { id: 'green',  hex: '#10b981' },
  { id: 'red',    hex: '#ef4444' },
  { id: 'gold',   hex: '#d4af37' },
]

// ── Card brand logo (SVG inline, do mock) ──────────────────────
function CardBrandLogo({ brand }: { brand: 'visa' | 'mastercard' }) {
  if (brand === 'visa') {
    return (
      <svg width={44} height={28} viewBox="0 0 40 26" style={{ display: 'block' }}>
        <rect width="40" height="26" rx="3" fill="#0B0D12" stroke="#2B3246" />
        <text x="20" y="18" textAnchor="middle" fontFamily="Arial Black, sans-serif" fontSize="10" fontWeight="900" fontStyle="italic" fill="#E5E9F2" letterSpacing="0.5">VISA</text>
      </svg>
    )
  }
  return (
    <svg width={44} height={28} viewBox="0 0 40 26" style={{ display: 'block' }}>
      <rect width="40" height="26" rx="3" fill="#0B0D12" stroke="#2B3246" />
      <circle cx="16" cy="13" r="6" fill="#EB001B" opacity="0.9" />
      <circle cx="24" cy="13" r="6" fill="#F79E1B" opacity="0.9" />
    </svg>
  )
}

function TierPill({ tier, label, large = false }: { tier: Tier; label: string; large?: boolean }) {
  const m = TIER_META[tier]
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 6,
      padding: large ? '6px 12px' : '4px 10px',
      borderRadius: 999, fontSize: large ? 12 : 11, fontWeight: 600,
      letterSpacing: '0.04em', textTransform: 'uppercase',
      background: m.badgeBg, border: `1px solid ${m.badgeBd}`, color: m.color,
    }}>
      {m.icon && <Icon name={m.icon} size={large ? 14 : 12} />}
      {label}
    </span>
  )
}

function dateFormat(iso: string, locale: Locale): string {
  try {
    const d = new Date(iso)
    return d.toLocaleDateString(locale === 'pt' ? 'pt-BR' : 'en-US', { day: '2-digit', month: 'long', year: 'numeric' })
  } catch { return iso }
}

function dateShort(iso: string, locale: Locale): string {
  try {
    const d = new Date(iso)
    return d.toLocaleDateString(locale === 'pt' ? 'pt-BR' : 'en-US', { day: '2-digit', month: 'long' })
  } catch { return iso }
}

function daysUntil(iso: string): number {
  try {
    const ms = new Date(iso).getTime() - Date.now()
    return Math.max(0, Math.ceil(ms / 86400000))
  } catch { return 0 }
}

// ── Page ───────────────────────────────────────────────────────
export default function AccountPage() {
  const router = useRouter()
  const supabase = useMemo(() => createClient(), [])
  const t = useTranslations('account')
  const tHeader = useTranslations('header')
  const locale = useLocale() as Locale
  const { color: accent, setColor: setAccent } = useTheme()

  const [email, setEmail] = useState<string | null>(null)
  const [memberSince, setMemberSince] = useState<string | null>(null)
  const [tier, setTier] = useState<Tier>('free')
  const [loading, setLoading] = useState(true)

  const [usage, setUsage] = useState<Usage | null>(null)
  const [usageError, setUsageError] = useState(false)
  const [coupons, setCoupons] = useState<Coupon[]>([])
  const [watched, setWatched] = useState<Watched[]>([])

  const [redeemInput, setRedeemInput] = useState('')
  const [copiedCode, setCopiedCode] = useState<string | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const [region, setRegion] = useState<string>('BR1')

  function flash(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(null), 2500)
  }

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.replace('/auth'); return }

      setEmail(user.email ?? null)
      setMemberSince(user.created_at ?? null)

      const meta = user.app_metadata ?? {}
      const metaTier = typeof meta.tier === 'string' ? meta.tier.toLowerCase() : null
      const isPremium = meta.is_premium === true
      const resolved: Tier = metaTier === 'donor' || metaTier === 'premium' || metaTier === 'pro' || metaTier === 'free'
        ? (metaTier as Tier)
        : isPremium ? 'premium' : 'free'
      setTier(resolved)

      const savedRegion = typeof window !== 'undefined' ? window.localStorage.getItem('metis_region') : null
      if (savedRegion && (REGIONS as readonly string[]).includes(savedRegion)) setRegion(savedRegion)

      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token

      // Paralelizado: usage + coupons públicos + watched
      const [usageRes, couponsRes, watchedRes] = await Promise.allSettled([
        token
          ? apiFetch(`/api/v1/chat/usage?supabase_token=${encodeURIComponent(token)}`).then(r => r.ok ? r.json() as Promise<Usage> : null)
          : Promise.resolve(null),
        apiFetch('/api/v1/coupons/public').then(r => r.ok ? r.json() as Promise<Coupon[]> : []),
        supabase
          .from('watched_players')
          .select('puuid, label, players(game_name, tag_line, profile_icon_id)')
          .order('created_at', { ascending: false })
          .then(({ data }) => (data ?? []) as unknown as Watched[]),
      ])

      if (usageRes.status === 'fulfilled' && usageRes.value) setUsage(usageRes.value)
      else setUsageError(true)
      if (couponsRes.status === 'fulfilled') setCoupons(couponsRes.value)
      if (watchedRes.status === 'fulfilled') setWatched(watchedRes.value)

      setLoading(false)
    }
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function handleSwitchLocale(loc: Locale) {
    if (loc === locale) return
    await setLocale(loc)
  }

  function handleRegionChange(r: string) {
    setRegion(r)
    try { window.localStorage.setItem('metis_region', r) } catch {}
  }

  async function handlePasswordReset() {
    if (!email) return
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth`,
    })
    flash(error ? t('security.password_sent') : t('security.password_sent'))
  }

  async function handleSignOutAll() {
    flash(t('security.sessions_signed_out'))
    await supabase.auth.signOut({ scope: 'global' })
    router.replace('/')
    router.refresh()
  }

  async function handleRemoveWatched(puuid: string) {
    await supabase.from('watched_players').delete().eq('puuid', puuid)
    setWatched((prev) => prev.filter((w) => w.puuid !== puuid))
  }

  function handleCopyCoupon(title: string) {
    if (typeof navigator === 'undefined' || !navigator.clipboard) return
    navigator.clipboard.writeText(title).catch(() => {})
    setCopiedCode(title)
    setTimeout(() => setCopiedCode(null), 1500)
  }

  const initial = email?.charAt(0).toUpperCase() ?? '?'
  const username = email?.split('@')[0] ?? '—'
  const meta = TIER_META[tier]
  const sub = FAKE_SUB[tier]
  const isFree = tier === 'free'
  const tierLabel = t(`tier_${tier}`)

  if (loading) {
    return (
      <div className="metis-scope" style={{ minHeight: '100vh', background: 'var(--m-bg)' }}>
        <AppHeader />
        <div style={{ padding: '80px 0', display: 'flex', justifyContent: 'center', gap: 6 }}>
          {[0, 150, 300].map((d) => (
            <span
              key={d}
              style={{
                width: 8, height: 8, borderRadius: '50%', background: 'var(--m-accent)',
                animation: 'm-bounce 1.4s infinite ease-in-out both', animationDelay: `${d}ms`,
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

  return (
    <div className="metis-scope" style={{ minHeight: '100vh', background: 'var(--m-bg)' }}>
      <AppHeader />

      {toast && (
        <div style={{
          position: 'fixed', top: 76, left: '50%', transform: 'translateX(-50%)', zIndex: 30,
          background: 'var(--m-surface)', border: '1px solid var(--m-border-2)',
          borderRadius: 8, padding: '10px 16px', fontSize: 12, fontWeight: 500,
          color: 'var(--m-text)', boxShadow: '0 6px 20px rgba(0,0,0,0.35)',
        }}>
          {toast}
        </div>
      )}

      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '28px 24px 40px' }}>
        {/* Page title */}
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 11, color: 'var(--m-muted)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
            <Icon name="settings" size={12} /> {t('eyebrow')}
          </div>
          <h1 className="font-display" style={{ fontSize: 28, fontWeight: 700 }}>{t('title')}</h1>
        </div>

        {/* Identity hero */}
        <div style={{
          position: 'relative', overflow: 'hidden', borderRadius: 14,
          background: 'var(--m-surface)', border: '1px solid var(--m-border)',
          padding: '28px 28px 24px', marginBottom: 20,
        }}>
          <div style={{
            position: 'absolute', top: -80, right: -60, width: 320, height: 320,
            background: `radial-gradient(circle, ${meta.color}44 0%, transparent 60%)`,
            pointerEvents: 'none',
          }} />
          <div style={{
            position: 'absolute', inset: 0,
            backgroundImage: 'linear-gradient(to right, rgb(var(--m-accent-rgb) / 0.025) 1px, transparent 1px), linear-gradient(to bottom, rgb(var(--m-accent-rgb) / 0.025) 1px, transparent 1px)',
            backgroundSize: '24px 24px', pointerEvents: 'none',
          }} />

          <div style={{ position: 'relative', display: 'flex', gap: 24, alignItems: 'center', flexWrap: 'wrap' }}>
            <div style={{
              width: 96, height: 96, borderRadius: 20,
              background: 'var(--m-surface-2)', border: `2px solid ${meta.color}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 44, fontWeight: 800, color: meta.color, flexShrink: 0,
              fontFamily: 'Space Grotesk, sans-serif',
              boxShadow: `0 0 40px ${meta.color}33, inset 0 0 0 1px rgba(255,255,255,0.05)`,
            }}>{initial}</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6, flexWrap: 'wrap' }}>
                <TierPill tier={tier} label={tierLabel} large />
                <div style={{ fontSize: 11, color: 'var(--m-muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                  {t('label_my_account')}
                </div>
              </div>
              <h2 className="font-display" style={{ fontSize: 32, fontWeight: 700, lineHeight: 1, marginBottom: 6 }}>{username}</h2>
              <div style={{ display: 'flex', gap: 14, alignItems: 'center', fontSize: 13, color: 'var(--m-text-dim)', flexWrap: 'wrap' }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                  <Icon name="mail" size={13} /> {email}
                </span>
                {memberSince && (
                  <>
                    <span style={{ color: 'var(--m-border-2)' }}>•</span>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                      <Icon name="calendar" size={13} /> {t('member_since', { date: dateFormat(memberSince, locale) })}
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Two-col grid (colapsa em 1 no mobile via media query inline nos children) */}
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.4fr) minmax(0, 1fr)', gap: 20 }} className="account-grid">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            {/* Subscription card */}
            <Card pad={0}>
              <div style={{ padding: '18px 22px', borderBottom: '1px solid var(--m-border)' }}>
                <SectionLabel icon="creditCard">{t('subscription.title')}</SectionLabel>
                <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                      <span className="font-display" style={{ fontSize: 22, fontWeight: 700, color: meta.color }}>{tierLabel}</span>
                      {!isFree && tier !== 'donor' && (
                        <span style={{ fontSize: 11, color: 'var(--m-green)', background: 'rgba(74,222,128,0.12)', padding: '2px 8px', borderRadius: 999, border: '1px solid rgba(74,222,128,0.3)', fontWeight: 600 }}>
                          {t('subscription.active')}
                        </span>
                      )}
                    </div>
                    {sub ? (
                      <div style={{ fontSize: 13, color: 'var(--m-text-dim)' }}>
                        <span className="font-display tabular" style={{ fontSize: 20, fontWeight: 700, color: 'var(--m-text)' }}>{sub.price}</span>
                        <span style={{ marginLeft: 4 }}>{sub.period === 'monthly' ? t('subscription.period_monthly') : sub.period === 'once' ? t('subscription.period_once') : ''}</span>
                      </div>
                    ) : (
                      <div style={{ fontSize: 13, color: 'var(--m-text-dim)' }}>{t('subscription.no_recurring')}</div>
                    )}
                  </div>
                  {isFree ? (
                    <Link href="/pricing" className="m-hover-accent" style={{
                      display: 'inline-flex', alignItems: 'center', gap: 6,
                      background: 'var(--m-accent)', border: 'none', color: '#1a1510',
                      padding: '9px 16px', borderRadius: 8, fontSize: 13, fontWeight: 600,
                      textDecoration: 'none',
                    }}>
                      <Icon name="sparkles" size={14} /> {t('subscription.upgrade')}
                    </Link>
                  ) : (
                    <button type="button" onClick={() => flash(t('security.delete_coming'))} style={{
                      display: 'inline-flex', alignItems: 'center', gap: 6,
                      background: 'var(--m-surface-2)', border: '1px solid var(--m-border-2)',
                      color: 'var(--m-text)', padding: '9px 16px', borderRadius: 8,
                      fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
                    }}>
                      <Icon name="settings" size={14} /> {t('subscription.manage')}
                    </button>
                  )}
                </div>
              </div>

              {sub && sub.cardBrand && sub.cardLast4 && (
                <div style={{ padding: '16px 22px', borderBottom: '1px solid var(--m-border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                    <CardBrandLogo brand={sub.cardBrand} />
                    <div>
                      <div className="font-mono" style={{ fontSize: 13, color: 'var(--m-text)', fontWeight: 600, letterSpacing: '0.04em' }}>
                        •••• •••• •••• {sub.cardLast4}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--m-text-dim)', marginTop: 2 }}>
                        {t('subscription.card_expires', { exp: sub.cardExp ?? '—' })}
                      </div>
                    </div>
                  </div>
                  <button type="button" onClick={() => flash(t('security.delete_coming'))} style={{
                    background: 'transparent', border: 'none', color: 'var(--m-accent)',
                    fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
                  }}>
                    {t('subscription.change_card')}
                  </button>
                </div>
              )}

              {sub && sub.nextBill && (
                <div style={{ padding: '14px 22px', fontSize: 12, color: 'var(--m-text-dim)', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Icon name="calendar" size={13} />
                  {t('subscription.next_bill', { date: dateFormat(sub.nextBill, locale) })}
                </div>
              )}
              {isFree && (
                <div style={{ padding: '14px 22px', fontSize: 12, color: 'var(--m-text-dim)', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Icon name="info" size={13} />
                  {t('subscription.free_cta')}
                </div>
              )}
            </Card>

            {/* Watched players */}
            <Card pad={0}>
              <div style={{ padding: '18px 22px 14px' }}>
                <SectionLabel icon="eye" right={
                  <Link href="/" style={{
                    background: 'transparent', border: '1px solid var(--m-border-2)', color: 'var(--m-text-dim)',
                    padding: '4px 10px', borderRadius: 6, fontSize: 11, fontWeight: 600,
                    display: 'inline-flex', alignItems: 'center', gap: 4, textDecoration: 'none',
                  }}>
                    <Icon name="plus" size={11} /> {t('watched.add')}
                  </Link>
                }>
                  {t('watched.title')}
                </SectionLabel>
              </div>
              {watched.length === 0 ? (
                <div style={{ padding: '0 22px 22px', fontSize: 12, color: 'var(--m-text-dim)' }}>
                  {t('watched.empty')}
                </div>
              ) : (
                <div>
                  {watched.map((p) => {
                    const gameName = p.players?.game_name ?? '—'
                    const tagLine = p.players?.tag_line ?? ''
                    return (
                      <div key={p.puuid} style={{
                        display: 'flex', alignItems: 'center', gap: 14,
                        padding: '12px 22px', borderTop: '1px solid var(--m-border)',
                      }}>
                        <ChampPortrait name="Aatrox" size={40} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
                            <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--m-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {gameName}
                            </span>
                            {tagLine && (
                              <span className="font-mono" style={{ fontSize: 11, color: 'var(--m-muted)' }}>#{tagLine}</span>
                            )}
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11, color: 'var(--m-text-dim)' }}>
                            <Icon name="bookOpen" size={11} />
                            {p.label ?? t('watched.no_label')}
                          </div>
                        </div>
                        <div style={{ display: 'flex', gap: 4 }}>
                          <Link
                            href={`/players/${p.puuid}`}
                            title={t('watched.open_dashboard')}
                            style={{
                              width: 30, height: 30, background: 'var(--m-surface-2)',
                              border: '1px solid var(--m-border-2)', borderRadius: 7,
                              color: 'var(--m-text-dim)',
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              textDecoration: 'none',
                            }}
                          >
                            <Icon name="arrowRight" size={13} />
                          </Link>
                          <button
                            type="button"
                            title={t('watched.remove')}
                            onClick={() => handleRemoveWatched(p.puuid)}
                            style={{
                              width: 30, height: 30, background: 'transparent',
                              border: '1px solid var(--m-border)', borderRadius: 7,
                              color: 'var(--m-muted)', cursor: 'pointer',
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                            }}
                          >
                            <Icon name="x" size={13} />
                          </button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </Card>

            {/* Security */}
            <Card pad={0}>
              <div style={{ padding: '18px 22px 14px' }}>
                <SectionLabel icon="shieldCheck">{t('security.title')}</SectionLabel>
              </div>
              <div style={{ borderTop: '1px solid var(--m-border)' }}>
                <AccountRow
                  icon="mail"
                  label={t('security.email_label')}
                  value={email ?? '—'}
                  action={t('security.email_readonly')}
                  actionMuted
                />
                <AccountRow
                  icon="key"
                  label={t('security.password_label')}
                  value={t('security.password_value')}
                  action={t('security.password_action')}
                  onAction={handlePasswordReset}
                />
                <AccountRow
                  icon="lock"
                  label={t('security.sessions_label')}
                  value={t('security.sessions_value')}
                  action={t('security.sessions_action')}
                  onAction={handleSignOutAll}
                />
              </div>
              <div style={{ padding: '14px 22px', background: 'rgba(248,113,113,0.04)', borderTop: '1px solid rgba(248,113,113,0.15)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, justifyContent: 'space-between', flexWrap: 'wrap' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 0 }}>
                    <div style={{ width: 32, height: 32, borderRadius: 8, background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--m-red)' }}>
                      <Icon name="trash" size={15} />
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--m-red)' }}>{t('security.delete_title')}</div>
                      <div style={{ fontSize: 11, color: 'var(--m-muted)' }}>{t('security.delete_sub')}</div>
                    </div>
                  </div>
                  <button type="button" onClick={() => flash(t('security.delete_coming'))} style={{
                    background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.3)',
                    color: 'var(--m-red)', padding: '7px 14px', borderRadius: 7,
                    fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap', cursor: 'pointer', fontFamily: 'inherit',
                  }}>
                    {t('security.delete_action')}
                  </button>
                </div>
              </div>
            </Card>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            {/* Tokens */}
            <Card pad={22}>
              <SectionLabel icon="sparkles">{t('tokens.title')}</SectionLabel>
              {usage ? (
                <TokensBlock usage={usage} locale={locale} t={t} />
              ) : usageError ? (
                <div style={{ fontSize: 12, color: 'var(--m-text-dim)' }}>{t('tokens.unavailable')}</div>
              ) : null}
            </Card>

            {/* Coupons */}
            <Card pad={22}>
              <SectionLabel icon="gift" right={
                <span style={{ fontSize: 11, color: 'var(--m-text-dim)', fontWeight: 500 }}>
                  {t('coupons.active_count', { n: coupons.length })}
                </span>
              }>
                {t('coupons.title')}
              </SectionLabel>

              {coupons.length === 0 ? (
                <div style={{ fontSize: 12, color: 'var(--m-text-dim)', marginBottom: 12 }}>
                  {t('coupons.none_active')}
                </div>
              ) : (
                <div style={{ display: 'grid', gap: 10, marginBottom: 12 }}>
                  {coupons.map((c, i) => {
                    const daysLeft = daysUntil(c.valid_until)
                    const urgent = daysLeft <= 10
                    const isCopied = copiedCode === c.title
                    return (
                      <div key={i} style={{
                        background: 'var(--m-surface-2)', border: '1px solid var(--m-border-2)',
                        borderRadius: 10, padding: '12px 14px',
                        display: 'flex', flexDirection: 'column', gap: 10,
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                          <div className="font-mono" style={{
                            fontSize: 13, fontWeight: 700, color: 'var(--m-accent)', letterSpacing: '0.06em',
                            background: 'rgb(var(--m-accent-rgb) / 0.08)',
                            border: '1px dashed rgb(var(--m-accent-rgb) / 0.35)',
                            padding: '4px 10px', borderRadius: 6,
                          }}>
                            {c.title}
                          </div>
                          <button
                            type="button"
                            title={isCopied ? t('coupons.copied') : t('coupons.copy')}
                            onClick={() => handleCopyCoupon(c.title)}
                            style={{
                              width: 28, height: 28, background: 'transparent',
                              border: '1px solid var(--m-border)', borderRadius: 6,
                              color: isCopied ? 'var(--m-green)' : 'var(--m-text-dim)',
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              cursor: 'pointer',
                            }}
                          >
                            <Icon name={isCopied ? 'check' : 'copy'} size={13} />
                          </button>
                        </div>
                        {c.description && (
                          <div style={{ fontSize: 12, color: 'var(--m-text)', fontWeight: 500 }}>{c.description}</div>
                        )}
                        <div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--m-muted)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                            <span>{t('coupons.until', { date: dateShort(c.valid_until, locale) })}</span>
                            <span style={{ color: urgent ? 'var(--m-red)' : 'var(--m-muted)' }}>
                              {t('coupons.days_left', { n: daysLeft })}
                            </span>
                          </div>
                          <Bar value={daysLeft} max={60} color={urgent ? 'var(--m-red)' : 'var(--m-green)'} height={3} />
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}

              <form
                onSubmit={(e) => {
                  e.preventDefault()
                  if (!redeemInput.trim()) return
                  flash(t('security.delete_coming'))
                  setRedeemInput('')
                }}
                style={{ display: 'flex', gap: 8 }}
              >
                <input
                  value={redeemInput}
                  onChange={(e) => setRedeemInput(e.target.value.toUpperCase())}
                  placeholder={t('coupons.input_placeholder')}
                  className="font-mono"
                  style={{
                    flex: 1, background: 'var(--m-bg)', border: '1px solid var(--m-border-2)',
                    borderRadius: 8, padding: '9px 12px', fontSize: 13, color: 'var(--m-text)',
                    letterSpacing: '0.04em', outline: 'none',
                  }}
                />
                <button type="submit" style={{
                  background: 'var(--m-accent)', border: 'none', color: '#1a1510',
                  padding: '9px 14px', borderRadius: 8, fontSize: 12, fontWeight: 600,
                  cursor: 'pointer', fontFamily: 'inherit',
                }}>
                  {t('coupons.redeem')}
                </button>
              </form>
            </Card>

            {/* Preferences */}
            <Card pad={22}>
              <SectionLabel icon="settings">{t('preferences.title')}</SectionLabel>

              <PreferenceRow icon="globe" label={t('preferences.language')} sub={t('preferences.language_sub')}>
                <div style={{
                  display: 'flex', background: 'var(--m-surface-2)', borderRadius: 999,
                  padding: 3, gap: 2, border: '1px solid var(--m-border-2)',
                }}>
                  {SUPPORTED_LOCALES.map((l) => {
                    const active = l === locale
                    return (
                      <button
                        key={l}
                        type="button"
                        onClick={() => handleSwitchLocale(l)}
                        disabled={active}
                        style={{
                          padding: '4px 12px', borderRadius: 999, fontSize: 11, fontWeight: 600,
                          border: 'none', cursor: active ? 'default' : 'pointer',
                          background: active ? 'var(--m-accent)' : 'transparent',
                          color: active ? '#1a1510' : 'var(--m-text-dim)',
                          fontFamily: 'inherit',
                        }}
                      >
                        {LOCALE_LABELS[l]}
                      </button>
                    )
                  })}
                </div>
              </PreferenceRow>

              <PreferenceRow icon="palette" label={t('preferences.accent')} sub={t('preferences.accent_sub')}>
                <div style={{ display: 'flex', gap: 6 }}>
                  {ACCENTS.map((a) => {
                    const active = a.id === accent
                    return (
                      <button
                        key={a.id}
                        type="button"
                        title={a.id}
                        onClick={() => setAccent(a.id)}
                        style={{
                          width: 26, height: 26, borderRadius: '50%', background: a.hex,
                          border: active ? `2px solid var(--m-text)` : `2px solid transparent`,
                          boxShadow: active ? `0 0 0 2px var(--m-surface), 0 0 12px ${a.hex}88` : 'none',
                          cursor: 'pointer', padding: 0,
                        }}
                      />
                    )
                  })}
                </div>
              </PreferenceRow>

              <PreferenceRow icon="gamepad" label={t('preferences.region')} sub={t('preferences.region_sub')} last>
                <select
                  value={region}
                  onChange={(e) => handleRegionChange(e.target.value)}
                  style={{
                    background: 'var(--m-surface-2)', border: '1px solid var(--m-border-2)',
                    color: 'var(--m-text)', padding: '6px 10px', borderRadius: 7, fontSize: 12,
                    fontFamily: 'inherit', fontWeight: 500, cursor: 'pointer',
                  }}
                >
                  {REGIONS.map((r) => <option key={r} value={r}>{r}</option>)}
                </select>
              </PreferenceRow>
            </Card>
          </div>
        </div>
      </div>

      <style jsx>{`
        @media (max-width: 860px) {
          :global(.account-grid) {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </div>
  )
}

// ── Subcomponents ──────────────────────────────────────────────

function TokensBlock({ usage, locale, t }: { usage: Usage; locale: Locale; t: ReturnType<typeof useTranslations<'account'>> }) {
  const pct = usage.pct
  const near = pct > 80
  const resetsIn = (() => {
    try {
      const ms = new Date(usage.resets_at).getTime() - Date.now()
      return Math.max(0, Math.ceil(ms / 86400000))
    } catch { return 0 }
  })()
  return (
    <>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 12 }}>
        <span className="font-display tabular" style={{ fontSize: 28, fontWeight: 700, color: near ? 'var(--m-red)' : 'var(--m-text)' }}>
          {formatNumber(usage.tokens_used, locale)}
        </span>
        <span style={{ fontSize: 13, color: 'var(--m-text-dim)' }}>
          {t('tokens.used_of_total', { total: formatNumber(usage.token_limit, locale) })}
        </span>
      </div>
      <Bar value={Math.min(pct, 100)} max={100} color={near ? 'var(--m-red)' : 'var(--m-accent)'} height={8} />
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 10, fontSize: 11, color: 'var(--m-muted)' }}>
        <span>{t('tokens.pct_used', { pct: Math.round(pct) })}</span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
          <Icon name="refresh" size={11} /> {t('tokens.resets_in', { days: resetsIn })}
        </span>
      </div>
    </>
  )
}

function AccountRow({ icon, label, value, action, onAction, actionMuted }: {
  icon: 'mail' | 'key' | 'lock'
  label: string
  value: string
  action: string
  onAction?: () => void
  actionMuted?: boolean
}) {
  return (
    <div style={{
      padding: '14px 22px', borderBottom: '1px solid var(--m-border)',
      display: 'flex', alignItems: 'center', gap: 14,
    }}>
      <div style={{
        width: 32, height: 32, borderRadius: 8, background: 'var(--m-surface-2)',
        border: '1px solid var(--m-border-2)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--m-text-dim)',
      }}>
        <Icon name={icon} size={15} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--m-text-dim)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</div>
        <div style={{ fontSize: 13, color: 'var(--m-text)', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {value}
        </div>
      </div>
      <button
        type="button"
        onClick={actionMuted ? undefined : onAction}
        disabled={actionMuted}
        style={{
          background: 'transparent',
          border: actionMuted ? 'none' : '1px solid var(--m-border-2)',
          color: actionMuted ? 'var(--m-muted)' : 'var(--m-text)',
          padding: actionMuted ? '0' : '6px 12px', borderRadius: 7,
          fontSize: 12, fontWeight: 500,
          cursor: actionMuted ? 'default' : 'pointer',
          fontFamily: 'inherit', whiteSpace: 'nowrap',
        }}
      >
        {action}
      </button>
    </div>
  )
}

function PreferenceRow({ icon, label, sub, last, children }: {
  icon: 'globe' | 'palette' | 'gamepad'
  label: string
  sub: string
  last?: boolean
  children: React.ReactNode
}) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '10px 0',
      borderBottom: last ? 'none' : '1px solid var(--m-border)',
      gap: 12, flexWrap: 'wrap',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <Icon name={icon} size={15} style={{ color: 'var(--m-text-dim)' }} />
        <div>
          <div style={{ fontSize: 13, fontWeight: 500 }}>{label}</div>
          <div style={{ fontSize: 11, color: 'var(--m-muted)' }}>{sub}</div>
        </div>
      </div>
      {children}
    </div>
  )
}
