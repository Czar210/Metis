// Player dashboard — a tela "diamante" do Metis. Cheia de gráficos.

function ScreenPlayer() {
  const winrate = Math.round((PLAYER.wins30d / PLAYER.games30d) * 100);
  const roleSegs = [
    { label:'Jungle',  value: PLAYER.roleDist.JUNGLE,  color:'var(--m-accent)' },
    { label:'Top',     value: PLAYER.roleDist.TOP,     color:'var(--m-violet)' },
    { label:'Mid',     value: PLAYER.roleDist.MIDDLE,  color:'var(--m-cyan)' },
    { label:'ADC',     value: PLAYER.roleDist.BOTTOM,  color:'var(--m-pink)' },
    { label:'Sup',     value: PLAYER.roleDist.UTILITY, color:'var(--m-green)' },
  ];

  return (
    <div className="metis-scope" style={{ width:'100%', height:'100%', overflow:'auto', background:'var(--m-bg)' }}>
      <AppHeader active="home"/>

      {/* ── Player banner ─────────────────────────────────────── */}
      <div style={{
        position:'relative',
        borderBottom:'1px solid var(--m-border)',
        background:'linear-gradient(180deg, rgba(245,200,66,0.1) 0%, transparent 100%), var(--m-bg)',
        overflow:'hidden',
      }}>
        <div style={{ position:'absolute', top:-80, right:-60, width:320, height:320, borderRadius:'50%', background:'radial-gradient(circle, rgba(245,200,66,0.18), transparent 70%)', filter:'blur(40px)' }}/>
        <div style={{ maxWidth:1200, margin:'0 auto', padding:'32px 28px 24px', position:'relative', display:'flex', alignItems:'center', gap:20 }}>
          <div style={{ width:88, height:88, borderRadius:16, background:'var(--m-surface-2)', border:'2px solid rgba(245,200,66,0.3)', overflow:'hidden', position:'relative' }}>
            <div style={{ position:'absolute', inset:0, background:'linear-gradient(135deg, #3a2f1e, #1a1510)' }}/>
            <div style={{ position:'absolute', inset:0, display:'flex', alignItems:'center', justifyContent:'center', fontSize:36, fontWeight:800, color:'var(--m-accent)' }}>Z</div>
            <div style={{ position:'absolute', bottom:-1, right:-1, width:28, height:28, borderRadius:'50%', background:'var(--m-bg)', border:'2px solid var(--m-bg)', display:'flex', alignItems:'center', justifyContent:'center' }}>
              <div style={{ width:'100%', height:'100%', borderRadius:'50%', background:'var(--m-green)', boxShadow:'0 0 8px var(--m-green)' }}/>
            </div>
          </div>
          <div style={{ flex:1 }}>
            <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:6 }}>
              <h1 className="font-display" style={{ fontSize:28, fontWeight:700, letterSpacing:'-0.02em' }}>{PLAYER.name}<span style={{ color:'var(--m-text-dim)', fontWeight:500 }}>#{PLAYER.tag}</span></h1>
              <span style={{ padding:'3px 8px', borderRadius:6, background:'var(--m-surface-2)', border:'1px solid var(--m-border-2)', fontSize:10, fontWeight:600, color:'var(--m-text-dim)', letterSpacing:'0.04em' }}>{PLAYER.server}</span>
              <span style={{ fontSize:11, color:'var(--m-muted)' }}>nível {PLAYER.level}</span>
            </div>
            <div style={{ display:'flex', alignItems:'center', gap:10 }}>
              <RankBadge tier={PLAYER.tier} rank={PLAYER.rank} lp={PLAYER.lp}/>
              <span style={{ fontSize:11, color:'var(--m-muted)' }}>pico: Diamond I · 112 LP</span>
            </div>
          </div>
          <div style={{ display:'flex', gap:8 }}>
            <button style={{ padding:'9px 14px', background:'var(--m-surface-2)', border:'1px solid var(--m-border-2)', borderRadius:10, color:'var(--m-text)', fontSize:12, fontWeight:500, display:'inline-flex', alignItems:'center', gap:6 }}>
              <Icon name="star" size={14} style={{ color:'var(--m-accent)' }}/> Supervisionar
            </button>
            <button style={{ padding:'9px 14px', background:'var(--m-accent)', border:'none', borderRadius:10, color:'#1a1510', fontSize:12, fontWeight:600, display:'inline-flex', alignItems:'center', gap:6 }}>
              <Icon name="brain" size={14}/> Analisar com IA
            </button>
          </div>
        </div>
      </div>

      {/* ── Grid principal ─────────────────────────────────────── */}
      <div style={{ maxWidth:1200, margin:'0 auto', padding:'24px 28px 48px', display:'grid', gridTemplateColumns:'1fr 320px', gap:20 }}>

        {/* LEFT COL */}
        <div style={{ display:'flex', flexDirection:'column', gap:20 }}>

          {/* KPI row */}
          <div style={{ display:'grid', gridTemplateColumns:'1.2fr 1fr 1fr 1fr', gap:12 }}>
            <Card>
              <SectionLabel icon="target">Últimos 30 dias</SectionLabel>
              <div style={{ display:'flex', alignItems:'center', gap:14 }}>
                <Donut value={winrate} size={84} thickness={9} color="var(--m-accent)" track="rgba(245,200,66,0.1)">
                  <div className="tabular font-display" style={{ fontSize:20, fontWeight:700 }}>{winrate}<span style={{ fontSize:12, color:'var(--m-text-dim)' }}>%</span></div>
                  <div style={{ fontSize:9, color:'var(--m-muted)', textTransform:'uppercase', letterSpacing:'0.06em' }}>winrate</div>
                </Donut>
                <div style={{ flex:1 }}>
                  <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:8 }}>
                    <span className="tabular" style={{ fontSize:22, fontWeight:700 }}>{PLAYER.games30d}</span>
                    <span style={{ fontSize:11, color:'var(--m-text-dim)' }}>partidas</span>
                  </div>
                  <div style={{ display:'flex', gap:12, fontSize:11 }}>
                    <div><span className="tabular" style={{ color:'var(--m-green)', fontWeight:600 }}>{PLAYER.wins30d}W</span></div>
                    <div><span className="tabular" style={{ color:'var(--m-red)', fontWeight:600 }}>{PLAYER.losses30d}L</span></div>
                  </div>
                  <div style={{ marginTop:8 }}>
                    <WinLossDots results={WR_LAST30.slice(-15)} size={7} gap={3}/>
                  </div>
                </div>
              </div>
            </Card>
            <Card>
              <SectionLabel icon="sword">KDA médio</SectionLabel>
              <div className="tabular font-display" style={{ fontSize:28, fontWeight:700 }}>{PLAYER.kda}</div>
              <div className="tabular" style={{ fontSize:11, color:'var(--m-text-dim)', marginTop:4 }}>
                <span style={{ color:'var(--m-green)' }}>{PLAYER.avgKills}</span> / <span style={{ color:'var(--m-red)' }}>{PLAYER.avgDeaths}</span> / <span style={{ color:'var(--m-cyan)' }}>{PLAYER.avgAssists}</span>
              </div>
              <div style={{ marginTop:10 }}>
                <div style={{ fontSize:9, color:'var(--m-muted)', textTransform:'uppercase', fontWeight:600, letterSpacing:'0.06em', marginBottom:4 }}>vs média Diamond</div>
                <Bar value={82} max={100} color="var(--m-green)" height={4}/>
                <div style={{ fontSize:10, color:'var(--m-green)', marginTop:3 }}>+18% acima</div>
              </div>
            </Card>
            <Card>
              <SectionLabel icon="crosshair">CS / min</SectionLabel>
              <div className="tabular font-display" style={{ fontSize:28, fontWeight:700 }}>{PLAYER.csPerMin}</div>
              <div style={{ fontSize:11, color:'var(--m-text-dim)', marginTop:4 }}>no papel de Jungle</div>
              <div style={{ marginTop:10 }}>
                <div style={{ fontSize:9, color:'var(--m-muted)', textTransform:'uppercase', fontWeight:600, letterSpacing:'0.06em', marginBottom:4 }}>vs role médio</div>
                <Bar value={76} max={100} color="var(--m-accent)" height={4}/>
                <div style={{ fontSize:10, color:'var(--m-accent)', marginTop:3 }}>top 24%</div>
              </div>
            </Card>
            <Card>
              <SectionLabel icon="eye">Visão / min</SectionLabel>
              <div className="tabular font-display" style={{ fontSize:28, fontWeight:700 }}>{PLAYER.visionPerMin}</div>
              <div style={{ fontSize:11, color:'var(--m-text-dim)', marginTop:4 }}>wards / minuto</div>
              <div style={{ marginTop:10 }}>
                <div style={{ fontSize:9, color:'var(--m-muted)', textTransform:'uppercase', fontWeight:600, letterSpacing:'0.06em', marginBottom:4 }}>vs média Diamond</div>
                <Bar value={38} max={100} color="var(--m-red)" height={4}/>
                <div style={{ fontSize:10, color:'var(--m-red)', marginTop:3 }}>abaixo · foco aqui</div>
              </div>
            </Card>
          </div>

          {/* LP chart */}
          <Card>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:4 }}>
              <SectionLabel icon="trending">Progressão de LP · últimas 20 partidas</SectionLabel>
              <div style={{ display:'flex', gap:4 }}>
                <Pill active>20 jogos</Pill>
                <Pill>7 dias</Pill>
                <Pill>30 dias</Pill>
                <Pill>Season</Pill>
              </div>
            </div>
            <div style={{ display:'flex', alignItems:'baseline', gap:10, marginBottom:10 }}>
              <span className="tabular font-display" style={{ fontSize:36, fontWeight:700 }}>{LP_HISTORY[LP_HISTORY.length-1].toLocaleString()}</span>
              <span style={{ fontSize:12, color:'var(--m-text-dim)' }}>LP total</span>
              <span className="tabular" style={{ fontSize:12, fontWeight:600, color:'var(--m-green)', marginLeft:'auto' }}>
                +{LP_HISTORY[LP_HISTORY.length-1] - LP_HISTORY[0]} nos últimos 20 jogos
              </span>
            </div>
            <AreaChart data={LP_HISTORY} height={160}/>
          </Card>

          {/* Champions table + Radar */}
          <div style={{ display:'grid', gridTemplateColumns:'1fr 280px', gap:20 }}>
            <Card pad={0}>
              <div style={{ padding:'16px 20px 12px' }}>
                <SectionLabel icon="gamepad">Melhores campeões · 30 dias</SectionLabel>
              </div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 60px 90px 70px 70px', gap:8, padding:'6px 20px', fontSize:10, color:'var(--m-muted)', textTransform:'uppercase', letterSpacing:'0.06em', fontWeight:600, borderTop:'1px solid var(--m-border)', borderBottom:'1px solid var(--m-border)' }}>
                <span>Campeão</span><span className="tabular">Games</span><span>Winrate</span><span className="tabular">KDA</span><span className="tabular">CS</span>
              </div>
              {PLAYER_CHAMPS.map(c => (
                <div key={c.champ} style={{ display:'grid', gridTemplateColumns:'1fr 60px 90px 70px 70px', gap:8, padding:'10px 20px', alignItems:'center', borderBottom:'1px solid rgba(34,40,56,0.4)' }}>
                  <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                    <ChampPortrait name={c.champ} size={32} role={c.role}/>
                    <div>
                      <div style={{ fontSize:13, fontWeight:500 }}>{c.champ}</div>
                      <div style={{ display:'flex', alignItems:'center', gap:4, marginTop:2 }}>
                        <span style={{ fontSize:9, color:'var(--m-muted)', textTransform:'uppercase', letterSpacing:'0.06em' }}>maestria {c.mastery}</span>
                      </div>
                    </div>
                  </div>
                  <span className="tabular" style={{ fontSize:13, fontWeight:600 }}>{c.games}</span>
                  <div>
                    <div style={{ display:'flex', alignItems:'baseline', gap:6 }}>
                      <span className="tabular" style={{ fontSize:13, fontWeight:600, color: c.wr > 55 ? 'var(--m-green)' : c.wr > 50 ? 'var(--m-accent)' : 'var(--m-red)' }}>{c.wr}%</span>
                    </div>
                    <div style={{ fontSize:10, color:'var(--m-text-dim)' }}>{c.wins}W {c.games-c.wins}L</div>
                  </div>
                  <span className="tabular" style={{ fontSize:12, color:'var(--m-text-dim)' }}>{c.kda}</span>
                  <span className="tabular" style={{ fontSize:12, color:'var(--m-text-dim)' }}>{c.avgCs}</span>
                </div>
              ))}
            </Card>

            <Card>
              <SectionLabel icon="target">Perfil de jogo</SectionLabel>
              <div style={{ display:'flex', justifyContent:'center', margin:'4px -10px -10px' }}>
                <RadarChart
                  size={240}
                  axes={[
                    { label:'Dano', value:0.82 },
                    { label:'Farm', value:0.76 },
                    { label:'Visão', value:0.38 },
                    { label:'Objetivos', value:0.64 },
                    { label:'KDA', value:0.71 },
                    { label:'Gank', value:0.88 },
                  ]}
                  color="var(--m-accent)"
                />
              </div>
              <div style={{ padding:'4px 0 0', fontSize:11, color:'var(--m-text-dim)', textAlign:'center', lineHeight:1.4 }}>
                Ponto <span style={{ color:'var(--m-accent)', fontWeight:600 }}>forte</span>: gank pressure<br/>
                Ponto <span style={{ color:'var(--m-red)', fontWeight:600 }}>fraco</span>: controle de visão
              </div>
            </Card>
          </div>

          {/* Match history */}
          <Card pad={0}>
            <div style={{ padding:'16px 20px 12px', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
              <SectionLabel icon="clock">Últimas partidas</SectionLabel>
              <div style={{ display:'flex', gap:4 }}>
                <Pill active>Todas</Pill>
                <Pill>Ranked</Pill>
                <Pill>Flex</Pill>
                <Pill>Normal</Pill>
              </div>
            </div>
            {MATCHES.slice(0, 6).map((m, i) => (
              <div key={i} style={{
                display:'grid', gridTemplateColumns:'4px 40px 1fr 100px 110px 90px 80px',
                gap:14, padding:'14px 20px', alignItems:'center',
                borderTop:'1px solid rgba(34,40,56,0.4)',
                background: m.win ? 'linear-gradient(90deg, rgba(74,222,128,0.05), transparent 30%)' : 'linear-gradient(90deg, rgba(248,113,113,0.05), transparent 30%)',
              }}>
                <div style={{ width:4, height:40, borderRadius:2, background: m.win ? 'var(--m-green)' : 'var(--m-red)' }}/>
                <ChampPortrait name={m.champ} size={40} role={m.role}/>
                <div>
                  <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                    <span style={{ fontSize:13, fontWeight:600, color: m.win ? 'var(--m-green)' : 'var(--m-red)' }}>{m.win ? 'Vitória' : 'Derrota'}</span>
                    <span style={{ fontSize:11, color:'var(--m-text-dim)' }}>· {m.mode}</span>
                  </div>
                  <div style={{ fontSize:11, color:'var(--m-muted)', marginTop:2 }}>{m.when} · {m.dur}</div>
                </div>
                <div>
                  <div className="tabular" style={{ fontSize:14, fontWeight:600 }}>
                    <span>{m.k}</span><span style={{ color:'var(--m-muted)' }}> / </span><span style={{ color:'var(--m-red)' }}>{m.d}</span><span style={{ color:'var(--m-muted)' }}> / </span><span>{m.a}</span>
                  </div>
                  <div className="tabular" style={{ fontSize:10, color:'var(--m-text-dim)', marginTop:2 }}>{((m.k+m.a)/Math.max(1,m.d)).toFixed(2)} KDA</div>
                </div>
                <div>
                  <div className="tabular" style={{ fontSize:12, fontWeight:500 }}>{m.cs} CS</div>
                  <div className="tabular" style={{ fontSize:10, color:'var(--m-text-dim)', marginTop:2 }}>{(m.cs/parseFloat(m.dur.split(':')[0])).toFixed(1)} / min</div>
                </div>
                <div>
                  <div className="tabular" style={{ fontSize:13, fontWeight:600, color: m.lp > 0 ? 'var(--m-green)' : 'var(--m-red)' }}>{m.lp > 0 ? '+' : ''}{m.lp} LP</div>
                </div>
                <button style={{ padding:'6px 10px', background:'var(--m-surface-2)', border:'1px solid var(--m-border-2)', borderRadius:6, color:'var(--m-text-dim)', fontSize:11, display:'inline-flex', alignItems:'center', gap:4 }}>
                  <Icon name="chevronDown" size={12}/> Detalhes
                </button>
              </div>
            ))}
          </Card>

        </div>

        {/* RIGHT COL */}
        <div style={{ display:'flex', flexDirection:'column', gap:20 }}>

          {/* Role distribution */}
          <Card>
            <SectionLabel icon="pieChart">Roles · 30 dias</SectionLabel>
            <div style={{ marginTop:6, marginBottom:12 }}>
              <StackedBar segments={roleSegs} height={10} radius={5}/>
            </div>
            {roleSegs.map(s => (
              <div key={s.label} style={{ display:'flex', alignItems:'center', gap:8, padding:'5px 0' }}>
                <div style={{ width:10, height:10, borderRadius:3, background:s.color }}/>
                <span style={{ fontSize:12, flex:1 }}>{s.label}</span>
                <span className="tabular" style={{ fontSize:12, fontWeight:600, color:'var(--m-text-dim)' }}>{s.value}%</span>
              </div>
            ))}
          </Card>

          {/* Insights */}
          <Card accent>
            <div style={{ display:'flex', gap:8, alignItems:'center', marginBottom:10 }}>
              <div style={{ width:28, height:28, borderRadius:8, background:'rgba(245,200,66,0.15)', display:'flex', alignItems:'center', justifyContent:'center', color:'var(--m-accent)' }}>
                <Icon name="brain" size={15}/>
              </div>
              <div className="font-display" style={{ fontSize:13, fontWeight:600 }}>Insights táticos</div>
            </div>
            <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
              {[
                { c:'var(--m-green)', t:'Ponto forte', d:'Seus Kayn com Rhaast têm 72% de winrate quando você passa de 30 min.', ico:'▲' },
                { c:'var(--m-red)',   t:'Cuidado',    d:'Você perde 64% dos jogos em que morre antes dos 5 minutos.', ico:'▼' },
                { c:'var(--m-cyan)',  t:'Recomendação', d:'Visão é sua métrica mais fraca — testar control wards no river.', ico:'●' },
              ].map((x, i) => (
                <div key={i} style={{ paddingLeft:12, borderLeft:`2px solid ${x.c}` }}>
                  <div style={{ fontSize:10, color:x.c, fontWeight:600, textTransform:'uppercase', letterSpacing:'0.06em' }}>{x.ico} {x.t}</div>
                  <div style={{ fontSize:12, color:'var(--m-text)', marginTop:3, lineHeight:1.5 }}>{x.d}</div>
                </div>
              ))}
            </div>
            <button style={{ width:'100%', marginTop:12, padding:'9px 12px', background:'var(--m-accent)', border:'none', borderRadius:8, color:'#1a1510', fontSize:12, fontWeight:600, display:'inline-flex', alignItems:'center', justifyContent:'center', gap:6 }}>
              <Icon name="messageCircle" size={13}/> Perguntar à Metis
            </button>
          </Card>

          {/* Frequent allies */}
          <Card>
            <SectionLabel icon="users">Duo frequente</SectionLabel>
            {[
              { n:'Luke#001',     g:14, wr:71, k:'Thresh' },
              { n:'Bamm#666',     g:9,  wr:55, k:'Jinx' },
              { n:'Pedrozs#br1',  g:6,  wr:66, k:'Ahri' },
            ].map(a => (
              <div key={a.n} style={{ display:'flex', alignItems:'center', gap:10, padding:'7px 0', borderBottom:'1px solid var(--m-border)' }}>
                <ChampPortrait name={a.k} size={28}/>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontSize:12, fontWeight:500 }}>{a.n}</div>
                  <div style={{ fontSize:10, color:'var(--m-muted)', marginTop:1 }}>{a.g} jogos juntos</div>
                </div>
                <div style={{ fontSize:12, fontWeight:600, color: a.wr > 55 ? 'var(--m-green)' : 'var(--m-text-dim)' }}>{a.wr}%</div>
              </div>
            ))}
          </Card>

        </div>
      </div>
    </div>
  );
}

window.ScreenPlayer = ScreenPlayer;
