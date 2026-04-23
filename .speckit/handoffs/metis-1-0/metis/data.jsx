// Sample data for the Metis redesigns. Themed to LoL.

// ── Champion icons via Data Dragon CDN (official Riot CDN) ─────
// When bundled as standalone, window.__resources contains blob URLs.
const DDRAGON_V = '14.21.1';
const _res = () => (typeof window !== 'undefined' && window.__resources) || {};
const champImg = (name) => _res()[`champ_${name}`] || `https://ddragon.leagueoflegends.com/cdn/${DDRAGON_V}/img/champion/${name}.png`;
const itemImg  = (id)   => _res()[`item_${id}`]    || `https://ddragon.leagueoflegends.com/cdn/${DDRAGON_V}/img/item/${id}.png`;
const profileImg = (id) => _res()[`profile_${id}`] || `https://ddragon.leagueoflegends.com/cdn/${DDRAGON_V}/img/profileicon/${id}.png`;

// Tier list — top champions, fake but plausible
const TIER_DATA = [
  { t:'S+', champ:'Kayn',        role:'JUNGLE',  wr:56.4, pr:12.3, games:4821, kda:3.2, trend:'up',   banRate:28 },
  { t:'S+', champ:'Mordekaiser', role:'TOP',     wr:55.8, pr:8.9,  games:3210, kda:2.8, trend:'up',   banRate:22 },
  { t:'S+', champ:'Talon',       role:'MIDDLE',  wr:54.9, pr:6.1,  games:2104, kda:3.7, trend:'flat', banRate:14 },
  { t:'S',  champ:'Leblanc',     role:'MIDDLE',  wr:54.1, pr:9.2,  games:3987, kda:2.9, trend:'up',   banRate:18 },
  { t:'S',  champ:'MonkeyKing',  role:'TOP',     wr:53.7, pr:7.4,  games:2643, kda:2.2, trend:'flat', banRate:11 },
  { t:'S',  champ:'Brand',       role:'UTILITY', wr:53.2, pr:15.8, games:6102, kda:3.1, trend:'up',   banRate:9 },
  { t:'S',  champ:'Jinx',        role:'BOTTOM',  wr:52.8, pr:18.3, games:7234, kda:2.7, trend:'up',   banRate:6 },
  { t:'A',  champ:'Thresh',      role:'UTILITY', wr:51.9, pr:11.2, games:4421, kda:3.9, trend:'flat', banRate:4 },
  { t:'A',  champ:'Yone',        role:'MIDDLE',  wr:51.4, pr:14.8, games:5801, kda:2.1, trend:'down', banRate:13 },
  { t:'A',  champ:'Jhin',        role:'BOTTOM',  wr:51.2, pr:16.1, games:6310, kda:3.4, trend:'flat', banRate:5 },
  { t:'A',  champ:'Garen',       role:'TOP',     wr:50.8, pr:6.7,  games:2438, kda:1.9, trend:'up',   banRate:2 },
  { t:'B',  champ:'Ahri',        role:'MIDDLE',  wr:49.7, pr:10.4, games:4128, kda:2.5, trend:'down', banRate:3 },
  { t:'B',  champ:'Ezreal',      role:'BOTTOM',  wr:49.3, pr:19.2, games:7612, kda:2.3, trend:'down', banRate:7 },
  { t:'B',  champ:'Lux',         role:'UTILITY', wr:48.9, pr:13.1, games:5102, kda:2.8, trend:'flat', banRate:2 },
  { t:'C',  champ:'Yasuo',       role:'MIDDLE',  wr:47.2, pr:17.9, games:7001, kda:1.8, trend:'down', banRate:21 },
];

// Player detail — a richer player dashboard
const PLAYER = {
  name: 'Zaras',
  tag: '0210',
  server: 'BR1',
  tier: 'DIAMOND',
  rank: 'II',
  lp: 64,
  iconId: 5844,
  level: 487,
  winrate: 58.3,
  games30d: 47,
  wins30d: 27,
  losses30d: 20,
  kda: 2.84,
  avgKills: 7.2,
  avgDeaths: 4.1,
  avgAssists: 4.4,
  csPerMin: 7.8,
  visionPerMin: 1.2,
  dmgPerMin: 782,
  mainRole: 'JUNGLE',
  roleDist: { JUNGLE: 68, TOP: 18, MIDDLE: 10, BOTTOM: 2, UTILITY: 2 },
};

