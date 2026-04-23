// Plans/Pricing screen — redesign dos 4 tiers.

function ScreenPlans() {
  const [period, setPeriod] = React.useState('monthly');

  return (
    <div className="metis-scope" style={{ width:'100%', height:'100%', overflow:'auto', background:'var(--m-bg)' }}>
      <AppHeader active="plans"/>

      <div style={{ maxWidth:1200, margin:'0 auto', padding:'44px 28px 48px' }}>
        {/* Header */}
        <div style={{ textAlign:'center', marginBottom:32 }}>
          <div style={{ display:'inline-flex', alignItems:'center', gap:6, padding:'4px 10px', borderRadius:999, background:'rgba(245,200,66,0.1)', border:'1px solid rgba(245,200,66,0.25)', color:'var(--m-accent)', fontSize:11, fontWeight:600, letterSpacing:'0.06em', textTransform:'uppercase', marginBottom:14 }}>
            <Icon name="sparkles" size={12}/> Planos Metis
          </div>
          <h1 className="font-display" style={{ fontSize:44, fontWeight:700, letterSpacing:'-0.03em', marginBottom:10 }}>
            Suba de Elo no <span style={{ color:'var(--m-accent)' }}>Metis</span>
          </h1>
          <p style={{ fontSize:15, color:'var(--m-text-dim)', maxWidth:540, margin:'0 auto' }}>
            Comece no Prata e evolua até Challenger. Cada tier desbloqueia ferramentas mais poderosas.
          </p>

          {/* Period toggle */}
          <div style={{ display:'inline-flex', padding:3, background:'var(--m-surface)', border:'1px solid var(--m-border)', borderRadius:999, marginTop:22 }}>
            {[
              { v:'monthly', l:'Mensal' },
              { v:'yearly',  l:'Anual', badge:'-20%' },
            ].map(p => (
              <button key={p.v} onClick={() => setPeriod(p.v)} style={{
                padding:'7px 18px', borderRadius:999,
                background: period === p.v ? 'var(--m-accent)' : 'transparent',
                color: period === p.v ? '#1a1510' : 'var(--m-text-dim)',
                border:'none', fontSize:13, fontWeight:600, display:'inline-flex', alignItems:'center', gap:6,
              }}>
                {p.l}
                {p.badge && <span style={{ padding:'1px 6px', borderRadius:999, fontSize:9, fontWeight:700, background: period === p.v ? 'rgba(26,21,16,0.2)' : 'rgba(74,222,128,0.2)', color: period === p.v ? '#1a1510' : 'var(--m-green)' }}>{p.badge}</span>}
              </button>
            ))}
          </div>
        </div>

        {/* Plan cards */}
        <div style={{ display:'grid', gridTemplateColumns:'repeat(4, 1fr)', gap:14 }}>
          {PLANS.map(p => {
            const yearlyPrice = (p.price * 12 * 0.8).toFixed(2);
            const actualPrice = period === 'monthly' ? p.price.toFixed(2) : yearlyPrice;
            const actualLabel = p.price === 0 ? p.priceLabel : (period === 'monthly' ? '/mês' : '/ano');
            const glowColor = p.color;
            return (
              <div key={p.tier} style={{
                position:'relative',
                padding: p.popular ? 28 : 22,
                background:'var(--m-surface)',
                border:'1px solid ' + (p.popular ? glowColor : 'var(--m-border)'),
                borderRadius:16,
                boxShadow: p.popular ? `0 0 0 1px ${glowColor}40, 0 30px 60px -20px ${glowColor}55` : 'none',
                overflow:'visible',
              }}>
                {p.popular && (
                  <div style={{ position:'absolute', top:-11, left:'50%', transform:'translateX(-50%)', padding:'4px 12px', background:glowColor, borderRadius:999, fontSize:10, fontWeight:700, color:'#1a1510', letterSpacing:'0.06em', textTransform:'uppercase', whiteSpace:'nowrap' }}>
                    Mais popular
                  </div>
                )}
                {/* Rank icon */}
                <div style={{ display:'flex', justifyContent:'center', marginBottom:14 }}>
                  <div style={{
                    width:68, height:68, borderRadius:'50%',
                    background: `radial-gradient(circle at 30% 30%, ${glowColor}, ${glowColor}50 60%, transparent)`,
                    display:'flex', alignItems:'center', justifyContent:'center',
                    position:'relative',
                  }}>
                    <div style={{ width:44, height:44, borderRadius:'50%', background:'var(--m-bg)', border:`2px solid ${glowColor}`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:22, color:glowColor }}>◆</div>
                  </div>
                </div>

                <div style={{ textAlign:'center', marginBottom:16 }}>
                  <h3 className="font-display" style={{ fontSize:22, fontWeight:700 }}>{p.tier}</h3>
                  <div style={{ fontSize:10, color:glowColor, textTransform:'uppercase', letterSpacing:'0.14em', fontWeight:700, marginTop:3 }}>{p.rank}</div>
                </div>

                <div style={{ textAlign:'center', marginBottom:18 }}>
                  <div style={{ display:'inline-flex', alignItems:'baseline', gap:2 }}>
                    <span style={{ fontSize:14, color:'var(--m-text-dim)', fontWeight:500 }}>R$</span>
                    <span className="tabular font-display" style={{ fontSize:36, fontWeight:700, letterSpacing:'-0.02em' }}>{actualPrice}</span>
                  </div>
                  <div style={{ fontSize:11, color:'var(--m-text-dim)', marginTop:2 }}>{actualLabel}</div>
                </div>

                <button style={{
                  width:'100%', padding:'11px 14px', borderRadius:10,
                  background: p.actionStyle === 'muted' ? 'var(--m-surface-2)' : `linear-gradient(135deg, ${glowColor}, ${glowColor}cc)`,
                  color: p.actionStyle === 'muted' ? 'var(--m-text-dim)' : '#0B0D12',
                  border: p.actionStyle === 'muted' ? '1px solid var(--m-border-2)' : 'none',
                  fontSize:13, fontWeight:600, marginBottom:18, cursor:'pointer',
                }}>{p.action}</button>

                <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                  {p.features.map((f, i) => (
                    <div key={i} style={{ display:'flex', alignItems:'flex-start', gap:8, opacity: f.on ? 1 : 0.4 }}>
                      <div style={{
                        flexShrink:0, width:14, height:14, marginTop:2,
                        display:'flex', alignItems:'center', justifyContent:'center',
                      }}>
                        {f.on ? (
                          <Icon name="check" size={12} style={{ color:glowColor }} strokeWidth={2.5}/>
                        ) : (
                          <Icon name="x" size={12} style={{ color:'var(--m-muted)' }} strokeWidth={2}/>
                        )}
                      </div>
                      <span style={{ fontSize:11, color: f.on ? 'var(--m-text)' : 'var(--m-muted)', lineHeight:1.45 }}>{f.t}</span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer info */}
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:14, marginTop:32 }}>
          {[
            { ico:'shield', t:'Cancele quando quiser', d:'Sem taxas ocultas, sem contrato.' },
            { ico:'bolt',   t:'Ativação imediata',     d:'Features liberadas em segundos após o pagamento.' },
            { ico:'brain',  t:'IA atualizada',          d:'Gemini 2.5 Flash · treinada pra League.' },
          ].map((x, i) => (
            <div key={i} style={{ display:'flex', gap:12, alignItems:'flex-start', padding:16, background:'var(--m-surface)', border:'1px solid var(--m-border)', borderRadius:12 }}>
              <div style={{ width:32, height:32, borderRadius:8, background:'rgba(245,200,66,0.1)', display:'flex', alignItems:'center', justifyContent:'center', color:'var(--m-accent)', flexShrink:0 }}>
                <Icon name={x.ico} size={16}/>
              </div>
              <div>
                <div style={{ fontSize:13, fontWeight:600 }}>{x.t}</div>
                <div style={{ fontSize:11, color:'var(--m-text-dim)', marginTop:3 }}>{x.d}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

window.ScreenPlans = ScreenPlans;
