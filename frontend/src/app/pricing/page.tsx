'use client'

import { useEffect, useState } from 'react'
import { apiFetch } from '@/lib/api'
import {
  AppHeader,
  Card,
  SectionLabel,
  Icon,
} from '@/components/design'

// ── Types ───────────────────────────────────────────────────────
type PlanAction = {
  label: string
  variant: 'muted' | 'filled'
}

type Plan = {
  tier: string
  rank: string
  color: string       // cor do accent do tier (hex)
  price: number       // valor mensal em BRL
  priceLabel: string  // sufixo ('para sempre' ou '/mês' / '/ano')
  action: PlanAction
  popular?: boolean
  features: { on: boolean; t: string }[]
}

type Coupon = {
  // `code` não vem do endpoint público — easter egg.
  title: string
  description: string | null
  effect: Record<string, unknown>
  valid_until: string
  max_uses: number | null
  uses_count: number
}

// ── Data ────────────────────────────────────────────────────────
const PLANS: Plan[] = [
  {
    tier: 'Free',
    rank: 'SILVER',
    color: '#B4C0CF',
    price: 0,
    priceLabel: 'para sempre',
    action: { label: 'Plano atual', variant: 'muted' },
    features: [
      { on: true,  t: 'Busca de jogadores ilimitada' },
      { on: true,  t: 'Histórico de partidas (últimas 20)' },
      { on: true,  t: 'Tier List com filtros' },
      { on: true,  t: 'Estatísticas de itens' },
      { on: true,  t: 'Página de campeão básica' },
      { on: true,  t: 'Metis Score nas partidas' },
      { on: true,  t: '1 jogador salvo em supervisão' },
      { on: true,  t: '1 recomendação por lane' },
      { on: false, t: 'Chat com IA Metis' },
      { on: false, t: 'Análise tática por partida' },
      { on: false, t: 'Filtros avançados de build' },
      { on: false, t: 'Badge no perfil' },
    ],
  },
  {
    tier: 'Doador',
    rank: 'EMERALD',
    color: '#44D19E',
    price: 4.9,
    priceLabel: '/mês',
    action: { label: 'Apoiar o projeto', variant: 'filled' },
    features: [
      { on: true,  t: 'Tudo do Free' },
      { on: true,  t: '5 jogadores salvos em supervisão' },
      { on: true,  t: '2 recomendações por lane' },
      { on: true,  t: 'Badge de Doador no perfil' },
      { on: true,  t: 'Apoio direto ao desenvolvimento' },
      { on: false, t: 'Chat com IA Metis' },
      { on: false, t: 'Análise tática por partida' },
      { on: false, t: 'Timeline interativa' },
      { on: false, t: 'Filtros avançados de build' },
      { on: false, t: 'Coaching IA' },
    ],
  },
  {
    tier: 'Premium',
    rank: 'MASTER',
    color: '#C581E6',
    price: 24.9,
    priceLabel: '/mês',
    action: { label: 'Subir de Elo', variant: 'filled' },
    popular: true,
    features: [
      { on: true, t: 'Tudo do Doador' },
      { on: true, t: 'Chat com IA Metis ilimitado' },
      { on: true, t: 'Recomendações completas (todas as roles)' },
      { on: true, t: 'Análise tática detalhada por partida' },
      { on: true, t: 'Timeline interativa com mapa' },
      { on: true, t: 'Filtros avançados de build por slot' },
      { on: true, t: 'Badge Master no perfil' },
      { on: true, t: 'Jogadores salvos ilimitados' },
      { on: true, t: 'Histórico completo (sem limite)' },
      { on: true, t: 'Prioridade no suporte' },
    ],
  },
  {
    tier: 'Pro',
    rank: 'CHALLENGER',
    color: '#66D7F0',
    price: 44.9,
    priceLabel: '/mês',
    action: { label: 'Virar Challenger', variant: 'filled' },
    features: [
      { on: true, t: 'Tudo do Premium' },
      { on: true, t: 'Coaching IA personalizado por sessão' },
      { on: true, t: 'API de dados pessoais (exportar stats)' },
      { on: true, t: 'Dashboard de evolução temporal' },
      { on: true, t: 'Comparação com jogadores do seu elo' },
      { on: true, t: 'Alertas de meta (campeões OP no seu elo)' },
      { on: true, t: 'Badge Challenger exclusiva no perfil' },
      { on: true, t: 'Acesso antecipado a features novas' },
      { on: true, t: 'Suporte direto com a equipe' },
      { on: true, t: 'Análise de replays com IA' },
    ],
  },
]

