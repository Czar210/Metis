// Account screen — /account. Rich profile/settings page for logged-in users.
// Includes 3 tier states (Free / Premium / Pro) togglable via props.

const ACCOUNT_DATA = {
  email: 'zaras.0210@gmail.com',
  memberSince: '14 de março de 2025',
  username: 'Zaras',
  avatarLetter: 'Z',

  // Subscription
  tiers: {
    free:    { label:'Free',    color:'var(--m-text-dim)', badgeBg:'rgba(138,147,166,0.12)', badgeBd:'rgba(138,147,166,0.3)' },
    doador:  { label:'Doador',  color:'var(--m-cyan)',     badgeBg:'rgba(91,227,212,0.12)',  badgeBd:'rgba(91,227,212,0.35)' },
    premium: { label:'Premium', color:'var(--m-accent)',   badgeBg:'rgba(245,200,66,0.12)',  badgeBd:'rgba(245,200,66,0.35)' },
    pro:     { label:'Pro',     color:'var(--m-violet)',   badgeBg:'rgba(139,127,255,0.12)', badgeBd:'rgba(139,127,255,0.35)' },
  },

  subscription: {
    premium: { price:'R$ 19,90', period:'/mês', nextBill:'23 de maio de 2026', cardBrand:'visa', cardLast4:'4242', cardExp:'08/28' },
    pro:     { price:'R$ 49,90', period:'/mês', nextBill:'23 de maio de 2026', cardBrand:'mastercard', cardLast4:'8823', cardExp:'11/27' },
    free:    null,
    doador:  { price:'R$ 5,00', period:'único', nextBill:null, cardBrand:'visa', cardLast4:'4242', cardExp:'08/28' },
  },

  // Chat tokens
  chatTokens: {
    premium: { used: 48234, total: 150000, resetIn: 18 },
    pro:     { used: 112903, total: 500000, resetIn: 18 },
    free:    { used: 1820,  total: 2000,   resetIn: 18 },
    doador:  { used: 4210,  total: 5000,   resetIn: 18 },
  },

  coupons: [
    { code:'LAUNCH50',   effect:'50% de desconto',      until:'31 de maio de 2026', daysLeft:38 },
    { code:'FRIEND2026', effect:'1 mês Premium grátis', until:'30 de abril de 2026', daysLeft:7 },
  ],

  watched: [
    { name:'Showmaker',     tag:'KR1',  label:'Estudo mid',    tier:'CHALLENGER',    lp:1243, winrate:61.2, mainChamp:'Ahri' },
    { name:'Canyon',        tag:'KR1',  label:'Referência jg', tier:'GRANDMASTER',   lp:684,  winrate:58.7, mainChamp:'Kayn' },
    { name:'brTT',          tag:'BR1',  label:'BR legend',     tier:'MASTER',        lp:132,  winrate:54.3, mainChamp:'Jhin' },
  ],

  sessions: [
    { device:'MacBook Pro 14', browser:'Chrome 129', location:'São Paulo, BR', lastActive:'agora',      current:true  },
    { device:'iPhone 15',      browser:'Safari iOS',  location:'São Paulo, BR', lastActive:'há 2 dias',   current:false },
    { device:'Windows PC',     browser:'Firefox 130', location:'Campinas, BR',  lastActive:'há 11 dias',  current:false },
  ],
};

// ── Card brand logo ────────────────────────────────────────────────
function CardBrandLogo({ brand, width = 40, height = 26 }) {
  if (brand === 'visa') {
    return (
      <svg width={width} height={height} viewBox="0 0 40 26" style={{ display:'block' }}>
        <rect width="40" height="26" rx="3" fill="#0B0D12" stroke="#2B3246"/>
        <text x="20" y="18" textAnchor="middle" fontFamily="Arial Black, sans-serif" fontSize="10" fontWeight="900" fontStyle="italic" fill="#E5E9F2" letterSpacing="0.5">VISA</text>
      </svg>
    );
  }
  if (brand === 'mastercard') {
    return (
      <svg width={width} height={height} viewBox="0 0 40 26" style={{ display:'block' }}>
        <rect width="40" height="26" rx="3" fill="#0B0D12" stroke="#2B3246"/>
        <circle cx="16" cy="13" r="6" fill="#EB001B" opacity="0.9"/>
        <circle cx="24" cy="13" r="6" fill="#F79E1B" opacity="0.9"/>
      </svg>
    );
  }
  return null;
}

