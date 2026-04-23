// Metis shared UI primitives: cards, stats, mini charts, header, role/tier badges.
// All use CSS tokens defined on .metis-scope.

// ── Card ────────────────────────────────────────────────────────────
function Card({ children, style, className='', pad = 20, hover = false, accent = false }) {
  return (
    <div className={className} style={{
      background: 'var(--m-surface)',
      border: '1px solid var(--m-border)',
      borderRadius: 14,
      padding: pad,
      position: 'relative',
      ...(accent ? { borderColor: 'rgba(245,200,66,0.35)', boxShadow: '0 0 0 1px rgba(245,200,66,0.15), 0 20px 40px -20px rgba(245,200,66,0.35)' } : {}),
      ...(style || {}),
    }}>
      {children}
    </div>
  );
}

// ── SectionLabel ────────────────────────────────────────────────────
function SectionLabel({ icon, children, right }) {
  return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:12 }}>
      <div style={{ display:'flex', alignItems:'center', gap:8, textTransform:'uppercase', letterSpacing:'0.08em', fontSize:11, fontWeight:600, color:'var(--m-text-dim)' }}>
        {icon && <Icon name={icon} size={14} style={{ color:'var(--m-accent)' }} />}
        {children}
      </div>
      {right}
    </div>
  );
}

// ── ChampPortrait ───────────────────────────────────────────────────
function ChampPortrait({ name, size = 40, border = true, role }) {
  return (
    <div style={{ position:'relative', width:size, height:size, flexShrink:0 }}>
      <div style={{
        width:size, height:size, borderRadius: size/6,
        backgroundImage:`url(${champImg(name)})`,
        backgroundSize:'cover', backgroundPosition:'center',
        border: border ? '1px solid var(--m-border-2)' : 'none',
      }} />
      {role && (
        <div style={{
          position:'absolute', bottom:-3, right:-3,
          width:size*0.42, height:size*0.42, borderRadius:'50%',
          background:'var(--m-surface-2)', border:'1px solid var(--m-border-2)',
          display:'flex', alignItems:'center', justifyContent:'center',
          fontSize:Math.max(8, size*0.22), color:'var(--m-text-dim)',
        }}>
          <RoleGlyph role={role} size={size*0.26} />
        </div>
      )}
    </div>
  );
}

// ── RoleGlyph — tiny inline SVG, no external img dependency ─────────
function RoleGlyph({ role, size = 12 }) {
  const glyphs = {
    TOP:     <path d="M3 3h12v3H6v9H3z" />,
    JUNGLE:  <path d="M9 2l2 4 4 1-3 3 1 4-4-2-4 2 1-4-3-3 4-1z" />,
    MIDDLE:  <path d="M3 15L15 3M3 3h5M15 15v-5" />,
    BOTTOM:  <path d="M15 15H3v-3h9V3h3z" />,
    UTILITY: <><circle cx="9" cy="9" r="6"/><path d="M9 5v8M5 9h8"/></>,
  };
  return (
    <svg width={size} height={size} viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" strokeLinecap="round">
      {glyphs[role] || glyphs.MIDDLE}
    </svg>
  );
}

// ── TierBadge ───────────────────────────────────────────────────────
function TierBadge({ tier, size = 'md' }) {
  const c = TIER_COLORS[tier] || TIER_COLORS.B;
  const dims = size === 'sm' ? { w:24, h:20, fs:10 } : size === 'lg' ? { w:44, h:36, fs:18 } : { w:32, h:26, fs:13 };
  return (
    <span style={{
      display:'inline-flex', alignItems:'center', justifyContent:'center',
      width:dims.w, height:dims.h, borderRadius:6,
      background:c.bg, border:`1px solid ${c.border}`, color:c.text,
      fontSize:dims.fs, fontWeight:700, letterSpacing:'-0.02em', flexShrink:0,
    }}>{tier}</span>
  );
}

