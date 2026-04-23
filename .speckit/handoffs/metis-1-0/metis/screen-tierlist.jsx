// Tier List redesign — transforma a tabela chata em uma tela rica e visual.

function ScreenTierList() {
  const [activeRole, setActiveRole] = React.useState('');
  const [activeElo, setActiveElo] = React.useState('EMERALD');

  return (
    <div className="metis-scope" style={{ width:'100%', height:'100%', overflow:'auto', background:'var(--m-bg)' }}>
      <AppHeader active="tierlist"/>

      <div style={{ maxWidth:1200, margin:'0 auto', padding:'28px 28px 48px' }}>
        {/* Title block */}
        <div style={{ display:'flex', alignItems:'flex-end', justifyContent:'space-between', marginBottom:24 }}>
          <div>
            <div style={{ fontSize:11, color:'var(--m-text-dim)', textTransform:'uppercase', letterSpacing:'0.1em', fontWeight:600, marginBottom:8 }}>Patch 14.21 · Emerald+ · BR</div>
            <h1 className="font-display" style={{ fontSize:40, fontWeight:700, letterSpacing:'-0.03em', marginBottom:6 }}>Tier List</h1>
            <p style={{ fontSize:14, color:'var(--m-text-dim)', maxWidth:520 }}>
              Ranking de campeões por role com winrate, pickrate e tendência. Dados de <span className="tabular" style={{ color:'var(--m-text)', fontWeight:600 }}>1.284.612</span> partidas.
            </p>
          </div>
          <div style={{ display:'flex', gap:8 }}>
            <Pill icon="sliders">Mais filtros</Pill>
            <Pill icon="filter" active>Campeões populares</Pill>
          </div>
        </div>

        {/* Filters row */}
        <div style={{ display:'flex', gap:20, marginBottom:20, padding:'12px 16px', background:'var(--m-surface)', border:'1px solid var(--m-border)', borderRadius:14, flexWrap:'wrap' }}>
          <div style={{ display:'flex', alignItems:'center', gap:10, flex:'1 1 240px', padding:'6px 10px', background:'var(--m-bg)', border:'1px solid var(--m-border)', borderRadius:10 }}>
            <Icon name="search" size={14} style={{ color:'var(--m-text-dim)' }}/>
            <input placeholder="Buscar campeão..." style={{ flex:1, background:'transparent', border:'none', color:'var(--m-text)', fontSize:13, outline:'none', fontFamily:'inherit' }}/>
          </div>

          <div style={{ display:'flex', gap:4 }}>
            {[
              { v:'', l:'Todas' },
              { v:'TOP', l:'Top' },
              { v:'JUNGLE', l:'Jungle' },
              { v:'MIDDLE', l:'Mid' },
              { v:'BOTTOM', l:'ADC' },
              { v:'UTILITY', l:'Sup' },
            ].map(r => (
              <button key={r.v} onClick={() => setActiveRole(r.v)} style={{
                display:'inline-flex', alignItems:'center', gap:6, padding:'7px 12px', borderRadius:8,
                background: activeRole === r.v ? 'var(--m-accent)' : 'transparent',
                color: activeRole === r.v ? '#1a1510' : 'var(--m-text-dim)',
                border:'1px solid ' + (activeRole === r.v ? 'var(--m-accent)' : 'var(--m-border)'),
                fontSize:12, fontWeight:600,
              }}>
                {r.v && <RoleGlyph role={r.v} size={12}/>}
                {r.l}
              </button>
            ))}
          </div>

          <div style={{ display:'flex', gap:4, marginLeft:'auto', alignItems:'center' }}>
            <span style={{ fontSize:11, color:'var(--m-muted)', marginRight:6 }}>Elo:</span>
            {['IRON','BRONZE','SILVER','GOLD','PLAT','EMERALD','DIAMOND','MASTER+'].map(e => (
              <button key={e} onClick={() => setActiveElo(e)} style={{
                padding:'6px 10px', borderRadius:8, fontSize:11, fontWeight:600,
                background: activeElo === e ? 'rgba(245,200,66,0.1)' : 'transparent',
                color: activeElo === e ? 'var(--m-accent)' : 'var(--m-text-dim)',
                border:'1px solid ' + (activeElo === e ? 'rgba(245,200,66,0.3)' : 'var(--m-border)'),
              }}>{e}</button>
            ))}
          </div>
        </div>

        {/* Tier rows */}
        {['S+','S','A','B','C'].map(tier => {
          const champs = TIER_DATA.filter(c => c.t === tier);
          if (!champs.length) return null;
          const c = TIER_COLORS[tier];
          return (
            <div key={tier} style={{ display:'grid', gridTemplateColumns:'72px 1fr', gap:16, marginBottom:18, alignItems:'stretch' }}>
              <div style={{
                display:'flex', alignItems:'center', justifyContent:'center',
                background: c.bg, border:`1px solid ${c.border}`,
                borderRadius:14,
                fontSize:34, fontWeight:800, color: c.text,
                letterSpacing:'-0.03em',
              }}>
                {tier}
              </div>
              <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(260px, 1fr))', gap:10 }}>
                {champs.map(ch => (
                  <div key={ch.champ} style={{
                    display:'flex', gap:12, padding:12,
                    background:'var(--m-surface)', border:'1px solid var(--m-border)', borderRadius:12,
                  }}>
                    <ChampPortrait name={ch.champ} size={48} role={ch.role}/>
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ display:'flex', alignItems:'baseline', justifyContent:'space-between', gap:8 }}>
                        <div className="font-display" style={{ fontSize:15, fontWeight:600 }}>{ch.champ}</div>
                        <span style={{ fontSize:10, color:'var(--m-muted)', textTransform:'uppercase', letterSpacing:'0.06em' }}>{ROLES_PT[ch.role]}</span>
                      </div>
                      <div style={{ display:'flex', alignItems:'center', gap:8, marginTop:4 }}>
                        <span className="tabular" style={{ fontSize:18, fontWeight:700, color: ch.wr > 52 ? 'var(--m-green)' : ch.wr > 50 ? 'var(--m-accent)' : 'var(--m-red)' }}>{ch.wr}%</span>
                        <span style={{ display:'inline-flex', alignItems:'center', gap:2, fontSize:10, fontWeight:600, color: ch.trend === 'up' ? 'var(--m-green)' : ch.trend === 'down' ? 'var(--m-red)' : 'var(--m-muted)' }}>
                          {ch.trend === 'up' ? '▲' : ch.trend === 'down' ? '▼' : '━'}
                          {ch.trend !== 'flat' && (ch.trend === 'up' ? ' +1.2' : ' -0.8')}
                        </span>
                        <div style={{ flex:1 }}/>
                        <span className="tabular" style={{ fontSize:11, color:'var(--m-text-dim)' }}>{ch.pr}% pick</span>
                      </div>
                      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:6, marginTop:8, fontSize:10 }}>
                        <div>
                          <div style={{ color:'var(--m-muted)', fontSize:9, textTransform:'uppercase', fontWeight:600, letterSpacing:'0.06em' }}>KDA</div>
                          <div className="tabular" style={{ color:'var(--m-text)', fontWeight:600, marginTop:1 }}>{ch.kda}</div>
                        </div>
                        <div>
                          <div style={{ color:'var(--m-muted)', fontSize:9, textTransform:'uppercase', fontWeight:600, letterSpacing:'0.06em' }}>Ban</div>
                          <div className="tabular" style={{ color:'var(--m-text)', fontWeight:600, marginTop:1 }}>{ch.banRate}%</div>
                        </div>
                        <div>
                          <div style={{ color:'var(--m-muted)', fontSize:9, textTransform:'uppercase', fontWeight:600, letterSpacing:'0.06em' }}>Games</div>
                          <div className="tabular" style={{ color:'var(--m-text)', fontWeight:600, marginTop:1 }}>{(ch.games/1000).toFixed(1)}k</div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}

      </div>
    </div>
  );
}

window.ScreenTierList = ScreenTierList;
