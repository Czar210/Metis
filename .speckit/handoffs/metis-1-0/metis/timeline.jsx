// Metis — interactive match timeline component.
// - Horizontal track (top): scrubbable, zoomable, with XP diff curve overlaid.
// - Vertical cards (bottom): rich event cards with minimap, hover details.
// - Modal on click + "Ask Metis" button + filters.

const TL_DURATION = 28 * 60; // 28 minutes in seconds
const fmtT = s => `${Math.floor(s/60).toString().padStart(2,'0')}:${(s%60).toString().padStart(2,'0')}`;

function Timeline() {
  const [filters, setFilters] = React.useState({ kill:true, obj:true, tower:true, ward:true, misc:true });
  const [team, setTeam] = React.useState('both'); // both / blue / red
  const [focusPlayer, setFocusPlayer] = React.useState(null); // player name or null
  const [range, setRange] = React.useState([0, TL_DURATION]);
  const [hoveredId, setHoveredId] = React.useState(null);
  const [openEvent, setOpenEvent] = React.useState(null);
  const [jumpInput, setJumpInput] = React.useState('');

  const inFilter = (e) => {
    const cat = categoryOf(e);
    if (!filters[cat]) return false;
    if (team !== 'both') {
      const t = eventTeam(e);
      if (t && t !== team) return false;
    }
    if (focusPlayer) {
      const names = eventPlayers(e);
      if (!names.includes(focusPlayer)) return false;
    }
    if (e.t < range[0] || e.t > range[1]) return false;
    return true;
  };

  const visible = TL_EVENTS.filter(inFilter);

  const players = React.useMemo(() => {
    const set = new Set();
    TL_EVENTS.forEach(e => eventPlayers(e).forEach(n => set.add(n)));
    return [...set];
  }, []);

  const handleJump = () => {
    const m = jumpInput.match(/^(\d{1,2}):?(\d{0,2})$/);
    if (!m) return;
    const mins = parseInt(m[1],10);
    const secs = parseInt(m[2] || '0', 10);
    const t = Math.min(TL_DURATION, mins*60 + secs);
    // center range ±90s
    setRange([Math.max(0, t-90), Math.min(TL_DURATION, t+90)]);
  };

  return (
    <Card style={{ padding:0 }}>
      {/* ── Header ──────────────────────────── */}
      <div style={{ padding:'16px 20px 12px', borderBottom:'1px solid var(--m-border)', display:'flex', alignItems:'center', gap:14, flexWrap:'wrap' }}>
        <SectionLabel icon="activity" style={{ margin:0 }}>Timeline da partida</SectionLabel>
        <div style={{ fontSize:10, color:'var(--m-text-dim)', padding:'3px 8px', background:'rgba(245,200,66,0.1)', border:'1px solid rgba(245,200,66,0.25)', borderRadius:4, color:'var(--m-accent)', fontWeight:600, letterSpacing:'0.04em', textTransform:'uppercase' }}>Interativa</div>
        <div style={{ flex:1 }}/>

        {/* Jump */}
        <div style={{ display:'flex', alignItems:'center', gap:6 }}>
          <span style={{ fontSize:10, color:'var(--m-muted)', textTransform:'uppercase', letterSpacing:'0.08em' }}>Ir p/</span>
          <input
            value={jumpInput}
            onChange={e => setJumpInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleJump()}
            placeholder="14:30"
            style={{ width:64, padding:'5px 8px', background:'var(--m-bg)', border:'1px solid var(--m-border-2)', borderRadius:6, color:'var(--m-text)', fontSize:11, fontFamily:'var(--font-mono)', textAlign:'center' }}
          />
          <button onClick={handleJump} style={{ padding:'5px 10px', background:'var(--m-surface-2)', border:'1px solid var(--m-border-2)', borderRadius:6, color:'var(--m-text-dim)', fontSize:10, fontWeight:600, cursor:'pointer' }}>
            Ir
          </button>
          <button onClick={() => { setRange([0, TL_DURATION]); setFocusPlayer(null); }} style={{ padding:'5px 10px', background:'transparent', border:'1px solid var(--m-border-2)', borderRadius:6, color:'var(--m-text-dim)', fontSize:10, fontWeight:600, cursor:'pointer' }}>
            Reset
          </button>
        </div>
      </div>

      {/* ── Filter row ───────────────────────── */}
      <div style={{ padding:'10px 20px', display:'flex', alignItems:'center', gap:14, flexWrap:'wrap', borderBottom:'1px solid var(--m-border)', background:'var(--m-bg)' }}>
        <div style={{ display:'flex', gap:4 }}>
          {[
            { k:'kill',  label:'Kills',     color:'#F87171' },
            { k:'obj',   label:'Objetivos', color:'#FB923C' },
            { k:'tower', label:'Torres',    color:'#F5C842' },
            { k:'ward',  label:'Wards',     color:'#5BE3D4' },
            { k:'misc',  label:'Marcos',    color:'#4ADE80' },
          ].map(f => (
            <button key={f.k} onClick={() => setFilters({ ...filters, [f.k]: !filters[f.k] })}
              style={{
                padding:'5px 10px', borderRadius:6, fontSize:11, fontWeight:600, cursor:'pointer',
                background: filters[f.k] ? `${f.color}20` : 'transparent',
                border: `1px solid ${filters[f.k] ? `${f.color}60` : 'var(--m-border-2)'}`,
                color: filters[f.k] ? f.color : 'var(--m-text-dim)',
                display:'inline-flex', alignItems:'center', gap:6,
              }}>
              <div style={{ width:7, height:7, borderRadius:'50%', background:f.color, opacity: filters[f.k] ? 1 : 0.3 }}/>
              {f.label}
            </button>
          ))}
        </div>
        <div style={{ width:1, height:18, background:'var(--m-border)' }}/>
        <div style={{ display:'flex', gap:3, padding:2, background:'var(--m-surface-2)', border:'1px solid var(--m-border-2)', borderRadius:7 }}>
          {['both','blue','red'].map(t => (
            <button key={t} onClick={() => setTeam(t)} style={{
              padding:'4px 10px', borderRadius:5, fontSize:10, fontWeight:600, cursor:'pointer', border:'none',
              background: team === t ? (t === 'blue' ? 'var(--m-green)' : t === 'red' ? 'var(--m-red)' : 'var(--m-surface)') : 'transparent',
              color: team === t ? (t === 'both' ? 'var(--m-text)' : '#0B0D12') : 'var(--m-text-dim)',
              textTransform:'uppercase', letterSpacing:'0.06em',
            }}>
              {t === 'both' ? 'Ambos' : t === 'blue' ? 'Azul' : 'Vermelho'}
            </button>
          ))}
        </div>
        <div style={{ flex:1 }}/>
        <div style={{ display:'flex', alignItems:'center', gap:6 }}>
          <span style={{ fontSize:10, color:'var(--m-muted)', textTransform:'uppercase', letterSpacing:'0.08em' }}>Jogador</span>
          <select value={focusPlayer || ''} onChange={e => setFocusPlayer(e.target.value || null)}
            style={{ padding:'5px 8px', background:'var(--m-bg)', border:'1px solid var(--m-border-2)', borderRadius:6, color:'var(--m-text)', fontSize:11, cursor:'pointer' }}>
            <option value="">Todos</option>
            {players.map(p => <option key={p} value={p}>{p}</option>)}
          </select>
        </div>
        <div style={{ fontSize:10, color:'var(--m-muted)' }}>
          <span className="tabular" style={{ color:'var(--m-text)' }}>{visible.length}</span> de {TL_EVENTS.length} eventos
        </div>
      </div>

      {/* ── Horizontal track ─────────────────── */}
      <HorizontalTrack
        events={visible}
        range={range}
        setRange={setRange}
        hoveredId={hoveredId}
        setHoveredId={setHoveredId}
        onClickEvent={setOpenEvent}
      />

      {/* ── Vertical cards ───────────────────── */}
      <div style={{ padding:'16px 20px 20px' }}>
        <div style={{ display:'flex', alignItems:'baseline', gap:10, marginBottom:12 }}>
          <div style={{ fontSize:11, color:'var(--m-muted)', textTransform:'uppercase', letterSpacing:'0.08em', fontWeight:600 }}>
            Eventos no intervalo {fmtT(range[0])} – {fmtT(range[1])}
          </div>
          <div style={{ flex:1, height:1, background:'var(--m-border)' }}/>
        </div>
        <div style={{ position:'relative' }}>
          {/* vertical spine */}
          <div style={{ position:'absolute', left:31, top:0, bottom:0, width:2, background:'var(--m-border)' }}/>
          <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
            {visible.length === 0 && (
              <div style={{ padding:'30px 20px', textAlign:'center', color:'var(--m-muted)', fontSize:12 }}>Nenhum evento com os filtros atuais.</div>
            )}
            {visible.map(e => (
              <EventCard
                key={e.id}
                ev={e}
                hovered={hoveredId === e.id}
                onHover={setHoveredId}
                onClick={() => setOpenEvent(e)}
              />
            ))}
          </div>
        </div>
      </div>

      {openEvent && <EventModal ev={openEvent} onClose={() => setOpenEvent(null)}/>}
    </Card>
  );
}