// ── RankBadge — elo + LP ────────────────────────────────────────────
function RankBadge({ tier='DIAMOND', rank='II', lp=0 }) {
  const colors = {
    IRON:'#857668', BRONZE:'#A96C3C', SILVER:'#B4C0CF', GOLD:'#E8B841',
    PLATINUM:'#4FC6CC', EMERALD:'#44D19E', DIAMOND:'#9FB7E6',
    MASTER:'#C581E6', GRANDMASTER:'#E87070', CHALLENGER:'#66D7F0',
  };
  const c = colors[tier] || '#9FB7E6';
  return (
    <div style={{ display:'inline-flex', alignItems:'center', gap:8, padding:'4px 10px 4px 4px', borderRadius:999, background:'var(--m-surface-2)', border:'1px solid var(--m-border-2)' }}>
      <div style={{ width:24, height:24, borderRadius:'50%', background:`radial-gradient(circle at 30% 30%, ${c}, ${c}88)`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:10, fontWeight:800, color:'#0B0D12' }}>◆</div>
      <div style={{ fontSize:11, fontWeight:600, letterSpacing:'0.04em', textTransform:'uppercase', color:c }}>{tier}</div>
      <div style={{ fontSize:11, fontWeight:500, color:'var(--m-text-dim)' }}>{rank}</div>
      <div style={{ fontSize:11, fontWeight:700, color:'var(--m-text)', fontVariantNumeric:'tabular-nums', paddingLeft:6, borderLeft:'1px solid var(--m-border-2)' }}>{lp} LP</div>
    </div>
  );
}

// ── Pill ────────────────────────────────────────────────────────────
function Pill({ children, color='default', style, icon, onClick, active=false }) {
  const map = {
    default: { bg:'var(--m-surface-2)', bd:'var(--m-border-2)', fg:'var(--m-text-dim)' },
    accent:  { bg:'rgba(245,200,66,0.12)', bd:'rgba(245,200,66,0.35)', fg:'var(--m-accent)' },
    green:   { bg:'rgba(74,222,128,0.12)', bd:'rgba(74,222,128,0.3)', fg:'var(--m-green)' },
    red:     { bg:'rgba(248,113,113,0.12)', bd:'rgba(248,113,113,0.3)', fg:'var(--m-red)' },
    cyan:    { bg:'rgba(91,227,212,0.12)', bd:'rgba(91,227,212,0.3)', fg:'var(--m-cyan)' },
    violet:  { bg:'rgba(139,127,255,0.12)', bd:'rgba(139,127,255,0.3)', fg:'var(--m-violet)' },
  };
  const c = map[color] || map.default;
  return (
    <button onClick={onClick} style={{
      display:'inline-flex', alignItems:'center', gap:6,
      background: active ? c.bg : 'transparent',
      border:`1px solid ${active ? c.bd : 'var(--m-border)'}`,
      color: active ? c.fg : 'var(--m-text-dim)',
      padding:'5px 10px', borderRadius:999, fontSize:12, fontWeight:500,
      whiteSpace:'nowrap', transition:'all .15s',
      ...(style||{}),
    }}>
      {icon && <Icon name={icon} size={12}/>}
      {children}
    </button>
  );
}

// ── Stat — label/value pair, big numbers ────────────────────────────
function Stat({ label, value, sub, accent, icon, size='md' }) {
  const dims = size === 'lg'
    ? { v: 32, l: 11, s: 11 }
    : size === 'sm'
    ? { v: 18, l: 10, s: 10 }
    : { v: 24, l: 10, s: 10 };
  return (
    <div>
      <div style={{ display:'flex', alignItems:'center', gap:6, textTransform:'uppercase', letterSpacing:'0.06em', fontSize:dims.l, fontWeight:600, color:'var(--m-text-dim)' }}>
        {icon && <Icon name={icon} size={12}/>}
        {label}
      </div>
      <div className="tabular font-display" style={{ fontSize:dims.v, fontWeight:700, color: accent || 'var(--m-text)', marginTop:4, lineHeight:1 }}>{value}</div>
      {sub && <div style={{ fontSize:dims.s, color:'var(--m-muted)', marginTop:3 }}>{sub}</div>}
    </div>
  );
}

// ── Bar — horizontal progress ───────────────────────────────────────
function Bar({ value, max = 100, color = 'var(--m-accent)', height = 6, track = 'var(--m-border)', rounded = true }) {
  const pct = Math.min(100, Math.max(0, (value / max) * 100));
  return (
    <div style={{ width:'100%', height, background:track, borderRadius: rounded ? height/2 : 0, overflow:'hidden' }}>
      <div style={{ width:`${pct}%`, height:'100%', background:color, borderRadius: rounded ? height/2 : 0, transition:'width .4s' }}/>
    </div>
  );
}

// ── WinLossDots — circular win/loss indicators ──────────────────────
function WinLossDots({ results, size = 8, gap = 4 }) {
  return (
    <div style={{ display:'flex', gap }}>
      {results.map((w, i) => (
        <div key={i} style={{
          width:size, height:size, borderRadius: size/2,
          background: w ? 'var(--m-green)' : 'var(--m-red)',
          opacity: 0.35 + (i / results.length) * 0.65,
        }}/>
      ))}
    </div>
  );
}

