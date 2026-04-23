'use client'

import { useEffect, useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { apiFetch } from '@/lib/api'
import {
  AppHeader,
  Card,
  SectionLabel,
  Icon,
} from '@/components/design'
import type { Locale } from '@/i18n/config'

// ── Types ───────────────────────────────────────────────────────
type PlanId = 'free' | 'donor' | 'premium' | 'pro'

type Plan = {
  id: PlanId
  tier: string           // display constante (nome do plano)
  rank: string           // LoL rank key (constante)
  color: string
  price: number
  /** Se true, mostra "/mês" ou "/ano". Se false, mostra "forever/para sempre". */
  isPaid: boolean
  actionVariant: 'muted' | 'filled'
  popular?: boolean
  featureCount: number
  /** Primeiros N features são on: true, o resto é off. */
  featuresOn: number
}

type Coupon = {
  title: string
  description: string | null
  effect: Record<string, unknown>
  valid_until: string
  max_uses: number | null
  uses_count: number
}

const PLANS: Plan[] = [
  { id: 'free',    tier: 'Free',    rank: 'SILVER',     color: '#B4C0CF', price: 0,    isPaid: false, actionVariant: 'muted',  featureCount: 12, featuresOn: 8 },
  { id: 'donor',   tier: 'Doador',  rank: 'EMERALD',    color: '#44D19E', price: 4.9,  isPaid: true,  actionVariant: 'filled', featureCount: 10, featuresOn: 5 },
  { id: 'premium', tier: 'Premium', rank: 'MASTER',     color: '#C581E6', price: 24.9, isPaid: true,  actionVariant: 'filled', popular: true, featureCount: 10, featuresOn: 10 },
  { id: 'pro',     tier: 'Pro',     rank: 'CHALLENGER', color: '#66D7F0', price: 44.9, isPaid: true,  actionVariant: 'filled', featureCount: 10, featuresOn: 10 },
]

type CompRow = {
  labelKey: 'row_saved' | 'row_history' | 'row_reco' | 'row_chat' | 'row_tactical' | 'row_timeline' | 'row_coaching' | 'row_api' | 'row_dashboard' | 'row_badge'
  free: string
  donor: string
  premium: string | 'row_reco_premium' | 'badge_master'
  pro: string | 'row_reco_pro' | 'badge_challenger'
  /** Se true, o valor é uma chave i18n dentro de comparison. */
  isKeyPremium?: boolean
  isKeyPro?: boolean
  isKeyDonor?: boolean
}

const COMPARISON: CompRow[] = [
  { labelKey: 'row_saved',     free: '1',  donor: '5',  premium: '∞', pro: '∞' },
  { labelKey: 'row_history',   free: '20', donor: '20', premium: '∞', pro: '∞' },
  { labelKey: 'row_reco',      free: '1',  donor: '2',  premium: 'row_reco_premium', pro: 'row_reco_pro', isKeyPremium: true, isKeyPro: true },
  { labelKey: 'row_chat',      free: '—',  donor: '—',  premium: '✓', pro: '✓' },
  { labelKey: 'row_tactical',  free: '—',  donor: '—',  premium: '✓', pro: '✓' },
  { labelKey: 'row_timeline',  free: '—',  donor: '—',  premium: '✓', pro: '✓' },
  { labelKey: 'row_coaching',  free: '—',  donor: '—',  premium: '—', pro: '✓' },
  { labelKey: 'row_api',       free: '—',  donor: '—',  premium: '—', pro: '✓' },
  { labelKey: 'row_dashboard', free: '—',  donor: '—',  premium: '—', pro: '✓' },
  { labelKey: 'row_badge',     free: '—',  donor: 'badge_donor', premium: 'badge_master', pro: 'badge_challenger', isKeyDonor: true, isKeyPremium: true, isKeyPro: true },
]

const FAQ_COUNT = 5

// ── Page ────────────────────────────────────────────────────────
export default function PricingPage() {
  const t = useTranslations('pricing')
  const locale = useLocale() as Locale
  const [period, setPeriod] = useState<'monthly' | 'yearly'>('monthly')
  const [coupons, setCoupons] = useState<Coupon[]>([])

  useEffect(() => {
    apiFetch('/api/v1/coupons/public')
      .then((r) => (r.ok ? r.json() : []))
      .then(setCoupons)
      .catch(() => setCoupons([]))
  }, [])

  function formatCouponDate(iso: string): string {
    try {
      const d = new Date(iso)
      return d.toLocaleDateString(locale === 'pt' ? 'pt-BR' : 'en-US', { day: '2-digit', month: 'long' })
    } catch {
      return iso
    }
  }

  return (
    <div className="metis-scope" style={{ minHeight: '100vh', background: 'var(--m-bg)' }}>
      <AppHeader active="plans" />

      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '44px 28px 48px' }}>
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '4px 10px',
              borderRadius: 999,
              background: 'rgb(var(--m-accent-rgb) / 0.1)',
              border: '1px solid rgb(var(--m-accent-rgb) / 0.25)',
              color: 'var(--m-accent)',
              fontSize: 11,
              fontWeight: 600,
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
              marginBottom: 14,
            }}
          >
            <Icon name="sparkles" size={12} /> {t('eyebrow')}
          </div>
          <h1
            className="font-display"
            style={{ fontSize: 44, fontWeight: 700, letterSpacing: '-0.03em', marginBottom: 10 }}
          >
            {t('title_part1')} <span style={{ color: 'var(--m-accent)' }}>{t('title_highlight')}</span>
          </h1>
          <p style={{ fontSize: 15, color: 'var(--m-text-dim)', maxWidth: 540, margin: '0 auto' }}>
            {t('subtitle')}
          </p>

          <div
            style={{
              display: 'inline-flex',
              padding: 3,
              background: 'var(--m-surface)',
              border: '1px solid var(--m-border)',
              borderRadius: 999,
              marginTop: 22,
            }}
          >
            {[
              { v: 'monthly' as const, labelKey: 'period_monthly' as const, badge: null },
              { v: 'yearly' as const,  labelKey: 'period_yearly' as const,  badge: t('period_discount') },
            ].map((p) => {
              const active = period === p.v
              return (
                <button
                  key={p.v}
                  type="button"
                  onClick={() => setPeriod(p.v)}
                  style={{
                    padding: '7px 18px',
                    borderRadius: 999,
                    background: active ? 'var(--m-accent)' : 'transparent',
                    color: active ? '#1a1510' : 'var(--m-text-dim)',
                    border: 'none',
                    fontSize: 13,
                    fontWeight: 600,
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                  }}
                >
                  {t(p.labelKey)}
                  {p.badge && (
                    <span
                      style={{
                        padding: '1px 6px',
                        borderRadius: 999,
                        fontSize: 9,
                        fontWeight: 700,
                        background: active ? 'rgba(26,21,16,0.2)' : 'rgba(74,222,128,0.2)',
                        color: active ? '#1a1510' : 'var(--m-green)',
                      }}
                    >
                      {p.badge}
                    </span>
                  )}
                </button>
              )
            })}
          </div>
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
            gap: 14,
          }}
        >
          {PLANS.map((p) => {
            const yearly = (p.price * 12 * 0.8).toFixed(2)
            const displayPrice = p.price === 0 ? '0,00' : (period === 'monthly' ? p.price.toFixed(2) : yearly)
            const displayLabel = !p.isPaid
              ? t('price_free')
              : (period === 'monthly' ? t('price_monthly') : t('price_yearly'))
            const actionLabel = t(`plans.${p.id}.action`)

            return (
              <div
                key={p.tier}
                style={{
                  position: 'relative',
                  padding: p.popular ? 28 : 22,
                  background: 'var(--m-surface)',
                  border: `1px solid ${p.popular ? p.color : 'var(--m-border)'}`,
                  borderRadius: 16,
                  boxShadow: p.popular
                    ? `0 0 0 1px ${p.color}40, 0 30px 60px -20px ${p.color}55`
                    : 'none',
                  overflow: 'visible',
                  display: 'flex',
                  flexDirection: 'column',
                }}
              >
                {p.popular && (
                  <div
                    style={{
                      position: 'absolute',
                      top: -11,
                      left: '50%',
                      transform: 'translateX(-50%)',
                      padding: '4px 12px',
                      background: p.color,
                      borderRadius: 999,
                      fontSize: 10,
                      fontWeight: 700,
                      color: '#1a1510',
                      letterSpacing: '0.06em',
                      textTransform: 'uppercase',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {t('popular_badge')}
                  </div>
                )}

                <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 14 }}>
                  <div
                    style={{
                      width: 68,
                      height: 68,
                      borderRadius: '50%',
                      background: `radial-gradient(circle at 30% 30%, ${p.color}, ${p.color}50 60%, transparent)`,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <div
                      style={{
                        width: 44,
                        height: 44,
                        borderRadius: '50%',
                        background: 'var(--m-bg)',
                        border: `2px solid ${p.color}`,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: 22,
                        color: p.color,
                      }}
                    >
                      ◆
                    </div>
                  </div>
                </div>

                <div style={{ textAlign: 'center', marginBottom: 16 }}>
                  <h3 className="font-display" style={{ fontSize: 22, fontWeight: 700 }}>
                    {p.tier}
                  </h3>
                  <div
                    style={{
                      fontSize: 10,
                      color: p.color,
                      textTransform: 'uppercase',
                      letterSpacing: '0.14em',
                      fontWeight: 700,
                      marginTop: 3,
                    }}
                  >
                    {p.rank}
                  </div>
                </div>

                <div style={{ textAlign: 'center', marginBottom: 18 }}>
                  <div style={{ display: 'inline-flex', alignItems: 'baseline', gap: 2 }}>
                    <span style={{ fontSize: 14, color: 'var(--m-text-dim)', fontWeight: 500 }}>{t('currency')}</span>
                    <span
                      className="tabular font-display"
                      style={{ fontSize: 36, fontWeight: 700, letterSpacing: '-0.02em' }}
                    >
                      {displayPrice}
                    </span>
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--m-text-dim)', marginTop: 2 }}>
                    {displayLabel}
                  </div>
                </div>

                <button
                  className={p.actionVariant === 'filled' ? 'm-hover-accent' : 'm-hover-surface'}
                  style={{
                    width: '100%',
                    padding: '11px 14px',
                    borderRadius: 10,
                    background:
                      p.actionVariant === 'muted'
                        ? 'var(--m-surface-2)'
                        : `linear-gradient(135deg, ${p.color}, ${p.color}cc)`,
                    color: p.actionVariant === 'muted' ? 'var(--m-text-dim)' : '#0B0D12',
                    border:
                      p.actionVariant === 'muted'
                        ? '1px solid var(--m-border-2)'
                        : 'none',
                    fontSize: 13,
                    fontWeight: 600,
                    marginBottom: 18,
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                  }}
                >
                  {actionLabel}
                </button>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {Array.from({ length: p.featureCount }, (_, i) => {
                    const on = i < p.featuresOn
                    const text = t(`plans.${p.id}.feature_${i}` as 'plans.free.feature_0')
                    return (
                      <div
                        key={i}
                        style={{
                          display: 'flex',
                          alignItems: 'flex-start',
                          gap: 8,
                          opacity: on ? 1 : 0.4,
                        }}
                      >
                        <div
                          style={{
                            flexShrink: 0,
                            width: 14,
                            height: 14,
                            marginTop: 2,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                        >
                          {on ? (
                            <Icon name="check" size={12} style={{ color: p.color }} strokeWidth={2.5} />
                          ) : (
                            <Icon name="x" size={12} style={{ color: 'var(--m-muted)' }} strokeWidth={2} />
                          )}
                        </div>
                        <span
                          style={{
                            fontSize: 11,
                            color: on ? 'var(--m-text)' : 'var(--m-muted)',
                            lineHeight: 1.45,
                          }}
                        >
                          {text}
                        </span>
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>

        {coupons.length > 0 && (
          <Card style={{ marginTop: 32 }}>
            <SectionLabel icon="sparkles">{t('coupons_title')}</SectionLabel>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
                gap: 12,
                marginTop: 4,
              }}
            >
              {coupons.map((c, idx) => {
                const remaining = c.max_uses !== null ? c.max_uses - c.uses_count : null
                return (
                  <div
                    key={`${c.title}-${idx}`}
                    style={{
                      padding: 16,
                      background: 'var(--m-bg)',
                      border: '1px solid rgb(var(--m-accent-rgb) / 0.35)',
                      borderRadius: 12,
                      position: 'relative',
                      overflow: 'hidden',
                    }}
                  >
                    <div
                      style={{
                        position: 'absolute',
                        top: -20,
                        right: -20,
                        width: 80,
                        height: 80,
                        borderRadius: '50%',
                        background: 'radial-gradient(circle, rgb(var(--m-accent-rgb) / 0.25), transparent 70%)',
                        pointerEvents: 'none',
                      }}
                    />
                    <div
                      style={{
                        position: 'relative',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 10,
                        marginBottom: 10,
                      }}
                    >
                      <div
                        style={{
                          width: 32,
                          height: 32,
                          borderRadius: 8,
                          background: 'rgb(var(--m-accent-rgb) / 0.15)',
                          color: 'var(--m-accent)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          flexShrink: 0,
                        }}
                      >
                        <Icon name="medal" size={16} />
                      </div>
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--m-text)' }}>
                          {c.title}
                        </div>
                        <div
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 6,
                            marginTop: 4,
                          }}
                        >
                          <code
                            className="font-mono"
                            title={t('coupons_code_tooltip')}
                            style={{
                              display: 'inline-block',
                              padding: '1px 8px',
                              background: 'var(--m-surface-2)',
                              border: '1px dashed var(--m-border-2)',
                              borderRadius: 4,
                              fontSize: 11,
                              color: 'var(--m-muted)',
                              letterSpacing: '0.18em',
                              userSelect: 'none',
                            }}
                          >
                            ? ? ? ? ? ? ?
                          </code>
                          <span style={{ fontSize: 10, color: 'var(--m-accent)', fontStyle: 'italic' }}>
                            {t('coupons_discover')}
                          </span>
                        </div>
                      </div>
                    </div>
                    {c.description && (
                      <p
                        style={{
                          position: 'relative',
                          fontSize: 12,
                          color: 'var(--m-text-dim)',
                          lineHeight: 1.5,
                          marginBottom: 10,
                        }}
                      >
                        {c.description}
                      </p>
                    )}
                    <div
                      style={{
                        position: 'relative',
                        display: 'flex',
                        gap: 14,
                        fontSize: 11,
                        color: 'var(--m-muted)',
                        paddingTop: 8,
                        borderTop: '1px solid var(--m-border)',
                      }}
                    >
                      <span>
                        <Icon
                          name="clock"
                          size={11}
                          style={{ display: 'inline', marginRight: 4, verticalAlign: -1 }}
                        />
                        {t('coupons_valid_until', { date: formatCouponDate(c.valid_until) })}
                      </span>
                      {remaining !== null && (
                        <span style={{ marginLeft: 'auto' }}>{t('coupons_remaining', { n: remaining })}</span>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </Card>
        )}

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
            gap: 14,
            marginTop: 32,
          }}
        >
          {([
            { ico: 'shield' as const, titleKey: 'trust.cancel_title' as const,  descKey: 'trust.cancel_desc' as const },
            { ico: 'bolt' as const,   titleKey: 'trust.instant_title' as const, descKey: 'trust.instant_desc' as const },
            { ico: 'brain' as const,  titleKey: 'trust.ai_title' as const,      descKey: 'trust.ai_desc' as const },
          ]).map((x, i) => (
            <div
              key={i}
              style={{
                display: 'flex',
                gap: 12,
                alignItems: 'flex-start',
                padding: 16,
                background: 'var(--m-surface)',
                border: '1px solid var(--m-border)',
                borderRadius: 12,
              }}
            >
              <div
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 8,
                  background: 'rgb(var(--m-accent-rgb) / 0.1)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--m-accent)',
                  flexShrink: 0,
                }}
              >
                <Icon name={x.ico} size={16} />
              </div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600 }}>{t(x.titleKey)}</div>
                <div style={{ fontSize: 11, color: 'var(--m-text-dim)', marginTop: 3 }}>{t(x.descKey)}</div>
              </div>
            </div>
          ))}
        </div>

        <div style={{ marginTop: 48, maxWidth: 900, marginLeft: 'auto', marginRight: 'auto' }}>
          <h2
            className="font-display"
            style={{ fontSize: 24, fontWeight: 700, textAlign: 'center', marginBottom: 20 }}
          >
            {t('comparison.title')}
          </h2>
          <Card pad={0}>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--m-border)' }}>
                    <th
                      style={{
                        padding: '12px 16px',
                        textAlign: 'left',
                        fontSize: 10,
                        color: 'var(--m-text-dim)',
                        textTransform: 'uppercase',
                        letterSpacing: '0.06em',
                        fontWeight: 600,
                      }}
                    >
                      {t('comparison.benefit_col')}
                    </th>
                    {PLANS.map((p) => (
                      <th
                        key={p.id}
                        style={{
                          padding: '12px 12px',
                          textAlign: 'center',
                          fontSize: 10,
                          color: p.color,
                          textTransform: 'uppercase',
                          letterSpacing: '0.06em',
                          fontWeight: 700,
                        }}
                      >
                        {p.tier}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {COMPARISON.map((row, i) => (
                    <tr
                      key={i}
                      style={{
                        borderBottom: '1px solid rgba(34,40,56,0.4)',
                        background: i % 2 ? 'rgba(11,13,18,0.3)' : 'transparent',
                      }}
                    >
                      <td style={{ padding: '10px 16px', fontSize: 12, color: 'var(--m-text)' }}>
                        {t(`comparison.${row.labelKey}`)}
                      </td>
                      <td style={{ padding: '10px 12px', textAlign: 'center', fontSize: 12, color: PLANS[0].color }}>
                        {row.free}
                      </td>
                      <td style={{ padding: '10px 12px', textAlign: 'center', fontSize: 12, color: PLANS[1].color }}>
                        {row.isKeyDonor ? t(`comparison.${row.donor}` as 'comparison.badge_donor') : row.donor}
                      </td>
                      <td style={{ padding: '10px 12px', textAlign: 'center', fontSize: 12, color: PLANS[2].color }}>
                        {row.isKeyPremium ? t(`comparison.${row.premium}` as 'comparison.badge_master') : row.premium}
                      </td>
                      <td style={{ padding: '10px 12px', textAlign: 'center', fontSize: 12, color: PLANS[3].color }}>
                        {row.isKeyPro ? t(`comparison.${row.pro}` as 'comparison.badge_challenger') : row.pro}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </div>

        <div style={{ marginTop: 48, maxWidth: 720, marginLeft: 'auto', marginRight: 'auto' }}>
          <h2
            className="font-display"
            style={{ fontSize: 24, fontWeight: 700, textAlign: 'center', marginBottom: 20 }}
          >
            {t('faq.title')}
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {Array.from({ length: FAQ_COUNT }, (_, i) => (
              <div
                key={i}
                style={{
                  padding: 16,
                  background: 'var(--m-surface)',
                  border: '1px solid var(--m-border)',
                  borderRadius: 12,
                }}
              >
                <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>
                  {t(`faq.q_${i}` as 'faq.q_0')}
                </h3>
                <p style={{ fontSize: 12, color: 'var(--m-text-dim)', lineHeight: 1.55 }}>
                  {t(`faq.a_${i}` as 'faq.a_0')}
                </p>
              </div>
            ))}
          </div>
        </div>

        <div style={{ marginTop: 60, maxWidth: 960, marginLeft: 'auto', marginRight: 'auto' }}>
          <div
            style={{
              position: 'relative',
              padding: '36px 40px',
              background:
                'linear-gradient(135deg, rgb(var(--m-accent-rgb) / 0.06), var(--m-surface) 50%, rgba(91,227,212,0.06))',
              border: '1px solid rgb(var(--m-accent-rgb) / 0.25)',
              borderRadius: 16,
              textAlign: 'center',
              overflow: 'hidden',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 10, marginBottom: 12 }}>
              <div
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: 8,
                  background: 'rgb(var(--m-accent-rgb) / 0.15)',
                  color: 'var(--m-accent)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Icon name="users" size={18} />
              </div>
              <h2 className="font-display" style={{ fontSize: 24, fontWeight: 700 }}>
                {t('enterprise.title')}
              </h2>
            </div>
            <p
              style={{
                fontSize: 13,
                color: 'var(--m-text-dim)',
                maxWidth: 560,
                margin: '0 auto 20px',
                lineHeight: 1.55,
              }}
            >
              {t('enterprise.desc_part1')}{' '}
              <span style={{ color: 'var(--m-accent)', fontWeight: 600 }}>{t('enterprise.desc_highlight')}</span>{' '}
              {t('enterprise.desc_part2')}
            </p>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
                gap: 10,
                maxWidth: 560,
                margin: '0 auto 24px',
              }}
            >
              {([
                { bigKey: 'enterprise.card_analytics_big' as const, subKey: 'enterprise.card_analytics_sub' as const, color: 'var(--m-accent)' },
                { bigKey: 'enterprise.card_scouting_big' as const,  subKey: 'enterprise.card_scouting_sub' as const,  color: 'var(--m-cyan)' },
                { bigKey: 'enterprise.card_api_big' as const,       subKey: 'enterprise.card_api_sub' as const,       color: 'var(--m-violet)' },
              ]).map((x, i) => (
                <div
                  key={i}
                  style={{
                    padding: 14,
                    background: 'var(--m-bg)',
                    border: '1px solid var(--m-border)',
                    borderRadius: 10,
                  }}
                >
                  <div className="font-display" style={{ fontSize: 18, fontWeight: 700, color: x.color }}>
                    {t(x.bigKey)}
                  </div>
                  <div style={{ fontSize: 10, color: 'var(--m-text-dim)', marginTop: 4, lineHeight: 1.4 }}>
                    {t(x.subKey)}
                  </div>
                </div>
              ))}
            </div>

            <a
              href="mailto:contato@metis.gg"
              className="m-hover-accent"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                background: 'var(--m-accent)',
                color: '#1a1510',
                padding: '11px 22px',
                borderRadius: 10,
                fontSize: 13,
                fontWeight: 700,
                textDecoration: 'none',
              }}
            >
              <Icon name="send" size={14} />
              {t('enterprise.cta')}
            </a>

            <p style={{ fontSize: 10, color: 'var(--m-muted)', marginTop: 12 }}>
              {t('enterprise.footnote')}
            </p>
          </div>
        </div>

        <p style={{ textAlign: 'center', fontSize: 11, color: 'var(--m-muted)', marginTop: 36 }}>
          {t('bottom_note')}
        </p>
      </div>
    </div>
  )
}
