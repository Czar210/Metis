'use client'

import { useState, type FormEvent, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { createClient } from '@/lib/supabase/client'
import { Icon, type IconName, Logo } from '@/components/design'

type Mode = 'login' | 'signup' | 'forgot'

export default function AuthPage() {
  const router = useRouter()
  const supabase = createClient()
  const t = useTranslations('auth')

  const [mode, setMode] = useState<Mode>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [signedUp, setSignedUp] = useState(false)
  const [forgotSent, setForgotSent] = useState(false)

  function switchMode(next: Mode) {
    setMode(next)
    setError(null)
    setPassword('')
    setConfirmPassword('')
    setForgotSent(false)
  }

  async function handleLogin(e: FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const resolvedEmail = email.trim() === 'admin' ? 'admin@metis.gg' : email.trim()
    const { error } = await supabase.auth.signInWithPassword({ email: resolvedEmail, password })

    if (error) {
      setError(error.message)
      setLoading(false)
      return
    }

    router.push('/')
    router.refresh()
  }

  async function handleSignup(e: FormEvent) {
    e.preventDefault()
    setError(null)

    if (password !== confirmPassword) {
      setError(t('error_passwords_mismatch'))
      return
    }
    if (password.length < 6) {
      setError(t('error_password_short'))
      return
    }

    setLoading(true)

    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
    })

    if (error) {
      setError(error.message)
      setLoading(false)
      return
    }

    setSignedUp(true)
    setLoading(false)
  }

  async function handleForgot(e: FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/auth`,
    })
    setLoading(false)
    if (error) {
      setError(error.message)
      return
    }
    setForgotSent(true)
  }

  // Tela pós-cadastro
  if (signedUp) {
    return (
      <AuthShell>
        <div style={cardStyle}>
          <div style={{ textAlign: 'center' }}>
            <div style={{
              width: 52, height: 52, borderRadius: 12,
              background: 'rgb(var(--m-accent-rgb) / 0.12)',
              border: '1px solid rgb(var(--m-accent-rgb) / 0.3)',
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              color: 'var(--m-accent)', marginBottom: 14,
            }}>
              <Icon name="mail" size={24} />
            </div>
            <h1 className="font-display" style={{ fontSize: 22, fontWeight: 700, marginBottom: 6 }}>
              {t('signedup_title')}
            </h1>
            <p style={{ fontSize: 13, color: 'var(--m-text-dim)', lineHeight: 1.5 }}>
              {t('signedup_sub_part1')}{' '}
              <span style={{ color: 'var(--m-text)', fontWeight: 500 }}>{email}</span>
              {t('signedup_sub_part2')}
            </p>
            <button
              type="button"
              onClick={() => { setSignedUp(false); switchMode('login') }}
              style={{
                marginTop: 20, background: 'transparent', border: 'none',
                color: 'var(--m-accent)', fontSize: 12, fontWeight: 600,
                cursor: 'pointer', fontFamily: 'inherit',
              }}
            >
              {t('back_to_login')}
            </button>
          </div>
        </div>
      </AuthShell>
    )
  }

  return (
    <AuthShell>
      {mode === 'forgot' ? (
        <div style={cardStyle}>
          <button
            type="button"
            onClick={() => switchMode('login')}
            style={{
              background: 'transparent', border: 'none', color: 'var(--m-text-dim)',
              fontSize: 12, fontWeight: 500, display: 'inline-flex', alignItems: 'center',
              gap: 4, marginBottom: 18, padding: 0, cursor: 'pointer', fontFamily: 'inherit',
            }}
          >
            <Icon name="chevronRight" size={13} style={{ transform: 'rotate(180deg)' }} />
            {t('forgot_back')}
          </button>

          <div style={{ marginBottom: 20 }}>
            <div style={{
              width: 48, height: 48, borderRadius: 12,
              background: 'rgb(var(--m-accent-rgb) / 0.12)',
              border: '1px solid rgb(var(--m-accent-rgb) / 0.3)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: 'var(--m-accent)', marginBottom: 14,
            }}>
              <Icon name="key" size={22} />
            </div>
            <h1 className="font-display" style={{ fontSize: 22, fontWeight: 700, marginBottom: 4 }}>
              {t('forgot_title')}
            </h1>
            <p style={{ fontSize: 13, color: 'var(--m-text-dim)' }}>{t('forgot_sub')}</p>
          </div>

          {forgotSent ? (
            <div style={{
              padding: '12px 14px', borderRadius: 10,
              background: 'rgba(74,222,128,0.08)', border: '1px solid rgba(74,222,128,0.3)',
              color: 'var(--m-green)', fontSize: 13, fontWeight: 500,
              display: 'flex', alignItems: 'center', gap: 10,
            }}>
              <Icon name="check" size={16} />
              {t('forgot_sent')}
            </div>
          ) : (
            <form onSubmit={handleForgot}>
              <AuthInput
                label={t('email')}
                type="email"
                icon="mail"
                placeholder={t('email_placeholder')}
                value={email}
                onChange={setEmail}
                hint={t('forgot_hint')}
                required
              />
              {error && <FieldError>{error}</FieldError>}
              <AuthSubmit loading={loading}>
                {t('forgot_submit')}
                <Icon name="send" size={14} />
              </AuthSubmit>
            </form>
          )}

          <div style={{ marginTop: 24, textAlign: 'center', fontSize: 12, color: 'var(--m-text-dim)' }}>
            {t('dont_have')}{' '}
            <button
              type="button"
              onClick={() => switchMode('signup')}
              style={linkBtnStyle}
            >
              {t('create_it')} →
            </button>
          </div>
        </div>
      ) : (
        <div style={cardStyle}>
          <AuthTabs active={mode} onChange={switchMode} t={t} />

          <div style={{ marginBottom: 20 }}>
            <h1 className="font-display" style={{ fontSize: 22, fontWeight: 700, marginBottom: 4 }}>
              {mode === 'login' ? t('login_title') : t('signup_title')}
            </h1>
            <p style={{ fontSize: 13, color: 'var(--m-text-dim)' }}>
              {mode === 'login' ? t('login_sub') : t('signup_sub')}
            </p>
          </div>

          <form onSubmit={mode === 'login' ? handleLogin : handleSignup}>
            <AuthInput
              label={t('email')}
              type="email"
              icon="mail"
              placeholder={t('email_placeholder')}
              value={email}
              onChange={setEmail}
              required
            />
            <AuthInput
              label={t('password')}
              type={showPassword ? 'text' : 'password'}
              icon="lock"
              placeholder={mode === 'signup' ? t('password_strong_placeholder') : t('password_placeholder')}
              value={password}
              onChange={setPassword}
              required
              rightSlot={
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  style={{
                    background: 'transparent', border: 'none', color: 'var(--m-text-dim)',
                    padding: 4, cursor: 'pointer',
                  }}
                >
                  <Icon name="eye" size={15} />
                </button>
              }
            />

            {mode === 'signup' && (
              <>
                <AuthInput
                  label={t('confirm_password')}
                  type={showPassword ? 'text' : 'password'}
                  icon="lock"
                  placeholder={t('password_placeholder')}
                  value={confirmPassword}
                  onChange={setConfirmPassword}
                  required
                />
                <PasswordReqs password={password} t={t} />
              </>
            )}

            {mode === 'login' && (
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: -4, marginBottom: 18 }}>
                <button
                  type="button"
                  onClick={() => switchMode('forgot')}
                  style={{
                    background: 'transparent', border: 'none', color: 'var(--m-accent)',
                    fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
                  }}
                >
                  {t('forgot_link')}
                </button>
              </div>
            )}

            {error && <FieldError>{error}</FieldError>}

            <AuthSubmit loading={loading}>
              {loading
                ? mode === 'login' ? t('loading_login') : t('loading_signup')
                : mode === 'login' ? t('login_submit') : t('signup_submit')}
              {!loading && <Icon name="arrowRight" size={14} />}
            </AuthSubmit>
          </form>

          <AuthDivider>{t('or_continue')}</AuthDivider>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <OAuthButton provider="google" label="Google" disabled comingSoon={t('coming_soon')} />
            <OAuthButton provider="github" label="GitHub" disabled comingSoon={t('coming_soon')} />
          </div>

          <div style={{ marginTop: 24, textAlign: 'center', fontSize: 12, color: 'var(--m-text-dim)' }}>
            {mode === 'login' ? (
              <>
                {t('new_to_metis')}{' '}
                <button type="button" onClick={() => switchMode('signup')} style={linkBtnStyle}>
                  {t('create_one')} →
                </button>
              </>
            ) : (
              <>
                {t('already_have')}{' '}
                <button type="button" onClick={() => switchMode('login')} style={linkBtnStyle}>
                  {t('sign_in_cta')} →
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </AuthShell>
  )
}

// ── Subcomponentes ─────────────────────────────────────────────

function AuthShell({ children }: { children: ReactNode }) {
  return (
    <div className="metis-scope" style={{
      minHeight: '100vh', background: 'var(--m-bg)',
      position: 'relative', overflow: 'hidden',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '48px 24px',
    }}>
      {/* Grid decorativo */}
      <div style={{
        position: 'absolute', inset: 0,
        backgroundImage: 'linear-gradient(to right, rgb(var(--m-accent-rgb) / 0.035) 1px, transparent 1px), linear-gradient(to bottom, rgb(var(--m-accent-rgb) / 0.035) 1px, transparent 1px)',
        backgroundSize: '32px 32px', pointerEvents: 'none',
        maskImage: 'radial-gradient(ellipse at center, black, transparent 75%)',
        WebkitMaskImage: 'radial-gradient(ellipse at center, black, transparent 75%)',
      }} />
      {/* Glow central */}
      <div style={{
        position: 'absolute', top: '-20%', left: '50%', transform: 'translateX(-50%)',
        width: 720, height: 720, pointerEvents: 'none',
        background: 'radial-gradient(circle, rgb(var(--m-accent-rgb) / 0.08) 0%, transparent 60%)',
      }} />

      <div style={{ position: 'relative', width: '100%', maxWidth: 440 }}>
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 28 }}>
          <Logo />
        </div>
        {children}
      </div>
    </div>
  )
}

function AuthTabs({ active, onChange, t }: {
  active: Mode
  onChange: (m: Mode) => void
  t: ReturnType<typeof useTranslations<'auth'>>
}) {
  return (
    <div style={{
      display: 'flex', padding: 3, gap: 2,
      background: 'var(--m-surface-2)', border: '1px solid var(--m-border-2)',
      borderRadius: 999, marginBottom: 24,
    }}>
      {(['login', 'signup'] as const).map((m) => {
        const isActive = active === m
        return (
          <button
            key={m}
            type="button"
            onClick={() => onChange(m)}
            style={{
              flex: 1, padding: '8px 16px', borderRadius: 999,
              fontSize: 13, fontWeight: 600, border: 'none', cursor: 'pointer',
              background: isActive ? 'var(--m-accent)' : 'transparent',
              color: isActive ? '#1a1510' : 'var(--m-text-dim)',
              fontFamily: 'inherit',
            }}
          >
            {m === 'login' ? t('mode_login') : t('mode_signup')}
          </button>
        )
      })}
    </div>
  )
}

function AuthInput({ label, type = 'text', icon, placeholder, value, onChange, hint, required, rightSlot }: {
  label: string
  type?: string
  icon?: IconName
  placeholder?: string
  value: string
  onChange: (v: string) => void
  hint?: string
  required?: boolean
  rightSlot?: ReactNode
}) {
  return (
    <div style={{ marginBottom: 16 }}>
      <label style={{
        display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--m-text-dim)',
        marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.06em',
      }}>
        {label}
      </label>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10,
        background: 'var(--m-surface)', border: '1px solid var(--m-border-2)',
        borderRadius: 10, padding: '0 14px',
      }}>
        {icon && <Icon name={icon} size={15} style={{ color: 'var(--m-text-dim)', flexShrink: 0 }} />}
        <input
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          required={required}
          style={{
            flex: 1, background: 'transparent', border: 'none', outline: 'none',
            color: 'var(--m-text)', padding: '12px 0', fontSize: 14, fontFamily: 'inherit',
          }}
        />
        {rightSlot}
      </div>
      {hint && <div style={{ fontSize: 11, color: 'var(--m-muted)', marginTop: 6 }}>{hint}</div>}
    </div>
  )
}

function PasswordReqs({ password, t }: { password: string; t: ReturnType<typeof useTranslations<'auth'>> }) {
  const reqs = [
    { key: 'min',   label: t('pass_req_min'),   met: password.length >= 8 },
    { key: 'upper', label: t('pass_req_upper'), met: /[A-Z]/.test(password) },
    { key: 'digit', label: t('pass_req_digit'), met: /\d/.test(password) },
  ]
  return (
    <div style={{ marginTop: -8, marginBottom: 18, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
      {reqs.map((r) => (
        <div
          key={r.key}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11,
            color: r.met ? 'var(--m-green)' : 'var(--m-muted)',
          }}
        >
          <Icon name={r.met ? 'check' : 'dot'} size={12} />
          {r.label}
        </div>
      ))}
    </div>
  )
}

function AuthSubmit({ loading, children }: { loading: boolean; children: ReactNode }) {
  return (
    <button
      type="submit"
      disabled={loading}
      style={{
        width: '100%', background: 'var(--m-accent)', border: 'none', color: '#1a1510',
        padding: '13px 16px', borderRadius: 10, fontSize: 14, fontWeight: 700,
        letterSpacing: '-0.01em',
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8,
        cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.6 : 1,
        fontFamily: 'inherit',
      }}
    >
      {children}
    </button>
  )
}

function AuthDivider({ children }: { children: ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '20px 0' }}>
      <div style={{ flex: 1, height: 1, background: 'var(--m-border)' }} />
      <span style={{
        fontSize: 10, color: 'var(--m-muted)', textTransform: 'uppercase',
        letterSpacing: '0.1em', fontWeight: 600,
      }}>
        {children}
      </span>
      <div style={{ flex: 1, height: 1, background: 'var(--m-border)' }} />
    </div>
  )
}

function OAuthButton({ provider, label, disabled, comingSoon }: {
  provider: 'google' | 'github'
  label: string
  disabled?: boolean
  comingSoon: string
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      style={{
        width: '100%', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 10,
        background: 'var(--m-surface)', border: '1px solid var(--m-border-2)',
        color: disabled ? 'var(--m-muted)' : 'var(--m-text)',
        padding: '11px 16px', borderRadius: 10, fontSize: 13, fontWeight: 600,
        opacity: disabled ? 0.6 : 1, cursor: disabled ? 'not-allowed' : 'pointer',
        position: 'relative', fontFamily: 'inherit',
      }}
    >
      <ProviderIcon provider={provider} />
      {label}
      {disabled && (
        <span style={{
          position: 'absolute', right: 10, fontSize: 9, fontWeight: 600, color: 'var(--m-muted)',
          background: 'var(--m-surface-2)', padding: '2px 6px', borderRadius: 4,
          textTransform: 'uppercase', letterSpacing: '0.06em',
        }}>
          {comingSoon}
        </span>
      )}
    </button>
  )
}

function ProviderIcon({ provider }: { provider: 'google' | 'github' }) {
  if (provider === 'google') {
    return (
      <svg width={16} height={16} viewBox="0 0 18 18" aria-hidden>
        <path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.91c1.7-1.57 2.69-3.88 2.69-6.62z"/>
        <path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.91-2.26c-.81.54-1.84.86-3.05.86-2.35 0-4.34-1.58-5.05-3.71H.96v2.33A9 9 0 0 0 9 18z"/>
        <path fill="#FBBC05" d="M3.95 10.71a5.4 5.4 0 0 1 0-3.42V4.96H.96a9 9 0 0 0 0 8.08l2.99-2.33z"/>
        <path fill="#EA4335" d="M9 3.58c1.32 0 2.51.46 3.44 1.35l2.58-2.58C13.47.89 11.43 0 9 0A9 9 0 0 0 .96 4.96l2.99 2.33C4.66 5.16 6.65 3.58 9 3.58z"/>
      </svg>
    )
  }
  return (
    <svg width={16} height={16} viewBox="0 0 24 24" aria-hidden fill="currentColor">
      <path d="M12 .5C5.37.5 0 5.87 0 12.5c0 5.3 3.44 9.8 8.21 11.39.6.1.82-.26.82-.58v-2.03c-3.34.73-4.04-1.43-4.04-1.43-.55-1.38-1.34-1.75-1.34-1.75-1.09-.74.08-.73.08-.73 1.2.09 1.84 1.24 1.84 1.24 1.07 1.83 2.81 1.3 3.5 1 .1-.78.42-1.3.76-1.6-2.67-.3-5.47-1.33-5.47-5.94 0-1.31.47-2.39 1.24-3.23-.12-.3-.54-1.53.12-3.18 0 0 1.01-.32 3.3 1.23a11.5 11.5 0 0 1 6 0c2.29-1.55 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.77.84 1.24 1.92 1.24 3.23 0 4.62-2.81 5.64-5.49 5.94.43.37.81 1.1.81 2.22v3.29c0 .32.22.69.82.58A12 12 0 0 0 24 12.5C24 5.87 18.63.5 12 .5z" />
    </svg>
  )
}

function FieldError({ children }: { children: ReactNode }) {
  return (
    <div style={{
      padding: '9px 12px', borderRadius: 8,
      background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.3)',
      color: 'var(--m-red)', fontSize: 12, fontWeight: 500, marginBottom: 14,
    }}>
      {children}
    </div>
  )
}

// ── Estilos compartilhados ─────────────────────────────────────

const cardStyle = {
  background: 'var(--m-surface)',
  border: '1px solid var(--m-border)',
  borderRadius: 16,
  padding: '28px 28px 32px',
} as const

const linkBtnStyle = {
  background: 'transparent',
  border: 'none',
  color: 'var(--m-accent)',
  fontWeight: 600,
  fontSize: 12,
  cursor: 'pointer',
  fontFamily: 'inherit',
  padding: 0,
} as const
