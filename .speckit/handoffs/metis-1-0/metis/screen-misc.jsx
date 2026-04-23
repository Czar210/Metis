// Chat / Changelog / Team screens.

// ── Chat Metis ──────────────────────────────────────────────────
function ScreenChat() {
  return (
    <div className="metis-scope" style={{ width:'100%', height:'100%', background:'var(--m-bg)', display:'flex', flexDirection:'column' }}>
      <AppHeader active="home"/>

      {/* Token bar */}
      <div style={{ padding:'8px 28px', borderBottom:'1px solid var(--m-border)', display:'flex', alignItems:'center', gap:12, background:'var(--m-surface)' }}>
        <Icon name="bolt" size={13} style={{ color:'var(--m-accent)' }}/>
        <span style={{ fontSize:11, color:'var(--m-text-dim)' }}>
          <span className="tabular" style={{ color:'var(--m-text)', fontWeight:600 }}>8.231</span> / 100.000 tokens hoje
        </span>
        <div style={{ flex:1, maxWidth:200 }}>
          <Bar value={8231} max={100000} color="var(--m-accent)" height={4}/>
        </div>
        <span style={{ fontSize:10, color:'var(--m-muted)' }}>Reset em 8h · Pro</span>
        <div style={{ flex:1 }}/>
        <span style={{ fontSize:11, color:'var(--m-text-dim)' }}>Invocador: <span style={{ color:'var(--m-text)' }}>Zaras#0210</span></span>
      </div>

      <div style={{ flex:1, overflow:'auto', display:'flex', flexDirection:'column' }}>
        <div style={{ maxWidth:800, width:'100%', margin:'0 auto', padding:'28px 20px 20px', flex:1 }}>
          {CHAT_THREAD.map((msg, i) => <ChatMsg key={i} msg={msg}/>)}
        </div>
      </div>

      {/* Input area */}
      <div style={{ borderTop:'1px solid var(--m-border)', background:'var(--m-surface)', padding:'14px 28px 18px' }}>
        <div style={{ maxWidth:800, margin:'0 auto' }}>
          <div style={{ display:'flex', gap:8, alignItems:'center', padding:'10px 12px', background:'var(--m-bg)', border:'1px solid var(--m-border-2)', borderRadius:12 }}>
            <Icon name="messageCircle" size={16} style={{ color:'var(--m-text-dim)' }}/>
            <input placeholder="Pergunte para a Metis... (Enter para enviar)" style={{ flex:1, background:'transparent', border:'none', color:'var(--m-text)', fontSize:13, outline:'none', fontFamily:'inherit' }}/>
            <button style={{ padding:6, background:'var(--m-accent)', border:'none', borderRadius:8, color:'#1a1510', display:'flex' }}>
              <Icon name="send" size={14}/>
            </button>
          </div>
          <div style={{ display:'flex', gap:6, marginTop:10, flexWrap:'wrap' }}>
            {['Review minha última derrota','Quem contra Kayn?','Como farmar melhor?','Builds pra ADC'].map(q => (
              <button key={q} style={{ padding:'5px 10px', background:'var(--m-surface-2)', border:'1px solid var(--m-border-2)', borderRadius:999, color:'var(--m-text-dim)', fontSize:11 }}>
                <Icon name="sparkles" size={10} style={{ marginRight:4, color:'var(--m-accent)' }}/>
                {q}
              </button>
            ))}
          </div>
          <div style={{ fontSize:10, color:'var(--m-muted)', textAlign:'center', marginTop:10 }}>A Metis só fala de League of Legends. Pode cometer erros — valide conselhos importantes.</div>
        </div>
      </div>
    </div>
  );
}