// ── Tier pill ──────────────────────────────────────────────────────
function TierPill({ tier, large = false }) {
  const t = ACCOUNT_DATA.tiers[tier];
  return (
    <span style={{
      display:'inline-flex', alignItems:'center', gap:6,
      padding: large ? '6px 12px' : '4px 10px',
      borderRadius:999, fontSize: large ? 12 : 11, fontWeight:600,
      letterSpacing:'0.04em', textTransform:'uppercase',
      background: t.badgeBg, border: `1px solid ${t.badgeBd}`, color: t.color,
    }}>
      {tier === 'premium' && <Icon name="sparkles" size={large?14:12}/>}
      {tier === 'pro' && <Icon name="zap" size={large?14:12}/>}
      {tier === 'doador' && <Icon name="gift" size={large?14:12}/>}
      {t.label}
    </span>
  );
}

// ── Identity: avatar variant ───────────────────────────────────────
function IdentityAvatarVariant({ tier }) {
  const t = ACCOUNT_DATA.tiers[tier];
  return (
    <Card pad={24}>
      <div style={{ display:'flex', gap:20, alignItems:'center' }}>
        <div style={{
          width:80, height:80, borderRadius:'50%',
          background: `linear-gradient(135deg, ${t.color} 0%, ${t.color}66 100%)`,
          display:'flex', alignItems:'center', justifyContent:'center',
          fontSize:36, fontWeight:700, color:'#0B0D12', flexShrink:0,
          border:`2px solid ${t.color}`, boxShadow:`0 0 32px ${t.color}33`,
          fontFamily:'Space Grotesk, sans-serif',
        }}>{ACCOUNT_DATA.avatarLetter}</div>
        <div style={{ flex:1, minWidth:0 }}>
          <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:4, flexWrap:'wrap' }}>
            <h2 className="font-display" style={{ fontSize:24, fontWeight:700 }}>{ACCOUNT_DATA.username}</h2>
            <TierPill tier={tier} large/>
          </div>
          <div style={{ fontSize:13, color:'var(--m-text-dim)', marginBottom:2 }}>{ACCOUNT_DATA.email}</div>
          <div style={{ display:'flex', alignItems:'center', gap:6, fontSize:12, color:'var(--m-muted)' }}>
            <Icon name="calendar" size={12}/> Membro desde {ACCOUNT_DATA.memberSince}
          </div>
        </div>
      </div>
    </Card>
  );
}

// ── Identity: hero gradient variant ────────────────────────────────
function IdentityHeroVariant({ tier }) {
  const t = ACCOUNT_DATA.tiers[tier];
  return (
    <div style={{
      position:'relative', overflow:'hidden', borderRadius:14,
      background:'var(--m-surface)', border:'1px solid var(--m-border)',
      padding:'28px 28px 24px',
    }}>
      {/* decorative gradient wash */}
      <div style={{
        position:'absolute', top:-80, right:-60, width:320, height:320,
        background:`radial-gradient(circle, ${t.color}44 0%, transparent 60%)`,
        pointerEvents:'none',
      }}/>
      <div style={{
        position:'absolute', inset:0,
        backgroundImage:'linear-gradient(to right, rgba(245,200,66,0.025) 1px, transparent 1px), linear-gradient(to bottom, rgba(245,200,66,0.025) 1px, transparent 1px)',
        backgroundSize:'24px 24px', pointerEvents:'none',
      }}/>

      <div style={{ position:'relative', display:'flex', gap:24, alignItems:'center' }}>
        <div style={{
          width:96, height:96, borderRadius:20,
          background:'var(--m-surface-2)', border:`2px solid ${t.color}`,
          display:'flex', alignItems:'center', justifyContent:'center',
          fontSize:44, fontWeight:800, color:t.color, flexShrink:0,
          fontFamily:'Space Grotesk, sans-serif',
          boxShadow:`0 0 40px ${t.color}33, inset 0 0 0 1px rgba(255,255,255,0.05)`,
        }}>{ACCOUNT_DATA.avatarLetter}</div>
        <div style={{ flex:1, minWidth:0 }}>
          <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:6, flexWrap:'wrap' }}>
            <TierPill tier={tier} large/>
            <div style={{ fontSize:11, color:'var(--m-muted)', textTransform:'uppercase', letterSpacing:'0.08em' }}>minha conta</div>
          </div>
          <h2 className="font-display" style={{ fontSize:32, fontWeight:700, lineHeight:1, marginBottom:6 }}>{ACCOUNT_DATA.username}</h2>
          <div style={{ display:'flex', gap:14, alignItems:'center', fontSize:13, color:'var(--m-text-dim)', flexWrap:'wrap' }}>
            <span style={{ display:'inline-flex', alignItems:'center', gap:6 }}>
              <Icon name="mail" size={13}/> {ACCOUNT_DATA.email}
            </span>
            <span style={{ color:'var(--m-border-2)' }}>•</span>
            <span style={{ display:'inline-flex', alignItems:'center', gap:6 }}>
              <Icon name="calendar" size={13}/> Desde {ACCOUNT_DATA.memberSince}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Subscription card ──────────────────────────────────────────────