// Recent matches — last 10
const MATCHES = [
  { win: true,  champ: 'Kayn',        role:'JUNGLE', k:12, d:3, a:8,  cs:178, dur:'28:14', mode:'Ranked Solo', when:'há 2h',  lp:+23 },
  { win: true,  champ: 'Kayn',        role:'JUNGLE', k:8,  d:5, a:11, cs:202, dur:'34:02', mode:'Ranked Solo', when:'há 4h',  lp:+19 },
  { win: false, champ: 'Mordekaiser', role:'TOP',    k:4,  d:7, a:3,  cs:221, dur:'31:48', mode:'Ranked Solo', when:'há 6h',  lp:-18 },
  { win: true,  champ: 'Kayn',        role:'JUNGLE', k:10, d:2, a:14, cs:164, dur:'24:31', mode:'Ranked Solo', when:'ontem',  lp:+22 },
  { win: true,  champ: 'Talon',       role:'MIDDLE', k:15, d:4, a:6,  cs:248, dur:'32:11', mode:'Ranked Solo', when:'ontem',  lp:+21 },
  { win: false, champ: 'Kayn',        role:'JUNGLE', k:3,  d:8, a:5,  cs:142, dur:'36:48', mode:'Ranked Solo', when:'2d atrás', lp:-20 },
  { win: true,  champ: 'Kayn',        role:'JUNGLE', k:14, d:4, a:9,  cs:195, dur:'30:22', mode:'Ranked Solo', when:'2d atrás', lp:+24 },
  { win: true,  champ: 'Leblanc',     role:'MIDDLE', k:11, d:3, a:4,  cs:201, dur:'27:59', mode:'Ranked Solo', when:'3d atrás', lp:+20 },
  { win: false, champ: 'Kayn',        role:'JUNGLE', k:6,  d:9, a:7,  cs:151, dur:'38:12', mode:'Ranked Solo', when:'3d atrás', lp:-17 },
  { win: true,  champ: 'Kayn',        role:'JUNGLE', k:9,  d:2, a:12, cs:187, dur:'29:03', mode:'Ranked Solo', when:'4d atrás', lp:+26 },
];

// Winrate sparkline over last 30 games (0 = loss, 1 = win)
const WR_LAST30 = [1,0,1,1,1,0,1,0,0,1,1,1,0,1,1,0,1,1,1,0,1,1,1,0,1,0,1,1,1,1];

// Top champions for this player
const PLAYER_CHAMPS = [
  { champ:'Kayn',        games:32, wins:21, wr:65.6, kda:3.4, role:'JUNGLE', avgDmg:29800, avgCs:184, mastery:7 },
  { champ:'Mordekaiser', games:8,  wins:4,  wr:50.0, kda:2.1, role:'TOP',    avgDmg:24300, avgCs:208, mastery:5 },
  { champ:'Talon',       games:4,  wins:3,  wr:75.0, kda:3.8, role:'MIDDLE', avgDmg:27100, avgCs:221, mastery:4 },
  { champ:'Leblanc',     games:3,  wins:2,  wr:66.7, kda:2.9, role:'MIDDLE', avgDmg:25600, avgCs:198, mastery:3 },
];

// LP history (last 20 games)
const LP_HISTORY = [
  1850,1868,1854,1876,1893,1878,1898,1919,1901,1924,
  1944,1963,1945,1968,1987,1972,1991,2012,1995,2014,
];

// AI chat preview messages
const CHAT_PREVIEW = [
  { role:'user',  text:'Por que eu perdi a última partida de Kayn?' },
  { role:'ai',    text:'Analisei o match ID `BR1_71284...`. Três fatores principais:', list:[
    { ico:'dot', text:'**Sua primeira morte aos 3:48** — gankeaste mid sem visão no river do inimigo. O Lee Sin contra-gankeou e vocês dois morreram.' },
    { ico:'dot', text:'**Objetivos**: só pegaste 1 de 4 dragões contestáveis. O inimigo fechou Alma aos 24:10.' },
    { ico:'dot', text:'**Forma Red vs Blue**: escolheste Darkin, mas o time não tinha iniciação. Shadow Assassin teria dado mais pick.' },
  ] },
];

