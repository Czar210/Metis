/**
 * AppHeader — nav bar do redesign, dark + accent gold.
 *
 * Auto-descobre o estado de auth via Supabase. Quando deslogado, mostra um
 * botão "Entrar" no lugar do avatar. Quando logado, mostra a inicial do email.
 */

'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { createClient } from '@/lib/supabase/client'
import { ThemeSwitcher } from '@/components/ui/ThemeSwitcher'
import { Icon, type IconName } from './Icon'
import { Logo } from './Logo'
import { LangSwitcher } from './LangSwitcher'

type NavId = 'home' | 'tierlist' | 'items' | 'plans' | 'team' | 'changelog'

type NavItem = {
  id: NavId
  labelKey: 'home' | 'tierlist' | 'items' | 'plans' | 'team'
  icon: IconName
  href: string
}

const NAV: NavItem[] = [
  { id: 'home',     labelKey: 'home',     icon: 'home',   href: '/' },
  { id: 'tierlist', labelKey: 'tierlist', icon: 'list',   href: '/champions' },
  { id: 'items',    labelKey: 'items',    icon: 'sword',  href: '/items' },
  { id: 'plans',    labelKey: 'plans',    icon: 'dollar', href: '/pricing' },
  { id: 'team',     labelKey: 'team',     icon: 'users',  href: '/team' },
]

type Props = {
  active?: NavId
  compact?: boolean
}

export function AppHeader({ active = 'home', compact = false }: Props) {
  const t = useTranslations('header')
  const [userEmail, setUserEmail] = useState<string | null | undefined>(undefined)
  const [isAdmin, setIsAdmin] = useState(false)

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data: { user } }) => {
      setUserEmail(user?.email ?? null)
      setIsAdmin(user?.app_metadata?.is_admin === true)
    })

    const { data: subscription } = supabase.auth.onAuthStateChange((_event, session) => {
      setUserEmail(session?.user?.email ?? null)
      setIsAdmin(session?.user?.app_metadata?.is_admin === true)
    })
    return () => {
      subscription.subscription.unsubscribe()
    }
  }, [])

  const initial = userEmail ? userEmail.charAt(0).toUpperCase() : null

  return (
    <header
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: compact ? '10px 20px' : '14px 28px',
        borderBottom: '1px solid var(--m-border)',
        background: 'var(--m-surface)',
        position: 'sticky',
        top: 0,
        zIndex: 10,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 28 }}>
        <Logo />
        <nav style={{ display: 'flex', gap: 4 }}>
          {NAV.map((n) => {
            const isActive = active === n.id
            return (
              <Link
                key={n.id}
                href={n.href}
                className="m-hover-surface"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '6px 10px',
                  borderRadius: 8,
                  fontSize: 13,
                  fontWeight: 500,
                  textDecoration: 'none',
                  color: isActive ? 'var(--m-accent)' : 'var(--m-text-dim)',
                  background: isActive ? 'rgb(var(--m-accent-rgb) / 0.08)' : 'transparent',
                  border: '1px solid transparent',
                }}
              >
                <Icon name={n.icon} size={14} />
                {t(`nav.${n.labelKey}`)}
              </Link>
            )
          })}
        </nav>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
        <ThemeSwitcher />

        <div style={{ width: 1, height: 18, background: 'var(--m-border)' }} />

        <Link
          href="/chat"
          className="m-hover-accent"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            background: 'var(--m-accent)',
            border: 'none',
            color: '#1a1510',
            padding: '7px 14px',
            borderRadius: 8,
            fontSize: 13,
            fontWeight: 600,
            textDecoration: 'none',
          }}
        >
          <Icon name="messageCircle" size={14} />
          {t('chat_metis')}
        </Link>

        <LangSwitcher />

        {/* Auth state: botão Entrar quando deslogado, avatar quando logado.
            `undefined` = ainda carregando → render nada pra evitar flash. */}
        {userEmail === null ? (
          <Link
            href="/auth"
            className="m-hover-outline"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '7px 12px',
              borderRadius: 8,
              background: 'transparent',
              border: '1px solid var(--m-border-2)',
              color: 'var(--m-text)',
              fontSize: 13,
              fontWeight: 500,
              textDecoration: 'none',
            }}
          >
            {t('sign_in')}
            <Icon name="arrowRight" size={12} />
          </Link>
        ) : initial ? (
          <Link
            href={isAdmin ? '/admin' : '/'}
            title={isAdmin ? `${userEmail} · ${t('admin_badge')}` : (userEmail ?? t('my_account'))}
            className="m-hover-surface"
            style={{
              width: 32,
              height: 32,
              borderRadius: '50%',
              background: 'var(--m-surface-2)',
              border: `1px solid ${isAdmin ? 'rgb(var(--m-accent-rgb) / 0.5)' : 'var(--m-border-2)'}`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 12,
              fontWeight: 700,
              color: isAdmin ? 'var(--m-accent)' : 'var(--m-text)',
              textDecoration: 'none',
            }}
          >
            {initial}
          </Link>
        ) : (
          // Placeholder invisível enquanto carrega — evita layout shift
          <div style={{ width: 32, height: 32 }} />
        )}
      </div>
    </header>
  )
}