function SubscriptionCard({ tier }) {
  const sub = ACCOUNT_DATA.subscription[tier];
  const t = ACCOUNT_DATA.tiers[tier];
  const isFree = tier === 'free';
  const isDoador = tier === 'doador';

  return (
    <Card pad={0}>
      <div style={{ padding:'18px 22px', borderBottom:'1px solid var(--m-border)' }}>
        <SectionLabel icon="creditCard">Assinatura</SectionLabel>
        <div style={{ display:'flex', alignItems:'baseline', justifyContent:'space-between', gap:12, flexWrap:'wrap' }}>
          <div>
            <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:6 }}>
              <span className="font-display" style={{ fontSize:22, fontWeight:700, color:t.color }}>{t.label}</span>
              {!isFree && !isDoador && (
                <span style={{ fontSize:11, color:'var(--m-green)', background:'rgba(74,222,128,0.12)', padding:'2px 8px', borderRadius:999, border:'1px solid rgba(74,222,128,0.3)', fontWeight:600 }}>ATIVO</span>
              )}
            </div>
            {sub ? (
              <div style={{ fontSize:13, color:'var(--m-text-dim)' }}>
                <span className="font-display tabular" style={{ fontSize:20, fontWeight:700, color:'var(--m-text)' }}>{sub.price}</span>
                <span style={{ marginLeft:4 }}>{sub.period}</span>
              </div>
            ) : (
              <div style={{ fontSize:13, color:'var(--m-text-dim)' }}>Sem cobranças recorrentes</div>
            )}
          </div>
          <button style={{
            display:'inline-flex', alignItems:'center', gap:6,
            background: isFree ? 'var(--m-accent)' : 'var(--m-surface-2)',
            border: isFree ? 'none' : '1px solid var(--m-border-2)',
            color: isFree ? '#1a1510' : 'var(--m-text)',
            padding:'9px 16px', borderRadius:8, fontSize:13, fontWeight:600,
          }}>
            {isFree ? <><Icon name="sparkles" size={14}/> Fazer upgrade</> : <><Icon name="settings" size={14}/> Gerenciar</>}
          </button>
        </div>
      </div>

      {sub && !isDoador && (
        <div style={{ padding:'16px 22px', borderBottom:'1px solid var(--m-border)', display:'flex', alignItems:'center', justifyContent:'space-between', gap:16 }}>
          <div style={{ display:'flex', alignItems:'center', gap:14 }}>
            <CardBrandLogo brand={sub.cardBrand} width={44} height={28}/>
            <div>
              <div style={{ fontSize:13, color:'var(--m-text)', fontWeight:600, letterSpacing:'0.04em' }} className="font-mono">
                •••• •••• •••• {sub.cardLast4}
              </div>
              <div style={{ fontSize:11, color:'var(--m-text-dim)', marginTop:2 }}>Expira {sub.cardExp}</div>
            </div>
          </div>
          <button style={{ background:'transparent', border:'none', color:'var(--m-accent)', fontSize:12, fontWeight:600 }}>Trocar</button>
        </div>
      )}

      {sub && sub.nextBill && (
        <div style={{ padding:'14px 22px', fontSize:12, color:'var(--m-text-dim)', display:'flex', alignItems:'center', gap:8 }}>
          <Icon name="calendar" size={13}/>
          Próxima cobrança em <span style={{ color:'var(--m-text)', fontWeight:500 }}>{sub.nextBill}</span>
        </div>
      )}
      {isFree && (
        <div style={{ padding:'14px 22px', fontSize:12, color:'var(--m-text-dim)', display:'flex', alignItems:'center', gap:8 }}>
          <Icon name="info" size={13}/>
          Desbloqueie o Chat Metis e análise de partidas com Premium
        </div>
      )}
    </Card>
  );
}