// Timeline events for a match detail
const TIMELINE = [
  { t:'01:30', ev:'First blood', actor:'você',    target:'Lee Sin',  lane:'TOP',    good:true },
  { t:'04:12', ev:'Kill',        actor:'Lee Sin', target:'você',     lane:'TOP',    good:false },
  { t:'07:55', ev:'Drake',       actor:'você',    target:'Infernal', lane:'OBJ',    good:true },
  { t:'10:23', ev:'Objective Bounty ativa', good:true },
  { t:'13:47', ev:'Tower',       actor:'você',    target:'Top T1',   lane:'TOP',    good:true },
  { t:'17:02', ev:'Teamfight',   actor:'4-1',     target:'em Mid',   lane:'MID',    good:true },
  { t:'22:14', ev:'Baron',       actor:'você',    target:'',         lane:'OBJ',    good:true },
  { t:'25:31', ev:'Ace',         actor:'5-0',     target:'em Base',  lane:'BASE',   good:true },
  { t:'28:14', ev:'Vitória',     actor:'Nexus',   target:'Destruído',lane:'END',    good:true },
];

const ROLES_PT = {
  TOP:'Top', JUNGLE:'Jungle', MIDDLE:'Mid', BOTTOM:'ADC', UTILITY:'Suporte'
};

const TIER_COLORS = {
  'S+': { bg:'rgba(245,200,66,0.12)',  border:'#F5C842', text:'#F5C842' },
  'S':  { bg:'rgba(251,146,60,0.12)',  border:'#FB923C', text:'#FBAD5A' },
  'A':  { bg:'rgba(74,222,128,0.12)',  border:'#4ADE80', text:'#4ADE80' },
  'B':  { bg:'rgba(96,165,250,0.12)',  border:'#60A5FA', text:'#60A5FA' },
  'C':  { bg:'rgba(138,147,166,0.12)', border:'#5A6378', text:'#8A93A6' },
};

// ── Items page ──────────────────────────────────────────
const ITEMS_DATA = [
  { id:3020, name:'Botas de Feiticeiro',     cat:'Botas',    picks:1520, wr:52.1, role:'MID',    cost:1100,  trend:'up',   tags:['penetração mágica','movimento'] },
  { id:3158, name:'Botas da Agilidade',       cat:'Botas',    picks:1489, wr:49.7, role:'JG',     cost:950,   trend:'flat', tags:['CDR','movimento'] },
  { id:3111, name:'Sapatos de Mercúrio',      cat:'Botas',    picks:1390, wr:51.8, role:'TOP',    cost:1100,  trend:'up',   tags:['tenacidade','movimento'] },
  { id:3006, name:'Grevas do Berserker',      cat:'Botas',    picks:1300, wr:60.0, role:'ADC',    cost:1100,  trend:'up',   tags:['velocidade de ataque','movimento'] },
  { id:3047, name:'Botas de Placas de Aço',   cat:'Botas',    picks:1210, wr:43.8, role:'TOP',    cost:1300,  trend:'down', tags:['armadura','movimento'] },
  { id:1055, name:'Lâmina de Doran',          cat:'Inicial',  picks:1080, wr:48.1, role:'ADC',    cost:450,   trend:'flat', tags:['AD','vida','life-steal'] },
  { id:6653, name:'Liandry',                  cat:'Lendário', picks:930,  wr:48.4, role:'MID',    cost:3000,  trend:'down', tags:['AP','vida','queimadura'] },
  { id:2055, name:'Guardião de Visão',        cat:'Utilitário',picks:900, wr:54.4, role:'SUP',    cost:75,    trend:'up',   tags:['visão','ativo'] },
  { id:3031, name:'Gume do Infinito',         cat:'Lendário', picks:810,  wr:55.6, role:'ADC',    cost:3400,  trend:'up',   tags:['AD','crit','dano'] },
  { id:3153, name:'Espada do Rei Destruído',  cat:'Lendário', picks:780,  wr:52.1, role:'TOP',    cost:3300,  trend:'flat', tags:['AD','life-steal','dano mágico'] },
  { id:3814, name:'Colhedor de Essência',     cat:'Lendário', picks:710,  wr:60.8, role:'MID',    cost:3200,  trend:'up',   tags:['AD','mana','escudo'] },
  { id:3742, name:'Couraça do Titã',          cat:'Lendário', picks:690,  wr:51.2, role:'TANK',   cost:2800,  trend:'flat', tags:['vida','tenacidade','tank'] },
];