// ── Horizontal scrubbable track ───────────────────────────────
function HorizontalTrack({ events, range, setRange, hoveredId, setHoveredId, onClickEvent }) {
  const trackRef = React.useRef(null);
  const [dragging, setDragging] = React.useState(null); // 'start' | 'end' | 'pan' | null

  const [r0, r1] = range;
  const visibleSpan = r1 - r0;
  const pctOf = t => ((t - r0) / visibleSpan) * 100;

  // Build XP diff curve points (blue - red) scaled 0..1 in visible range
  const minutes = XP_CURVE_BLUE.length - 1;
  const xpPoints = [];
  const diffs = XP_CURVE_BLUE.map((b,i) => b - XP_CURVE_RED[i]);
  const maxAbs = Math.max(...diffs.map(Math.abs));
  for (let m = 0; m <= minutes; m++) {
    const t = m * 60;
    if (t < r0 || t > r1) continue;
    xpPoints.push({ x: pctOf(t), y: 50 - (diffs[m] / maxAbs) * 40 });
  }

  return (
    <div style={{ padding:'12px 20px 16px', background:'linear-gradient(180deg, #101319 0%, #0B0D12 100%)' }}>
      {/* XP diff label row */}
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:6 }}>
        <div style={{ fontSize:10, color:'var(--m-muted)', textTransform:'uppercase', letterSpacing:'0.08em', fontWeight:600, display:'flex', alignItems:'center', gap:8 }}>
          <span>Diferença de XP</span>
          <span style={{ display:'inline-flex', alignItems:'center', gap:5 }}>
            <div style={{ width:8, height:8, background:'var(--m-green)', borderRadius:2 }}/>
            <span style={{ textTransform:'none', letterSpacing:0 }}>Azul ↑</span>
          </span>
          <span style={{ display:'inline-flex', alignItems:'center', gap:5 }}>
            <div style={{ width:8, height:8, background:'var(--m-red)', borderRadius:2 }}/>
            <span style={{ textTransform:'none', letterSpacing:0 }}>Vermelho ↑</span>
          </span>
        </div>
        <div style={{ fontSize:10, color:'var(--m-text-dim)', fontFamily:'var(--font-mono)' }}>
          {fmtT(r0)} → {fmtT(r1)} <span style={{ color:'var(--m-muted)' }}>({fmtT(visibleSpan)})</span>
        </div>
      </div>

      {/* XP curve chart */}
      <svg viewBox="0 0 100 50" preserveAspectRatio="none" style={{ width:'100%', height:54, display:'block', overflow:'visible' }}>
        <line x1="0" y1="50" x2="100" y2="50" stroke="var(--m-border)" strokeWidth="0.3" strokeDasharray="1 1"/>
        {xpPoints.length > 1 && (
          <>
            <path
              d={`M ${xpPoints[0].x},50 ${xpPoints.map(p => `L ${p.x},${p.y}`).join(' ')} L ${xpPoints[xpPoints.length-1].x},50 Z`}
              fill="url(#xpGradient)" opacity="0.4"
            />
            <path
              d={`M ${xpPoints.map(p => `${p.x},${p.y}`).join(' L ')}`}
              stroke="var(--m-green)" strokeWidth="0.4" fill="none" vectorEffect="non-scaling-stroke"
            />
          </>
        )}
        <defs>
          <linearGradient id="xpGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--m-green)" stopOpacity="0.5"/>
            <stop offset="100%" stopColor="var(--m-green)" stopOpacity="0"/>
          </linearGradient>
        </defs>
      </svg>

      {/* Main track */}
      <div ref={trackRef} style={{ position:'relative', height:80, marginTop:6 }}>
        {/* Baseline */}
        <div style={{ position:'absolute', left:0, right:0, top:40, height:2, background:'var(--m-border)', borderRadius:2 }}/>

        {/* Minute ticks */}
        {Array.from({ length: Math.ceil(visibleSpan / 60) + 1 }).map((_, i) => {
          const t = Math.ceil(r0 / 60) * 60 + i * 60;
          if (t > r1) return null;
          const x = pctOf(t);
          return (
            <div key={i} style={{ position:'absolute', left:`${x}%`, top:36, bottom:0, borderLeft:'1px solid var(--m-border)', opacity:0.6 }}>
              <div style={{ position:'absolute', top:-14, left:-12, fontSize:9, color:'var(--m-muted)', fontFamily:'var(--font-mono)', whiteSpace:'nowrap' }}>
                {Math.floor(t/60)}:00
              </div>
            </div>
          );
        })}

        {/* Events */}
        {events.map(e => {
          if (e.t < r0 || e.t > r1) return null;
          const x = pctOf(e.t);
          const cat = categoryOf(e);
          const t = eventTeam(e);
          const yOffset = t === 'red' ? 18 : t === 'blue' ? -18 : 0;
          return (
            <TrackMarker
              key={e.id}
              ev={e}
              x={x}
              yOffset={yOffset}
              hovered={hoveredId === e.id}
              onHover={setHoveredId}
              onClick={() => onClickEvent(e)}
            />
          );
        })}
      </div>

      {/* Zoom range slider */}
      <div style={{ marginTop:8, padding:'8px 0', position:'relative' }}>
        <div style={{ position:'relative', height:28, background:'var(--m-surface-2)', border:'1px solid var(--m-border)', borderRadius:6 }}>
          {/* mini event density */}
          {TL_EVENTS.map(e => (
            <div key={e.id} style={{
              position:'absolute',
              left:`${(e.t/TL_DURATION)*100}%`,
              top:8, bottom:8, width:2,
              background: e.key ? 'var(--m-accent)' : EVENT_TYPE_META[e.type]?.color || 'var(--m-muted)',
              opacity: e.key ? 1 : 0.5,
            }}/>
          ))}
          {/* selected range */}
          <div style={{
            position:'absolute',
            left:`${(r0/TL_DURATION)*100}%`,
            width:`${((r1-r0)/TL_DURATION)*100}%`,
            top:0, bottom:0,
            background:'rgba(245,200,66,0.12)',
            border:'1.5px solid var(--m-accent)',
            borderRadius:5,
            pointerEvents:'none',
          }}/>
        </div>
        <div style={{ display:'flex', gap:8, marginTop:8, alignItems:'center' }}>
          <span style={{ fontSize:10, color:'var(--m-muted)', fontFamily:'var(--font-mono)' }}>{fmtT(0)}</span>
          <input type="range" min="0" max={TL_DURATION} step="10" value={r0}
            onChange={e => setRange([Math.min(+e.target.value, r1-60), r1])}
            style={{ flex:1 }}/>
          <input type="range" min="0" max={TL_DURATION} step="10" value={r1}
            onChange={e => setRange([r0, Math.max(+e.target.value, r0+60)])}
            style={{ flex:1 }}/>
          <span style={{ fontSize:10, color:'var(--m-muted)', fontFamily:'var(--font-mono)' }}>{fmtT(TL_DURATION)}</span>
        </div>
      </div>
    </div>
  );
}