// ── Sparkline — tiny SVG line chart ────────────────────────────────
function Sparkline({ data, width = 120, height = 36, color='var(--m-accent)', fill = true, strokeW = 2 }) {
  if (!data.length) return null;
  const min = Math.min(...data), max = Math.max(...data);
  const range = max - min || 1;
  const pts = data.map((v, i) => {
    const x = (i / (data.length - 1)) * width;
    const y = height - ((v - min) / range) * (height - 4) - 2;
    return [x, y];
  });
  const path = pts.map((p, i) => (i === 0 ? 'M' : 'L') + p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join(' ');
  const area = path + ` L ${width} ${height} L 0 ${height} Z`;
  return (
    <svg width={width} height={height} style={{ display:'block' }}>
      {fill && (
        <>
          <defs>
            <linearGradient id="spark-fill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity="0.35"/>
              <stop offset="100%" stopColor={color} stopOpacity="0"/>
            </linearGradient>
          </defs>
          <path d={area} fill="url(#spark-fill)"/>
        </>
      )}
      <path d={path} stroke={color} strokeWidth={strokeW} fill="none" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

// ── Donut — single-value circular progress ──────────────────────────
function Donut({ value, max = 100, size = 120, thickness = 10, color = 'var(--m-accent)', track = 'var(--m-border)', children }) {
  const r = (size - thickness) / 2;
  const circ = 2 * Math.PI * r;
  const pct = Math.min(1, Math.max(0, value / max));
  return (
    <div style={{ position:'relative', width:size, height:size, flexShrink:0 }}>
      <svg width={size} height={size} style={{ transform:'rotate(-90deg)' }}>
        <circle cx={size/2} cy={size/2} r={r} stroke={track} strokeWidth={thickness} fill="none"/>
        <circle cx={size/2} cy={size/2} r={r} stroke={color} strokeWidth={thickness} fill="none"
          strokeDasharray={`${circ * pct} ${circ}`} strokeLinecap="round" style={{ transition:'stroke-dasharray .5s' }}/>
      </svg>
      <div style={{ position:'absolute', inset:0, display:'flex', alignItems:'center', justifyContent:'center', flexDirection:'column' }}>
        {children}
      </div>
    </div>
  );
}

// ── StackedBar — horizontal role distribution ───────────────────────
function StackedBar({ segments, height = 8, radius = 4 }) {
  const total = segments.reduce((s, x) => s + x.value, 0);
  return (
    <div style={{ display:'flex', width:'100%', height, borderRadius:radius, overflow:'hidden', background:'var(--m-border)' }}>
      {segments.map((s, i) => (
        <div key={i} style={{ width:`${(s.value/total)*100}%`, background:s.color, transition:'width .4s' }} title={`${s.label}: ${s.value}%`}/>
      ))}
    </div>
  );
}

// ── AreaChart — for LP history ──────────────────────────────────────
function AreaChart({ data, width = 480, height = 140, color = 'var(--m-accent)', grid = true }) {
  if (!data.length) return null;
  const min = Math.min(...data), max = Math.max(...data);
  const range = max - min || 1;
  const padX = 0, padY = 8;
  const pts = data.map((v, i) => {
    const x = padX + (i / (data.length - 1)) * (width - padX * 2);
    const y = padY + (1 - (v - min) / range) * (height - padY * 2);
    return [x, y];
  });
  const path = pts.map((p, i) => (i === 0 ? 'M' : 'L') + p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join(' ');
  const area = path + ` L ${width - padX} ${height} L ${padX} ${height} Z`;
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} style={{ display:'block', width:'100%' }}>
      <defs>
        <linearGradient id="area-gr" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.5"/>
          <stop offset="100%" stopColor={color} stopOpacity="0"/>
        </linearGradient>
      </defs>
      {grid && [0.25, 0.5, 0.75].map((t, i) => (
        <line key={i} x1={0} x2={width} y1={height * t} y2={height * t} stroke="var(--m-border)" strokeDasharray="2 4"/>
      ))}
      <path d={area} fill="url(#area-gr)"/>
      <path d={path} stroke={color} strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
      {pts.map((p, i) => (
        <circle key={i} cx={p[0]} cy={p[1]} r="2.5" fill="var(--m-bg)" stroke={color} strokeWidth="1.5"/>
      ))}
    </svg>
  );
}

// ── RadarChart — multi-axis performance profile ────────────────────
function RadarChart({ axes, value, size = 200, color='var(--m-accent)' }) {
  // axes: [{label, value 0-1}]
  const cx = size / 2, cy = size / 2, r = size * 0.38;
  const n = axes.length;
  const ptAt = (i, ratio) => {
    const ang = -Math.PI/2 + (i / n) * Math.PI * 2;
    return [cx + Math.cos(ang) * r * ratio, cy + Math.sin(ang) * r * ratio];
  };
  const grid = [0.25, 0.5, 0.75, 1];
  const poly = axes.map((a, i) => ptAt(i, a.value).join(',')).join(' ');
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      {grid.map((g, i) => (
        <polygon key={i}
          points={Array.from({length:n}, (_, j) => ptAt(j, g).join(',')).join(' ')}
          fill="none" stroke="var(--m-border)" strokeWidth="1"
          opacity={i === grid.length-1 ? 0.8 : 0.4}
        />
      ))}
      {axes.map((_, i) => {
        const [x, y] = ptAt(i, 1);
        return <line key={i} x1={cx} y1={cy} x2={x} y2={y} stroke="var(--m-border)" strokeWidth="1" opacity="0.3"/>;
      })}
      <polygon points={poly} fill={color} fillOpacity="0.2" stroke={color} strokeWidth="1.5"/>
      {axes.map((a, i) => {
        const [x, y] = ptAt(i, a.value);
        return <circle key={i} cx={x} cy={y} r="3" fill={color}/>;
      })}
      {axes.map((a, i) => {
        const [x, y] = ptAt(i, 1.16);
        return (
          <text key={i} x={x} y={y} textAnchor="middle" dominantBaseline="middle"
            fontSize="9" fill="var(--m-text-dim)" fontWeight="600" style={{ textTransform:'uppercase', letterSpacing:'0.06em' }}>
            {a.label}
          </text>
        );
      })}
    </svg>
  );
}

// ── Header (app chrome) ─────────────────────────────────────────────
function AppHeader({ active='home', compact=false }) {
  const navItems = [
    { id:'home',      label:'Home',      icon:'home' },
    { id:'tierlist',  label:'Tier List', icon:'list' },
    { id:'items',     label:'Itens',     icon:'sword' },
    { id:'plans',     label:'Planos',    icon:'dollar' },
    { id:'team',      label:'Equipe',    icon:'users' },
  ];
  return (
    <header style={{
      display:'flex', alignItems:'center', justifyContent:'space-between',
      padding: compact ? '10px 20px' : '14px 28px',
      borderBottom:'1px solid var(--m-border)',
      background:'var(--m-surface)',
      position:'sticky', top:0, zIndex:10,
    }}>
      <div style={{ display:'flex', alignItems:'center', gap:28 }}>
        <Logo />
        <nav style={{ display:'flex', gap:4 }}>
          {navItems.map(n => (
            <a key={n.id} href="#" style={{
              display:'inline-flex', alignItems:'center', gap:6,
              padding:'6px 10px', borderRadius:8,
              fontSize:13, fontWeight:500, textDecoration:'none',
              color: active === n.id ? 'var(--m-accent)' : 'var(--m-text-dim)',
              background: active === n.id ? 'rgba(245,200,66,0.08)' : 'transparent',
            }}>
              <Icon name={n.icon} size={14}/>
              {n.label}
            </a>
          ))}
        </nav>
      </div>
      <div style={{ display:'flex', alignItems:'center', gap:10 }}>
        <button style={{ display:'inline-flex', alignItems:'center', gap:6, background:'var(--m-accent)', border:'none', color:'#1a1510', padding:'7px 14px', borderRadius:8, fontSize:13, fontWeight:600 }}>
          <Icon name="messageCircle" size={14}/>
          Chat Metis
        </button>
        <div style={{ width:32, height:32, borderRadius:'50%', background:'var(--m-surface-2)', border:'1px solid var(--m-border-2)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:12, fontWeight:700, color:'var(--m-text-dim)' }}>Z</div>
      </div>
    </header>
  );
}

function Logo({ size = 24 }) {
  return (
    <a href="#" style={{ display:'inline-flex', alignItems:'center', gap:8, textDecoration:'none', color:'var(--m-text)' }}>
      <svg width={size} height={size} viewBox="0 0 32 32" fill="none">
        <path d="M6 26V6l10 14L26 6v20" stroke="var(--m-accent)" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round"/>
        <circle cx="16" cy="26" r="1.5" fill="var(--m-accent)"/>
      </svg>
      <span className="font-display" style={{ fontSize:16, fontWeight:700, letterSpacing:'-0.02em' }}>Metis</span>
    </a>
  );
}

Object.assign(window, {
  Card, SectionLabel, ChampPortrait, RoleGlyph, TierBadge, RankBadge,
  Pill, Stat, Bar, WinLossDots, Sparkline, Donut, StackedBar, AreaChart, RadarChart,
  AppHeader, Logo,
});
