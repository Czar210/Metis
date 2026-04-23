// Rich timeline events for match detail — with coords, participants, context.
// Map is roughly 0..100 on both axes (0,0 = bottom-left red base; 100,100 = top-right blue base for a standard minimap).

const TL_EVENTS = [
  // ── Early game
  { id:1, t:90, type:'kill', killer:{ c:'Kayn', n:'Zaras', team:'blue', isYou:true }, victim:{ c:'Garen', n:'SpinToWin', team:'red' }, assists:[{ c:'Mordekaiser', n:'ShadowFury', team:'blue' }], lane:'TOP', x:18, y:78, gold:400, label:'Primeiro sangue', key:true, note:'Gank bem-sucedido no top. Kayn e Morde combaram em cima do Flash do Garen que ainda estava em CD.' },
  { id:2, t:252, type:'kill', killer:{ c:'Leblanc', n:'DeceiveGG', team:'red' }, victim:{ c:'Kayn', n:'Zaras', team:'blue', isYou:true }, assists:[{ c:'Lux', n:'LaserQueen', team:'red' }], lane:'MID', x:52, y:48, gold:320, note:'Tentou gankear mid sem visão no river. Lux veio de lateral com Q e fechou a jogada.' },
  { id:3, t:310, type:'ward', actor:{ c:'Thresh', n:'HookLord', team:'blue' }, target:'Ward de Controle', x:72, y:58, lane:'TRI', note:'Ward de controle no triângulo da jungle inferior azul.' },
  { id:4, t:360, type:'level', actor:{ c:'Kayn', n:'Zaras', team:'blue', isYou:true }, level:6, x:38, y:62, note:'Ultimate disponível pela primeira vez. Ainda não tem forma escolhida.' },
  { id:5, t:475, type:'dragon', team:'blue', drakeType:'Infernal', x:78, y:22, gold:1200, note:'Primeiro drake contestado. Kayn smite antes do Leblanc pular.', key:true, assists:[{ c:'Jinx', n:'AdcCarry4', team:'blue' }, { c:'Thresh', n:'HookLord', team:'blue' }] },
  { id:6, t:540, type:'herald', team:'red', x:22, y:82, note:'Arauto solo pelo time vermelho enquanto o azul pegava drake. Comeu 2 placas.' },
  { id:7, t:612, type:'item', actor:{ c:'Kayn', n:'Zaras', team:'blue', isYou:true }, item:6693, itemName:'Colhedor de Essência', x:50, y:50, note:'Primeiro item lendário. Timing 10:12, razoável pra Kayn Diamante.' },
  { id:8, t:662, type:'kill', killer:{ c:'Talon', n:'MidOrFeed', team:'blue' }, victim:{ c:'Yone', n:'WindBro', team:'red' }, assists:[], lane:'MID', x:48, y:52, gold:300, note:'Solo kill limpo. Talon all-in com parry perfeito do Q do Yone.' },

  // ── Mid game
  { id:9, t:780, type:'level', actor:{ c:'Kayn', n:'Zaras', team:'blue', isYou:true }, level:11, x:38, y:48, note:'Level 11 — Ultimate com 2º ponto, spike de poder significativo.' },
  { id:10, t:827, type:'tower', team:'blue', tower:'T1 Top', x:16, y:72, gold:250, note:'Primeira torre da partida. Morde sozinho sob Stopwatch.' },
  { id:11, t:892, type:'ward', actor:{ c:'Lux', n:'LaserQueen', team:'red' }, target:'Ward destruída', x:62, y:38, lane:'RIVER', note:'Thresh limpou ward de controle no river inferior.' },
  { id:12, t:930, type:'dragon', team:'red', drakeType:'Mountain', x:78, y:22, gold:1100, note:'Time azul não contestou. Estavam resetando após a T1 top.' },
  { id:13, t:1022, type:'teamfight', x:55, y:55, lane:'MID', note:'Teamfight 5v5 no mid. Azul pega 3, vermelho pega 1. Virou a partida.',
    kills:[
      { killer:{ c:'Kayn', n:'Zaras', team:'blue', isYou:true }, victim:{ c:'Leblanc', n:'DeceiveGG', team:'red' } },
      { killer:{ c:'Talon', n:'MidOrFeed', team:'blue' }, victim:{ c:'Yone', n:'WindBro', team:'red' } },
      { killer:{ c:'Jinx', n:'AdcCarry4', team:'blue' }, victim:{ c:'Ezreal', n:'ElderArrow', team:'red' } },
      { killer:{ c:'Garen', n:'SpinToWin', team:'red' }, victim:{ c:'Thresh', n:'HookLord', team:'blue' } },
    ], key:true, gold:1800 },
  { id:14, t:1108, type:'item', actor:{ c:'Kayn', n:'Zaras', team:'blue', isYou:true }, item:3814, itemName:'Mortal Reminder', x:48, y:50, note:'Segundo lendário. Escolha anti-heal pelo Garen Conquistador.' },
  { id:15, t:1187, type:'dragon', team:'blue', drakeType:'Infernal', x:78, y:22, gold:1250, note:'Segunda Infernal. Ramp de dano significativo pro time azul.', key:true },
  { id:16, t:1247, type:'tower', team:'blue', tower:'T1 Mid', x:50, y:50, gold:300 },
  { id:17, t:1338, type:'ward', actor:{ c:'Thresh', n:'HookLord', team:'blue' }, target:'Ward de Controle no Baron pit', x:52, y:72, lane:'BARON', note:'Preparando visão pra Baron call.' },

  // ── Late game
  { id:18, t:1425, type:'tower', team:'blue', tower:'T1 Bot', x:82, y:22, gold:250 },
  { id:19, t:1478, type:'level', actor:{ c:'Kayn', n:'Zaras', team:'blue', isYou:true }, level:16, x:46, y:58, note:'R maxed. Power spike final.' },
  { id:20, t:1534, type:'dragon', team:'red', drakeType:'Cloud', x:78, y:22, gold:1100, note:'Drake de nuvem conseguido enquanto azul pressionava top.' },
  { id:21, t:1612, type:'kill', killer:{ c:'Kayn', n:'Zaras', team:'blue', isYou:true }, victim:{ c:'Ezreal', n:'ElderArrow', team:'red' }, lane:'TOP', x:22, y:68, gold:380, note:'Pick solo no Ezreal que deu flash errado.' },
  { id:22, t:1742, type:'item', actor:{ c:'Jinx', n:'AdcCarry4', team:'blue' }, item:3031, itemName:'Gume do Infinito', x:60, y:40, note:'Jinx com IE + Phantom Dancer + Statikk. ADC hiper-carry online.' },
  { id:23, t:1822, type:'baron', team:'blue', x:52, y:72, gold:1500, note:'Baron conseguido sem troca. Kayn smite perfeito com Leblanc e Yone ainda em recall.', key:true, assists:[{ c:'Kayn', n:'Zaras', team:'blue', isYou:true }, { c:'Jinx', n:'AdcCarry4', team:'blue' }, { c:'Talon', n:'MidOrFeed', team:'blue' }] },
  { id:24, t:1891, type:'tower', team:'blue', tower:'T2 Mid', x:50, y:60 },
  { id:25, t:1978, type:'tower', team:'blue', tower:'T2 Bot', x:72, y:22 },
  { id:26, t:2044, type:'teamfight', x:55, y:35, lane:'BOT', note:'Teamfight decisivo com buff de Baron ativo. Azul ace em base inimiga.',
    kills:[
      { killer:{ c:'Kayn', n:'Zaras', team:'blue', isYou:true }, victim:{ c:'Leblanc', n:'DeceiveGG', team:'red' } },
      { killer:{ c:'Jinx', n:'AdcCarry4', team:'blue' }, victim:{ c:'Ezreal', n:'ElderArrow', team:'red' } },
      { killer:{ c:'Talon', n:'MidOrFeed', team:'blue' }, victim:{ c:'Lux', n:'LaserQueen', team:'red' } },
      { killer:{ c:'Mordekaiser', n:'ShadowFury', team:'blue' }, victim:{ c:'Garen', n:'SpinToWin', team:'red' } },
      { killer:{ c:'Thresh', n:'HookLord', team:'blue' }, victim:{ c:'Yone', n:'WindBro', team:'red' } },
    ], key:true, gold:2200 },
  { id:27, t:2098, type:'tower', team:'blue', tower:'Inibidor Mid', x:42, y:28 },
  { id:28, t:2148, type:'tower', team:'blue', tower:'Nexus', x:24, y:12, note:'Partida finalizada em 35:48. Vitória azul com 32-19 em kills.', key:true },
];

