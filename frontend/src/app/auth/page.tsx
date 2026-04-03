'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Swords, MailCheck } from 'lucide-react'

type Mode = 'login' | 'signup'

export default function AuthPage() {
  const router = useRouter()
  const supabase = createClient()

  const [mode, setMode] = useState<Mode>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [signedUp, setSignedUp] = useState(false)

  function switchMode(next: Mode) {
    setMode(next)
    setError(null)
    setPassword('')
    setConfirmPassword('')
  }

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const { error } = await supabase.auth.signInWithPassword({ email, password })

    if (error) {
      setError(error.message)
      setLoading(false)
      return
    }

    router.push('/')
    router.refresh()
  }

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (password !== confirmPassword) {
      setError('As senhas não coincidem.')
      return
    }
    if (password.length < 6) {
      setError('A senha deve ter ao menos 6 caracteres.')
      return
    }

    setLoading(true)

    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    })

    if (error) {
      setError(error.message)
      setLoading(false)
      return
    }

    setSignedUp(true)
    setLoading(false)
  }

  // Tela pós-cadastro
  if (signedUp) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-metis-bg px-4">
        <div className="w-full max-w-sm text-center">
          <div className="flex flex-col items-center mb-8">
            <div className="flex items-center gap-2 mb-2">
              <Swords className="w-7 h-7 text-metis-accent" />
              <span className="text-2xl font-bold text-metis-text tracking-tight">Metis</span>
            </div>
          </div>
          <div className="bg-metis-surface border border-metis-border rounded-xl p-8">
            <MailCheck className="w-10 h-10 text-metis-accent mx-auto mb-4" />
            <h2 className="text-lg font-semibold text-metis-text mb-2">Verifique seu email</h2>
            <p className="text-sm text-metis-text-dim leading-relaxed">
              Enviamos um link de confirmação para{' '}
              <span className="text-metis-text font-medium">{email}</span>.
              Clique no link para ativar sua conta.
            </p>
            <button
              onClick={() => { setSignedUp(false); switchMode('login') }}
              className="mt-6 text-xs text-metis-accent hover:underline"
            >
              Voltar para o login
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-metis-bg px-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <div className="flex items-center gap-2 mb-2">
            <Swords className="w-7 h-7 text-metis-accent" />
            <span className="text-2xl font-bold text-metis-text tracking-tight">Metis</span>
          </div>
          <p className="text-metis-text-dim text-sm">Sua estrategista no Rift</p>
        </div>

        {/* Card */}
        <div className="bg-metis-surface border border-metis-border rounded-xl p-6">
          {/* Toggle */}
          <div className="flex mb-6 bg-metis-bg rounded-lg p-1">
            <button
              onClick={() => switchMode('login')}
              className={`flex-1 py-1.5 rounded-md text-sm font-medium transition-colors ${
                mode === 'login'
                  ? 'bg-metis-surface text-metis-text shadow-sm'
                  : 'text-metis-text-dim hover:text-metis-text'
              }`}
            >
              Entrar
            </button>
            <button
              onClick={() => switchMode('signup')}
              className={`flex-1 py-1.5 rounded-md text-sm font-medium transition-colors ${
                mode === 'signup'
                  ? 'bg-metis-surface text-metis-text shadow-sm'
                  : 'text-metis-text-dim hover:text-metis-text'
              }`}
            >
              Criar conta
            </button>
          </div>

          <form onSubmit={mode === 'login' ? handleLogin : handleSignup} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="email" className="text-xs text-metis-text-dim font-medium uppercase tracking-wide">
                Email
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                placeholder="summoner@metis.gg"
                className="bg-metis-bg border border-metis-border rounded-lg px-3 py-2.5 text-sm text-metis-text placeholder-metis-muted outline-none focus:border-metis-accent transition-colors"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="password" className="text-xs text-metis-text-dim font-medium uppercase tracking-wide">
                Senha
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                placeholder="••••••••"
                className="bg-metis-bg border border-metis-border rounded-lg px-3 py-2.5 text-sm text-metis-text placeholder-metis-muted outline-none focus:border-metis-accent transition-colors"
              />
            </div>

            {mode === 'signup' && (
              <div className="flex flex-col gap-1.5">
                <label htmlFor="confirmPassword" className="text-xs text-metis-text-dim font-medium uppercase tracking-wide">
                  Confirmar senha
                </label>
                <input
                  id="confirmPassword"
                  type="password"
                  value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                  required
                  placeholder="••••••••"
                  className="bg-metis-bg border border-metis-border rounded-lg px-3 py-2.5 text-sm text-metis-text placeholder-metis-muted outline-none focus:border-metis-accent transition-colors"
                />
              </div>
            )}

            {error && (
              <p className="text-red-400 text-xs bg-red-400/10 border border-red-400/20 rounded-lg px-3 py-2">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="mt-1 bg-metis-accent hover:bg-metis-accent-hover disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium rounded-lg py-2.5 text-sm transition-colors"
            >
              {loading
                ? mode === 'login' ? 'Entrando...' : 'Criando conta...'
                : mode === 'login' ? 'Entrar' : 'Criar conta'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