function TrackMarker({ ev, x, yOffset, hovered, onHover, onClick }) {
  const meta = EVENT_TYPE_META[ev.type];
  const color = ev.key ? 'var(--m-accent)' : meta.color;
  const size = ev.key ? 24 : ev.type === 'teamfight' ? 22 : 18;

  return (
    <div
      onMouseEnter={() => onHover(ev.id)}
      onMouseLeave={() => onHover(null)}
      onClick={onClick}
      style={{
        position:'absolute',
        left:`${x}%`,
        top:`calc(50% + ${yOffset}px)`,
        transform:'translate(-50%, -50%)',
        width:size, height:size, borderRadius:'50%',
        background: ev.key ? 'linear-gradient(135deg, #F5C842, #D4A228)' : `${color}22`,
        border: `2px solid ${color}`,
        boxShadow: hovered ? `0 0 0 4px ${color}33, 0 4px 12px rgba(0,0,0,0.4)` : (ev.key ? `0 0 12px ${color}66` : 'none'),
        display:'flex', alignItems:'center', justifyContent:'center',
        color: ev.key ? '#1a1510' : color,
        cursor:'pointer',
        zIndex: hovered ? 20 : ev.key ? 5 : 1,
        transition:'box-shadow 0.15s',
      }}>
      <Icon name={meta.icon} size={size * 0.52}/>

      {/* Tooltip */}
      {hovered && (
        <div style={{
          position:'absolute',
          bottom: yOffset > 0 ? 'auto' : `calc(100% + 10px)`,
          top:    yOffset > 0 ? `calc(100% + 10px)` : 'auto',
          left:'50%',
          transform:'translateX(-50%)',
          minWidth:260, maxWidth:320,
          padding:'10px 12px',
          background:'var(--m-surface-2)',
          border:`1px solid ${color}66`,
          borderRadius:10,
          boxShadow:'0 8px 32px rgba(0,0,0,0.6)',
          zIndex:100,
          pointerEvents:'none',
          textAlign:'left',
        }}>
          <MarkerTooltipContent ev={ev}/>
        </div>
      )}
    </div>
  );
}

