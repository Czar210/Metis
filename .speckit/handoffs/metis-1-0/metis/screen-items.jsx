// Items screen — redesign da tela de itens, tornando-a rica em hierarquia visual.

function ScreenItems() {
  const [activeRole, setActiveRole] = React.useState('');
  const [activeCat, setActiveCat] = React.useState('');
  const [sortBy, setSortBy] = React.useState('popular');

  // Top 3 "pick" itens
  const top3 = [...ITEMS_DATA].sort((a,b) => b.picks - a.picks).slice(0,3);
  const topWR = [...ITEMS_DATA].sort((a,b) => b.wr - a.wr).slice(0,3);

  let list = ITEMS_DATA;
  if (activeRole) list = list.filter(x => x.role === activeRole);
  if (activeCat)  list = list.filter(x => x.cat === activeCat);
  if (sortBy === 'winrate') list = [...list].sort((a,b) => b.wr - a.wr);
  else list = [...list].sort((a,b) => b.picks - a.picks);

  return (
    <div className="metis-scope" style={{ width:'100%', height:'100%', overflow:'auto', background:'var(--m-bg)' }}>
      <AppHeader active="items"/>

      <div style={{ maxWidth:1200, margin:'0 auto', padding:'28px 28px 48px' }}>
        {/* Title */}
        <div style={{ marginBottom:20 }}>
          <div style={{ fontSize:11, color:'var(--m-text-dim)', textTransform:'uppercase', letterSpacing:'0.1em', fontWeight:600, marginBottom:8 }}>Patch 14.21 · Banco Metis</div>
          <h1 className="font-display" style={{ fontSize:40, fontWeight:700, letterSpacing:'-0.03em', marginBottom:6 }}>Estatísticas de Itens</h1>
          <p style={{ fontSize:14, color:'var(--m-text-dim)' }}>
            Winrate e popularidade de cada item · <span className="tabular" style={{ color:'var(--m-text)', fontWeight:600 }}>1.164</span> itens mapeados
          </p>
        </div>

        {/* Spotlight: top picks + top winrates */}
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16, marginBottom:24 }}>
          <Card>
            <SectionLabel icon="flame" right={<span style={{ fontSize:10, color:'var(--m-muted)', textTransform:'uppercase', letterSpacing:'0.06em' }}>+ populares</span>}>Mais comprados hoje</SectionLabel>
            <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
              {top3.map((it, i) => (
                <div key={it.id} style={{ display:'flex', alignItems:'center', gap:12, padding:'8px 4px' }}>
                  <div className="tabular font-display" style={{ fontSize:24, fontWeight:700, color:'var(--m-accent)', width:28, textAlign:'right' }}>{i+1}</div>
                  <div style={{ width:44, height:44, borderRadius:8, background:'var(--m-surface-2)', border:'1px solid var(--m-border-2)', backgroundImage:`url(${itemImg(it.id)})`, backgroundSize:'cover', backgroundPosition:'center' }}/>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ fontSize:13, fontWeight:600 }}>{it.name}</div>
                    <div style={{ fontSize:11, color:'var(--m-text-dim)', marginTop:2 }}>{it.cat} · {it.cost}g</div>
                  </div>
                  <div style={{ textAlign:'right' }}>
                    <div className="tabular" style={{ fontSize:13, fontWeight:600 }}>{(it.picks/1000).toFixed(1)}k</div>
                    <div style={{ fontSize:10, color:'var(--m-muted)' }}>picks</div>
                  </div>
                </div>
              ))}
            </div>
          </Card>
          <Card>
            <SectionLabel icon="trending" right={<span style={{ fontSize:10, color:'var(--m-green)', textTransform:'uppercase', letterSpacing:'0.06em' }}>+ eficientes</span>}>Top winrate (min. 500 picks)</SectionLabel>
            <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
              {topWR.map((it, i) => (
                <div key={it.id} style={{ display:'flex', alignItems:'center', gap:12, padding:'8px 4px' }}>
                  <div className="tabular font-display" style={{ fontSize:24, fontWeight:700, color:'var(--m-green)', width:28, textAlign:'right' }}>{i+1}</div>
                  <div style={{ width:44, height:44, borderRadius:8, background:'var(--m-surface-2)', border:'1px solid var(--m-border-2)', backgroundImage:`url(${itemImg(it.id)})`, backgroundSize:'cover', backgroundPosition:'center' }}/>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ fontSize:13, fontWeight:600 }}>{it.name}</div>
                    <div style={{ fontSize:11, color:'var(--m-text-dim)', marginTop:2 }}>{it.cat} · {it.cost}g</div>
                  </div>
                  <div style={{ textAlign:'right' }}>
                    <div className="tabular" style={{ fontSize:15, fontWeight:700, color:'var(--m-green)' }}>{it.wr}%</div>
                    <div style={{ fontSize:10, color:'var(--m-muted)' }}>{it.picks} picks</div>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>

        {/* Filter bar */}
        <div style={{ display:'flex', gap:10, marginBottom:16, padding:'12px 16px', background:'var(--m-surface)', border:'1px solid var(--m-border)', borderRadius:14, flexWrap:'wrap', alignItems:'center' }}>
          <div style={{ display:'flex', alignItems:'center', gap:10, flex:'1 1 240px', padding:'6px 10px', background:'var(--m-bg)', border:'1px solid var(--m-border)', borderRadius:10 }}>
            <Icon name="search" size={14} style={{ color:'var(--m-text-dim)' }}/>
            <input placeholder="Buscar item..." style={{ flex:1, background:'transparent', border:'none', color:'var(--m-text)', fontSize:13, outline:'none', fontFamily:'inherit' }}/>
          </div>

          <div style={{ display:'flex', gap:4 }}>
            {['','TOP','JG','MID','ADC','SUP'].map(r => (
              <button key={r||'all'} onClick={() => setActiveRole(r)} style={{
                padding:'6px 12px', borderRadius:8, fontSize:12, fontWeight:600,
                background: activeRole === r ? 'var(--m-accent)' : 'transparent',
                color: activeRole === r ? '#1a1510' : 'var(--m-text-dim)',
                border:'1px solid ' + (activeRole === r ? 'var(--m-accent)' : 'var(--m-border)'),
              }}>{r || 'Todas'}</button>
            ))}
          </div>

          <div style={{ display:'flex', gap:4, marginLeft:6 }}>
            {['','Lendário','Botas','Inicial','Utilitário'].map(c => (
              <button key={c||'all'} onClick={() => setActiveCat(c)} style={{
                padding:'6px 10px', borderRadius:8, fontSize:11, fontWeight:600,
                background: activeCat === c ? 'rgba(245,200,66,0.1)' : 'transparent',
                color: activeCat === c ? 'var(--m-accent)' : 'var(--m-text-dim)',
                border:'1px solid ' + (activeCat === c ? 'rgba(245,200,66,0.3)' : 'var(--m-border)'),
              }}>{c || 'Categorias'}</button>
            ))}
          </div>

          <div style={{ marginLeft:'auto', display:'flex', gap:4 }}>
            <span style={{ fontSize:11, color:'var(--m-muted)', alignSelf:'center', marginRight:4 }}>Ordenar:</span>
            <Pill color="accent" active={sortBy === 'popular'} onClick={() => setSortBy('popular')}>Popular</Pill>
            <Pill color="accent" active={sortBy === 'winrate'} onClick={() => setSortBy('winrate')}>Winrate</Pill>
          </div>
        </div>

        {/* Table */}
        <Card pad={0}>
          <div style={{ display:'grid', gridTemplateColumns:'50px 1fr 90px 80px 110px 110px 90px', gap:12, padding:'10px 20px', fontSize:10, color:'var(--m-muted)', textTransform:'uppercase', letterSpacing:'0.06em', fontWeight:600, borderBottom:'1px solid var(--m-border)' }}>
            <span>#</span><span>Item</span><span>Categoria</span><span className="tabular">Custo</span><span className="tabular">Picks</span><span>Winrate</span><span>Tendência</span>
          </div>
          {list.map((it, i) => (
            <div key={it.id} style={{
              display:'grid', gridTemplateColumns:'50px 1fr 90px 80px 110px 110px 90px', gap:12,
              padding:'12px 20px', alignItems:'center', borderBottom:'1px solid rgba(34,40,56,0.4)',
            }}>
              <span className="tabular font-display" style={{ fontSize:16, fontWeight:700, color:'var(--m-text-dim)' }}>{i+1}</span>
              <div style={{ display:'flex', alignItems:'center', gap:12 }}>
                <div style={{ width:36, height:36, borderRadius:7, background:'var(--m-surface-2)', border:'1px solid var(--m-border-2)', backgroundImage:`url(${itemImg(it.id)})`, backgroundSize:'cover', backgroundPosition:'center' }}/>
                <div>
                  <div style={{ fontSize:13, fontWeight:500 }}>{it.name}</div>
                  <div style={{ display:'flex', gap:4, marginTop:3 }}>
                    {it.tags.slice(0,2).map(t => (
                      <span key={t} style={{ fontSize:9, padding:'1px 6px', background:'var(--m-surface-2)', border:'1px solid var(--m-border-2)', borderRadius:3, color:'var(--m-text-dim)' }}>{t}</span>
                    ))}
                  </div>
                </div>
              </div>
              <span style={{ fontSize:11, color:'var(--m-text-dim)' }}>{it.cat}</span>
              <span className="tabular" style={{ fontSize:12, color:'var(--m-accent)' }}>{it.cost}g</span>
              <div>
                <div className="tabular" style={{ fontSize:13, fontWeight:600 }}>{it.picks.toLocaleString()}</div>
                <Bar value={it.picks} max={1600} color="var(--m-accent)" height={3}/>
              </div>
              <div>
                <div className="tabular" style={{ fontSize:14, fontWeight:700, color: it.wr > 52 ? 'var(--m-green)' : it.wr > 48 ? 'var(--m-text)' : 'var(--m-red)' }}>{it.wr}%</div>
                <Bar value={it.wr - 40} max={25} color={it.wr > 52 ? 'var(--m-green)' : it.wr > 48 ? 'var(--m-accent)' : 'var(--m-red)'} height={3}/>
              </div>
              <span style={{
                display:'inline-flex', alignItems:'center', gap:4, fontSize:11, fontWeight:600,
                color: it.trend === 'up' ? 'var(--m-green)' : it.trend === 'down' ? 'var(--m-red)' : 'var(--m-muted)',
              }}>
                {it.trend === 'up' ? '▲ em alta' : it.trend === 'down' ? '▼ em queda' : '━ estável'}
              </span>
            </div>
          ))}
        </Card>
      </div>
    </div>
  );
}

window.ScreenItems = ScreenItems;