// ── Chat tokens card ───────────────────────────────────────────────
function TokensCard({ tier }) {
  const t = ACCOUNT_DATA.chatTokens[tier];
  const pct = (t.used / t.total) * 100;
  const near = pct > 80;
  return (
    <Card pad={22}>
      <SectionLabel icon="sparkles">Uso do Chat Metis</SectionLabel>
      <div style={{ display:'flex', alignItems:'baseline', gap:8, marginBottom:12 }}>
        <span className="font-display tabular" style={{ fontSize:28, fontWeight:700, color: near ? 'var(--m-red)' : 'var(--m-text)' }}>
          {(t.used/1000).toFixed(1)}k
        </span>
        <span style={{ fontSize:13, color:'var(--m-text-dim)' }}>/ {(t.total/1000).toFixed(0)}k tokens</span>
      </div>
      <Bar value={pct} color={near ? 'var(--m-red)' : 'var(--m-accent)'} height={8}/>
      <div style={{ display:'flex', justifyContent:'space-between', marginTop:10, fontSize:11, color:'var(--m-muted)' }}>
        <span>{pct.toFixed(0)}% usado</span>
        <span style={{ display:'inline-flex', alignItems:'center', gap:4 }}>
          <Icon name="refresh" size={11}/> Reseta em {t.resetIn} dias
        </span>
      </div>
    </Card>
  );
}

// ── Coupon card (compact) ──────────────────────────────────────────
function CouponCompactCard({ coupon }) {
  const urgent = coupon.daysLeft <= 10;
  return (
    <div style={{
      background:'var(--m-surface-2)', border:'1px solid var(--m-border-2)',
      borderRadius:10, padding:'12px 14px',
      display:'flex', flexDirection:'column', gap:10,
    }}>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:8 }}>
        <div className="font-mono" style={{
          fontSize:13, fontWeight:700, color:'var(--m-accent)', letterSpacing:'0.06em',
          background:'rgba(245,200,66,0.08)', border:'1px dashed rgba(245,200,66,0.35)',
          padding:'4px 10px', borderRadius:6,
        }}>{coupon.code}</div>
        <button title="Copiar código" style={{
          width:28, height:28, background:'transparent', border:'1px solid var(--m-border)',
          borderRadius:6, color:'var(--m-text-dim)', display:'flex', alignItems:'center', justifyContent:'center',
        }}>
          <Icon name="copy" size={13}/>
        </button>
      </div>
      <div style={{ fontSize:12, color:'var(--m-text)', fontWeight:500 }}>{coupon.effect}</div>
      <div>
        <div style={{ display:'flex', justifyContent:'space-between', fontSize:10, color:'var(--m-muted)', marginBottom:4, textTransform:'uppercase', letterSpacing:'0.06em' }}>
          <span>Válido até {coupon.until}</span>
          <span style={{ color: urgent ? 'var(--m-red)' : 'var(--m-muted)' }}>{coupon.daysLeft}d</span>
        </div>
        <Bar value={coupon.daysLeft} max={60} color={urgent ? 'var(--m-red)' : 'var(--m-green)'} height={3}/>
      </div>
    </div>
  );
}