function MarkerTooltipContent({ ev }) {
  const meta = EVENT_TYPE_META[ev.type];
  return (
    <div>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:6 }}>
        <div style={{ fontSize:9, color: meta.color, textTransform:'uppercase', letterSpacing:'0.1em', fontWeight:700 }}>{ev.type === 'dragon' ? `${ev.drakeType} Drake` : meta.label}</div>
        <div className="tabular" style={{ fontSize:10, color:'var(--m-text-dim)', fontFamily:'var(--font-mono)' }}>{fmtT(ev.t)}</div>
      </div>
      {ev.type === 'kill' && (
        <div style={{ display:'flex', alignItems:'center', gap:8, padding:'6px 0' }}>
          <ChampPortrait name={ev.killer.c} size={32} ring={ev.killer.team}/>
          <div style={{ fontSize:16, color:'var(--m-muted)' }}>⟶</div>
          <ChampPortrait name={ev.victim.c} size={32} ring={ev.victim.team} dim/>
          <div style={{ flex:1 }}>
            <div style={{ fontSize:11, fontWeight:600 }}>{ev.killer.n}</div>
            <div style={{ fontSize:10, color:'var(--m-text-dim)' }}>matou {ev.victim.n}</div>
          </div>
        </div>
      )}
      {ev.type === 'teamfight' && (
        <div style={{ display:'flex', flexWrap:'wrap', gap:4, padding:'4px 0' }}>
          {ev.kills.slice(0,5).map((k,i) => (
            <div key={i} style={{ display:'flex', alignItems:'center', gap:2 }}>
              <ChampPortrait name={k.killer.c} size={20} ring={k.killer.team}/>
              <span style={{ fontSize:10, color:'var(--m-muted)' }}>×</span>
              <ChampPortrait name={k.victim.c} size={20} ring={k.victim.team} dim/>
            </div>
          ))}
        </div>
      )}
      {ev.type === 'dragon' && (
        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
          <div style={{ width:28, height:28, borderRadius:6, background:`${DRAKE_COLORS[ev.drakeType]}20`, border:`1px solid ${DRAKE_COLORS[ev.drakeType]}60`, display:'flex', alignItems:'center', justifyContent:'center', color:DRAKE_COLORS[ev.drakeType] }}>
            <Icon name="flame" size={14}/>
          </div>
          <div>
            <div style={{ fontSize:11, fontWeight:600 }}>Time {ev.team === 'blue' ? 'Azul' : 'Vermelho'}</div>
            <div style={{ fontSize:10, color:'var(--m-text-dim)' }}>+{ev.gold?.toLocaleString()} de ouro</div>
          </div>
        </div>
      )}
      {(ev.type === 'tower' || ev.type === 'baron' || ev.type === 'herald') && (
        <div style={{ fontSize:11, color:'var(--m-text)' }}>
          <b style={{ color: ev.team === 'blue' ? 'var(--m-green)' : 'var(--m-red)' }}>Time {ev.team === 'blue' ? 'Azul' : 'Vermelho'}</b>
          {ev.tower && <span style={{ color:'var(--m-text-dim)' }}> · {ev.tower}</span>}
        </div>
      )}
      {ev.type === 'level' && (
        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
          <ChampPortrait name={ev.actor.c} size={28} ring={ev.actor.team}/>
          <div>
            <div style={{ fontSize:11, fontWeight:600 }}>{ev.actor.n} atingiu nível {ev.level}</div>
          </div>
        </div>
      )}
      {ev.type === 'item' && (
        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
          <ChampPortrait name={ev.actor.c} size={26} ring={ev.actor.team}/>
          <div style={{ width:26, height:26, borderRadius:5, background:`url(${itemImg(ev.item)}) center/cover`, border:'1px solid var(--m-border-2)' }}/>
          <div style={{ fontSize:11 }}>
            <b>{ev.actor.n}</b>
            <div style={{ fontSize:10, color:'var(--m-text-dim)' }}>finalizou {ev.itemName}</div>
          </div>
        </div>
      )}
      {ev.type === 'ward' && (
        <div style={{ fontSize:11, color:'var(--m-text-dim)' }}>
          <b style={{ color: 'var(--m-text)' }}>{ev.actor.n}</b> — {ev.target}
        </div>
      )}
      {/* Mini map preview */}
      <div style={{ marginTop:8, display:'flex', gap:8, alignItems:'center' }}>
        <MiniMap x={ev.x} y={ev.y} team={eventTeam(ev)} size={48}/>
        <div style={{ fontSize:9, color:'var(--m-muted)', lineHeight:1.4 }}>
          {ev.lane ? `Lane: ${ev.lane}` : ''}<br/>
          coords ~({ev.x}, {ev.y})
        </div>
      </div>
      {ev.note && <div style={{ fontSize:10, color:'var(--m-text-dim)', marginTop:8, lineHeight:1.5, fontStyle:'italic', borderTop:'1px solid var(--m-border)', paddingTop:6 }}>"{ev.note}"</div>}
      <div style={{ fontSize:9, color:'var(--m-muted)', marginTop:6, textAlign:'center', letterSpacing:'0.06em', textTransform:'uppercase' }}>Clique pra detalhes</div>
    </div>
  );
}

