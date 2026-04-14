'use client'

import { useState } from 'react'
import Image from 'next/image'
import { Check, X, Shield, Heart, Crown, Gem, Building2, Mail } from 'lucide-react'
import { Header } from '@/components/ui/Header'
import { emblemPath } from '@/lib/ddragon'

type Tier = {
  name: string
  rank: string
  price: string
  period: string
  icon: React.ReactNode
  emblem: string
  color: string
  textColor: string
  borderColor: string
  bgGlow: string
  btnClass: string
  popular?: boolean
  features: { text: string; included: boolean }[]
  cta: string
}

const TIERS: Tier[] = [
  {
    name: 'Free',
    rank: 'Silver',
    price: 'R$ 0',
    period: 'para sempre',
    icon: <Shield className="w-6 h-6" />,
    emblem: 'Silver',
    color: 'from-gray-400/10 to-gray-500/5',
    textColor: 'text-gray-300',
    borderColor: 'border-gray-400/30',
    bgGlow: '',
    btnClass: 'bg-gray-600 hover:bg-gray-500 text-white',
    features: [
      { text: 'Busca de jogadores ilimitada', included: true },
      { text: 'Historico de partidas (ultimas 20)', included: true },
      { text: 'Tier List com filtros', included: true },
      { text: 'Estatisticas de itens', included: true },
      { text: 'Pagina de campeao basica', included: true },
      { text: 'Metis Score nas partidas', included: true },
      { text: '1 jogador salvo em supervisao', included: true },
      { text: '1 recomendacao por lane', included: true },
      { text: 'Chat com IA Metis', included: false },
      { text: 'Badge no perfil', included: false },
    ],
    cta: 'Plano atual',
  },
  {
    name: 'Doador',
    rank: 'Emerald',
    price: 'R$ 4,90',
    period: '/mes',
    icon: <Heart className="w-6 h-6" />,
    emblem: 'Emerald',
    color: 'from-emerald-500/10 to-emerald-600/5',
    textColor: 'text-emerald-400',
    borderColor: 'border-emerald-500/30',
    bgGlow: 'shadow-emerald-500/5',
    btnClass: 'bg-emerald-600 hover:bg-emerald-500 text-white',
    features: [
      { text: 'Tudo do Free', included: true },
      { text: '5 jogadores salvos em supervisao', included: true },
      { text: '2 recomendacoes por lane', included: true },
      { text: 'Badge de Doador no perfil', included: true },
      { text: 'Apoio direto ao desenvolvimento', included: true },
      { text: 'Chat com IA Metis', included: false },
      { text: 'Analise tatica por partida', included: false },
      { text: 'Timeline interativa', included: false },
      { text: 'Filtros avancados de build', included: false },
      { text: 'Coaching IA', included: false },
    ],
    cta: 'Apoiar o projeto',
  },
  {
    name: 'Premium',
    rank: 'Master',
    price: 'R$ 24,90',
    period: '/mes',
    icon: <Crown className="w-6 h-6" />,
    emblem: 'Master',
    color: 'from-purple-500/10 to-purple-600/5',
    textColor: 'text-purple-400',
    borderColor: 'border-purple-500/40',
    bgGlow: 'shadow-purple-500/10',
    btnClass: 'bg-purple-600 hover:bg-purple-500 text-white',
    popular: true,
    features: [
      { text: 'Tudo do Doador', included: true },
      { text: 'Chat com IA Metis ilimitado', included: true },
      { text: 'Recomendacoes completas (todas as roles)', included: true },
      { text: 'Analise tatica detalhada por partida', included: true },
      { text: 'Timeline interativa com mapa', included: true },
      { text: 'Filtros avancados de build por slot', included: true },
      { text: 'Badge Master no perfil', included: true },
      { text: 'Jogadores salvos ilimitados', included: true },
      { text: 'Historico completo (sem limite)', included: true },
      { text: 'Prioridade no suporte', included: true },
    ],
    cta: 'Subir de Elo',
  },
  {
    name: 'Pro',
    rank: 'Challenger',
    price: 'R$ 44,90',
    period: '/mes',
    icon: <Gem className="w-6 h-6" />,
    emblem: 'Challenger',
    color: 'from-cyan-400/10 via-amber-400/5 to-cyan-500/10',
    textColor: 'text-cyan-400',
    borderColor: 'border-cyan-400/40',
    bgGlow: 'shadow-cyan-500/10',
    btnClass: 'bg-gradient-to-r from-cyan-500 to-amber-500 hover:from-cyan-400 hover:to-amber-400 text-black font-bold',
    features: [
      { text: 'Tudo do Premium', included: true },
      { text: 'Coaching IA personalizado por sessao', included: true },
      { text: 'API de dados pessoais (exportar stats)', included: true },
      { text: 'Dashboard de evolucao temporal', included: true },
      { text: 'Comparacao com jogadores do seu elo', included: true },
      { text: 'Alertas de meta (campeoes OP no seu elo)', included: true },
      { text: 'Badge Challenger exclusiva no perfil', included: true },
      { text: 'Acesso antecipado a features novas', included: true },
      { text: 'Suporte direto com a equipe', included: true },
      { text: 'Analise de replays com IA', included: true },
    ],
    cta: 'Virar Challenger',
  },
]

