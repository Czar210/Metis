'use client'

import Link from 'next/link'
import { ExternalLink } from 'lucide-react'
import { Header } from '@/components/ui/Header'

type Member = {
  name: string
  initials: string
  title: string
  company: string
  roleInMetis: string[]
  quote: string
  links: { label: string; href: string }[]
  color: {
    accent: string
    border: string
    bg: string
    badge: string
    text: string
    dot: string
  }
}

const TEAM: Member[] = [
  {
    name: 'César Sibila',
    initials: 'CS',
    title: 'Engenheiro de Dados',
    company: 'AI Engineer Jr @ Izii',
    roleInMetis: ['Tech Lead', 'Data Architect', 'CI/CD & Infra'],
    quote: 'Construo software como se fosse pra eu mesmo usar, e pra falar a verdade esse geralmente é o caso.',
    links: [
      { label: 'Portfólio', href: 'https://cesarsibila.vercel.app/' },
    ],
    color: {
      accent: '#D4A017',
      border: 'border-amber-500/40',
      bg: 'bg-amber-500/5',
      badge: 'bg-amber-500/15 text-amber-400 border border-amber-500/25',
      text: 'text-amber-400',
      dot: 'bg-amber-400',
    },
  },
  {
    name: 'Enzo Takida',
    initials: 'ET',
    title: 'Data Analytics',
    company: '',
    roleInMetis: ['Frontend & UX', 'Supabase Auth', 'Design System'],
    quote: '',
    links: [
      { label: 'LinkedIn', href: 'https://www.linkedin.com/in/enzo-kikuji-takida/' },
    ],
    color: {
      accent: '#DC2626',
      border: 'border-red-500/40',
      bg: 'bg-red-500/5',
      badge: 'bg-red-500/15 text-red-400 border border-red-500/25',
      text: 'text-red-400',
      dot: 'bg-red-400',
    },
  },
  {
    name: 'André Messina',
    initials: 'AM',
    title: 'Cientista de Dados Jr',
    company: 'Data Analytics @ Rappi',
    roleInMetis: ['Backend & AI Engineer', 'Arquitetura de Dados', 'Prompt Engineering'],
    quote: '',
    links: [
      { label: 'LinkedIn', href: 'https://www.linkedin.com/in/andre-messina-506179239/' },
    ],
    color: {
      accent: '#16A34A',
      border: 'border-green-500/40',
      bg: 'bg-green-500/5',
      badge: 'bg-green-500/15 text-green-400 border border-green-500/25',
      text: 'text-green-400',
      dot: 'bg-green-400',
    },
  },
]

export default function TeamPage() {
  return (
    <div className="min-h-screen bg-metis-bg text-metis-text">
      <Header />

      <main className="max-w-5xl mx-auto px-4 py-12">
        {/* Hero */}
        <div className="mb-12 text-center">
          <p className="text-xs font-medium text-metis-accent uppercase tracking-widest mb-3">// Equipe</p>
          <h1 className="text-3xl font-bold text-metis-text mb-3">Quem faz a Metis</h1>
          <p className="text-metis-text-dim text-sm max-w-md mx-auto">
            Três pessoas construindo algo que gostariam de ter tido quando estavam aprendendo o jogo.
          </p>
        </div>

        {/* Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {TEAM.map((member) => (
            <div
              key={member.name}
              className={`relative rounded-2xl border ${member.color.border} ${member.color.bg} p-6 flex flex-col gap-5 transition-all duration-300 hover:scale-[1.02]`}
            >
              {/* Glow sutil no topo */}
              <div
                className="absolute inset-x-0 top-0 h-px rounded-t-2xl opacity-60"
                style={{ background: `linear-gradient(to right, transparent, ${member.color.accent}, transparent)` }}
              />

              {/* Avatar + Nome */}
              <div className="flex items-center gap-3">
                <div
                  className="w-12 h-12 rounded-full flex items-center justify-center text-sm font-bold text-metis-bg flex-shrink-0"
                  style={{ backgroundColor: member.color.accent }}
                >
                  {member.initials}
                </div>
                <div>
                  <p className="font-semibold text-metis-text leading-tight">{member.name}</p>
                  <p className={`text-xs font-medium mt-0.5 ${member.color.text}`}>{member.title}</p>
                  {member.company && (
                    <p className="text-xs text-metis-text-dim">{member.company}</p>
                  )}
                </div>
              </div>

              {/* Roles no Metis */}
              <div className="flex flex-wrap gap-1.5">
                {member.roleInMetis.map((role) => (
                  <span key={role} className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${member.color.badge}`}>
                    {role}
                  </span>
                ))}
              </div>

              {/* Quote */}
              <div className="flex-1">
                {member.quote ? (
                  <blockquote className="text-sm text-metis-text-dim italic leading-relaxed border-l-2 pl-3" style={{ borderColor: member.color.accent }}>
                    "{member.quote}"
                  </blockquote>
                ) : (
                  <div className="h-12" />
                )}
              </div>

              {/* Links */}
              <div className="flex gap-2 pt-2 border-t border-metis-border/50">
                {member.links.map((link) => (
                  <a
                    key={link.label}
                    href={link.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border transition-colors font-medium ${member.color.badge} hover:opacity-80`}
                  >
                    {link.label}
                    <ExternalLink className="w-3 h-3" />
                  </a>
                ))}
              </div>
            </div>
          ))}
        </div>
      </main>
    </div>
  )
}