// ── Vertical event card (bottom list) ─────────────────────────
function EventCard({ ev, hovered, onHover, onClick }) {
  const meta = EVENT_TYPE_META[ev.type];
  const color = ev.key ? 'var(--m-accent)' : meta.color;
  const teamColor = eventTeam(ev) === 'blue' ? 'var(--m-green)' : eventTeam(ev) === 'red' ? 'var(--m-red)' : 'var(--m-muted)';

  return (
    <div
      onMouseEnter={() => onHover(ev.id)}
      onMouseLeave={() => onHover(null)}
      onClick={onClick}
      style={{
        position:'relative',
        display:'grid',
        gridTemplateColumns:'64px 1fr 84px',
        gap:14,
        padding:'11px 14px',
        paddingLeft:72,
        background: hovered ? 'var(--m-surface-2)' : 'var(--m-surface)',
        border:`1px solid ${hovered ? `${color}66` : 'var(--m-border)'}`,
        borderLeft:`3px solid ${color}`,
        borderRadius:10,
        cursor:'pointer',
        transition:'background 0.15s, border 0.15s',
      }}>
      {/* Spine node */}
      <div style={{
        position:'absolute', left:19, top:'50%', transform:'translateY(-50%)',
        width:26, height:26, borderRadius:'50%',
        background: ev.key ? 'linear-gradient(135deg, #F5C842, #D4A228)' : 'var(--m-bg)',
        border:`2px solid ${color}`,
        display:'flex', alignItems:'center', justifyContent:'center',
        color: ev.key ? '#1a1510' : color,
        zIndex:2,
      }}>
        <Icon name={meta.icon} size={13}/>
      </div>

      {/* Timestamp */}
      <div style={{ display:'flex', flexDirection:'column', justifyContent:'center' }}>
        <div className="tabular font-display" style={{ fontSize:16, fontWeight:700, color:'var(--m-text)', letterSpacing:'-0.02em' }}>{fmtT(ev.t)}</div>
        <div style={{ fontSize:9, color:'var(--m-muted)', textTransform:'uppercase', letterSpacing:'0.08em' }}>{ev.type === 'dragon' ? ev.drakeType : meta.label}</div>
      </div>

      {/* Content */}
      <div style={{ minWidth:0, display:'flex', flexDirection:'column', justifyContent:'center', gap:4 }}>
        <EventSummary ev={ev}/>
        {ev.note && <div style={{ fontSize:11, color:'var(--m-text-dim)', lineHeight:1.45 }}>{ev.note}</div>}
        <div style={{ display:'flex', gap:6, alignItems:'center', marginTop:2 }}>
          {ev.key && <span style={{ fontSize:9, padding:'2px 6px', background:'rgba(245,200,66,0.15)', color:'var(--m-accent)', borderRadius:3, fontWeight:700, letterSpacing:'0.06em' }}>MOMENTO CHAVE</span>}
          {ev.gold && <span style={{ fontSize:10, color:'var(--m-accent)', fontFamily:'var(--font-mono)' }}>+{ev.gold.toLocaleString()}g</span>}
          {ev.lane && <span style={{ fontSize:10, color:'var(--m-muted)' }}>{ev.lane}</span>}
        </div>
      </div>

      {/* Mini map */}
      <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:4 }}>
        <MiniMap x={ev.x} y={ev.y} team={eventTeam(ev)} size={60} pulse={hovered}/>
        <div style={{ fontSize:8, color:'var(--m-muted)', fontFamily:'var(--font-mono)' }}>{ev.x},{ev.y}</div>
      </div>
    </div>
  );
}