function CouponsCard() {
  return (
    <Card pad={22}>
      <SectionLabel icon="gift" right={
        <span style={{ fontSize:11, color:'var(--m-text-dim)', fontWeight:500 }}>{ACCOUNT_DATA.coupons.length} ativos</span>
      }>Cupons</SectionLabel>

      <div style={{ display:'grid', gap:10, marginBottom:12 }}>
        {ACCOUNT_DATA.coupons.map((c, i) => <CouponCompactCard key={i} coupon={c}/>)}
      </div>

      <div style={{ display:'flex', gap:8 }}>
        <input placeholder="Resgatar código" style={{
          flex:1, background:'var(--m-bg)', border:'1px solid var(--m-border-2)',
          borderRadius:8, padding:'9px 12px', fontSize:13, color:'var(--m-text)',
          fontFamily:'JetBrains Mono, monospace', letterSpacing:'0.04em',
          outline:'none',
        }}/>
        <button style={{
          background:'var(--m-accent)', border:'none', color:'#1a1510',
          padding:'9px 14px', borderRadius:8, fontSize:12, fontWeight:600,
        }}>Resgatar</button>
      </div>
    </Card>
  );
}

// ── Watched players card ───────────────────────────────────────────
function WatchedPlayersCard() {
  return (
    <Card pad={0}>
      <div style={{ padding:'18px 22px 14px' }}>
        <SectionLabel icon="eye" right={
          <button style={{ background:'transparent', border:'1px solid var(--m-border-2)', color:'var(--m-text-dim)', padding:'4px 10px', borderRadius:6, fontSize:11, fontWeight:600, display:'inline-flex', alignItems:'center', gap:4 }}>
            <Icon name="plus" size={11}/> Adicionar
          </button>
        }>Jogadores supervisionados</SectionLabel>
      </div>
      <div>
        {ACCOUNT_DATA.watched.map((p, i) => (
          <div key={i} style={{
            display:'flex', alignItems:'center', gap:14,
            padding:'12px 22px',
            borderTop:'1px solid var(--m-border)',
          }}>
            <ChampPortrait name={p.mainChamp} size={40}/>
            <div style={{ flex:1, minWidth:0 }}>
              <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:3 }}>
                <span style={{ fontSize:14, fontWeight:600, color:'var(--m-text)' }}>{p.name}</span>
                <span style={{ fontSize:11, color:'var(--m-muted)' }} className="font-mono">#{p.tag}</span>
              </div>
              <div style={{ display:'flex', alignItems:'center', gap:8, fontSize:11, color:'var(--m-text-dim)' }}>
                <Icon name="bookOpen" size={11}/>
                {p.label}
              </div>
            </div>
            <div style={{ textAlign:'right', fontSize:11, color:'var(--m-text-dim)' }}>
              <div style={{ color:'var(--m-text)', fontWeight:600, fontSize:12 }}>{p.tier}</div>
              <div className="tabular">{p.lp} LP · {p.winrate}% WR</div>
            </div>
            <div style={{ display:'flex', gap:4 }}>
              <button title="Abrir dashboard" style={{ width:30, height:30, background:'var(--m-surface-2)', border:'1px solid var(--m-border-2)', borderRadius:7, color:'var(--m-text-dim)', display:'flex', alignItems:'center', justifyContent:'center' }}>
                <Icon name="arrowRight" size={13}/>
              </button>
              <button title="Remover" style={{ width:30, height:30, background:'transparent', border:'1px solid var(--m-border)', borderRadius:7, color:'var(--m-muted)', display:'flex', alignItems:'center', justifyContent:'center' }}>
                <Icon name="x" size={13}/>
              </button>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}

// ── Preferences card ───────────────────────────────────────────────
function PreferencesCard() {
  const accents = [
    { name:'gold',   color:'#F5C842', active:true  },
    { name:'blue',   color:'#60A5FA', active:false },
    { name:'violet', color:'#8B7FFF', active:false },
    { name:'green',  color:'#4ADE80', active:false },
    { name:'red',    color:'#F87171', active:false },
  ];
  const regions = ['BR1', 'NA1', 'EUW', 'KR', 'LAN', 'LAS'];

  return (
    <Card pad={22}>
      <SectionLabel icon="settings">Preferências</SectionLabel>

      {/* Language */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'10px 0', borderBottom:'1px solid var(--m-border)' }}>
        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
          <Icon name="globe" size={15} style={{ color:'var(--m-text-dim)' }}/>
          <div>
            <div style={{ fontSize:13, fontWeight:500 }}>Idioma</div>
            <div style={{ fontSize:11, color:'var(--m-muted)' }}>Interface e textos da IA</div>
          </div>
        </div>
        <div style={{ display:'flex', background:'var(--m-surface-2)', borderRadius:999, padding:3, gap:2, border:'1px solid var(--m-border-2)' }}>
          {['PT','EN'].map((l, i) => (
            <button key={l} style={{
              padding:'4px 12px', borderRadius:999, fontSize:11, fontWeight:600, border:'none',
              background: i === 0 ? 'var(--m-accent)' : 'transparent',
              color: i === 0 ? '#1a1510' : 'var(--m-text-dim)',
            }}>{l}</button>
          ))}
        </div>
      </div>

      {/* Accent color */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'10px 0', borderBottom:'1px solid var(--m-border)' }}>
        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
          <Icon name="palette" size={15} style={{ color:'var(--m-text-dim)' }}/>
          <div>
            <div style={{ fontSize:13, fontWeight:500 }}>Cor de destaque</div>
            <div style={{ fontSize:11, color:'var(--m-muted)' }}>Aplicada em toda a interface</div>
          </div>
        </div>
        <div style={{ display:'flex', gap:6 }}>
          {accents.map(a => (
            <button key={a.name} title={a.name} style={{
              width:26, height:26, borderRadius:'50%', background:a.color,
              border: a.active ? `2px solid var(--m-text)` : `2px solid transparent`,
              boxShadow: a.active ? `0 0 0 2px var(--m-surface), 0 0 12px ${a.color}88` : 'none',
              cursor:'pointer', padding:0,
            }}/>
          ))}
        </div>
      </div>

      {/* Region */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'10px 0' }}>
        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
          <Icon name="gamepad" size={15} style={{ color:'var(--m-text-dim)' }}/>
          <div>
            <div style={{ fontSize:13, fontWeight:500 }}>Região padrão</div>
            <div style={{ fontSize:11, color:'var(--m-muted)' }}>Busca e tier list</div>
          </div>
        </div>
        <select style={{
          background:'var(--m-surface-2)', border:'1px solid var(--m-border-2)',
          color:'var(--m-text)', padding:'6px 10px', borderRadius:7, fontSize:12,
          fontFamily:'inherit', fontWeight:500,
        }}>
          {regions.map(r => <option key={r}>{r}</option>)}
        </select>
      </div>
    </Card>
  );
}