const COMPARISON = [
  { name: 'Jogadores salvos',     free: '1',  donor: '5',  premium: '∞',         pro: '∞' },
  { name: 'Histórico de partidas',free: '20', donor: '20', premium: '∞',         pro: '∞' },
  { name: 'Recomendações por lane',free: '1', donor: '2',  premium: '∞ + razões', pro: '∞ + razões' },
  { name: 'Chat com IA Metis',    free: '—',  donor: '—',  premium: '✓',         pro: '✓' },
  { name: 'Análise tática',       free: '—',  donor: '—',  premium: '✓',         pro: '✓' },
  { name: 'Timeline interativa',  free: '—',  donor: '—',  premium: '✓',         pro: '✓' },
  { name: 'Coaching IA',          free: '—',  donor: '—',  premium: '—',         pro: '✓' },
  { name: 'API de dados',         free: '—',  donor: '—',  premium: '—',         pro: '✓' },
  { name: 'Dashboard evolução',   free: '—',  donor: '—',  premium: '—',         pro: '✓' },
  { name: 'Badge no perfil',      free: '—',  donor: 'Doador', premium: 'Master', pro: 'Challenger' },
]

const FAQ = [
  { q: 'Posso cancelar a qualquer momento?', a: 'Sim, sem multa e sem burocracia. Cancele direto no painel da sua conta.' },
  { q: 'O que acontece se eu cancelar?',     a: 'Você volta pro plano Free. Seus dados não são apagados — só os benefícios premium param.' },
  { q: 'Como funciona o Chat com IA?',       a: 'A Metis analisa seus dados de partida e responde perguntas táticas usando Gemini 2.5 Flash com RAG sobre dados reais do jogo.' },
  { q: 'Aceita PIX?',                         a: 'Sim. Aceitamos PIX, cartão de crédito e boleto.' },
  { q: 'O Doador ajuda em quê?',              a: 'Ajuda a manter os servidores rodando e o desenvolvimento ativo. Você ganha benefícios extras como agradecimento.' },
]

// ── Helpers ─────────────────────────────────────────────────────
function formatCouponDate(iso: string): string {
  try {
    const d = new Date(iso)
    return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long' })
  } catch {
    return iso
  }
}