// ── Champion page ────────────────────────────────────────
const CHAMP = {
  name: 'Vayne',
  title: 'A Caçadora Noturna',
  games: 173,
  roles: ['ADC','TOP'],
  overview: { wr:50.9, kda:1.84, avgK:7.8, avgD:7.0, avgA:5.0, csMin:6.8, dpm:863, avgGold:13300 },
};
const CHAMP_BUILDS = [
  { name:'Lâmina de Doran',        picks:86, wr:47.7, patch:'16.7', first:true },
  { name:'Hexoplaca Experimental', picks:80, wr:76.3, patch:'16.7' },
  { name:'Grevas do Berserker',    picks:76, wr:57.9, patch:'16.7' },
  { name:'Colhedor de Essência',   picks:71, wr:60.6, patch:'16.7' },
  { name:'Dardos de Caça-Demônios',picks:71, wr:47.9, patch:'16.7' },
  { name:'Espada do Rei Destruído',picks:63, wr:41.3, patch:'16.7' },
  { name:'Chuva de Canivete',      picks:63, wr:48.0, patch:'16.7' },
  { name:'Lâmina da Fúria de Guinsoo', picks:57, wr:49.1, patch:'16.7' },
  { name:'Gume do Infinito',       picks:33, wr:42.4, patch:'16.7' },
  { name:'Espada G.P.C.',          picks:23, wr:34.8, patch:'16.7' },
];
const CHAMP_MATCHUPS = [
  { champ:'Lux',     games:13, wr:53.8, vs:+3.0 },
  { champ:'Kaisa',   games:11, wr:54.5, vs:+3.7 },
  { champ:'Akali',   games:9,  wr:55.6, vs:+4.7 },
  { champ:'Nami',    games:9,  wr:44.4, vs:-6.4 },
  { champ:'Jhin',    games:9,  wr:55.6, vs:+4.7 },
  { champ:'Talon',   games:8,  wr:50.0, vs:-0.9 },
  { champ:'Sona',    games:8,  wr:37.5, vs:-13.4 },
  { champ:'Caitlyn', games:7,  wr:28.6, vs:-22.3 },
  { champ:'Thresh',  games:7,  wr:28.6, vs:-22.3 },
  { champ:'Jinx',    games:7,  wr:71.4, vs:+20.8 },
];
const CHAMP_SYNERGIES = [
  { champ:'Karma',     games:10, wr:30.0 },
  { champ:'Lulu',      games:9,  wr:66.7 },
  { champ:'Nami',      games:9,  wr:22.2 },
  { champ:'Ahri',      games:8,  wr:50.0 },
  { champ:'Jayce',     games:7,  wr:42.9 },
  { champ:'Mel',       games:7,  wr:57.1 },
  { champ:'Leblanc',   games:6,  wr:33.3 },
  { champ:'Seraphine', games:6,  wr:50.0 },
  { champ:'Soraka',    games:6,  wr:50.0 },
  { champ:'Ezreal',    games:6,  wr:16.7 },
];