function EventSummary({ ev }) {
  if (ev.type === 'kill') {
    return (
      <div style={{ display:'flex', alignItems:'center', gap:6, flexWrap:'wrap' }}>
        <ChampPortrait name={ev.killer.c} size={22} ring={ev.killer.team}/>
        <span style={{ fontSize:12, fontWeight:600, color: ev.killer.isYou ? 'var(--m-accent)' : 'var(--m-text)' }}>{ev.killer.n}</span>
        <Icon name="sword" size={11} style={{ color:'var(--m-muted)' }}/>
        <ChampPortrait name={ev.victim.c} size={22} ring={ev.victim.team} dim/>
        <span style={{ fontSize:12, color:'var(--m-text-dim)' }}>{ev.victim.n}</span>
        {ev.assists?.length > 0 && (
          <div style={{ display:'flex', alignItems:'center', gap:4, paddingLeft:6, borderLeft:'1px solid var(--m-border)', marginLeft:4 }}>
            <span style={{ fontSize:9, color:'var(--m-muted)' }}>assist</span>
            {ev.assists.map((a,i) => <ChampPortrait key={i} name={a.c} size={16} ring={a.team}/>)}
          </div>
        )}
      </div>
    );
  }
  if (ev.type === 'teamfight') {
    return (
      <div style={{ display:'flex', alignItems:'center', gap:8, flexWrap:'wrap' }}>
        <span style={{ fontSize:12, fontWeight:600 }}>Teamfight</span>
        <span style={{ fontSize:11, color:'var(--m-text-dim)' }}>·</span>
        <div style={{ display:'flex', gap:2 }}>
          {ev.kills.map((k,i) => (
            <div key={i} style={{ display:'flex', alignItems:'center', gap:1 }}>
              <ChampPortrait name={k.killer.c} size={18} ring={k.killer.team}/>
              <ChampPortrait name={k.victim.c} size={18} ring={k.victim.team} dim/>
            </div>
          ))}
        </div>
        <span className="tabular" style={{ fontSize:11, color:'var(--m-text)', fontWeight:600 }}>
          {ev.kills.filter(k => k.killer.team === 'blue').length} × {ev.kills.filter(k => k.killer.team === 'red').length}
        </span>
      </div>
    );
  }
  if (ev.type === 'dragon') {
    return (
      <div style={{ display:'flex', alignItems:'center', gap:6 }}>
        <div style={{ width:22, height:22, borderRadius:5, background:`${DRAKE_COLORS[ev.drakeType]}20`, border:`1px solid ${DRAKE_COLORS[ev.drakeType]}`, display:'flex', alignItems:'center', justifyContent:'center', color:DRAKE_COLORS[ev.drakeType] }}>
          <Icon name="flame" size={12}/>
        </div>
        <span style={{ fontSize:12, fontWeight:600 }}>Dragão {ev.drakeType}</span>
        <span style={{ fontSize:11, color:'var(--m-text-dim)' }}>·</span>
        <span style={{ fontSize:12, color: ev.team === 'blue' ? 'var(--m-green)' : 'var(--m-red)', fontWeight:600 }}>Time {ev.team === 'blue' ? 'Azul' : 'Vermelho'}</span>
      </div>
    );
  }
  if (ev.type === 'baron') {
    return <div style={{ fontSize:12, fontWeight:700, color:'var(--m-accent)' }}>Baron Nashor · Time {ev.team === 'blue' ? 'Azul' : 'Vermelho'}</div>;
  }
  if (ev.type === 'herald') {
    return <div style={{ fontSize:12, fontWeight:600 }}>Arauto do Vale · Time {ev.team === 'blue' ? 'Azul' : 'Vermelho'}</div>;
  }
  if (ev.type === 'tower') {
    return <div style={{ fontSize:12, fontWeight:600 }}>{ev.tower} destruída <span style={{ color:'var(--m-text-dim)', fontWeight:500 }}>· Time {ev.team === 'blue' ? 'Azul' : 'Vermelho'}</span></div>;
  }
  if (ev.type === 'level') {
    return (
      <div style={{ display:'flex', alignItems:'center', gap:6 }}>
        <ChampPortrait name={ev.actor.c} size={20} ring={ev.actor.team}/>
        <span style={{ fontSize:12, fontWeight:600, color: ev.actor.isYou ? 'var(--m-accent)' : 'var(--m-text)' }}>{ev.actor.n}</span>
        <span style={{ fontSize:11, color:'var(--m-text-dim)' }}>chegou ao nível</span>
        <span className="tabular" style={{ fontSize:13, fontWeight:700, color:'var(--m-green)' }}>{ev.level}</span>
      </div>
    );
  }
  if (ev.type === 'item') {
    return (
      <div style={{ display:'flex', alignItems:'center', gap:6 }}>
        <ChampPortrait name={ev.actor.c} size={20} ring={ev.actor.team}/>
        <span style={{ fontSize:12, fontWeight:600, color: ev.actor.isYou ? 'var(--m-accent)' : 'var(--m-text)' }}>{ev.actor.n}</span>
        <span style={{ fontSize:11, color:'var(--m-text-dim)' }}>finalizou</span>
        <div style={{ width:20, height:20, borderRadius:4, background:`url(${itemImg(ev.item)}) center/cover`, border:'1px solid var(--m-border-2)' }}/>
        <span style={{ fontSize:12, fontWeight:600 }}>{ev.itemName}</span>
      </div>
    );
  }
  if (ev.type === 'ward') {
    return (
      <div style={{ display:'flex', alignItems:'center', gap:6 }}>
        <ChampPortrait name={ev.actor.c} size={18} ring={ev.actor.team}/>
        <span style={{ fontSize:12 }}>{ev.actor.n}</span>
        <span style={{ fontSize:11, color:'var(--m-text-dim)' }}>· {ev.target}</span>
      </div>
    );
  }
  return null;
}

