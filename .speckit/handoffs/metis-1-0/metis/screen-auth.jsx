// Auth screen — /auth. 3 states: login, signup, forgot password.

function AuthShell({ children }) {
  return (
    <div className="metis-scope" style={{
      minHeight:'100%', background:'var(--m-bg)',
      position:'relative', overflow:'hidden',
      display:'flex', alignItems:'center', justifyContent:'center',
      padding:'48px 24px',
    }}>
      {/* decorative backdrop */}
      <div style={{
        position:'absolute', inset:0,
        backgroundImage:'linear-gradient(to right, rgba(245,200,66,0.035) 1px, transparent 1px), linear-gradient(to bottom, rgba(245,200,66,0.035) 1px, transparent 1px)',
        backgroundSize:'32px 32px', pointerEvents:'none', maskImage:'radial-gradient(ellipse at center, black, transparent 75%)',
      }}/>
      <div style={{
        position:'absolute', top:'-20%', left:'50%', transform:'translateX(-50%)',
        width:720, height:720, pointerEvents:'none',
        background:'radial-gradient(circle, rgba(245,200,66,0.08) 0%, transparent 60%)',
      }}/>

      <div style={{ position:'relative', width:'100%', maxWidth:440 }}>
        {/* Logo */}
        <div style={{ display:'flex', justifyContent:'center', marginBottom:28 }}>
          <Logo size={32}/>
        </div>
        {children}
      </div>
    </div>
  );
}

function AuthTabs({ active, onChange }) {
  return (
    <div style={{
      display:'flex', padding:3, gap:2,
      background:'var(--m-surface-2)', border:'1px solid var(--m-border-2)',
      borderRadius:999, marginBottom:24,
    }}>
      {['login','signup'].map(t => (
        <button key={t} onClick={() => onChange(t)} style={{
          flex:1, padding:'8px 16px', borderRadius:999, fontSize:13, fontWeight:600,
          border:'none',
          background: active === t ? 'var(--m-accent)' : 'transparent',
          color: active === t ? '#1a1510' : 'var(--m-text-dim)',
        }}>
          {t === 'login' ? 'Entrar' : 'Criar conta'}
        </button>
      ))}
    </div>
  );
}

function AuthInput({ label, type='text', placeholder, icon, value, hint, rightSlot }) {
  return (
    <div style={{ marginBottom:16 }}>
      <label style={{ display:'block', fontSize:11, fontWeight:600, color:'var(--m-text-dim)', marginBottom:6, textTransform:'uppercase', letterSpacing:'0.06em' }}>{label}</label>
      <div style={{
        display:'flex', alignItems:'center', gap:10,
        background:'var(--m-surface)', border:'1px solid var(--m-border-2)',
        borderRadius:10, padding:'0 14px',
      }}>
        {icon && <Icon name={icon} size={15} style={{ color:'var(--m-text-dim)', flexShrink:0 }}/>}
        <input type={type} placeholder={placeholder} defaultValue={value} style={{
          flex:1, background:'transparent', border:'none', outline:'none',
          color:'var(--m-text)', padding:'12px 0', fontSize:14, fontFamily:'inherit',
        }}/>
        {rightSlot}
      </div>
      {hint && <div style={{ fontSize:11, color:'var(--m-muted)', marginTop:6 }}>{hint}</div>}
    </div>
  );
}

function AuthSubmit({ children }) {
  return (
    <button style={{
      width:'100%', background:'var(--m-accent)', border:'none', color:'#1a1510',
      padding:'13px 16px', borderRadius:10, fontSize:14, fontWeight:700, letterSpacing:'-0.01em',
      display:'inline-flex', alignItems:'center', justifyContent:'center', gap:8,
    }}>{children}</button>
  );
}

function AuthDivider({ children }) {
  return (
    <div style={{ display:'flex', alignItems:'center', gap:10, margin:'20px 0' }}>
      <div style={{ flex:1, height:1, background:'var(--m-border)' }}/>
      <span style={{ fontSize:10, color:'var(--m-muted)', textTransform:'uppercase', letterSpacing:'0.1em', fontWeight:600 }}>{children}</span>
      <div style={{ flex:1, height:1, background:'var(--m-border)' }}/>
    </div>
  );
}