// ── Plans ───────────────────────────────────────────────
const PLANS = [
  {
    tier:'Free', rank:'SILVER', color:'#B4C0CF', price:0, priceLabel:'para sempre',
    action:'Plano atual', actionStyle:'muted',
    features:[
      { on:true,  t:'Busca de jogadores ilimitada' },
      { on:true,  t:'Histórico de partidas (últimas 20)' },
      { on:true,  t:'Tier List com filtros' },
      { on:true,  t:'Estatísticas de itens' },
      { on:true,  t:'Página de campeão básica' },
      { on:true,  t:'Metis Score nas partidas' },
      { on:true,  t:'1 jogador salvo em supervisão' },
      { on:true,  t:'1 recomendação por lane' },
      { on:false, t:'Chat com IA Metis' },
      { on:false, t:'Análise tática por partida' },
      { on:false, t:'Filtros avançados de build' },
      { on:false, t:'Badge no perfil' },
    ],
  },
  {
    tier:'Doador', rank:'EMERALD', color:'#44D19E', price:4.9, priceLabel:'/mes',
    action:'Apoiar o projeto', actionStyle:'emerald',
    features:[
      { on:true, t:'Tudo do Free' },
      { on:true, t:'5 jogadores salvos em supervisão' },
      { on:true, t:'2 recomendações por lane' },
      { on:true, t:'Badge de Doador no perfil' },
      { on:true, t:'Apoio direto ao desenvolvimento' },
      { on:false, t:'Chat com IA Metis' },
      { on:false, t:'Análise tática por partida' },
      { on:false, t:'Timeline interativa' },
      { on:false, t:'Filtros avançados de build' },
      { on:false, t:'Coaching IA' },
    ],
  },
  {
    tier:'Premium', rank:'MASTER', color:'#C581E6', price:24.9, priceLabel:'/mes',
    action:'Subir de Elo', actionStyle:'master',
    popular:true,
    features:[
      { on:true, t:'Tudo do Doador' },
      { on:true, t:'Chat com IA Metis ilimitado' },
      { on:true, t:'Recomendações completas (todas as roles)' },
      { on:true, t:'Análise tática detalhada por partida' },
      { on:true, t:'Timeline interativa com mapa' },
      { on:true, t:'Filtros avançados de build por slot' },
      { on:true, t:'Badge Master no perfil' },
      { on:true, t:'Jogadores salvos ilimitados' },
      { on:true, t:'Histórico completo (sem limite)' },
      { on:true, t:'Prioridade no suporte' },
    ],
  },
  {
    tier:'Pro', rank:'CHALLENGER', color:'#66D7F0', price:44.9, priceLabel:'/mes',
    action:'Virar Challenger', actionStyle:'challenger',
    features:[
      { on:true, t:'Tudo do Premium' },
      { on:true, t:'Coaching IA personalizado por sessão' },
      { on:true, t:'API de dados pessoais (exportar stats)' },
      { on:true, t:'Dashboard de evolução temporal' },
      { on:true, t:'Comparação com jogadores do seu elo' },
      { on:true, t:'Alertas de meta (campeões OP no seu elo)' },
      { on:true, t:'Badge Challenger exclusiva no perfil' },
      { on:true, t:'Acesso antecipado a features novas' },
      { on:true, t:'Suporte direto com a equipe' },
      { on:true, t:'Análise de replays com IA' },
    ],
  },
];

// ── Changelog ────────────────────────────────────────────
const CHANGELOG = [
  { v:'Pre-0.9.0', date:'04/2026', current:true, tag:'BIG UPDATE', title:'Pre-release da 0.9.0 com foco em qualidade do Chat Metis.',
    items:[
      { tag:'NOVO',    t:'Guardrail de tópico — a Metis agora responde APENAS sobre League of Legends e rejeita perguntas fora do jogo.' },
      { tag:'NOVO',    t:'Personalidade definida: calma, analítica, nunca tóxica. Transforma derrotas em aprendizado.' },
      { tag:'NOVO',    t:'Limite diário de tokens por plano — Doador (5k), Premium (30k), Pro (100k). Reset à meia-noite (horário de Londres).' },
      { tag:'NOVO',    t:'Barra de uso de tokens no chat — veja quanto do seu limite diário foi utilizado em tempo real.' },
      { tag:'MELHORIA',t:'Chat atualizado para Gemini 2.5 Flash — modelo mais capaz e com respostas mais precisas.' },
    ] },
  { v:'Alpha v0.8.3', date:'04/2026',
    items:[
      { tag:'MELHORIA',t:'Chat com IA atualizado para Gemini 2.5 Flash — respostas mais inteligentes e contextuais.' },
      { tag:'FIX',     t:'Correção na exibição de itens Mythic no Match Detail.' },
    ] },
  { v:'Alpha v0.8.0', date:'03/2026',
    items:[
      { tag:'NOVO',    t:'Análise de Equipe no Match Detail — donuts comparativos por métrica.' },
      { tag:'NOVO',    t:'Aba Builds no Match Detail — veja itens e runas por jogador.' },
      { tag:'MELHORIA',t:'Página de campeão ganhou 4 tabs (Overview, Builds, Matchups, Sinergias).' },
    ] },
  { v:'Alpha v0.7.0', date:'02/2026',
    items:[
      { tag:'NOVO',    t:'Metis Score — métrica proprietária de 0 a 100 que pontua sua partida.' },
      { tag:'NOVO',    t:'Tier List com filtro por elo (Iron → Challenger).' },
    ] },
];

