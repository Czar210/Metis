/**
 * AppHeader — nav bar do redesign, dark + accent gold.
 *
 * Auto-descobre o estado de auth via Supabase. Quando deslogado, mostra um
 * botão "Entrar" no lugar do avatar. Quando logado, mostra a inicial do email.
 */

'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
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
  const router = useRouter()
  const [userEmail, setUserEmail] = useState<string | null | undefined>(undefined)
  const [isAdmin, setIsAdmin] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [signingOut, setSigningOut] = useState(false)
  const menuRef = useRef<HTMLDivElement | null>(null)

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

  useEffect(() => {
    if (!menuOpen) return
    function onClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false)
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setMenuOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onClick)
      document.removeEventListener('keydown', onKey)
    }
  }, [menuOpen])

  async function handleSignOut() {
    if (signingOut) return
    setSigningOut(true)
    const supabase = createClient()
    await supabase.auth.signOut()
    setMenuOpen(false)
    setSigningOut(false)
    router.replace('/')
    router.refresh()
  }

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
          <div ref={menuRef} style={{ position: 'relative' }}>
            <button
              type="button"
              onClick={() => setMenuOpen((v) => !v)}
              aria-haspopup="menu"
              aria-expanded={menuOpen}
              aria-label={t('menu.open')}
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
                cursor: 'pointer',
                padding: 0,
                fontFamily: 'inherit',
              }}
            >
              {initial}
            </button>

            {menuOpen && (
              <div
                role="menu"
                style={{
                  position: 'absolute',
                  top: 'calc(100% + 8px)',
                  right: 0,
                  minWidth: 220,
                  background: 'var(--m-surface)',
                  border: '1px solid var(--m-border-2)',
                  borderRadius: 10,
                  boxShadow: '0 10px 30px rgba(0,0,0,0.35)',
                  padding: 6,
                  zIndex: 20,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 2,
                }}
              >
                <div
                  style={{
                    padding: '8px 10px 6px',
                    fontSize: 11,
                    color: 'var(--m-text-dim)',
                    borderBottom: '1px solid var(--m-border)',
                    marginBottom: 4,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {userEmail}
                </div>

                <Link
                  role="menuitem"
                  href="/account"
                  onClick={() => setMenuOpen(false)}
                  className="m-hover-surface"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    padding: '8px 10px',
                    borderRadius: 6,
                    fontSize: 13,
                    fontWeight: 500,
                    color: 'var(--m-text)',
                    textDecoration: 'none',
                  }}
                >
                  <Icon name="settings" size={14} />
                  {t('menu.account')}
                </Link>

                {isAdmin && (
                  <Link
                    role="menuitem"
                    href="/admin"
                    onClick={() => setMenuOpen(false)}
                    className="m-hover-surface"
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                      padding: '8px 10px',
                      borderRadius: 6,
                      fontSize: 13,
                      fontWeight: 500,
                      color: 'var(--m-accent)',
                      textDecoration: 'none',
                    }}
                  >
                    <Icon name="shield" size={14} />
                    {t('menu.admin_panel')}
                  </Link>
                )}

                <button
                  type="button"
                  role="menuitem"
                  onClick={handleSignOut}
                  disabled={signingOut}
                  className="m-hover-surface"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    padding: '8px 10px',
                    borderRadius: 6,
                    fontSize: 13,
                    fontWeight: 500,
                    color: 'var(--m-red)',
                    background: 'transparent',
                    border: 'none',
                    cursor: signingOut ? 'not-allowed' : 'pointer',
                    fontFamily: 'inherit',
                    textAlign: 'left',
                    opacity: signingOut ? 0.6 : 1,
                  }}
                >
                  <Icon name="logout" size={14} />
                  {signingOut ? t('menu.signing_out') : t('menu.sign_out')}
                </button>
              </div>
            )}
          </div>
        ) : (
          // Placeholder invisível enquanto carrega — evita layout shift
          <div style={{ width: 32, height: 32 }} />
        )}
      </div>
    </header>
  )
}