// ── Mini map component ────────────────────────────────────────
function MiniMap({ x, y, team, size=60, pulse=false, showHeatmap=false }) {
  const color = team === 'blue' ? '#4ADE80' : team === 'red' ? '#F87171' : '#F5C842';
  return (
    <div style={{
      position:'relative', width:size, height:size,
      borderRadius:6, overflow:'hidden',
      background:'linear-gradient(135deg, #1a2a2f 0%, #0f1a1e 100%)',
      border:'1px solid var(--m-border-2)',
    }}>
      {/* Map stylization: river diagonal + jungle zones */}
      <svg viewBox="0 0 100 100" style={{ position:'absolute', inset:0, width:'100%', height:'100%' }}>
        {/* Jungle green tint */}
        <rect width="100" height="100" fill="#0D1A15"/>
        {/* River */}
        <path d="M 0,62 L 38,62 L 62,38 L 100,38" stroke="#2B6B8F" strokeWidth="14" fill="none" opacity="0.45"/>
        {/* Lanes */}
        <path d="M 6,94 L 6,32 L 32,6 L 94,6" stroke="#3a3628" strokeWidth="2.5" fill="none" opacity="0.7"/>
        <path d="M 6,94 L 94,6" stroke="#3a3628" strokeWidth="2" fill="none" opacity="0.55"/>
        <path d="M 6,94 L 68,94 L 94,68 L 94,6" stroke="#3a3628" strokeWidth="2.5" fill="none" opacity="0.7"/>
        {/* Bases */}
        <circle cx="8" cy="92" r="5" fill="#F87171" opacity="0.35"/>
        <circle cx="92" cy="8" r="5" fill="#4ADE80" opacity="0.35"/>
        {/* Heatmap (optional) */}
        {showHeatmap && KILL_HEATMAP.map((k,i) => (
          <circle key={i} cx={k.x} cy={100-k.y} r="4" fill={k.team === 'blue' ? '#4ADE80' : '#F87171'} opacity="0.25"/>
        ))}
        {/* Event pin */}
        {x != null && (
          <>
            {pulse && <circle cx={x} cy={100-y} r="10" fill={color} opacity="0.2">
              <animate attributeName="r" values="4;10;4" dur="1.5s" repeatCount="indefinite"/>
              <animate attributeName="opacity" values="0.4;0;0.4" dur="1.5s" repeatCount="indefinite"/>
            </circle>}
            <circle cx={x} cy={100-y} r="3.5" fill={color} stroke="#0B0D12" strokeWidth="1"/>
          </>
        )}
      </svg>
    </div>
  );
}