function OAuthButton({ provider, label, disabled }) {
  return (
    <button style={{
      width:'100%', display:'inline-flex', alignItems:'center', justifyContent:'center', gap:10,
      background:'var(--m-surface)', border:'1px solid var(--m-border-2)',
      color: disabled ? 'var(--m-muted)' : 'var(--m-text)',
      padding:'11px 16px', borderRadius:10, fontSize:13, fontWeight:600,
      opacity: disabled ? 0.6 : 1, cursor: disabled ? 'not-allowed' : 'pointer',
      position:'relative',
    }}>
      <Icon name={provider} size={16}/>
      {label}
      {disabled && (
        <span style={{
          position:'absolute', right:12, fontSize:9, fontWeight:600, color:'var(--m-muted)',
          background:'var(--m-surface-2)', padding:'2px 6px', borderRadius:4, textTransform:'uppercase', letterSpacing:'0.06em',
        }}>Em breve</span>
      )}
    </button>
  );
}

// ── Login ──────────────────────────────────────────────────────────
function AuthLogin({ onSwitchMode }) {
  return (
    <div style={{ background:'var(--m-surface)', border:'1px solid var(--m-border)', borderRadius:16, padding:'28px 28px 32px' }}>
      <AuthTabs active="login" onChange={(m) => onSwitchMode(m)}/>

      <div style={{ marginBottom:20 }}>
        <h1 className="font-display" style={{ fontSize:22, fontWeight:700, marginBottom:4 }}>Bem-vinde de volta</h1>
        <p style={{ fontSize:13, color:'var(--m-text-dim)' }}>Entre para acessar o chat Metis, jogadores supervisionados e planos.</p>
      </div>

      <AuthInput label="Email" type="email" icon="mail" placeholder="voce@exemplo.com"/>
      <AuthInput label="Senha" type="password" icon="lock" placeholder="••••••••••"
        rightSlot={<button style={{ background:'transparent', border:'none', color:'var(--m-text-dim)', padding:4 }}><Icon name="eye" size={15}/></button>}
      />

      <div style={{ display:'flex', justifyContent:'flex-end', marginTop:-4, marginBottom:18 }}>
        <button onClick={() => onSwitchMode('forgot')} style={{ background:'transparent', border:'none', color:'var(--m-accent)', fontSize:12, fontWeight:600 }}>Esqueci minha senha</button>
      </div>

      <AuthSubmit>Entrar <Icon name="arrowRight" size={14}/></AuthSubmit>

      <AuthDivider>ou continue com</AuthDivider>

      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
        <OAuthButton provider="google" label="Google" disabled/>
        <OAuthButton provider="github" label="GitHub" disabled/>
      </div>

      <div style={{ marginTop:24, textAlign:'center', fontSize:12, color:'var(--m-text-dim)' }}>
        Novo no Metis?{' '}
        <button onClick={() => onSwitchMode('signup')} style={{ background:'transparent', border:'none', color:'var(--m-accent)', fontWeight:600, fontSize:12 }}>Criar uma conta →</button>
      </div>
    </div>
  );
}

