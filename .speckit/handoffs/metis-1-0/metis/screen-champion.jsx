// Champion detail page — 4 tabs (Overview, Builds, Matchups, Sinergias)

function ScreenChampion() {
  const [tab, setTab] = React.useState('overview');
  const [role, setRole] = React.useState('');

  return (
    <div className="metis-scope" style={{ width:'100%', height:'100%', overflow:'auto', background:'var(--m-bg)' }}>
      <AppHeader active="tierlist"/>

      {/* Hero banner */}
      <div style={{
        position:'relative',
        borderBottom:'1px solid var(--m-border)',
        background:'linear-gradient(180deg, rgba(139,127,255,0.12), transparent)',
        overflow:'hidden',
      }}>
        <div style={{ position:'absolute', top:-60, right:-40, width:280, height:280, borderRadius:'50%', background:'radial-gradient(circle, rgba(139,127,255,0.25), transparent 70%)', filter:'blur(50px)' }}/>
        <div style={{ maxWidth:1200, margin:'0 auto', padding:'24px 28px', position:'relative' }}>
          <a href="#" style={{ display:'inline-flex', alignItems:'center', gap:5, fontSize:12, color:'var(--m-text-dim)', textDecoration:'none', marginBottom:16 }}>
            ← Tier List
          </a>
          <div style={{ display:'flex', alignItems:'flex-end', gap:20 }}>
            <div style={{ width:96, height:96, borderRadius:14, overflow:'hidden', border:'2px solid rgba(139,127,255,0.4)', boxShadow:'0 0 40px rgba(139,127,255,0.25)', backgroundImage:`url(${champImg(CHAMP.name)})`, backgroundSize:'cover' }}/>
            <div style={{ flex:1 }}>
              <div style={{ fontSize:11, color:'var(--m-violet)', textTransform:'uppercase', letterSpacing:'0.1em', fontWeight:600, marginBottom:4 }}>{CHAMP.title}</div>
              <h1 className="font-display" style={{ fontSize:42, fontWeight:700, letterSpacing:'-0.03em' }}>{CHAMP.name}</h1>
              <div style={{ display:'flex', alignItems:'center', gap:10, marginTop:8, fontSize:12, color:'var(--m-text-dim)' }}>
                <span className="tabular" style={{ color:'var(--m-text)', fontWeight:600 }}>{CHAMP.games}</span> partidas no banco Metis
                <span style={{ color:'var(--m-muted)' }}>·</span>
                <span>Roles: {CHAMP.roles.map(r => ROLES_PT[r==='ADC'?'BOTTOM':r] || r).join(', ')}</span>
              </div>
            </div>
            <div style={{ display:'flex', gap:8 }}>
              <button style={{ padding:'9px 14px', background:'var(--m-surface-2)', border:'1px solid var(--m-border-2)', borderRadius:10, color:'var(--m-text)', fontSize:12, fontWeight:500, display:'inline-flex', alignItems:'center', gap:6 }}>
                <Icon name="star" size={13} style={{ color:'var(--m-accent)' }}/> Favoritar
              </button>
              <button style={{ padding:'9px 14px', background:'var(--m-accent)', border:'none', borderRadius:10, color:'#1a1510', fontSize:12, fontWeight:600, display:'inline-flex', alignItems:'center', gap:6 }}>
                <Icon name="brain" size={13}/> Perguntar à IA
              </button>
            </div>
          </div>
        </div>
      </div>

      <div style={{ maxWidth:1200, margin:'0 auto', padding:'20px 28px 48px' }}>
        {/* Role filter pills */}
        <div style={{ display:'flex', gap:6, marginBottom:14, flexWrap:'wrap' }}>
          {[
            { v:'',    l:'Todos' },
            { v:'TOP', l:'Top' },
            { v:'JUNGLE', l:'Jungle' },
            { v:'MIDDLE', l:'Mid' },
            { v:'BOTTOM', l:'ADC' },
            { v:'UTILITY', l:'Suporte' },
          ].map(r => (
            <button key={r.v||'all'} onClick={() => setRole(r.v)} style={{
              padding:'6px 12px', borderRadius:8, fontSize:12, fontWeight:600,
              background: role === r.v ? 'var(--m-accent)' : 'transparent',
              color: role === r.v ? '#1a1510' : 'var(--m-text-dim)',
              border:'1px solid ' + (role === r.v ? 'var(--m-accent)' : 'var(--m-border)'),
            }}>{r.l}</button>
          ))}
          <div style={{ flex:1 }}/>
          <select style={{ padding:'6px 12px', background:'var(--m-surface)', border:'1px solid var(--m-border)', borderRadius:8, color:'var(--m-text-dim)', fontSize:12, fontFamily:'inherit' }}>
            <option>Todos</option>
          </select>
          <select style={{ padding:'6px 12px', background:'var(--m-surface)', border:'1px solid var(--m-border)', borderRadius:8, color:'var(--m-text-dim)', fontSize:12, fontFamily:'inherit' }}>
            <option>Todos os patches</option>
          </select>
        </div>

        {/* Tabs */}
        <div style={{ display:'flex', gap:2, borderBottom:'1px solid var(--m-border)', marginBottom:24 }}>
          {[
            { id:'overview', l:'Overview', ic:'target' },
            { id:'builds',   l:'Builds',   ic:'sword' },
            { id:'matchups', l:'Matchups', ic:'crosshair' },
            { id:'synergy',  l:'Sinergias',ic:'users' },
          ].map(t => (
            <button key={t.id} onClick={() => setTab(t.id)} style={{
              padding:'10px 16px', background:'transparent', border:'none',
              color: tab === t.id ? 'var(--m-accent)' : 'var(--m-text-dim)',
              fontSize:13, fontWeight: tab === t.id ? 600 : 500,
              borderBottom:'2px solid ' + (tab === t.id ? 'var(--m-accent)' : 'transparent'),
              marginBottom:-1, display:'inline-flex', alignItems:'center', gap:6,
            }}>
              <Icon name={t.ic} size={13}/>
              {t.l}
            </button>
          ))}
        </div>

        {tab === 'overview'  && <ChampOverview/>}
        {tab === 'builds'    && <ChampBuilds/>}
        {tab === 'matchups'  && <ChampMatchups/>}
        {tab === 'synergy'   && <ChampSynergies/>}
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────
function ChampOverview() {
  const o = CHAMP.overview;
  return (
    <div style={{ display:'grid', gridTemplateColumns:'2fr 1fr', gap:20 }}>
      <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
        {/* KPIs */}
        <div style={{ display:'grid', gridTemplateColumns:'repeat(4, 1fr)', gap:12 }}>
          <Card>
            <SectionLabel icon="target">Winrate</SectionLabel>
            <div className="tabular font-display" style={{ fontSize:34, fontWeight:700, color: o.wr > 52 ? 'var(--m-green)' : 'var(--m-accent)' }}>{o.wr}%</div>
            <div style={{ marginTop:6 }}><Bar value={o.wr - 40} max={25} color={o.wr > 52 ? 'var(--m-green)' : 'var(--m-accent)'} height={4}/></div>
            <div style={{ fontSize:11, color:'var(--m-text-dim)', marginTop:6 }}>média role: 50.2%</div>
          </Card>
          <Card>
            <SectionLabel icon="sword">KDA</SectionLabel>
            <div className="tabular font-display" style={{ fontSize:34, fontWeight:700 }}>{o.kda}</div>
            <div className="tabular" style={{ fontSize:11, color:'var(--m-text-dim)', marginTop:4 }}>
              <span style={{ color:'var(--m-green)' }}>{o.avgK}</span> / <span style={{ color:'var(--m-red)' }}>{o.avgD}</span> / <span style={{ color:'var(--m-cyan)' }}>{o.avgA}</span>
            </div>
            <div style={{ fontSize:10, color:'var(--m-muted)', marginTop:8 }}>média por partida</div>
          </Card>
          <Card>
            <SectionLabel icon="crosshair">CS / min</SectionLabel>
            <div className="tabular font-display" style={{ fontSize:34, fontWeight:700 }}>{o.csMin}</div>
            <div style={{ marginTop:6 }}><Bar value={68} max={100} color="var(--m-accent)" height={4}/></div>
            <div style={{ fontSize:11, color:'var(--m-text-dim)', marginTop:6 }}>top 32% dos ADCs</div>
          </Card>
          <Card>
            <SectionLabel icon="zap">DPM</SectionLabel>
            <div className="tabular font-display" style={{ fontSize:34, fontWeight:700 }}>{o.dpm}</div>
            <div style={{ marginTop:6 }}><Bar value={82} max={100} color="var(--m-pink)" height={4}/></div>
            <div style={{ fontSize:11, color:'var(--m-text-dim)', marginTop:6 }}>ouro médio: {(o.avgGold/1000).toFixed(1)}k</div>
          </Card>
        </div>

        {/* Power curve */}
        <Card>
          <SectionLabel icon="trending">Curva de poder por tempo de jogo</SectionLabel>
          <PowerCurve/>
          <div style={{ display:'flex', justifyContent:'space-between', fontSize:10, color:'var(--m-muted)', marginTop:8, padding:'0 4px' }}>
            <span>0'</span><span>10'</span><span>20'</span><span>30'</span><span>40'+</span>
          </div>
          <div style={{ fontSize:11, color:'var(--m-text-dim)', marginTop:10, padding:'8px 12px', background:'var(--m-bg)', border:'1px solid var(--m-border)', borderRadius:8 }}>
            <span style={{ color:'var(--m-violet)', fontWeight:600 }}>Analítico:</span> Vayne é um <b>scaling hyper-carry</b>. Winrate sobe de 42% aos 15 min para <b style={{ color:'var(--m-green)' }}>68%</b> depois dos 35 min. Prolongue o jogo.
          </div>
        </Card>

        {/* Abilities priority */}
        <Card>
          <SectionLabel icon="sparkles">Ordem de habilidades</SectionLabel>
          <AbilitiesGrid/>
        </Card>
      </div>

      {/* Sidebar — radar + best-in/against */}
      <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
        <Card>
          <SectionLabel icon="target">Perfil do campeão</SectionLabel>
          <div style={{ display:'flex', justifyContent:'center', margin:'4px -8px -8px' }}>
            <RadarChart size={230} color="var(--m-violet)" axes={[
              { label:'Dano',    value:0.92 },
              { label:'Sustain', value:0.35 },
              { label:'Utility', value:0.22 },
              { label:'Mobilidade', value:0.85 },
              { label:'Defesa',  value:0.28 },
              { label:'Dificuldade',value:0.80 },
            ]}/>
          </div>
        </Card>

        <Card>
          <SectionLabel icon="shield">Spells recomendadas</SectionLabel>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
            {[
              { name:'Flash',  pick:94, wr:51 },
              { name:'Exausto',pick:68, wr:53 },
              { name:'Cura',   pick:22, wr:48 },
              { name:'Aniq.',  pick:12, wr:47 },
            ].map(s => (
              <div key={s.name} style={{ padding:'10px 12px', background:'var(--m-surface-2)', border:'1px solid var(--m-border)', borderRadius:8 }}>
                <div style={{ fontSize:12, fontWeight:600 }}>{s.name}</div>
                <div className="tabular" style={{ fontSize:11, color:'var(--m-text-dim)', marginTop:3 }}>{s.pick}% pick · {s.wr}% WR</div>
              </div>
            ))}
          </div>
        </Card>

        <Card accent>
          <SectionLabel icon="brain">Insight da Metis</SectionLabel>
          <p style={{ fontSize:12, color:'var(--m-text)', lineHeight:1.55 }}>
            Vayne tem <span style={{ color:'var(--m-red)', fontWeight:600 }}>42% WR</span> antes dos 20 min, mas <span style={{ color:'var(--m-green)', fontWeight:600 }}>68% WR</span> após 35. Priorize farmar seguro até o 3º item.
          </p>
          <button style={{ width:'100%', marginTop:10, padding:'8px 12px', background:'var(--m-accent)', border:'none', borderRadius:8, color:'#1a1510', fontSize:11, fontWeight:600 }}>Explorar no chat →</button>
        </Card>
      </div>
    </div>
  );
}

function PowerCurve() {
  const data = [38, 41, 42, 45, 48, 52, 56, 61, 65, 68];
  return <AreaChart data={data} height={140} color="var(--m-violet)"/>;
}

function AbilitiesGrid() {
  const abilities = [
    { key:'Q', name:'Rolamento Acrobático', prio:2 },
    { key:'W', name:'Flecha de Prata',      prio:1, isMax:true },
    { key:'E', name:'Condenação',            prio:3 },
    { key:'R', name:'Hora Final',            prio:0, isUlt:true },
  ];
  // 18 level sequence
  const seq = ['Q','W','E','W','W','R','W','E','W','Q','R','E','E','Q','Q','R','Q','E'];
  return (
    <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
      <div style={{ display:'grid', gridTemplateColumns:'200px repeat(18, 1fr)', gap:3, fontSize:9, color:'var(--m-muted)', textAlign:'center', fontWeight:600 }}>
        <div style={{ textAlign:'left', paddingLeft:6 }}>HABILIDADE / NÍVEL</div>
        {Array.from({length:18}, (_, i) => <div key={i}>{i+1}</div>)}
      </div>
      {abilities.map(a => (
        <div key={a.key} style={{ display:'grid', gridTemplateColumns:'200px repeat(18, 1fr)', gap:3, alignItems:'center' }}>
          <div style={{ display:'flex', alignItems:'center', gap:8 }}>
            <div style={{ width:28, height:28, borderRadius:6, background: a.isMax ? 'rgba(245,200,66,0.2)' : 'var(--m-surface-2)', border:'1px solid ' + (a.isMax ? 'var(--m-accent)' : 'var(--m-border-2)'), display:'flex', alignItems:'center', justifyContent:'center', fontSize:12, fontWeight:700, color: a.isMax ? 'var(--m-accent)' : 'var(--m-text)' }}>{a.key}</div>
            <div>
              <div style={{ fontSize:12, fontWeight:500 }}>{a.name}</div>
              <div style={{ fontSize:9, color:'var(--m-muted)', textTransform:'uppercase', letterSpacing:'0.06em' }}>{a.isUlt ? 'Ultimate' : a.isMax ? 'MAX primeiro' : `prio ${a.prio}`}</div>
            </div>
          </div>
          {seq.map((s, i) => {
            const active = s === a.key;
            return (
              <div key={i} style={{
                height:22, borderRadius:4,
                background: active ? (a.isMax ? 'var(--m-accent)' : a.isUlt ? 'var(--m-violet)' : 'var(--m-cyan)') : 'var(--m-surface-2)',
                border:'1px solid ' + (active ? 'transparent' : 'var(--m-border)'),
                display:'flex', alignItems:'center', justifyContent:'center',
                fontSize:10, fontWeight:700, color: active ? '#0B0D12' : 'transparent',
              }}>{active ? (i+1) : '.'}</div>
            );
          })}
        </div>
      ))}
    </div>
  );
}

// ────────────────────────────────────────────────────────
function ChampBuilds() {
  return (
    <div style={{ display:'grid', gridTemplateColumns:'1fr 320px', gap:20 }}>
      <Card pad={0}>
        <div style={{ padding:'16px 20px 12px', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
          <SectionLabel icon="sword">Itens mais usados</SectionLabel>
          <div style={{ display:'flex', gap:4 }}>
            <Pill active>Todos slots</Pill>
            <Pill>Inicial</Pill>
            <Pill>1º item</Pill>
            <Pill>Botas</Pill>
          </div>
        </div>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 100px 100px 80px', gap:12, padding:'8px 20px', fontSize:10, color:'var(--m-muted)', textTransform:'uppercase', letterSpacing:'0.06em', fontWeight:600, borderTop:'1px solid var(--m-border)', borderBottom:'1px solid var(--m-border)' }}>
          <span>Item</span><span className="tabular">Picks</span><span>Winrate</span><span>Patch</span>
        </div>
        {CHAMP_BUILDS.map((b, i) => (
          <div key={b.name} style={{ display:'grid', gridTemplateColumns:'1fr 100px 100px 80px', gap:12, padding:'10px 20px', alignItems:'center', borderBottom:'1px solid rgba(34,40,56,0.4)' }}>
            <div style={{ display:'flex', alignItems:'center', gap:10 }}>
              <div style={{ width:32, height:32, borderRadius:6, background:'var(--m-surface-2)', border:'1px solid var(--m-border-2)', backgroundImage:`url(${itemImg(3000 + i*7)})`, backgroundSize:'cover' }}/>
              <div>
                <div style={{ fontSize:13, fontWeight:500 }}>{b.name}</div>
                {b.first && <div style={{ fontSize:9, color:'var(--m-accent)', fontWeight:600, textTransform:'uppercase', letterSpacing:'0.06em', marginTop:2 }}>Item inicial</div>}
              </div>
            </div>
            <div>
              <div className="tabular" style={{ fontSize:13, fontWeight:600 }}>{b.picks}</div>
              <Bar value={b.picks} max={100} color="var(--m-accent)" height={3}/>
            </div>
            <div>
              <div className="tabular" style={{ fontSize:14, fontWeight:700, color: b.wr > 52 ? 'var(--m-green)' : b.wr > 48 ? 'var(--m-text)' : 'var(--m-red)' }}>{b.wr}%</div>
              <Bar value={b.wr - 30} max={50} color={b.wr > 52 ? 'var(--m-green)' : b.wr > 48 ? 'var(--m-accent)' : 'var(--m-red)'} height={3}/>
            </div>
            <span style={{ fontSize:11, color:'var(--m-text-dim)' }}>{b.patch}</span>
          </div>
        ))}
      </Card>

      <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
        <Card>
          <SectionLabel icon="sparkles">Build recomendada</SectionLabel>
          <div style={{ fontSize:11, color:'var(--m-text-dim)', marginBottom:10, textTransform:'uppercase', letterSpacing:'0.06em', fontWeight:600 }}>Ordem mais comum (63% WR)</div>
          <div style={{ display:'flex', gap:4, flexWrap:'wrap' }}>
            {[3814, 3006, 3031, 3094, 3153, 3036].map((id, i) => (
              <React.Fragment key={i}>
                <div style={{ width:40, height:40, borderRadius:6, background:'var(--m-surface-2)', border:'1px solid var(--m-border-2)', backgroundImage:`url(${itemImg(id)})`, backgroundSize:'cover', flexShrink:0 }}/>
                {i < 5 && <Icon name="chevronRight" size={14} style={{ alignSelf:'center', color:'var(--m-muted)' }}/>}
              </React.Fragment>
            ))}
          </div>
        </Card>

        <Card>
          <SectionLabel icon="zap">Runas principais</SectionLabel>
          <div style={{ display:'flex', gap:12, padding:'10px 0' }}>
            <div style={{ flex:1 }}>
              <div style={{ fontSize:11, color:'var(--m-accent)', fontWeight:600, marginBottom:6, textTransform:'uppercase', letterSpacing:'0.06em' }}>Precisão</div>
              <div style={{ display:'flex', gap:4 }}>
                {['PC','TL','OV','CS'].map((r, i) => (
                  <div key={i} style={{ width:28, height:28, borderRadius:'50%', background: i === 0 ? 'var(--m-accent)' : 'var(--m-surface-2)', border:'1px solid ' + (i === 0 ? 'var(--m-accent)' : 'var(--m-border-2)'), display:'flex', alignItems:'center', justifyContent:'center', fontSize:9, fontWeight:700, color: i === 0 ? '#0B0D12' : 'var(--m-text-dim)' }}>{r}</div>
                ))}
              </div>
            </div>
            <div style={{ flex:1 }}>
              <div style={{ fontSize:11, color:'var(--m-green)', fontWeight:600, marginBottom:6, textTransform:'uppercase', letterSpacing:'0.06em' }}>Determinação</div>
              <div style={{ display:'flex', gap:4 }}>
                {['RS','LS'].map((r, i) => (
                  <div key={i} style={{ width:28, height:28, borderRadius:'50%', background:'var(--m-surface-2)', border:'1px solid var(--m-border-2)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:9, fontWeight:700, color:'var(--m-text-dim)' }}>{r}</div>
                ))}
              </div>
            </div>
          </div>
          <div style={{ fontSize:10, color:'var(--m-muted)', marginTop:4 }}>72% dos jogadores usam esta combinação · 54% WR</div>
        </Card>
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────
function ChampMatchups() {
  return (
    <Card pad={0}>
      <div style={{ padding:'16px 20px 12px', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
        <SectionLabel icon="crosshair">Matchups · oponente na lane</SectionLabel>
        <div style={{ display:'flex', gap:4 }}>
          <Pill active>Todos</Pill>
          <Pill>Favoráveis</Pill>
          <Pill>Difíceis</Pill>
        </div>
      </div>
      <div style={{ display:'grid', gridTemplateColumns:'1fr 90px 100px 120px 1fr', gap:12, padding:'8px 20px', fontSize:10, color:'var(--m-muted)', textTransform:'uppercase', letterSpacing:'0.06em', fontWeight:600, borderTop:'1px solid var(--m-border)', borderBottom:'1px solid var(--m-border)' }}>
        <span>Oponente</span><span className="tabular">Partidas</span><span>Winrate</span><span>vs média</span><span>Dificuldade</span>
      </div>
      {CHAMP_MATCHUPS.map((m, i) => (
        <div key={m.champ} style={{ display:'grid', gridTemplateColumns:'1fr 90px 100px 120px 1fr', gap:12, padding:'10px 20px', alignItems:'center', borderBottom:'1px solid rgba(34,40,56,0.4)' }}>
          <div style={{ display:'flex', alignItems:'center', gap:10 }}>
            <ChampPortrait name={m.champ} size={32}/>
            <span style={{ fontSize:13, fontWeight:500 }}>{m.champ}</span>
          </div>
          <span className="tabular" style={{ fontSize:13, fontWeight:600 }}>{m.games}</span>
          <div>
            <div className="tabular" style={{ fontSize:14, fontWeight:700, color: m.wr > 52 ? 'var(--m-green)' : m.wr > 45 ? 'var(--m-accent)' : 'var(--m-red)' }}>{m.wr}%</div>
          </div>
          <span className="tabular" style={{ fontSize:13, fontWeight:600, color: m.vs >= 0 ? 'var(--m-green)' : 'var(--m-red)' }}>{m.vs > 0 ? '+' : ''}{m.vs}%</span>
          <div style={{ display:'flex', alignItems:'center', gap:8 }}>
            <div style={{ flex:1, height:6, borderRadius:3, background:'var(--m-border)', overflow:'hidden', position:'relative' }}>
              <div style={{ position:'absolute', left:'50%', top:0, bottom:0, width:1, background:'var(--m-muted)' }}/>
              <div style={{
                position:'absolute',
                left: m.vs >= 0 ? '50%' : `${50 + m.vs}%`,
                width: `${Math.abs(m.vs)}%`,
                height:'100%',
                background: m.vs >= 0 ? 'var(--m-green)' : 'var(--m-red)',
              }}/>
            </div>
            <span style={{ fontSize:10, color:'var(--m-text-dim)', minWidth:60, textAlign:'right' }}>
              {m.vs > 3 ? 'Fácil' : m.vs < -10 ? 'Muito dif.' : m.vs < 0 ? 'Difícil' : 'Neutro'}
            </span>
          </div>
        </div>
      ))}
    </Card>
  );
}

// ────────────────────────────────────────────────────────
function ChampSynergies() {
  return (
    <div style={{ display:'grid', gridTemplateColumns:'1fr 320px', gap:20 }}>
      <Card pad={0}>
        <div style={{ padding:'16px 20px 12px' }}>
          <SectionLabel icon="users">Sinergias · aliado no mesmo time</SectionLabel>
        </div>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 90px 100px 1fr', gap:12, padding:'8px 20px', fontSize:10, color:'var(--m-muted)', textTransform:'uppercase', letterSpacing:'0.06em', fontWeight:600, borderTop:'1px solid var(--m-border)', borderBottom:'1px solid var(--m-border)' }}>
          <span>Aliado</span><span className="tabular">Partidas</span><span>Winrate</span><span>Sinergia</span>
        </div>
        {CHAMP_SYNERGIES.map(s => (
          <div key={s.champ} style={{ display:'grid', gridTemplateColumns:'1fr 90px 100px 1fr', gap:12, padding:'10px 20px', alignItems:'center', borderBottom:'1px solid rgba(34,40,56,0.4)' }}>
            <div style={{ display:'flex', alignItems:'center', gap:10 }}>
              <ChampPortrait name={s.champ} size={32}/>
              <span style={{ fontSize:13, fontWeight:500 }}>{s.champ}</span>
            </div>
            <span className="tabular" style={{ fontSize:13, fontWeight:600 }}>{s.games}</span>
            <div className="tabular" style={{ fontSize:14, fontWeight:700, color: s.wr > 55 ? 'var(--m-green)' : s.wr > 45 ? 'var(--m-text)' : 'var(--m-red)' }}>{s.wr}%</div>
            <div style={{ display:'flex', alignItems:'center', gap:8 }}>
              <div style={{ flex:1 }}>
                <Bar value={s.wr} max={100} height={6} color={s.wr > 55 ? 'var(--m-green)' : s.wr > 45 ? 'var(--m-accent)' : 'var(--m-red)'}/>
              </div>
              <span style={{ fontSize:10, color:'var(--m-text-dim)', minWidth:52, textAlign:'right' }}>
                {s.wr > 60 ? 'Excelente' : s.wr > 45 ? 'Ok' : 'Evitar'}
              </span>
            </div>
          </div>
        ))}
      </Card>

      <Card accent>
        <SectionLabel icon="sparkles">Duo sugerido</SectionLabel>
        <div style={{ display:'flex', alignItems:'center', gap:10, padding:'12px 0' }}>
          <ChampPortrait name="Vayne" size={48}/>
          <Icon name="plus" size={16} style={{ color:'var(--m-accent)' }}/>
          <ChampPortrait name="Lulu" size={48}/>
        </div>
        <div className="tabular font-display" style={{ fontSize:24, fontWeight:700, color:'var(--m-green)' }}>66.7% WR</div>
        <div style={{ fontSize:11, color:'var(--m-text-dim)', marginTop:4 }}>Lulu enabler + Vayne scaling = comp padrão em Masters+. A Lulu amplifica dano e protege a Vayne.</div>
        <button style={{ width:'100%', marginTop:12, padding:'8px 12px', background:'var(--m-accent)', border:'none', borderRadius:8, color:'#1a1510', fontSize:11, fontWeight:600 }}>Perguntar à IA sobre este duo</button>
      </Card>
    </div>
  );
}

window.ScreenChampion = ScreenChampion;