// XP curve over time (min 0..28) — approx per minute, both teams combined ahead = positive
const XP_CURVE_BLUE = [0,120,420,860,1380,1820,2320,2900,3520,4180,4900,5680,6540,7420,8340,9280,10280,11320,12400,13540,14720,15980,17280,18600,20000,21480,23000,24580,26200];
const XP_CURVE_RED  = [0,110,380,780,1240,1640,2100,2580,3140,3760,4380,5080,5780,6520,7280,8080,8900,9760,10660,11600,12540,13520,14480,15480,16500,17540,18600,19700,20820];

// Heatmap kill points (x, y, team, weight)
const KILL_HEATMAP = TL_EVENTS
  .filter(e => e.type === 'kill' || e.type === 'teamfight')
  .flatMap(e => {
    if (e.type === 'kill') {
      return [{ x:e.x, y:e.y, team:e.killer.team, w:1 }];
    }
    return e.kills.map(k => ({ x:e.x + (Math.random()*8-4), y:e.y + (Math.random()*8-4), team:k.killer.team, w:1 }));
  });

const DRAKE_COLORS = {
  Infernal:   '#FB923C',
  Ocean:      '#60A5FA',
  Mountain:   '#A96C3C',
  Cloud:      '#C7D2E3',
  Hextech:    '#5BE3D4',
  Chemtech:   '#84CC16',
  Elder:      '#F5C842',
};

const EVENT_TYPE_META = {
  kill:      { label:'Kill',       icon:'sword',        color:'#F87171' },
  teamfight: { label:'Teamfight',  icon:'users',        color:'#FB923C' },
  dragon:    { label:'Dragão',     icon:'flame',        color:'#FB923C' },
  herald:    { label:'Arauto',     icon:'eye',          color:'#60A5FA' },
  baron:     { label:'Baron',      icon:'star',         color:'#8B7FFF' },
  tower:     { label:'Torre',      icon:'shield',       color:'#F5C842' },
  ward:      { label:'Ward',       icon:'eye',          color:'#5BE3D4' },
  level:     { label:'Level up',   icon:'arrowUp',      color:'#4ADE80' },
  item:      { label:'Item',       icon:'sword',        color:'#F5C842' },
};

Object.assign(window, { TL_EVENTS, XP_CURVE_BLUE, XP_CURVE_RED, KILL_HEATMAP, DRAKE_COLORS, EVENT_TYPE_META });