// ── Security / account card ────────────────────────────────────────
function SecurityCard() {
  return (
    <Card pad={0}>
      <div style={{ padding:'18px 22px 14px' }}>
        <SectionLabel icon="shieldCheck">Segurança</SectionLabel>
      </div>
      <div style={{ borderTop:'1px solid var(--m-border)' }}>
        <AccountRow icon="mail"  label="Email"      value={ACCOUNT_DATA.email} action="Apenas leitura" actionMuted/>
        <AccountRow icon="key"   label="Senha"      value="Última alteração há 47 dias" action="Alterar"/>
        <AccountRow icon="lock"  label="Sessões ativas" value={`${ACCOUNT_DATA.sessions.length} dispositivos conectados`} action="Gerenciar"/>
      </div>
      <div style={{ padding:'14px 22px', background:'rgba(248,113,113,0.04)', borderTop:'1px solid rgba(248,113,113,0.15)' }}>
        <div style={{ display:'flex', alignItems:'center', gap:10, justifyContent:'space-between' }}>
          <div style={{ display:'flex', alignItems:'center', gap:10 }}>
            <div style={{ width:32, height:32, borderRadius:8, background:'rgba(248,113,113,0.08)', border:'1px solid rgba(248,113,113,0.2)', display:'flex', alignItems:'center', justifyContent:'center', color:'var(--m-red)' }}>
              <Icon name="trash" size={15}/>
            </div>
            <div>
              <div style={{ fontSize:13, fontWeight:500, color:'var(--m-red)' }}>Deletar conta</div>
              <div style={{ fontSize:11, color:'var(--m-muted)' }}>Ação permanente — remove jogadores supervisionados, cupons, histórico de chat.</div>
            </div>
          </div>
          <button style={{
            background:'rgba(248,113,113,0.08)', border:'1px solid rgba(248,113,113,0.3)',
            color:'var(--m-red)', padding:'7px 14px', borderRadius:7, fontSize:12, fontWeight:600,
            whiteSpace:'nowrap',
          }}>Deletar</button>
        </div>
      </div>
    </Card>
  );
}

