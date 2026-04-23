// Match detail screen — with timeline, teams comparison, team analysis, builds and inline AI analysis.

function ScreenMatch() {
  const [tab, setTab] = React.useState('overview');
  return (
    <div className="metis-scope" style={{ width:'100%', height:'100%', overflow:'auto', background:'var(--m-bg)' }}>
      <AppHeader active="home"/>

      {/* Banner */}
      <div style={{
        background:'linear-gradient(180deg, rgba(74,222,128,0.1), transparent)',
        borderBottom:'1px solid var(--m-border)',
      }}>
        <div style={{ maxWidth:1200, margin:'0 auto', padding:'20px 28px 16px' }}>
          <div style={{ display:'flex', alignItems:'center', gap:10, fontSize:11, color:'var(--m-text-dim)', marginBottom:14 }}>
            <a href="#" style={{ color:'var(--m-text-dim)', textDecoration:'none' }}>Zaras#0210</a>
            <Icon name="chevronRight" size={10}/>
            <span>Partida</span>
            <Icon name="chevronRight" size={10}/>
            <span className="font-mono" style={{ color:'var(--m-accent)' }}>BR1_71284902145</span>
          </div>
          <div style={{ display:'flex', alignItems:'center', gap:16 }}>
            <div style={{ width:56, height:56, borderRadius:10, background:'rgba(74,222,128,0.15)', border:'1px solid rgba(74,222,128,0.3)', display:'flex', alignItems:'center', justifyContent:'center' }}>
              <Icon name="check" size={28} style={{ color:'var(--m-green)' }}/>
            </div>
            <div>
              <h1 className="font-display" style={{ fontSize:24, fontWeight:700 }}>
                Vitória <span style={{ color:'var(--m-green)' }}>azul</span> · em 28:14
              </h1>
              <div style={{ display:'flex', gap:14, fontSize:12, color:'var(--m-text-dim)', marginTop:4 }}>
                <span>Ranked Solo/Duo</span>
                <span>·</span>
                <span>Patch 14.21</span>
                <span>·</span>
                <span>há 2 horas</span>
                <span>·</span>
                <span className="tabular" style={{ color:'var(--m-green)', fontWeight:600 }}>+23 LP</span>
              </div>
            </div>
            <div style={{ flex:1 }}/>
            <button style={{ padding:'9px 14px', background:'var(--m-accent)', border:'none', borderRadius:10, color:'#1a1510', fontSize:12, fontWeight:600, display:'inline-flex', alignItems:'center', gap:6 }}>
              <Icon name="brain" size={14}/> Analisar com IA
            </button>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ maxWidth:1200, margin:'0 auto', padding:'0 28px', borderBottom:'1px solid var(--m-border)' }}>
        <div style={{ display:'flex', gap:2 }}>
          {[
            { id:'overview', l:'Overview',          ic:'list' },
            { id:'teams',    l:'Análise de Equipe', ic:'pieChart' },
            { id:'builds',   l:'Builds & Runas',    ic:'sword' },
          ].map(t => (
            <button key={t.id} onClick={() => setTab(t.id)} style={{
              padding:'12px 18px', background:'transparent', border:'none',
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
      </div>

      {tab === 'overview' && <MatchOverview/>}
      {tab === 'teams'    && <MatchTeamAnalysis/>}
      {tab === 'builds'   && <MatchBuilds/>}
    </div>
  );
}

// ── Overview tab (teams table + timeline + ai analysis) ─────
function MatchOverview() {
  return (
    <div className="metis-scope">
      <div style={{ maxWidth:1200, margin:'0 auto', padding:'24px 28px 48px', display:'flex', flexDirection:'column', gap:20 }}>

        {/* ═══ Top row: teams + gold chart + AI ═══ */}
        <div style={{ display:'grid', gridTemplateColumns:'1fr 360px', gap:20 }}>
        <div style={{ display:'flex', flexDirection:'column', gap:20 }}>

          {/* Teams comparison */}
          <Card pad={0}>
            <div style={{ padding:'16px 20px 12px' }}>
              <SectionLabel icon="shield">Times</SectionLabel>
            </div>

            {/* Blue team (win) */}
            <TeamBlock color="var(--m-green)" label="Azul · Vitória" gold="58.4k" kills={32} towers={9} drakes={3} baron={1} isYou>
              {[
                { champ:'Mordekaiser', role:'TOP',    name:'ShadowFury',  k:9,  d:2, a:7,  cs:221, dmg:28400, vision:14 },
                { champ:'Kayn',        role:'JUNGLE', name:'Zaras',       k:12, d:3, a:8,  cs:178, dmg:29800, vision:21, isYou:true },
                { champ:'Talon',       role:'MIDDLE', name:'MidOrFeed',   k:8,  d:4, a:6,  cs:248, dmg:27100, vision:11 },
                { champ:'Jinx',        role:'BOTTOM', name:'AdcCarry4',   k:3,  d:1, a:9,  cs:262, dmg:22900, vision:8 },
                { champ:'Thresh',      role:'UTILITY',name:'HookLord',    k:0,  d:2, a:16, cs:31,  dmg:9200,  vision:54 },
              ]}
            </TeamBlock>

            <div style={{ height:1, background:'var(--m-border)' }}/>

            {/* Red team (loss) */}
            <TeamBlock color="var(--m-red)" label="Vermelho · Derrota" gold="52.1k" kills={19} towers={3} drakes={1} baron={0}>
              {[
                { champ:'Garen',    role:'TOP',    name:'SpinToWin',  k:3, d:6, a:2, cs:189, dmg:19400, vision:9 },
                { champ:'Leblanc',  role:'JUNGLE', name:'DeceiveGG',  k:6, d:7, a:4, cs:152, dmg:24800, vision:15 },
                { champ:'Yone',     role:'MIDDLE', name:'WindBro',    k:4, d:8, a:3, cs:224, dmg:22100, vision:10 },
                { champ:'Ezreal',   role:'BOTTOM', name:'ElderArrow', k:5, d:6, a:2, cs:254, dmg:21700, vision:7 },
                { champ:'Lux',      role:'UTILITY',name:'LaserQueen', k:1, d:5, a:6, cs:28,  dmg:17200, vision:47 },
              ]}
            </TeamBlock>
          </Card>

          {/* Gold difference chart */}
          <Card>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:10 }}>
              <SectionLabel icon="dollar">Diferença de ouro</SectionLabel>
              <div style={{ display:'flex', gap:4 }}>
                <Pill active>Ouro</Pill>
                <Pill>XP</Pill>
                <Pill>CS</Pill>
                <Pill>Dano</Pill>
              </div>
            </div>
            <GoldDiffChart/>
            <div style={{ display:'flex', gap:14, marginTop:10, fontSize:11 }}>
              <div style={{ display:'flex', alignItems:'center', gap:5 }}>
                <div style={{ width:10, height:2, background:'var(--m-green)' }}/>
                <span style={{ color:'var(--m-text-dim)' }}>Azul à frente</span>
              </div>
              <div style={{ display:'flex', alignItems:'center', gap:5 }}>
                <div style={{ width:10, height:2, background:'var(--m-red)' }}/>
                <span style={{ color:'var(--m-text-dim)' }}>Vermelho à frente</span>
              </div>
              <div style={{ marginLeft:'auto', color:'var(--m-text-dim)' }}>Pico: +6.3k aos 22:14 (Baron)</div>
            </div>
          </Card>

        </div>

        {/* RIGHT */}
        <div style={{ display:'flex', flexDirection:'column', gap:20 }}>

          {/* AI Analysis */}
          <Card accent>
            <div style={{ display:'flex', gap:8, alignItems:'center', marginBottom:10 }}>
              <div style={{ width:28, height:28, borderRadius:8, background:'rgba(245,200,66,0.15)', display:'flex', alignItems:'center', justifyContent:'center', color:'var(--m-accent)' }}>
                <Icon name="brain" size={15}/>
              </div>
              <div>
                <div className="font-display" style={{ fontSize:13, fontWeight:600 }}>Análise da Metis</div>
                <div style={{ fontSize:10, color:'var(--m-text-dim)' }}>gerada em 4s · Llama 3</div>
              </div>
            </div>
            <div style={{ fontSize:12, color:'var(--m-text)', lineHeight:1.55, marginBottom:12 }}>
              Partida <span style={{ color:'var(--m-green)', fontWeight:600 }}>dominante</span>. Você stompou a jungle inimiga com gank cedo no top (1:30) e nunca mais deu espaço. Pontos a melhorar:
            </div>
            {[
              { c:'var(--m-green)', s:'✓', t:'Gank cedo no top às 1:30 deu first blood e 340g de vantagem.' },
              { c:'var(--m-green)', s:'✓', t:'Forma Rhaast foi certeira — composição inimiga não tinha pick.' },
              { c:'var(--m-red)',   s:'!', t:'1 de 4 dragões — deixou Infernal e Mountain pro inimigo nos 15 min.' },
              { c:'var(--m-accent)', s:'→', t:'Próxima: fechar jogos em 25 min quando tem +5k de ouro.' },
            ].map((x, i) => (
              <div key={i} style={{ display:'flex', gap:8, alignItems:'flex-start', padding:'7px 0', borderTop: i ? '1px solid var(--m-border)' : 'none' }}>
                <span style={{ color:x.c, fontSize:13, fontWeight:700, width:14, flexShrink:0 }}>{x.s}</span>
                <span style={{ fontSize:11, color:'var(--m-text-dim)', lineHeight:1.5 }}>{x.t}</span>
              </div>
            ))}
          </Card>

          {/* Quick stats */}
          <Card>
            <SectionLabel icon="activity">Resumo rápido</SectionLabel>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(2, 1fr)', gap:10, marginTop:6 }}>
              {[
                { l:'Duração',       v:'28:14',   c:'var(--m-text)' },
                { l:'Eventos-chave', v:'8',       c:'var(--m-accent)' },
                { l:'Teamfights',    v:'2',       c:'var(--m-text)' },
                { l:'LP ganho',      v:'+23',     c:'var(--m-green)' },
              ].map((s, i) => (
                <div key={i} style={{ padding:'10px 12px', background:'var(--m-bg)', border:'1px solid var(--m-border)', borderRadius:8 }}>
                  <div style={{ fontSize:9, color:'var(--m-muted)', textTransform:'uppercase', letterSpacing:'0.08em', fontWeight:600, marginBottom:3 }}>{s.l}</div>
                  <div className="tabular font-display" style={{ fontSize:20, fontWeight:700, color:s.c, letterSpacing:'-0.02em' }}>{s.v}</div>
                </div>
              ))}
            </div>
          </Card>
        </div>
        </div>
        {/* ═══ END top row ═══ */}

        {/* ═══ Full-width interactive timeline ═══ */}
        <Timeline/>

      </div>
    </div>
  );
}

// ── Team Analysis tab — donut comparisons per metric ────────────
function MatchTeamAnalysis() {
  const teams = {
    blue: { label:'Azul', color:'var(--m-green)', kills:32, gold:58400, dmg:117400, vision:108, cs:940, obj:13 },
    red:  { label:'Vermelho', color:'var(--m-red)',  kills:19, gold:52100, dmg:105200, vision:78,  cs:847, obj:4  },
  };
  const metrics = [
    { key:'kills',  label:'Abates',         fmt:v => v },
    { key:'gold',   label:'Ouro total',     fmt:v => (v/1000).toFixed(1)+'k' },
    { key:'dmg',    label:'Dano a campeões',fmt:v => (v/1000).toFixed(1)+'k' },
    { key:'vision', label:'Score de visão', fmt:v => v },
    { key:'cs',     label:'Creep score',    fmt:v => v },
    { key:'obj',    label:'Objetivos',      fmt:v => v, note:'drakes + baron + torres' },
  ];

  return (
    <div className="metis-scope">
      <div style={{ maxWidth:1200, margin:'0 auto', padding:'24px 28px 48px', display:'grid', gridTemplateColumns:'1fr 320px', gap:20 }}>
        <div style={{ display:'flex', flexDirection:'column', gap:20 }}>
          <Card>
            <SectionLabel icon="pieChart" right={
              <div style={{ display:'flex', gap:12, fontSize:11 }}>
                <div style={{ display:'inline-flex', alignItems:'center', gap:5 }}>
                  <div style={{ width:10, height:10, borderRadius:2, background:'var(--m-green)' }}/>
                  <span style={{ color:'var(--m-text-dim)' }}>Azul · Vitória</span>
                </div>
                <div style={{ display:'inline-flex', alignItems:'center', gap:5 }}>
                  <div style={{ width:10, height:10, borderRadius:2, background:'var(--m-red)' }}/>
                  <span style={{ color:'var(--m-text-dim)' }}>Vermelho · Derrota</span>
                </div>
              </div>
            }>Comparação por métrica</SectionLabel>

            <div style={{ display:'grid', gridTemplateColumns:'repeat(3, 1fr)', gap:16, marginTop:4 }}>
              {metrics.map(m => {
                const b = teams.blue[m.key], r = teams.red[m.key];
                const total = b + r;
                const blueWin = b > r;
                return (
                  <div key={m.key} style={{ padding:'16px 12px 14px', background:'var(--m-bg)', border:'1px solid var(--m-border)', borderRadius:12, display:'flex', flexDirection:'column', alignItems:'center' }}>
                    <div style={{ fontSize:10, color:'var(--m-muted)', textTransform:'uppercase', letterSpacing:'0.08em', fontWeight:600, marginBottom:10 }}>{m.label}</div>
                    <SplitDonut blue={b} red={r} size={130} winner={blueWin ? 'blue' : 'red'}/>
                    <div style={{ display:'flex', justifyContent:'space-between', width:'100%', marginTop:12, padding:'0 4px' }}>
                      <div style={{ textAlign:'left' }}>
                        <div className="tabular font-display" style={{ fontSize:17, fontWeight:700, color: blueWin ? 'var(--m-green)' : 'var(--m-text)' }}>{m.fmt(b)}</div>
                        <div style={{ fontSize:10, color:'var(--m-text-dim)' }}>{((b/total)*100).toFixed(0)}%</div>
                      </div>
                      <div style={{ textAlign:'right' }}>
                        <div className="tabular font-display" style={{ fontSize:17, fontWeight:700, color: !blueWin ? 'var(--m-red)' : 'var(--m-text)' }}>{m.fmt(r)}</div>
                        <div style={{ fontSize:10, color:'var(--m-text-dim)' }}>{((r/total)*100).toFixed(0)}%</div>
                      </div>
                    </div>
                    {m.note && <div style={{ fontSize:9, color:'var(--m-muted)', marginTop:8, textAlign:'center' }}>{m.note}</div>}
                  </div>
                );
              })}
            </div>
          </Card>

          {/* Bar comparison per player */}
          <Card>
            <SectionLabel icon="barChart">Dano a campeões · por jogador</SectionLabel>
            <PlayerDamageBars/>
          </Card>

          {/* Objectives breakdown */}
          <Card>
            <SectionLabel icon="shield">Objetivos contestados</SectionLabel>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(2, 1fr)', gap:10, marginTop:6 }}>
              {[
                { label:'Primeiro sangue',  b:true,  r:false, time:'01:30' },
                { label:'Primeiro dragão',  b:true,  r:false, time:'07:55' },
                { label:'Primeira torre',   b:true,  r:false, time:'13:47' },
                { label:'Arauto do Vale',   b:false, r:true,  time:'09:42' },
                { label:'Alma do Dragão',   b:false, r:true,  time:'24:10', lost:true },
                { label:'Baron Nashor',     b:true,  r:false, time:'22:14', chave:true },
              ].map((o, i) => (
                <div key={i} style={{ display:'flex', alignItems:'center', gap:10, padding:'10px 12px', background:'var(--m-bg)', border:'1px solid var(--m-border)', borderLeft:`3px solid ${o.b ? 'var(--m-green)' : 'var(--m-red)'}`, borderRadius:8 }}>
                  <div style={{ width:26, height:26, borderRadius:6, background: o.b ? 'rgba(74,222,128,0.15)' : 'rgba(248,113,113,0.15)', display:'flex', alignItems:'center', justifyContent:'center', color: o.b ? 'var(--m-green)' : 'var(--m-red)' }}>
                    <Icon name={o.chave ? 'star' : o.label.includes('ragão') ? 'flame' : o.label.includes('orre') ? 'shield' : 'check'} size={13}/>
                  </div>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ fontSize:12, fontWeight:600 }}>{o.label}</div>
                    <div style={{ fontSize:10, color:'var(--m-text-dim)', marginTop:2 }}>
                      <span className="font-mono">{o.time}</span> · {o.b ? 'Azul' : 'Vermelho'}
                      {o.chave && <span style={{ marginLeft:6, padding:'1px 5px', background:'rgba(245,200,66,0.15)', color:'var(--m-accent)', borderRadius:3, fontSize:9, fontWeight:700, letterSpacing:'0.04em' }}>CHAVE</span>}
                      {o.lost && <span style={{ marginLeft:6, padding:'1px 5px', background:'rgba(248,113,113,0.15)', color:'var(--m-red)', borderRadius:3, fontSize:9, fontWeight:700, letterSpacing:'0.04em' }}>PERDIDO</span>}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>

        {/* Sidebar */}
        <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
          <Card>
            <SectionLabel icon="target">Perfil dos times</SectionLabel>
            <div style={{ display:'flex', flexDirection:'column', gap:14, marginTop:8 }}>
              {[
                { label:'Dano AD',    b:0.62, r:0.48 },
                { label:'Dano AP',    b:0.38, r:0.58 },
                { label:'Controle',   b:0.55, r:0.72 },
                { label:'Mobilidade', b:0.78, r:0.44 },
                { label:'Sustain',    b:0.45, r:0.52 },
                { label:'Pick',       b:0.82, r:0.38 },
              ].map(p => (
                <div key={p.label}>
                  <div style={{ display:'flex', justifyContent:'space-between', fontSize:11, color:'var(--m-text-dim)', marginBottom:4 }}>
                    <span>{p.label}</span>
                    <span className="tabular">{Math.round(p.b*100)} · {Math.round(p.r*100)}</span>
                  </div>
                  <VsBar blue={p.b} red={p.r}/>
                </div>
              ))}
            </div>
          </Card>

          <Card accent>
            <SectionLabel icon="brain">Leitura da Metis</SectionLabel>
            <p style={{ fontSize:12, color:'var(--m-text)', lineHeight:1.55 }}>
              Comp azul era <b style={{ color:'var(--m-green)' }}>pick-focada</b> (Kayn, Talon, Thresh). Contra um time sem frontline sólida, a janela de 14–22 min foi decisiva — <b>5 kills sem trade</b> vieram de flanks no river.
            </p>
          </Card>
        </div>
      </div>
    </div>
  );
}

function SplitDonut({ blue, red, size=120, winner='blue' }) {
  const total = blue + red;
  const r = size/2 - 8;
  const circ = 2 * Math.PI * r;
  const bluePct = blue / total;
  return (
    <div style={{ position:'relative', width:size, height:size }}>
      <svg width={size} height={size} style={{ transform:'rotate(-90deg)' }}>
        <circle cx={size/2} cy={size/2} r={r} stroke="var(--m-border)" strokeWidth="8" fill="none"/>
        <circle cx={size/2} cy={size/2} r={r} stroke="var(--m-green)" strokeWidth="10" fill="none"
          strokeDasharray={`${circ * bluePct} ${circ}`} strokeLinecap="butt"/>
        <circle cx={size/2} cy={size/2} r={r} stroke="var(--m-red)" strokeWidth="10" fill="none"
          strokeDasharray={`${circ * (1-bluePct)} ${circ}`}
          strokeDashoffset={`${-circ * bluePct}`}
          strokeLinecap="butt"/>
      </svg>
      <div style={{ position:'absolute', inset:0, display:'flex', alignItems:'center', justifyContent:'center', flexDirection:'column' }}>
        <div className="tabular font-display" style={{ fontSize:18, fontWeight:700, color: winner === 'blue' ? 'var(--m-green)' : 'var(--m-red)' }}>
          {(bluePct*100).toFixed(0)}:{((1-bluePct)*100).toFixed(0)}
        </div>
      </div>
    </div>
  );
}

function VsBar({ blue, red }) {
  const total = blue + red;
  return (
    <div style={{ display:'flex', height:8, borderRadius:4, overflow:'hidden', background:'var(--m-border)' }}>
      <div style={{ width:`${(blue/total)*100}%`, background:'var(--m-green)' }}/>
      <div style={{ width:`${(red/total)*100}%`, background:'var(--m-red)' }}/>
    </div>
  );
}

function PlayerDamageBars() {
  const players = [
    { champ:'Kayn',        name:'Zaras',      dmg:29800, team:'blue', isYou:true },
    { champ:'Mordekaiser', name:'ShadowFury', dmg:28400, team:'blue' },
    { champ:'Talon',       name:'MidOrFeed',  dmg:27100, team:'blue' },
    { champ:'Leblanc',     name:'DeceiveGG',  dmg:24800, team:'red' },
    { champ:'Jinx',        name:'AdcCarry4',  dmg:22900, team:'blue' },
    { champ:'Yone',        name:'WindBro',    dmg:22100, team:'red' },
    { champ:'Ezreal',      name:'ElderArrow', dmg:21700, team:'red' },
    { champ:'Garen',       name:'SpinToWin',  dmg:19400, team:'red' },
    { champ:'Lux',         name:'LaserQueen', dmg:17200, team:'red' },
    { champ:'Thresh',      name:'HookLord',   dmg:9200,  team:'blue' },
  ];
  const max = Math.max(...players.map(p => p.dmg));
  return (
    <div style={{ display:'flex', flexDirection:'column', gap:7, marginTop:4 }}>
      {players.map((p, i) => (
        <div key={i} style={{ display:'grid', gridTemplateColumns:'28px 120px 1fr 70px', gap:10, alignItems:'center' }}>
          <ChampPortrait name={p.champ} size={26}/>
          <div style={{ minWidth:0 }}>
            <div style={{ fontSize:12, fontWeight: p.isYou ? 700 : 500, color: p.isYou ? 'var(--m-accent)' : 'var(--m-text)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{p.name}{p.isYou && <span style={{ fontSize:8, padding:'1px 4px', background:'var(--m-accent)', color:'#1a1510', borderRadius:2, marginLeft:5, fontWeight:700 }}>VOCÊ</span>}</div>
            <div style={{ fontSize:10, color:'var(--m-text-dim)' }}>{p.champ}</div>
          </div>
          <div style={{ height:18, borderRadius:4, background:'var(--m-bg)', border:'1px solid var(--m-border)', overflow:'hidden', position:'relative' }}>
            <div style={{ height:'100%', width:`${(p.dmg/max)*100}%`, background: p.team === 'blue' ? 'linear-gradient(90deg, rgba(74,222,128,0.2), var(--m-green))' : 'linear-gradient(90deg, rgba(248,113,113,0.2), var(--m-red))' }}/>
          </div>
          <div className="tabular" style={{ fontSize:12, fontWeight:600, textAlign:'right' }}>{p.dmg.toLocaleString()}</div>
        </div>
      ))}
    </div>
  );
}

// ── Builds tab ──────────────────────────────────────────────────
function MatchBuilds() {
  const players = [
    { champ:'Mordekaiser', name:'ShadowFury',  role:'TOP',    team:'blue', items:[3068,3065,3143,3742,3111,3748], trinket:3340, runes:{ primary:'Dominação', keystone:'Eletrocutar', secondary:'Determinação' } },
    { champ:'Kayn',        name:'Zaras',       role:'JUNGLE', team:'blue', items:[6693,3158,3814,3153,3036,3047], trinket:3364, runes:{ primary:'Dominação', keystone:'Colheita Sombria', secondary:'Precisão' }, isYou:true },
    { champ:'Talon',       name:'MidOrFeed',   role:'MIDDLE', team:'blue', items:[6691,3158,6694,3036,3156,3814], trinket:3363, runes:{ primary:'Dominação', keystone:'Eletrocutar', secondary:'Magia' } },
    { champ:'Jinx',        name:'AdcCarry4',   role:'BOTTOM', team:'blue', items:[3094,3006,3031,3036,3085,3026], trinket:3340, runes:{ primary:'Precisão', keystone:'Passo Veloz', secondary:'Dominação' } },
    { champ:'Thresh',      name:'HookLord',    role:'UTILITY',team:'blue', items:[3109,3111,3222,3190,3076,3800], trinket:3364, runes:{ primary:'Determinação', keystone:'Agarrar de Imortal', secondary:'Inspiração' } },
    { champ:'Garen',       name:'SpinToWin',   role:'TOP',    team:'red',  items:[6630,3047,3071,3075,3065,3742], trinket:3340, runes:{ primary:'Precisão', keystone:'Conquistador', secondary:'Determinação' } },
    { champ:'Leblanc',     name:'DeceiveGG',   role:'JUNGLE', team:'red',  items:[6653,3020,3152,3165,3135,3157], trinket:3364, runes:{ primary:'Magia', keystone:'Invocar Aery', secondary:'Inspiração' } },
    { champ:'Yone',        name:'WindBro',     role:'MIDDLE', team:'red',  items:[6673,3006,3031,3036,3085,3026], trinket:3340, runes:{ primary:'Precisão', keystone:'Conquistador', secondary:'Dominação' } },
    { champ:'Ezreal',      name:'ElderArrow',  role:'BOTTOM', team:'red',  items:[3078,3006,3036,3085,3139,3072], trinket:3340, runes:{ primary:'Magia', keystone:'Invocar Aery', secondary:'Inspiração' } },
    { champ:'Lux',         name:'LaserQueen',  role:'UTILITY',team:'red',  items:[3853,3158,3504,3107,3011,3222], trinket:3364, runes:{ primary:'Magia', keystone:'Cometa Arcano', secondary:'Inspiração' } },
  ];
  return (
    <div className="metis-scope">
      <div style={{ maxWidth:1200, margin:'0 auto', padding:'24px 28px 48px' }}>
        <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:14 }}>
          <SectionLabel icon="sword">Itens · Runas · Summoners por jogador</SectionLabel>
          <div style={{ flex:1 }}/>
          <div style={{ display:'flex', gap:4 }}>
            <Pill active>Todos</Pill>
            <Pill>Azul</Pill>
            <Pill>Vermelho</Pill>
          </div>
        </div>

        <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
          {players.map((p, i) => <BuildRow key={i} p={p}/>)}
        </div>

        <Card accent style={{ marginTop:20 }}>
          <div style={{ display:'flex', alignItems:'flex-start', gap:14 }}>
            <div style={{ width:36, height:36, borderRadius:10, background:'rgba(245,200,66,0.15)', display:'flex', alignItems:'center', justifyContent:'center', color:'var(--m-accent)', flexShrink:0 }}>
              <Icon name="brain" size={18}/>
            </div>
            <div style={{ flex:1 }}>
              <div style={{ fontSize:13, fontWeight:600, marginBottom:4 }}>Sua build vs. build média de Kayn Diamante+</div>
              <p style={{ fontSize:12, color:'var(--m-text-dim)', lineHeight:1.55, marginBottom:10 }}>
                Você comprou <b style={{ color:'var(--m-accent)' }}>Colhedor de Essência</b> no 3º slot — escolha ótima contra a Leblanc. A maioria compra Serylda's no 4º, mas você preferiu Mortal Reminder pelo grievous wounds. Decisão sólida.
              </p>
              <div style={{ display:'flex', gap:8 }}>
                <button style={{ padding:'7px 12px', background:'var(--m-accent)', border:'none', borderRadius:8, color:'#1a1510', fontSize:11, fontWeight:600 }}>Discutir build com a IA</button>
                <button style={{ padding:'7px 12px', background:'transparent', border:'1px solid var(--m-border-2)', borderRadius:8, color:'var(--m-text-dim)', fontSize:11, fontWeight:500 }}>Ver build-path completo</button>
              </div>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}

function BuildRow({ p }) {
  const teamColor = p.team === 'blue' ? 'var(--m-green)' : 'var(--m-red)';
  return (
    <div style={{
      display:'grid', gridTemplateColumns:'28px 40px 170px 1fr 170px',
      gap:14, padding:'12px 16px', alignItems:'center',
      background: p.isYou ? 'rgba(245,200,66,0.05)' : 'var(--m-surface)',
      border:'1px solid ' + (p.isYou ? 'rgba(245,200,66,0.35)' : 'var(--m-border)'),
      borderLeft: `3px solid ${teamColor}`,
      borderRadius:10,
    }}>
      <RoleGlyph role={p.role} size={16}/>
      <ChampPortrait name={p.champ} size={36}/>
      <div>
        <div style={{ fontSize:13, fontWeight: p.isYou ? 700 : 500, color: p.isYou ? 'var(--m-accent)' : 'var(--m-text)' }}>
          {p.name}{p.isYou && <span style={{ fontSize:8, padding:'1px 4px', background:'var(--m-accent)', color:'#1a1510', borderRadius:2, marginLeft:5, fontWeight:700 }}>VOCÊ</span>}
        </div>
        <div style={{ fontSize:10, color:'var(--m-text-dim)', marginTop:2 }}>{p.champ} · {ROLES_PT[p.role]}</div>
      </div>
      <div style={{ display:'flex', alignItems:'center', gap:4 }}>
        {p.items.map((id, i) => (
          <div key={i} style={{ width:32, height:32, borderRadius:6, background:'var(--m-surface-2)', border:'1px solid var(--m-border-2)', backgroundImage:`url(${itemImg(id)})`, backgroundSize:'cover', backgroundPosition:'center', flexShrink:0 }} title={`Item ${id}`}/>
        ))}
        <div style={{ width:1, height:28, background:'var(--m-border)', margin:'0 4px' }}/>
        <div style={{ width:28, height:28, borderRadius:'50%', background:'var(--m-surface-2)', border:'1px solid var(--m-border-2)', backgroundImage:`url(${itemImg(p.trinket)})`, backgroundSize:'cover', flexShrink:0 }} title="Trinket"/>
      </div>
      <div style={{ display:'flex', gap:8, alignItems:'center' }}>
        <div style={{
          width:30, height:30, borderRadius:'50%',
          background: `radial-gradient(circle at 30% 30%, ${runeColor(p.runes.primary)}, ${runeColor(p.runes.primary)}70)`,
          border:`1.5px solid ${runeColor(p.runes.primary)}`,
          display:'flex', alignItems:'center', justifyContent:'center',
          fontSize:11, fontWeight:800, color:'#0B0D12',
          flexShrink:0,
        }}>{p.runes.primary[0]}</div>
        <div style={{ minWidth:0, flex:1 }}>
          <div style={{ fontSize:11, fontWeight:600, color:runeColor(p.runes.primary), whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{p.runes.keystone}</div>
          <div style={{ fontSize:9, color:'var(--m-text-dim)', textTransform:'uppercase', letterSpacing:'0.06em' }}>{p.runes.primary.slice(0,4)} / {p.runes.secondary.slice(0,4)}</div>
        </div>
      </div>
    </div>
  );
}

function runeColor(name) {
  const map = {
    'Precisão':'#F5C842',
    'Dominação':'#F87171',
    'Magia':'#8B7FFF',
    'Determinação':'#4ADE80',
    'Inspiração':'#5BE3D4',
  };
  return map[name] || '#F5C842';
}

// ── Team block for teams comparison ─────────────────────────────
function TeamBlock({ children, label, color, gold, kills, towers, drakes, baron, isYou }) {
  return (
    <div>
      <div style={{ display:'flex', alignItems:'center', padding:'10px 20px', background:`linear-gradient(90deg, ${color === 'var(--m-green)' ? 'rgba(74,222,128,0.06)' : 'rgba(248,113,113,0.06)'}, transparent)` }}>
        <div style={{ width:3, height:24, background:color, borderRadius:2, marginRight:10 }}/>
        <div style={{ fontSize:12, fontWeight:600, color, textTransform:'uppercase', letterSpacing:'0.06em' }}>{label}</div>
        <div style={{ flex:1 }}/>
        <div style={{ display:'flex', gap:14, fontSize:11, color:'var(--m-text-dim)' }}>
          <span><span className="tabular" style={{ color:'var(--m-text)', fontWeight:600 }}>{gold}</span> ouro</span>
          <span><span className="tabular" style={{ color:'var(--m-text)', fontWeight:600 }}>{kills}</span> kills</span>
          <span><span className="tabular" style={{ color:'var(--m-text)', fontWeight:600 }}>{towers}</span> torres</span>
          <span><span className="tabular" style={{ color:'var(--m-text)', fontWeight:600 }}>{drakes}</span> drakes</span>
          <span><span className="tabular" style={{ color:'var(--m-text)', fontWeight:600 }}>{baron}</span> baron</span>
        </div>
      </div>
      {children.map((p, i) => (
        <div key={i} style={{
          display:'grid', gridTemplateColumns:'28px 36px 1fr 110px 85px 80px 50px',
          gap:12, padding:'10px 20px', alignItems:'center',
          borderTop: i ? '1px solid rgba(34,40,56,0.4)' : 'none',
          background: p.isYou ? 'rgba(245,200,66,0.05)' : 'transparent',
        }}>
          <RoleGlyph role={p.role} size={16}/>
          <ChampPortrait name={p.champ} size={32}/>
          <div>
            <div style={{ fontSize:12, fontWeight: p.isYou ? 700 : 500, color: p.isYou ? 'var(--m-accent)' : 'var(--m-text)' }}>
              {p.name}{p.isYou && <span style={{ fontSize:9, fontWeight:600, padding:'2px 5px', background:'var(--m-accent)', color:'#1a1510', borderRadius:3, marginLeft:6, letterSpacing:'0.04em' }}>VOCÊ</span>}
            </div>
            <div style={{ fontSize:10, color:'var(--m-text-dim)', marginTop:1 }}>{p.champ}</div>
          </div>
          <div className="tabular" style={{ fontSize:13, fontWeight:600 }}>
            <span>{p.k}</span><span style={{ color:'var(--m-muted)' }}> / </span><span style={{ color:'var(--m-red)' }}>{p.d}</span><span style={{ color:'var(--m-muted)' }}> / </span><span>{p.a}</span>
          </div>
          <div>
            <div className="tabular" style={{ fontSize:11, fontWeight:500 }}>{p.dmg.toLocaleString()}</div>
            <Bar value={p.dmg} max={30000} color={color} height={3} track="var(--m-border)"/>
          </div>
          <span className="tabular" style={{ fontSize:11, color:'var(--m-text-dim)' }}>{p.cs} cs</span>
          <span className="tabular" style={{ fontSize:11, color:'var(--m-text-dim)' }}>{p.vision} v</span>
        </div>
      ))}
    </div>
  );
}

// ── Gold difference chart — azul à frente toda partida ────────
function GoldDiffChart() {
  // positive = blue ahead, negative = red ahead
  const data = [0, 340, 520, 480, 780, 1200, 1100, 1350, 1820, 2100, 2540, 2980, 3420, 3800, 4200, 4650, 4800, 5100, 5430, 5820, 6150, 6300, 6280, 6450, 6800, 7100, 7420, 7680, 7900];
  const W = 640, H = 160, mid = H/2;
  const max = Math.max(...data.map(Math.abs)) * 1.15;
  const pts = data.map((v, i) => {
    const x = (i / (data.length - 1)) * W;
    const y = mid - (v / max) * (H/2 - 12);
    return [x, y];
  });
  const path = pts.map((p, i) => (i === 0 ? 'M' : 'L') + p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join(' ');
  const areaTop = path + ` L ${W} ${mid} L 0 ${mid} Z`;

  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ display:'block', width:'100%' }}>
      <defs>
        <linearGradient id="gd-blue" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--m-green)" stopOpacity="0.4"/>
          <stop offset="100%" stopColor="var(--m-green)" stopOpacity="0.02"/>
        </linearGradient>
      </defs>
      {/* horizontal guides */}
      {[0.25, 0.75].map((t, i) => (
        <line key={i} x1={0} x2={W} y1={H*t} y2={H*t} stroke="var(--m-border)" strokeDasharray="2 4"/>
      ))}
      {/* time markers */}
      {[5,10,15,20,25].map(min => {
        const x = (min / 28) * W;
        return (
          <g key={min}>
            <line x1={x} x2={x} y1={0} y2={H} stroke="var(--m-border)" strokeDasharray="2 4" opacity="0.5"/>
            <text x={x} y={H-4} fontSize="9" fill="var(--m-muted)" textAnchor="middle" fontFamily="JetBrains Mono">{min}:00</text>
          </g>
        );
      })}
      {/* mid line */}
      <line x1={0} x2={W} y1={mid} y2={mid} stroke="var(--m-border-2)" strokeWidth="1"/>
      <path d={areaTop} fill="url(#gd-blue)"/>
      <path d={path} stroke="var(--m-green)" strokeWidth="2" fill="none" strokeLinecap="round"/>
      {/* event markers */}
      {[
        { t:1.5,  y:mid-30,  l:'FB',    c:'var(--m-green)' },
        { t:7.9,  y:mid-50,  l:'DR',    c:'var(--m-accent)' },
        { t:13.8, y:mid-85,  l:'T1',    c:'var(--m-accent)' },
        { t:22.2, y:mid-105, l:'BARON', c:'var(--m-violet)' },
      ].map((m, i) => {
        const x = (m.t / 28) * W;
        return (
          <g key={i}>
            <circle cx={x} cy={m.y} r="4" fill={m.c} stroke="var(--m-bg)" strokeWidth="2"/>
            <text x={x+7} y={m.y+3} fontSize="9" fill={m.c} fontWeight="600" fontFamily="JetBrains Mono">{m.l}</text>
          </g>
        );
      })}
    </svg>
  );
}

window.ScreenMatch = ScreenMatch;