// ── Signup ─────────────────────────────────────────────────────────
function AuthSignup({ onSwitchMode }) {
  const passReqs = [
    { label:'Mínimo 8 caracteres', met:true },
    { label:'1 letra maiúscula', met:true },
    { label:'1 número', met:false },
  ];
  return (
    <div style={{ background:'var(--m-surface)', border:'1px solid var(--m-border)', borderRadius:16, padding:'28px 28px 32px' }}>
      <AuthTabs active="signup" onChange={onSwitchMode}/>

      <div style={{ marginBottom:20 }}>
        <h1 className="font-display" style={{ fontSize:22, fontWeight:700, marginBottom:4 }}>Crie sua conta</h1>
        <p style={{ fontSize:13, color:'var(--m-text-dim)' }}>Comece de graça. Upgrade pra Premium quando quiser.</p>
      </div>

      <AuthInput label="Email" type="email" icon="mail" placeholder="voce@exemplo.com"/>
      <AuthInput label="Senha" type="password" icon="lock" placeholder="Crie uma senha forte"/>

      <div style={{ marginTop:-8, marginBottom:18, display:'flex', gap:12, flexWrap:'wrap' }}>
        {passReqs.map((r, i) => (
          <div key={i} style={{
            display:'inline-flex', alignItems:'center', gap:5, fontSize:11,
            color: r.met ? 'var(--m-green)' : 'var(--m-muted)',
          }}>
            <Icon name={r.met ? 'check' : 'dot'} size={12}/>
            {r.label}
          </div>
        ))}
      </div>

      <div style={{ display:'flex', alignItems:'flex-start', gap:10, marginBottom:18 }}>
        <div style={{
          width:18, height:18, borderRadius:5, background:'var(--m-accent)',
          display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, marginTop:1,
        }}>
          <Icon name="check" size={12} style={{ color:'#1a1510' }} strokeWidth={3}/>
        </div>
        <div style={{ fontSize:12, color:'var(--m-text-dim)', lineHeight:1.5 }}>
          Concordo com os <a href="#" style={{ color:'var(--m-accent)', textDecoration:'none' }}>Termos de uso</a> e a <a href="#" style={{ color:'var(--m-accent)', textDecoration:'none' }}>Política de privacidade</a>.
        </div>
      </div>

      <AuthSubmit>Criar conta grátis <Icon name="arrowRight" size={14}/></AuthSubmit>

      <AuthDivider>ou continue com</AuthDivider>

      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
        <OAuthButton provider="google" label="Google" disabled/>
        <OAuthButton provider="github" label="GitHub" disabled/>
      </div>

      <div style={{ marginTop:24, textAlign:'center', fontSize:12, color:'var(--m-text-dim)' }}>
        Já tem conta?{' '}
        <button onClick={() => onSwitchMode('login')} style={{ background:'transparent', border:'none', color:'var(--m-accent)', fontWeight:600, fontSize:12 }}>Entrar →</button>
      </div>
    </div>
  );
}

// ── Forgot password ────────────────────────────────────────────────
function AuthForgot({ onSwitchMode }) {
  return (
    <div style={{ background:'var(--m-surface)', border:'1px solid var(--m-border)', borderRadius:16, padding:'28px 28px 32px' }}>
      <button onClick={() => onSwitchMode('login')} style={{
        background:'transparent', border:'none', color:'var(--m-text-dim)',
        fontSize:12, fontWeight:500, display:'inline-flex', alignItems:'center', gap:4, marginBottom:18, padding:0,
      }}>
        <Icon name="chevronRight" size={13} style={{ transform:'rotate(180deg)' }}/> Voltar para login
      </button>

      <div style={{ marginBottom:20 }}>
        <div style={{
          width:48, height:48, borderRadius:12,
          background:'rgba(245,200,66,0.12)', border:'1px solid rgba(245,200,66,0.3)',
          display:'flex', alignItems:'center', justifyContent:'center',
          color:'var(--m-accent)', marginBottom:14,
        }}>
          <Icon name="key" size={22}/>
        </div>
        <h1 className="font-display" style={{ fontSize:22, fontWeight:700, marginBottom:4 }}>Redefinir senha</h1>
        <p style={{ fontSize:13, color:'var(--m-text-dim)' }}>Vamos enviar um link no seu email para você escolher uma nova senha.</p>
      </div>

      <AuthInput label="Email" type="email" icon="mail" placeholder="voce@exemplo.com"
        hint="O link expira em 1 hora."/>

      <AuthSubmit>Enviar link de redefinição <Icon name="send" size={14}/></AuthSubmit>

      <div style={{ marginTop:24, textAlign:'center', fontSize:12, color:'var(--m-text-dim)' }}>
        Não tem uma conta?{' '}
        <button onClick={() => onSwitchMode('signup')} style={{ background:'transparent', border:'none', color:'var(--m-accent)', fontWeight:600, fontSize:12 }}>Criar uma →</button>
      </div>
    </div>
  );
}

// ── Wrapper with internal mode state ───────────────────────────────
function ScreenAuth({ initialMode = 'login' }) {
  const [mode, setMode] = React.useState(initialMode);
  return (
    <AuthShell>
      {mode === 'login'  && <AuthLogin  onSwitchMode={setMode}/>}
      {mode === 'signup' && <AuthSignup onSwitchMode={setMode}/>}
      {mode === 'forgot' && <AuthForgot onSwitchMode={setMode}/>}
    </AuthShell>
  );
}

Object.assign(window, { ScreenAuth });
