// Home redesign — injeta muito mais conteúdo visual que a home atual
// (que era só um search bar + tier list mini).
//
// Estrutura:
//  • Hero com busca + estatística geral do banco
//  • Destaques do meta (carrossel/grid de campeões em alta)
//  • Tier list snippet (top 5) + sparkline de winrate do meta
//  • Seção "últimas análises" (matches recentes no banco)
//  • Jogadores em supervisão (se logado)

function ScreenHome() {
  return (
    <div className="metis-scope" style={{ width:'100%', height:'100%', overflow:'auto', background:'var(--m-bg)' }}>
      <AppHeader active="home" />

      {/* ── Hero ───────────────────────────────────────────────── */}
      <section className="metis-grid-bg" style={{
        position:'relative',
        borderBottom:'1px solid var(--m-border)',
        overflow:'hidden',
      }}>
        <div style={{ position:'absolute', top:-120, right:-80, width:420, height:420, borderRadius:'50%', background:'radial-gradient(circle, rgba(245,200,66,0.18), transparent 70%)', filter:'blur(40px)', pointerEvents:'none' }}/>
        <div style={{ position:'absolute', bottom:-120, left:-80, width:360, height:360, borderRadius:'50%', background:'radial-gradient(circle, rgba(91,227,212,0.12), transparent 70%)', filter:'blur(40px)', pointerEvents:'none' }}/>

        <div style={{ maxWidth:1200, margin:'0 auto', padding:'56px 28px 40px', position:'relative' }}>
          <div style={{ display:'inline-flex', alignItems:'center', gap:8, padding:'5px 11px', borderRadius:999, background:'rgba(245,200,66,0.1)', border:'1px solid rgba(245,200,66,0.25)', color:'var(--m-accent)', fontSize:11, fontWeight:600, letterSpacing:'0.06em', textTransform:'uppercase', marginBottom:20 }}>
            <Icon name="sparkles" size={12}/> Patch 14.21 · ao vivo
          </div>

          <h1 className="font-display" style={{ fontSize:52, lineHeight:1.05, fontWeight:700, letterSpacing:'-0.03em', maxWidth:760, marginBottom:14 }}>
            Seu coach particular, em cada <span style={{ color:'var(--m-accent)' }}>partida</span>.
          </h1>
          <p style={{ fontSize:16, color:'var(--m-text-dim)', maxWidth:560, marginBottom:28, lineHeight:1.5 }}>
            Metis analisa jogo a jogo com IA, extrai padrões do seu desempenho e mostra exatamente <span style={{ color:'var(--m-text)' }}>o que funciona</span> — e o que está te segurando.
          </p>

          {/* Search + server selector */}
          <div style={{ display:'flex', gap:8, marginBottom:14, maxWidth:640 }}>
            <div style={{ flex:1, display:'flex', alignItems:'center', gap:10, padding:'12px 16px', background:'var(--m-surface)', border:'1px solid var(--m-border-2)', borderRadius:12 }}>
              <Icon name="search" size={16} style={{ color:'var(--m-text-dim)' }}/>
              <input defaultValue="Zaras#0210" placeholder="Nome#Tag  ex: Zaras#0210"
                style={{ flex:1, background:'transparent', border:'none', color:'var(--m-text)', fontSize:14, outline:'none', fontFamily:'inherit' }}/>
              <span style={{ fontSize:11, color:'var(--m-muted)' }}>⌘K</span>
            </div>
            <select defaultValue="BR1" style={{ padding:'0 14px', background:'var(--m-surface)', border:'1px solid var(--m-border-2)', borderRadius:12, color:'var(--m-text)', fontSize:13, outline:'none', fontFamily:'inherit', minWidth:90 }}>
              <option>BR</option><option>NA</option><option>EUW</option><option>KR</option>
            </select>
            <button style={{ padding:'0 22px', background:'var(--m-accent)', border:'none', borderRadius:12, color:'#1a1510', fontSize:14, fontWeight:600, display:'flex', alignItems:'center', gap:6 }}>
              Analisar
              <Icon name="arrowRight" size={14}/>
            </button>
          </div>
          <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
            <span style={{ fontSize:11, color:'var(--m-muted)', marginRight:4, alignSelf:'center' }}>Recentes:</span>
            {['Brtt#BR1','Zaras#0210','Fallenbot#0001','YoDa#KR1'].map(n => (
              <button key={n} style={{ fontSize:11, padding:'3px 10px', borderRadius:999, border:'1px solid var(--m-border)', background:'transparent', color:'var(--m-text-dim)' }}>{n}</button>
            ))}
          </div>

          {/* Live stats strip */}
          <div style={{ display:'grid', gridTemplateColumns:'repeat(4, 1fr)', gap:16, marginTop:40, padding:'20px 24px', background:'rgba(20,24,38,0.6)', border:'1px solid var(--m-border)', borderRadius:16, backdropFilter:'blur(8px)' }}>
            <Stat size="lg" label="Partidas" value="1,284,612" sub="processadas · tempo real"/>
            <Stat size="lg" label="Jogadores" value="327K" sub="mapeados · 9 regiões"/>
            <Stat size="lg" label="Chats IA hoje" value="4,821" sub="insights táticos" accent="var(--m-cyan)"/>
            <Stat size="lg" label="Próxima ingestão" value="7 min" sub="live scraping" accent="var(--m-accent)"/>
          </div>
        </div>
      </section>

      {/* ── Main content grid ──────────────────────────────────── */}
      <div style={{ maxWidth:1200, margin:'0 auto', padding:'40px 28px', display:'grid', gridTemplateColumns:'2fr 1fr', gap:24 }}>

        {/* Left col — meta highlights */}
        <div style={{ display:'flex', flexDirection:'column', gap:24 }}>

          {/* Meta picks spotlight */}
          <Card pad={0}>
            <div style={{ padding:'18px 20px 14px', borderBottom:'1px solid var(--m-border)' }}>
              <SectionLabel icon="flame">Destaques do meta · patch 14.21</SectionLabel>
              <h3 className="font-display" style={{ fontSize:20, fontWeight:600 }}>
                Quem está <span style={{ color:'var(--m-accent)' }}>quebrando</span> a solo queue agora
              </h3>
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(3, 1fr)', gap:1, background:'var(--m-border)' }}>
              {TIER_DATA.slice(0, 3).map((c, i) => (
                <div key={c.champ} style={{ padding:20, background:'var(--m-surface)', position:'relative', overflow:'hidden' }}>
                  <div style={{ position:'absolute', top:-20, right:-20, width:120, height:120, backgroundImage:`url(${champImg(c.champ)})`, backgroundSize:'cover', opacity:0.2, filter:'blur(4px)' }}/>
                  <div style={{ position:'relative', display:'flex', gap:12, alignItems:'flex-start' }}>
                    <ChampPortrait name={c.champ} size={52} role={c.role}/>
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:4 }}>
                        <TierBadge tier={c.t} size="sm"/>
                        <span style={{ fontSize:10, color:'var(--m-muted)', textTransform:'uppercase', letterSpacing:'0.06em' }}>{ROLES_PT[c.role]}</span>
                      </div>
                      <div className="font-display" style={{ fontSize:18, fontWeight:600, marginBottom:2 }}>{c.champ}</div>
                      <div style={{ display:'flex', gap:8, alignItems:'baseline' }}>
                        <span className="tabular" style={{ fontSize:22, fontWeight:700, color:'var(--m-green)' }}>{c.wr}%</span>
                        <span style={{ fontSize:11, color:'var(--m-muted)' }}>winrate</span>
                        <span style={{ display:'inline-flex', alignItems:'center', gap:2, fontSize:11, fontWeight:600, color:'var(--m-green)', marginLeft:'auto' }}>
                          <Icon name="trending" size={12}/> +{(i+0.5).toFixed(1)}%
                        </span>
                      </div>
                    </div>
                  </div>
                  <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:12, marginTop:14, paddingTop:14, borderTop:'1px solid var(--m-border)' }}>
                    <div><div style={{ fontSize:9, color:'var(--m-muted)', textTransform:'uppercase', letterSpacing:'0.06em', fontWeight:600 }}>Pickrate</div><div className="tabular" style={{ fontSize:13, fontWeight:600, marginTop:2 }}>{c.pr}%</div></div>
                    <div><div style={{ fontSize:9, color:'var(--m-muted)', textTransform:'uppercase', letterSpacing:'0.06em', fontWeight:600 }}>KDA</div><div className="tabular" style={{ fontSize:13, fontWeight:600, marginTop:2 }}>{c.kda}</div></div>
                    <div><div style={{ fontSize:9, color:'var(--m-muted)', textTransform:'uppercase', letterSpacing:'0.06em', fontWeight:600 }}>Games</div><div className="tabular" style={{ fontSize:13, fontWeight:600, marginTop:2 }}>{c.games.toLocaleString()}</div></div>
                  </div>
                </div>
              ))}
            </div>
          </Card>

          {/* Mini tier list */}
          <Card pad={0}>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'16px 20px 12px' }}>
              <SectionLabel icon="trending">Tier list · top 10</SectionLabel>
              <a href="#" style={{ fontSize:12, color:'var(--m-accent)', textDecoration:'none', display:'inline-flex', alignItems:'center', gap:3 }}>
                Ver completa <Icon name="chevronRight" size={12}/>
              </a>
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'40px 1fr 60px 90px 70px 70px', gap:10, padding:'8px 20px', fontSize:10, color:'var(--m-muted)', textTransform:'uppercase', letterSpacing:'0.06em', fontWeight:600, borderTop:'1px solid var(--m-border)', borderBottom:'1px solid var(--m-border)' }}>
              <span>Tier</span><span>Campeão</span><span>Role</span><span>Winrate</span><span className="tabular">Pick</span><span className="tabular">KDA</span>
            </div>
            {TIER_DATA.slice(0, 8).map((c) => (
              <div key={c.champ} style={{ display:'grid', gridTemplateColumns:'40px 1fr 60px 90px 70px 70px', gap:10, padding:'10px 20px', alignItems:'center', borderBottom:'1px solid rgba(34,40,56,0.4)' }}>
                <TierBadge tier={c.t} size="sm"/>
                <div style={{ display:'flex', alignItems:'center', gap:10, minWidth:0 }}>
                  <ChampPortrait name={c.champ} size={28}/>
                  <span style={{ fontSize:13, fontWeight:500 }}>{c.champ}</span>
                </div>
                <span style={{ fontSize:11, color:'var(--m-text-dim)' }}>{ROLES_PT[c.role]}</span>
                <div>
                  <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:3 }}>
                    <span className="tabular" style={{ fontSize:13, fontWeight:600, color: c.wr > 52 ? 'var(--m-green)' : c.wr > 50 ? 'var(--m-accent)' : 'var(--m-text-dim)' }}>{c.wr}%</span>
                  </div>
                  <Bar value={c.wr - 45} max={15} height={3} color={c.wr > 52 ? 'var(--m-green)' : 'var(--m-accent)'}/>
                </div>
                <span className="tabular" style={{ fontSize:12, color:'var(--m-text-dim)' }}>{c.pr}%</span>
                <span className="tabular" style={{ fontSize:12, color:'var(--m-text-dim)' }}>{c.kda}</span>
              </div>
            ))}
          </Card>

        </div>

        {/* Right col */}
        <div style={{ display:'flex', flexDirection:'column', gap:24 }}>

          {/* Watched players */}
          <Card>
            <SectionLabel icon="star" right={<a href="#" style={{ fontSize:11, color:'var(--m-accent)', textDecoration:'none' }}>+ Novo</a>}>Em supervisão</SectionLabel>
            {[
              { name:'Zaras#0210', tier:'DIAMOND', rank:'II', lp:64, delta:+23, streak:[1,1,0,1,1] },
              { name:'Brtt#BR1',   tier:'MASTER',  rank:'I',  lp:182, delta:+41, streak:[1,1,1,0,1] },
              { name:'Fallen#001', tier:'PLATINUM',rank:'III',lp:22, delta:-18, streak:[0,0,1,0,1] },
            ].map(p => (
              <div key={p.name} style={{ display:'flex', alignItems:'center', gap:10, padding:'10px 0', borderBottom:'1px solid var(--m-border)' }}>
                <div style={{ width:36, height:36, borderRadius:8, background:'var(--m-surface-2)', border:'1px solid var(--m-border-2)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:13, fontWeight:700, color:'var(--m-text-dim)' }}>{p.name[0]}</div>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontSize:12, fontWeight:600 }}>{p.name}</div>
                  <div style={{ display:'flex', alignItems:'center', gap:6, marginTop:2 }}>
                    <span style={{ fontSize:10, color:'var(--m-text-dim)' }}>{p.tier} {p.rank}</span>
                    <span style={{ fontSize:10, color:'var(--m-muted)' }}>·</span>
                    <span className="tabular" style={{ fontSize:10, fontWeight:600, color: p.delta >= 0 ? 'var(--m-green)' : 'var(--m-red)' }}>{p.delta >= 0 ? '+' : ''}{p.delta} LP</span>
                  </div>
                </div>
                <WinLossDots results={p.streak} size={6} gap={3}/>
              </div>
            ))}
          </Card>

          {/* Ask Metis teaser */}
          <Card accent>
            <div style={{ display:'flex', gap:10, alignItems:'center', marginBottom:10 }}>
              <div style={{ width:32, height:32, borderRadius:8, background:'rgba(245,200,66,0.15)', display:'flex', alignItems:'center', justifyContent:'center', color:'var(--m-accent)' }}>
                <Icon name="brain" size={18}/>
              </div>
              <div>
                <div className="font-display" style={{ fontSize:14, fontWeight:600 }}>Pergunte à Metis</div>
                <div style={{ fontSize:11, color:'var(--m-text-dim)' }}>Llama 3 · contexto das suas partidas</div>
              </div>
            </div>
            <div style={{ background:'var(--m-bg)', border:'1px solid var(--m-border)', borderRadius:10, padding:'10px 12px', marginBottom:8 }}>
              <p style={{ fontSize:12, color:'var(--m-text-dim)', lineHeight:1.5 }}>
                <span style={{ color:'var(--m-accent)', fontWeight:600 }}>Ex:</span> "Por que meu winrate caiu com Kayn nos últimos 10 jogos?"
              </p>
            </div>
            <div style={{ display:'flex', flexDirection:'column', gap:5 }}>
              {[
                'Me mostre meu matchup mais difícil',
                'Qual role eu deveria forçar na ranqueada?',
                'Revisa meu último jogo perdido',
              ].map(q => (
                <button key={q} style={{ textAlign:'left', padding:'8px 10px', background:'var(--m-surface-2)', border:'1px solid var(--m-border)', borderRadius:8, color:'var(--m-text-dim)', fontSize:11, display:'flex', alignItems:'center', gap:6 }}>
                  <Icon name="sparkles" size={11} style={{ color:'var(--m-accent)' }}/>
                  {q}
                </button>
              ))}
            </div>
          </Card>

          {/* Patch digest */}
          <Card>
            <SectionLabel icon="bookOpen" right={<span style={{ fontSize:11, color:'var(--m-muted)' }}>há 3 dias</span>}>Patch 14.21 · resumo</SectionLabel>
            <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
              {[
                { sym:'▲', color:'var(--m-green)', name:'Kayn',        note:'buff jungle clear +7%' },
                { sym:'▲', color:'var(--m-green)', name:'Mordekaiser', note:'R cooldown -15s' },
                { sym:'▼', color:'var(--m-red)',   name:'Yone',        note:'E dano reduzido' },
                { sym:'●', color:'var(--m-blue)',  name:'Duskblade',   note:'reworked para assassinos' },
              ].map(x => (
                <div key={x.name} style={{ display:'flex', alignItems:'center', gap:10, padding:'6px 0', borderBottom:'1px solid var(--m-border)' }}>
                  <span style={{ color:x.color, fontSize:14, fontWeight:700, width:14, textAlign:'center' }}>{x.sym}</span>
                  <span style={{ fontSize:12, fontWeight:600, minWidth:100 }}>{x.name}</span>
                  <span style={{ fontSize:11, color:'var(--m-text-dim)' }}>{x.note}</span>
                </div>
              ))}
            </div>
          </Card>

        </div>
      </div>
    </div>
  );
}

window.ScreenHome = ScreenHome;