function ChatMsg({ msg }) {
  const isUser = msg.role === 'user';
  return (
    <div style={{ display:'flex', flexDirection: isUser ? 'row-reverse' : 'row', gap:12, marginBottom:20, alignItems:'flex-start' }}>
      {!isUser && (
        <div style={{ width:32, height:32, borderRadius:8, background:'rgba(245,200,66,0.15)', border:'1px solid rgba(245,200,66,0.3)', display:'flex', alignItems:'center', justifyContent:'center', color:'var(--m-accent)', flexShrink:0 }}>
          <Icon name="brain" size={16}/>
        </div>
      )}
      <div style={{ flex: isUser ? '0 1 auto' : 1, maxWidth: isUser ? '70%' : '92%' }}>
        <div style={{
          background: isUser ? 'var(--m-accent)' : 'var(--m-surface)',
          border: isUser ? 'none' : '1px solid var(--m-border)',
          padding: '12px 14px', borderRadius: 12,
          color: isUser ? '#1a1510' : 'var(--m-text)', fontSize:13, lineHeight:1.55,
        }}>
          {msg.text}
        </div>
        {msg.blocks && (
          <div style={{ marginTop:8, display:'flex', flexDirection:'column', gap:8 }}>
            {msg.blocks.map((b, i) => (
              <div key={i} style={{ padding:'10px 12px', background:'var(--m-surface)', border:'1px solid var(--m-border)', borderLeft:`3px solid ${b.color}`, borderRadius:10 }}>
                <div style={{ fontSize:10, color:b.color, textTransform:'uppercase', letterSpacing:'0.08em', fontWeight:700, marginBottom:4 }}>{b.head}</div>
                <div style={{ fontSize:12, color:'var(--m-text-dim)', lineHeight:1.55 }}>{b.body}</div>
              </div>
            ))}
          </div>
        )}
        {msg.followups && (
          <div style={{ display:'flex', gap:6, marginTop:10, flexWrap:'wrap' }}>
            {msg.followups.map(f => (
              <button key={f} style={{ padding:'5px 10px', background:'var(--m-bg)', border:'1px solid var(--m-border)', borderRadius:999, color:'var(--m-text-dim)', fontSize:11 }}>
                <Icon name="arrowRight" size={10} style={{ marginRight:4, color:'var(--m-accent)' }}/>
                {f}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Changelog ───────────────────────────────────────────────────
function ScreenChangelog() {
  const TAG_COLORS = {
    'BIG UPDATE': { bg:'rgba(139,127,255,0.15)', fg:'var(--m-violet)' },
    'NOVO':       { bg:'rgba(74,222,128,0.15)',  fg:'var(--m-green)' },
    'MELHORIA':   { bg:'rgba(245,200,66,0.15)',  fg:'var(--m-accent)' },
    'FIX':        { bg:'rgba(96,165,250,0.15)',  fg:'var(--m-blue)' },
  };
  return (
    <div className="metis-scope" style={{ width:'100%', height:'100%', overflow:'auto', background:'var(--m-bg)' }}>
      <AppHeader active="changelog"/>
      <div style={{ maxWidth:760, margin:'0 auto', padding:'40px 28px 48px' }}>
        <div style={{ display:'inline-flex', alignItems:'center', gap:6, fontSize:11, color:'var(--m-accent)', textTransform:'uppercase', letterSpacing:'0.12em', fontWeight:600, marginBottom:14 }}>
          <Icon name="sparkles" size={12}/> Novidades
        </div>
        <h1 className="font-display" style={{ fontSize:40, fontWeight:700, letterSpacing:'-0.03em', marginBottom:8 }}>O que é novo?</h1>
        <p style={{ fontSize:14, color:'var(--m-text-dim)', marginBottom:36 }}>
          Acompanhe as evoluções da Metis. Cada versão traz melhorias reais — sem promessas, só entregas.
        </p>

        {/* Timeline */}
        <div style={{ position:'relative', paddingLeft:32 }}>
          <div style={{ position:'absolute', left:9, top:12, bottom:12, width:2, background:'var(--m-border)' }}/>
          {CHANGELOG.map((rel, i) => (
            <div key={rel.v} style={{ position:'relative', marginBottom:28 }}>
              <div style={{
                position:'absolute', left:-28, top:4, width:20, height:20, borderRadius:'50%',
                background: rel.current ? 'var(--m-accent)' : 'var(--m-surface)',
                border: `2px solid ${rel.current ? 'var(--m-accent)' : 'var(--m-border-2)'}`,
                boxShadow: rel.current ? '0 0 0 5px rgba(245,200,66,0.15)' : 'none',
              }}/>
              <div style={{ display:'flex', alignItems:'baseline', gap:10, marginBottom:10 }}>
                <h2 className="font-display" style={{ fontSize:22, fontWeight:700 }}>{rel.v}</h2>
                {rel.current && <span style={{ padding:'2px 8px', background:'rgba(245,200,66,0.15)', border:'1px solid rgba(245,200,66,0.3)', borderRadius:4, fontSize:10, fontWeight:600, color:'var(--m-accent)', letterSpacing:'0.06em' }}>ATUAL</span>}
                <div style={{ flex:1 }}/>
                <span style={{ fontSize:12, color:'var(--m-text-dim)' }}>{rel.date}</span>
              </div>
              {rel.title && (
                <div style={{ display:'flex', alignItems:'flex-start', gap:8, padding:'10px 12px', background:'rgba(139,127,255,0.06)', border:'1px solid rgba(139,127,255,0.2)', borderRadius:8, marginBottom:10 }}>
                  <span style={{ padding:'2px 7px', background:TAG_COLORS[rel.tag].bg, color:TAG_COLORS[rel.tag].fg, borderRadius:4, fontSize:9, fontWeight:700, letterSpacing:'0.06em', flexShrink:0, marginTop:1 }}>{rel.tag}</span>
                  <span style={{ fontSize:13, color:'var(--m-text)', lineHeight:1.5 }}>{rel.title}</span>
                </div>
              )}
              <div style={{ display:'flex', flexDirection:'column', gap:8, padding:'14px 16px', background:'var(--m-surface)', border:'1px solid var(--m-border)', borderRadius:12 }}>
                {rel.items.map((it, j) => {
                  const c = TAG_COLORS[it.tag] || TAG_COLORS.MELHORIA;
                  return (
                    <div key={j} style={{ display:'flex', alignItems:'flex-start', gap:10 }}>
                      <span style={{ padding:'2px 7px', background:c.bg, color:c.fg, borderRadius:4, fontSize:9, fontWeight:700, letterSpacing:'0.06em', flexShrink:0, marginTop:1, minWidth:60, textAlign:'center' }}>{it.tag}</span>
                      <span style={{ fontSize:12, color:'var(--m-text-dim)', lineHeight:1.55 }}>{it.t}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Team ────────────────────────────────────────────────────────
function ScreenTeam() {
  return (
    <div className="metis-scope" style={{ width:'100%', height:'100%', overflow:'auto', background:'var(--m-bg)' }}>
      <AppHeader active="team"/>
      <div style={{ maxWidth:1100, margin:'0 auto', padding:'52px 28px 48px' }}>
        <div style={{ textAlign:'center', marginBottom:44 }}>
          <div style={{ display:'inline-flex', alignItems:'center', gap:6, fontSize:11, color:'var(--m-accent)', textTransform:'uppercase', letterSpacing:'0.14em', fontWeight:700, marginBottom:14 }}>
            // Equipe
          </div>
          <h1 className="font-display" style={{ fontSize:44, fontWeight:700, letterSpacing:'-0.03em', marginBottom:12 }}>
            Quem faz a <span style={{ color:'var(--m-accent)' }}>Metis</span>
          </h1>
          <p style={{ fontSize:15, color:'var(--m-text-dim)', maxWidth:540, margin:'0 auto', lineHeight:1.55 }}>
            Três pessoas construindo algo que gostariam de ter tido quando estavam aprendendo o jogo.
          </p>
        </div>

        <div style={{ display:'grid', gridTemplateColumns:'repeat(3, 1fr)', gap:16 }}>
          {TEAM.map(m => (
            <div key={m.name} style={{
              padding:24,
              background:'var(--m-surface)',
              border:`1px solid ${m.color}33`,
              borderRadius:16,
              position:'relative', overflow:'hidden',
            }}>
              <div style={{ position:'absolute', top:-40, right:-40, width:140, height:140, borderRadius:'50%', background:`radial-gradient(circle, ${m.color}22, transparent 70%)`, filter:'blur(30px)' }}/>
              <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:14, position:'relative' }}>
                <div style={{ width:48, height:48, borderRadius:'50%', background:m.color, display:'flex', alignItems:'center', justifyContent:'center', color:'#0B0D12', fontSize:16, fontWeight:800 }}>{m.initials}</div>
                <div style={{ flex:1, minWidth:0 }}>
                  <div className="font-display" style={{ fontSize:17, fontWeight:600 }}>{m.name}</div>
                  <div style={{ fontSize:11, color:m.color, fontWeight:600, marginTop:2 }}>{m.role}</div>
                  {m.sub && <div style={{ fontSize:10, color:'var(--m-text-dim)', marginTop:1 }}>{m.sub}</div>}
                </div>
              </div>
              <div style={{ display:'flex', flexWrap:'wrap', gap:6, marginBottom:16, position:'relative' }}>
                {m.tags.map(t => (
                  <span key={t} style={{ padding:'3px 10px', background:`${m.color}1a`, border:`1px solid ${m.color}40`, borderRadius:999, fontSize:10, color:m.color, fontWeight:500 }}>{t}</span>
                ))}
              </div>
              {m.quote && (
                <blockquote style={{ margin:0, padding:'10px 12px', background:'var(--m-bg)', border:'1px solid var(--m-border)', borderLeft:`2px solid ${m.color}`, borderRadius:8, fontSize:12, color:'var(--m-text-dim)', fontStyle:'italic', lineHeight:1.5, marginBottom:14, position:'relative' }}>
                  "{m.quote}"
                </blockquote>
              )}
              <button style={{
                width:'100%', padding:'9px 12px',
                background:'transparent', border:`1px solid ${m.color}`, borderRadius:8,
                color:m.color, fontSize:12, fontWeight:600, display:'inline-flex', alignItems:'center', justifyContent:'center', gap:6,
              }}>
                {m.link.label} <Icon name="arrowRight" size={12}/>
              </button>
            </div>
          ))}
        </div>

        {/* Stats */}
        <div style={{ display:'grid', gridTemplateColumns:'repeat(4, 1fr)', gap:14, marginTop:36, padding:'24px', background:'var(--m-surface)', border:'1px solid var(--m-border)', borderRadius:16 }}>
          <Stat size="lg" label="Dias construindo" value="184" sub="desde o primeiro commit"/>
          <Stat size="lg" label="Commits" value="2,847" sub="tudo versionado"/>
          <Stat size="lg" label="Linhas de código" value="62k" sub="TypeScript + SQL" accent="var(--m-cyan)"/>
          <Stat size="lg" label="Cafés" value="∞" sub="combustível principal" accent="var(--m-accent)"/>
        </div>
      </div>
    </div>
  );
}

window.ScreenChat = ScreenChat;
window.ScreenChangelog = ScreenChangelog;
window.ScreenTeam = ScreenTeam;