// ── Page ────────────────────────────────────────────────────────
export default function PricingPage() {
  const [period, setPeriod] = useState<'monthly' | 'yearly'>('monthly')
  const [coupons, setCoupons] = useState<Coupon[]>([])

  useEffect(() => {
    apiFetch('/api/v1/coupons/public')
      .then((r) => (r.ok ? r.json() : []))
      .then(setCoupons)
      .catch(() => setCoupons([]))
  }, [])

  return (
    <div className="metis-scope" style={{ minHeight: '100vh', background: 'var(--m-bg)' }}>
      <AppHeader active="plans" />

      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '44px 28px 48px' }}>
        {/* ══════════ Header ══════════ */}
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
            <Icon name="sparkles" size={12} /> Planos Metis
          </div>
          <h1
            className="font-display"
            style={{ fontSize: 44, fontWeight: 700, letterSpacing: '-0.03em', marginBottom: 10 }}
          >
            Suba de Elo no <span style={{ color: 'var(--m-accent)' }}>Metis</span>
          </h1>
          <p style={{ fontSize: 15, color: 'var(--m-text-dim)', maxWidth: 540, margin: '0 auto' }}>
            Comece no Prata e evolua até Challenger. Cada tier desbloqueia ferramentas mais poderosas.
          </p>

          {/* Period toggle */}
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
              { v: 'monthly' as const, l: 'Mensal' },
              { v: 'yearly' as const,  l: 'Anual', badge: '-20%' },
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
                  {p.l}
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

        {/* ══════════ 4 Tier cards ══════════ */}
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
            const displayLabel = p.price === 0 ? p.priceLabel : (period === 'monthly' ? '/mês' : '/ano')

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
                    Mais popular
                  </div>
                )}

                {/* Rank orb */}
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

                {/* Name + rank */}
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

                {/* Price */}
                <div style={{ textAlign: 'center', marginBottom: 18 }}>
                  <div style={{ display: 'inline-flex', alignItems: 'baseline', gap: 2 }}>
                    <span style={{ fontSize: 14, color: 'var(--m-text-dim)', fontWeight: 500 }}>R$</span>
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

                {/* CTA */}
                <button
                  className={p.action.variant === 'filled' ? 'm-hover-accent' : 'm-hover-surface'}
                  style={{
                    width: '100%',
                    padding: '11px 14px',
                    borderRadius: 10,
                    background:
                      p.action.variant === 'muted'
                        ? 'var(--m-surface-2)'
                        : `linear-gradient(135deg, ${p.color}, ${p.color}cc)`,
                    color: p.action.variant === 'muted' ? 'var(--m-text-dim)' : '#0B0D12',
                    border:
                      p.action.variant === 'muted'
                        ? '1px solid var(--m-border-2)'
                        : 'none',
                    fontSize: 13,
                    fontWeight: 600,
                    marginBottom: 18,
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                  }}
                >
                  {p.action.label}
                </button>

                {/* Features */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {p.features.map((f, i) => (
                    <div
                      key={i}
                      style={{
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: 8,
                        opacity: f.on ? 1 : 0.4,
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
                        {f.on ? (
                          <Icon name="check" size={12} style={{ color: p.color }} strokeWidth={2.5} />
                        ) : (
                          <Icon name="x" size={12} style={{ color: 'var(--m-muted)' }} strokeWidth={2} />
                        )}
                      </div>
                      <span
                        style={{
                          fontSize: 11,
                          color: f.on ? 'var(--m-text)' : 'var(--m-muted)',
                          lineHeight: 1.45,
                        }}
                      >
                        {f.t}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
        </div>

        {/* ══════════ Cupons (se houver) ══════════ */}
        {coupons.length > 0 && (
          <Card style={{ marginTop: 32 }}>
            <SectionLabel icon="sparkles">Cupons disponíveis</SectionLabel>
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
                            title="descubra o código pra resgatar"
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
                            descubra o código
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
                        válido até {formatCouponDate(c.valid_until)}
                      </span>
                      {remaining !== null && (
                        <span style={{ marginLeft: 'auto' }}>{remaining} restantes</span>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </Card>
        )}

        {/* ══════════ Footer de trust ══════════ */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
            gap: 14,
            marginTop: 32,
          }}
        >
          {[
            { ico: 'shield' as const, t: 'Cancele quando quiser', d: 'Sem taxas ocultas, sem contrato.' },
            { ico: 'bolt' as const,   t: 'Ativação imediata',     d: 'Features liberadas em segundos após o pagamento.' },
            { ico: 'brain' as const,  t: 'IA atualizada',          d: 'Gemini 2.5 Flash · treinada pra League.' },
          ].map((x, i) => (
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
                <div style={{ fontSize: 13, fontWeight: 600 }}>{x.t}</div>
                <div style={{ fontSize: 11, color: 'var(--m-text-dim)', marginTop: 3 }}>{x.d}</div>
              </div>
            </div>
          ))}
        </div>

        {/* ══════════ Comparativo tabular ══════════ */}
        <div style={{ marginTop: 48, maxWidth: 900, marginLeft: 'auto', marginRight: 'auto' }}>
          <h2
            className="font-display"
            style={{ fontSize: 24, fontWeight: 700, textAlign: 'center', marginBottom: 20 }}
          >
            Comparativo de benefícios
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
                      Benefício
                    </th>
                    {(['Free', 'Doador', 'Premium', 'Pro'] as const).map((n, i) => (
                      <th
                        key={n}
                        style={{
                          padding: '12px 12px',
                          textAlign: 'center',
                          fontSize: 10,
                          color: PLANS[i].color,
                          textTransform: 'uppercase',
                          letterSpacing: '0.06em',
                          fontWeight: 700,
                        }}
                      >
                        {n}
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
                        {row.name}
                      </td>
                      <td style={{ padding: '10px 12px', textAlign: 'center', fontSize: 12, color: PLANS[0].color }}>
                        {row.free}
                      </td>
                      <td style={{ padding: '10px 12px', textAlign: 'center', fontSize: 12, color: PLANS[1].color }}>
                        {row.donor}
                      </td>
                      <td style={{ padding: '10px 12px', textAlign: 'center', fontSize: 12, color: PLANS[2].color }}>
                        {row.premium}
                      </td>
                      <td style={{ padding: '10px 12px', textAlign: 'center', fontSize: 12, color: PLANS[3].color }}>
                        {row.pro}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </div>

        {/* ══════════ FAQ ══════════ */}
        <div style={{ marginTop: 48, maxWidth: 720, marginLeft: 'auto', marginRight: 'auto' }}>
          <h2
            className="font-display"
            style={{ fontSize: 24, fontWeight: 700, textAlign: 'center', marginBottom: 20 }}
          >
            Perguntas frequentes
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {FAQ.map((faq, i) => (
              <div
                key={i}
                style={{
                  padding: 16,
                  background: 'var(--m-surface)',
                  border: '1px solid var(--m-border)',
                  borderRadius: 12,
                }}
              >
                <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>{faq.q}</h3>
                <p style={{ fontSize: 12, color: 'var(--m-text-dim)', lineHeight: 1.55 }}>{faq.a}</p>
              </div>
            ))}
          </div>
        </div>

        {/* ══════════ Times & Empresas ══════════ */}
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
                Para Times e Empresas
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
              Seu time pode contratar nosso serviço. Entre em contato, peça modificações, e criaremos sua{' '}
              <span style={{ color: 'var(--m-accent)', fontWeight: 600 }}>ferramenta própria</span> pra você poder analisar todos os seus jogadores em velocidade industrial.
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
              {[
                { big: 'Analytics', sub: 'Dashboard personalizado pro seu time inteiro', color: 'var(--m-accent)' },
                { big: 'Scouting',  sub: 'Encontre e analise talentos automaticamente',   color: 'var(--m-cyan)' },
                { big: 'API',       sub: 'Integre dados do Metis nos seus sistemas',      color: 'var(--m-violet)' },
              ].map((x, i) => (
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
                    {x.big}
                  </div>
                  <div style={{ fontSize: 10, color: 'var(--m-text-dim)', marginTop: 4, lineHeight: 1.4 }}>
                    {x.sub}
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
              Fale com a gente
            </a>

            <p style={{ fontSize: 10, color: 'var(--m-muted)', marginTop: 12 }}>
              Planos empresariais com preços sob consulta. Contratos mensais ou anuais.
            </p>
          </div>
        </div>

        <p style={{ textAlign: 'center', fontSize: 11, color: 'var(--m-muted)', marginTop: 36 }}>
          Preços em reais brasileiros (BRL). Planos anuais cobrados em parcela única com 20% de desconto.
        </p>
      </div>
    </div>
  )
}