export default function PricingPage() {
  const [annual, setAnnual] = useState(false)

  return (
    <div className="min-h-screen bg-metis-bg text-metis-text">
      <Header />

      <main className="max-w-7xl mx-auto px-4 py-12">
        {/* Hero */}
        <div className="text-center mb-12">
          <h1 className="text-3xl font-bold text-metis-text mb-3">
            Suba de Elo no Metis
          </h1>
          <p className="text-metis-text-dim text-sm max-w-lg mx-auto">
            Comece no Prata e evolua ate Challenger. Cada tier desbloqueia ferramentas mais poderosas.
          </p>

          {/* Toggle anual/mensal */}
          <div className="flex items-center justify-center gap-3 mt-6">
            <span className={`text-sm ${!annual ? 'text-metis-text' : 'text-metis-text-dim'}`}>Mensal</span>
            <button
              onClick={() => setAnnual(!annual)}
              className={`relative w-12 h-6 rounded-full transition-colors ${annual ? 'bg-metis-accent' : 'bg-metis-border'}`}
            >
              <div className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition-transform ${annual ? 'translate-x-6' : 'translate-x-0.5'}`} />
            </button>
            <span className={`text-sm ${annual ? 'text-metis-text' : 'text-metis-text-dim'}`}>
              Anual <span className="text-green-400 text-xs font-semibold">-20%</span>
            </span>
          </div>
        </div>

        {/* Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {TIERS.map(tier => {
            const price = annual && tier.price !== 'R$ 0'
              ? `R$ ${(parseFloat(tier.price.replace('R$ ', '').replace(',', '.')) * 0.8).toFixed(2).replace('.', ',')}`
              : tier.price

            return (
              <div
                key={tier.name}
                className={`relative rounded-2xl border ${tier.borderColor} bg-gradient-to-b ${tier.color} p-5 flex flex-col transition-all duration-300 hover:scale-[1.03] ${tier.bgGlow} ${
                  tier.popular ? 'ring-2 ring-purple-500/40' : ''
                }`}
              >
                {/* Badge popular */}
                {tier.popular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-purple-500 text-white text-[10px] font-bold px-3 py-0.5 rounded-full uppercase tracking-wider">
                    Mais popular
                  </div>
                )}

                {/* Emblema de elo */}
                <div className="flex justify-center mb-3">
                  <div className="w-16 h-14 relative overflow-hidden">
                    <Image
                      src={emblemPath(tier.emblem)}
                      alt={tier.rank}
                      width={200}
                      height={200}
                      unoptimized
                      className="absolute top-1/2 left-1/2"
                      style={{ transform: 'translate(-50%, -45%) scale(4.5)' }}
                    />
                  </div>
                </div>

                {/* Nome + rank */}
                <div className="text-center mb-4">
                  <h2 className={`text-lg font-bold ${tier.textColor}`}>{tier.name}</h2>
                  <p className="text-[10px] text-metis-text-dim uppercase tracking-widest">{tier.rank}</p>
                </div>

                {/* Preco */}
                <div className="text-center mb-5">
                  <span className="text-2xl font-bold text-metis-text">{price}</span>
                  <span className="text-xs text-metis-text-dim ml-1">{tier.period}</span>
                </div>

                {/* CTA */}
                <button className={`w-full py-2.5 rounded-xl text-sm font-semibold transition-all mb-5 ${tier.btnClass}`}>
                  {tier.cta}
                </button>

                {/* Features */}
                <ul className="flex-1 space-y-2">
                  {tier.features.map((f, i) => (
                    <li key={i} className="flex items-start gap-2">
                      {f.included ? (
                        <Check className={`w-3.5 h-3.5 flex-shrink-0 mt-0.5 ${tier.textColor}`} />
                      ) : (
                        <X className="w-3.5 h-3.5 flex-shrink-0 mt-0.5 text-metis-muted/50" />
                      )}
                      <span className={`text-xs ${f.included ? 'text-metis-text' : 'text-metis-muted/50'}`}>
                        {f.text}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )
          })}
        </div>

        {/* Comparativo rapido */}
        <div className="mt-16 max-w-4xl mx-auto">
          <h2 className="text-xl font-bold text-metis-text text-center mb-8">Comparativo de beneficios</h2>
          <div className="bg-metis-surface border border-metis-border rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-metis-border">
                  <th className="px-4 py-3 text-left text-xs text-metis-text-dim uppercase">Beneficio</th>
                  <th className="px-3 py-3 text-center text-xs text-gray-300 uppercase">Free</th>
                  <th className="px-3 py-3 text-center text-xs text-emerald-400 uppercase">Doador</th>
                  <th className="px-3 py-3 text-center text-xs text-purple-400 uppercase">Premium</th>
                  <th className="px-3 py-3 text-center text-xs text-cyan-400 uppercase">Pro</th>
                </tr>
              </thead>
              <tbody>
                {[
                  { name: 'Jogadores salvos', free: '1', donor: '5', premium: '∞', pro: '∞' },
                  { name: 'Historico de partidas', free: '20', donor: '20', premium: '∞', pro: '∞' },
                  { name: 'Recomendacoes por lane', free: '1', donor: '2', premium: '∞ + reasons', pro: '∞ + reasons' },
                  { name: 'Chat com IA Metis', free: '—', donor: '—', premium: '✓', pro: '✓' },
                  { name: 'Analise tatica', free: '—', donor: '—', premium: '✓', pro: '✓' },
                  { name: 'Timeline interativa', free: '—', donor: '—', premium: '✓', pro: '✓' },
                  { name: 'Coaching IA', free: '—', donor: '—', premium: '—', pro: '✓' },
                  { name: 'API de dados', free: '—', donor: '—', premium: '—', pro: '✓' },
                  { name: 'Dashboard evolucao', free: '—', donor: '—', premium: '—', pro: '✓' },
                  { name: 'Badge no perfil', free: '—', donor: 'Doador', premium: 'Master', pro: 'Challenger' },
                ].map((row, i) => (
                  <tr key={i} className={`border-b border-metis-border/50 ${i % 2 ? 'bg-metis-bg/20' : ''}`}>
                    <td className="px-4 py-2.5 text-xs text-metis-text">{row.name}</td>
                    <td className="px-3 py-2.5 text-center text-xs text-metis-text-dim">{row.free}</td>
                    <td className="px-3 py-2.5 text-center text-xs text-emerald-400">{row.donor}</td>
                    <td className="px-3 py-2.5 text-center text-xs text-purple-400">{row.premium}</td>
                    <td className="px-3 py-2.5 text-center text-xs text-cyan-400">{row.pro}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* FAQ */}
        <div className="mt-16 max-w-2xl mx-auto">
          <h2 className="text-xl font-bold text-metis-text text-center mb-8">Perguntas frequentes</h2>
          <div className="space-y-4">
            {[
              { q: 'Posso cancelar a qualquer momento?', a: 'Sim! Sem multa, sem burocracia. Cancele direto no painel da sua conta.' },
              { q: 'O que acontece se eu cancelar?', a: 'Voce volta pro plano Free. Seus dados nao sao apagados, so os beneficios premium param.' },
              { q: 'Como funciona o Chat com IA?', a: 'A Metis analisa seus dados de partida e responde perguntas taticas usando Gemini + RAG com dados reais do jogo.' },
              { q: 'Aceita PIX?', a: 'Sim! Aceitamos PIX, cartao de credito e boleto.' },
              { q: 'O Doador ajuda em que?', a: 'Ajuda a manter os servidores rodando e o desenvolvimento ativo. Voce ganha beneficios extras como agradecimento.' },
            ].map((faq, i) => (
              <div key={i} className="bg-metis-surface border border-metis-border rounded-xl p-4">
                <h3 className="text-sm font-semibold text-metis-text mb-1">{faq.q}</h3>
                <p className="text-sm text-metis-text-dim">{faq.a}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Empresas / Times */}
        <div className="mt-20 max-w-4xl mx-auto">
          <div className="relative rounded-2xl border border-amber-500/30 bg-gradient-to-br from-amber-500/5 via-metis-surface to-cyan-500/5 p-10 text-center overflow-hidden">
            {/* Glow */}
            <div className="absolute inset-0 bg-gradient-to-r from-amber-500/5 via-transparent to-cyan-500/5 pointer-events-none" />

            <div className="relative z-10">
              <div className="flex items-center justify-center gap-2 mb-4">
                <Building2 className="w-7 h-7 text-amber-400" />
                <h2 className="text-2xl font-bold text-metis-text">Para Times e Empresas</h2>
              </div>

              <p className="text-metis-text-dim text-sm max-w-xl mx-auto mb-6 leading-relaxed">
                Seu time pode contratar nosso servico. Entre em contato, peca modificacoes,
                e criaremos sua <span className="text-amber-400 font-semibold">ferramenta propria</span> pra
                voce poder analisar todos os seus jogadores na velocidade da luz.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8 max-w-lg mx-auto">
                <div className="bg-metis-bg/50 rounded-xl p-4 border border-metis-border/50">
                  <p className="text-2xl font-bold text-amber-400 mb-1">Analytics</p>
                  <p className="text-[10px] text-metis-text-dim">Dashboard personalizado pra seu time inteiro</p>
                </div>
                <div className="bg-metis-bg/50 rounded-xl p-4 border border-metis-border/50">
                  <p className="text-2xl font-bold text-cyan-400 mb-1">Scouting</p>
                  <p className="text-[10px] text-metis-text-dim">Encontre e analise talentos automaticamente</p>
                </div>
                <div className="bg-metis-bg/50 rounded-xl p-4 border border-metis-border/50">
                  <p className="text-2xl font-bold text-purple-400 mb-1">API</p>
                  <p className="text-[10px] text-metis-text-dim">Integre dados do Metis nos seus sistemas</p>
                </div>
              </div>

              <a
                href="mailto:contato@metis.gg"
                className="inline-flex items-center gap-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-black font-bold px-8 py-3 rounded-xl text-sm transition-all"
              >
                <Mail className="w-4 h-4" />
                Fale com a gente
              </a>

              <p className="text-[11px] text-metis-muted mt-4">
                Planos empresariais com precos sob consulta. Aceitamos contratos mensais ou anuais.
              </p>
            </div>
          </div>
        </div>

        <p className="text-center text-xs text-metis-muted mt-12">
          Precos em reais brasileiros (BRL). Planos anuais cobrados em parcela unica com 20% de desconto.
        </p>
      </main>
    </div>
  )
}