function AccountRow({ icon, label, value, action, actionMuted }) {
  return (
    <div style={{ padding:'14px 22px', borderBottom:'1px solid var(--m-border)', display:'flex', alignItems:'center', gap:14 }}>
      <div style={{ width:32, height:32, borderRadius:8, background:'var(--m-surface-2)', border:'1px solid var(--m-border-2)', display:'flex', alignItems:'center', justifyContent:'center', color:'var(--m-text-dim)' }}>
        <Icon name={icon} size={15}/>
      </div>
      <div style={{ flex:1 }}>
        <div style={{ fontSize:12, fontWeight:500, color:'var(--m-text-dim)', textTransform:'uppercase', letterSpacing:'0.06em' }}>{label}</div>
        <div style={{ fontSize:13, color:'var(--m-text)', marginTop:2 }}>{value}</div>
      </div>
      <button style={{
        background:'transparent', border: actionMuted ? 'none' : '1px solid var(--m-border-2)',
        color: actionMuted ? 'var(--m-muted)' : 'var(--m-text)',
        padding: actionMuted ? '0' : '6px 12px', borderRadius:7, fontSize:12, fontWeight:500,
        cursor: actionMuted ? 'default' : 'pointer',
      }}>{action}</button>
    </div>
  );
}

// ── Main screen ────────────────────────────────────────────────────
function ScreenAccount({ tier = 'premium', layout = 'two-col', identity = 'hero' }) {
  return (
    <div className="metis-scope" style={{ background:'var(--m-bg)', minHeight:'100%' }}>
      <AppHeader active={null}/>

      <div style={{ maxWidth: layout === 'single' ? 760 : 1200, margin:'0 auto', padding:'28px 24px 40px' }}>
        {/* Page title */}
        <div style={{ marginBottom:20 }}>
          <div style={{ fontSize:11, color:'var(--m-muted)', textTransform:'uppercase', letterSpacing:'0.1em', marginBottom:6, display:'flex', alignItems:'center', gap:6 }}>
            <Icon name="settings" size={12}/> Configurações
          </div>
          <h1 className="font-display" style={{ fontSize:28, fontWeight:700 }}>Minha conta</h1>
        </div>

        {/* Identity */}
        <div style={{ marginBottom:20 }}>
          {identity === 'hero'
            ? <IdentityHeroVariant tier={tier}/>
            : <IdentityAvatarVariant tier={tier}/>}
        </div>

        {/* Main grid */}
        {layout === 'two-col' ? (
          <div style={{ display:'grid', gridTemplateColumns:'1.4fr 1fr', gap:20 }}>
            <div style={{ display:'flex', flexDirection:'column', gap:20 }}>
              <SubscriptionCard tier={tier}/>
              <WatchedPlayersCard/>
              <SecurityCard/>
            </div>
            <div style={{ display:'flex', flexDirection:'column', gap:20 }}>
              <TokensCard tier={tier}/>
              <CouponsCard/>
              <PreferencesCard/>
            </div>
          </div>
        ) : (
          <div style={{ display:'flex', flexDirection:'column', gap:20 }}>
            <SubscriptionCard tier={tier}/>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:20 }}>
              <TokensCard tier={tier}/>
              <CouponsCard/>
            </div>
            <WatchedPlayersCard/>
            <PreferencesCard/>
            <SecurityCard/>
          </div>
        )}
      </div>
    </div>
  );
}

Object.assign(window, { ScreenAccount, ACCOUNT_DATA, TierPill, CardBrandLogo });