// ── Modal on event click ─────────────────────────────────────
function EventModal({ ev, onClose }) {
  const meta = EVENT_TYPE_META[ev.type];
  const color = ev.key ? 'var(--m-accent)' : meta.color;

  React.useEffect(() => {
    const onKey = e => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div onClick={onClose} style={{
      position:'absolute', inset:0,
      background:'rgba(11,13,18,0.85)', backdropFilter:'blur(8px)',
      display:'flex', alignItems:'center', justifyContent:'center',
      zIndex:1000, padding:30, borderRadius:14,
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        maxWidth:560, width:'100%',
        background:'var(--m-surface)',
        border:`1px solid ${color}66`,
        borderTop:`3px solid ${color}`,
        borderRadius:14,
        boxShadow:'0 20px 60px rgba(0,0,0,0.6)',
        overflow:'hidden',
      }}>
        <div style={{ padding:'18px 22px 14px', borderBottom:'1px solid var(--m-border)', display:'flex', alignItems:'center', gap:12 }}>
          <div style={{ width:44, height:44, borderRadius:10, background:`${color}22`, border:`1.5px solid ${color}`, display:'flex', alignItems:'center', justifyContent:'center', color }}>
            <Icon name={meta.icon} size={22}/>
          </div>
          <div style={{ flex:1 }}>
            <div style={{ fontSize:10, color, textTransform:'uppercase', letterSpacing:'0.1em', fontWeight:700 }}>{ev.type === 'dragon' ? `Drake ${ev.drakeType}` : meta.label}{ev.key && ' · Momento chave'}</div>
            <div className="font-display" style={{ fontSize:20, fontWeight:700, marginTop:2 }}>
              <span className="tabular" style={{ color:'var(--m-text)' }}>{fmtT(ev.t)}</span>
              <span style={{ color:'var(--m-muted)', fontWeight:500, fontSize:14, marginLeft:10 }}>minuto {Math.floor(ev.t/60)}</span>
            </div>
          </div>
          <button onClick={onClose} style={{ width:30, height:30, borderRadius:7, background:'var(--m-surface-2)', border:'1px solid var(--m-border-2)', color:'var(--m-text-dim)', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center' }}>
            <Icon name="x" size={14}/>
          </button>
        </div>

        <div style={{ padding:'18px 22px' }}>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 160px', gap:18, alignItems:'start' }}>
            <div>
              <EventSummary ev={ev}/>
              {ev.assists?.length > 0 && (
                <div style={{ marginTop:12, paddingTop:12, borderTop:'1px solid var(--m-border)' }}>
                  <div style={{ fontSize:10, color:'var(--m-muted)', textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:6, fontWeight:600 }}>Assistências</div>
                  <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
                    {ev.assists.map((a,i) => (
                      <div key={i} style={{ display:'flex', alignItems:'center', gap:5, padding:'4px 8px 4px 4px', background:'var(--m-bg)', borderRadius:14 }}>
                        <ChampPortrait name={a.c} size={20} ring={a.team}/>
                        <span style={{ fontSize:11 }}>{a.n}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {ev.note && (
                <div style={{ marginTop:12, padding:12, background:'var(--m-bg)', border:'1px solid var(--m-border)', borderRadius:8 }}>
                  <div style={{ fontSize:10, color:'var(--m-muted)', textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:4, fontWeight:600 }}>Contexto</div>
                  <div style={{ fontSize:12, color:'var(--m-text-dim)', lineHeight:1.55 }}>{ev.note}</div>
                </div>
              )}
            </div>
            <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:8 }}>
              <MiniMap x={ev.x} y={ev.y} team={eventTeam(ev)} size={140} pulse showHeatmap/>
              <div style={{ fontSize:10, color:'var(--m-text-dim)', textAlign:'center' }}>
                <div>{ev.lane || 'Localização'}</div>
                <div className="tabular" style={{ color:'var(--m-muted)' }}>({ev.x}, {ev.y})</div>
              </div>
              {ev.gold && (
                <div style={{ padding:'6px 10px', background:'rgba(245,200,66,0.1)', border:'1px solid rgba(245,200,66,0.3)', borderRadius:6 }}>
                  <div style={{ fontSize:9, color:'var(--m-muted)', textTransform:'uppercase', letterSpacing:'0.08em', textAlign:'center' }}>Ouro</div>
                  <div className="tabular font-display" style={{ fontSize:16, fontWeight:700, color:'var(--m-accent)' }}>+{ev.gold.toLocaleString()}</div>
                </div>
              )}
            </div>
          </div>
        </div>

        <div style={{ padding:'14px 22px', borderTop:'1px solid var(--m-border)', background:'var(--m-bg)', display:'flex', gap:8 }}>
          <button style={{ flex:1, padding:'10px 14px', background:'linear-gradient(135deg, #F5C842, #D4A228)', border:'none', borderRadius:8, color:'#1a1510', fontSize:12, fontWeight:700, cursor:'pointer', display:'inline-flex', alignItems:'center', justifyContent:'center', gap:8 }}>
            <Icon name="brain" size={14}/>
            Perguntar à Metis sobre este momento
          </button>
          <button style={{ padding:'10px 14px', background:'var(--m-surface-2)', border:'1px solid var(--m-border-2)', borderRadius:8, color:'var(--m-text-dim)', fontSize:11, fontWeight:600, cursor:'pointer' }}>
            Ver replay
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Helpers ───────────────────────────────────────────────────
function categoryOf(e) {
  if (e.type === 'kill' || e.type === 'teamfight') return 'kill';
  if (e.type === 'dragon' || e.type === 'baron' || e.type === 'herald') return 'obj';
  if (e.type === 'tower') return 'tower';
  if (e.type === 'ward') return 'ward';
  return 'misc';
}
function eventTeam(e) {
  if (e.team) return e.team;
  if (e.killer) return e.killer.team;
  if (e.actor) return e.actor.team;
  return null;
}
function eventPlayers(e) {
  const out = [];
  if (e.killer) out.push(e.killer.n);
  if (e.victim) out.push(e.victim.n);
  if (e.actor)  out.push(e.actor.n);
  if (e.assists) e.assists.forEach(a => out.push(a.n));
  if (e.kills)   e.kills.forEach(k => { out.push(k.killer.n); out.push(k.victim.n); });
  return out;
}

Object.assign(window, { Timeline });