// ── Team ─────────────────────────────────────────────────
const TEAM = [
  { name:'César Sibila',  initials:'CS', color:'#F5C842', role:'Engenheiro de Dados', sub:'AI Engineer Jr @ Izi',
    tags:['Tech Lead','Data Architect','CI/CD & Infra'],
    quote:'Construo software como se fosse eu mesmo usar, e pra falar a verdade esse geralmente é o caso.',
    link:{ label:'Portfolio', kind:'portfolio' } },
  { name:'Enzo Takida',   initials:'ET', color:'#F87171', role:'Data Analytics', sub:null,
    tags:['Frontend & UX','Supabase Auth','Design System'],
    quote:null, link:{ label:'LinkedIn', kind:'linkedin' } },
  { name:'André Messina', initials:'AM', color:'#4ADE80', role:'Cientista de Dados Jr', sub:'Data Analytics @ Ropp',
    tags:['Backend & AI Engineer','Arquitetura de Dados','Prompt Engineering'],
    quote:null, link:{ label:'LinkedIn', kind:'linkedin' } },
];

// ── Chat preview conversation ────────────────────────────
const CHAT_THREAD = [
  { role:'ai', text:'Olá, invocador. Sou a Metis — sua estrategista no Rift. Pode me perguntar sobre campeões, builds, matchups ou estratégia. Como posso te ajudar hoje?' },
  { role:'user', text:'Por que eu perdi a última partida de Kayn?' },
  { role:'ai', text:'Analisei o match `BR1_71284902145`. Três fatores principais me chamaram atenção:',
    blocks:[
      { kind:'insight', color:'var(--m-red)',   head:'Gank sem visão aos 3:48', body:'Você gankeou o mid sem ward no river inimigo. O Lee Sin contra-gankeou e vocês dois morreram — derrota no tempo e no ouro.' },
      { kind:'insight', color:'var(--m-accent)', head:'Objetivos mal contestados', body:'Você pegou 1 de 4 dragões contestáveis. O time inimigo fechou Alma Infernal aos 24:10 e ganhou quase todas as teamfights a partir dali.' },
      { kind:'insight', color:'var(--m-cyan)',  head:'Escolha da forma', body:'Você escolheu Darkin (Rhaast), mas o time aliado não tinha iniciação. Shadow Assassin daria mais pick-potential contra a comp inimiga.' },
    ],
    followups:['Como jogo o early game com mais segurança?', 'Quando devo escolher Shadow Assassin?', 'Me mostra outra partida de Kayn']
  },
];

Object.assign(window, {
  DDRAGON_V, champImg, itemImg, profileImg,
  TIER_DATA, PLAYER, MATCHES, WR_LAST30, PLAYER_CHAMPS, LP_HISTORY,
  CHAT_PREVIEW, TIMELINE, ROLES_PT, TIER_COLORS,
  ITEMS_DATA, CHAMP, CHAMP_BUILDS, CHAMP_MATCHUPS, CHAMP_SYNERGIES,
  PLANS, CHANGELOG, TEAM, CHAT_THREAD,
});
