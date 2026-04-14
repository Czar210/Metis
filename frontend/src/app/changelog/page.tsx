'use client'

import Link from 'next/link'
import { Sparkles } from 'lucide-react'
import { Header } from '@/components/ui/Header'

type Entry = {
  version: string
  date: string
  tag: 'novo' | 'melhoria' | 'fix' | 'big'
  text: string
}

type Release = {
  version: string
  date: string
  label: string
  current?: boolean
  entries: Entry[]
}

const RELEASES: Release[] = [
  {
    version: 'Alpha v0.8.0',
    date: '04/2026',
    label: 'Big Update',
    current: true,
    entries: [
      { version: '', date: '', tag: 'big',      text: 'Maior atualização desde o lançamento — nova interface, IA integrada, recomendações e monetização.' },
      { version: '', date: '', tag: 'novo',      text: 'Busca inteligente com autocomplete — digite o nome e veja sugestões instantâneas de jogadores já cadastrados.' },
      { version: '', date: '', tag: 'novo',      text: 'Página de Itens — ranking de todos os itens por winrate e popularidade, com filtros por role e patch.' },
      { version: '', date: '', tag: 'novo',      text: 'Recomendações de campeão por lane — a Metis analisa seu perfil e sugere picks por posição (Diana JG ≠ Diana Mid).' },
      { version: '', date: '', tag: 'novo',      text: 'Chat com IA Metis funcionando — conectado ao Gemini Flash Lite para respostas táticas reais.' },
      { version: '', date: '', tag: 'novo',      text: 'Metis Score nas partidas — nota de performance por role com cores de elo (Iron a Challenger).' },
      { version: '', date: '', tag: 'novo',      text: 'Análise de equipe na partida — gráficos comparando os times em kills, ouro, dano, visão e CS.' },
      { version: '', date: '', tag: 'novo',      text: 'Tab de Build na partida — itens finais, feitiços e runas completas (primária + secundária) de cada jogador.' },
      { version: '', date: '', tag: 'novo',      text: 'Jogou com / Nemesis — veja quem jogou ao seu lado ou contra você com mais frequência.' },
      { version: '', date: '', tag: 'novo',      text: 'Histórico de nomes — se um jogador mudou de nick, o sistema detecta e mostra os nomes anteriores.' },
      { version: '', date: '', tag: 'novo',      text: 'Página de Planos — Free, Doador, Premium e Pro com emblemas de elo (Silver a Challenger).' },
      { version: '', date: '', tag: 'melhoria',  text: 'Tier List com badges de tier (S+ a D), dropdown de patch e emblemas de elo maiores nos filtros.' },
      { version: '', date: '', tag: 'melhoria',  text: 'Perfil do jogador expandido — layout em 2 colunas, resumo da temporada, filtros por season/patch/role.' },
      { version: '', date: '', tag: 'melhoria',  text: 'Matchups agora mostram winrate normalizado (vs Média) para identificar counters reais.' },
      { version: '', date: '', tag: 'melhoria',  text: 'Header unificado em todas as páginas — logo Metis sempre volta ao menu, navegação consistente.' },
      { version: '', date: '', tag: 'melhoria',  text: 'Scoreboard da partida ordenado por role (Top → JG → Mid → ADC → SUP).' },
      { version: '', date: '', tag: 'melhoria',  text: 'Light mode refinado — melhor contraste e legibilidade.' },
    ],
  },
  {
    version: 'Alpha v0.7.1',
    date: '04/2026',
    label: '',
    current: false,
    entries: [
      { version: '', date: '', tag: 'fix', text: 'Histórico de partidas agora sempre aparece do mais recente ao mais antigo.' },
      { version: '', date: '', tag: 'fix', text: 'Data da partida mostra quando o jogo foi jogado, não quando foi importado para o banco.' },
      { version: '', date: '', tag: 'fix', text: 'Botão "Ver partidas novas" não travava mais com erro 500 em determinadas condições.' },
    ],
  },
  {
    version: 'Alpha v0.7.0',
    date: '04/2026',
    label: '',
    current: false,
    entries: [
      { version: '', date: '', tag: 'novo',     text: 'Página de campeão em /champions/[nome] — overview, builds, matchups e sinergias com filtros de lane, servidor e patch.' },
      { version: '', date: '', tag: 'melhoria', text: 'Tier List: clicar no nome de um campeão abre a página do campeão diretamente.' },
      { version: '', date: '', tag: 'melhoria', text: 'Cards de partida: novo botão "Campeão" para acessar a página do campeão jogado.' },
      { version: '', date: '', tag: 'fix',      text: 'Ícones de lane e emblemas de elo na Tier List estavam quebrados — corrigidos com assets do CommunityDragon.' },
    ],
  },
  {
    version: 'Alpha v0.6.6',
    date: '04/2026',
    label: '',
    current: false,
    entries: [
      { version: '', date: '', tag: 'novo',     text: 'Painel de administração em /admin — estatísticas do sistema em tempo real.' },
      { version: '', date: '', tag: 'melhoria', text: 'Botão "Ver partidas novas" agora tem cooldown de 5 minutos com contador regressivo visível.' },
      { version: '', date: '', tag: 'fix',      text: 'Cooldown persiste mesmo ao recarregar a página — sem burlar o limite ao dar F5.' },
    ],
  },
  {
    version: 'Alpha v0.6.5',
    date: '04/2026',
    label: '',
    current: false,
    entries: [
      { version: '', date: '', tag: 'novo',     text: 'Timeline da partida — gráfico de CS/m, Ouro e XP ao longo do tempo para todos os jogadores.' },
      { version: '', date: '', tag: 'novo',     text: 'Seu jogador aparece destacado na timeline com linha mais grossa e cores intensas.' },
      { version: '', date: '', tag: 'melhoria', text: 'Página de detalhes da partida ganhou seção colapsável "Timeline da Partida" abaixo do scoreboard.' },
    ],
  },
  {
    version: 'Alpha v0.6.4',
    date: '04/2026',
    label: '',
    current: false,
    entries: [
      { version: '', date: '', tag: 'novo',     text: 'Cards de partida mostram itens, keystone, CS/m e nível final de cada campeão.' },
      { version: '', date: '', tag: 'novo',     text: 'Resumo do jogador no topo do perfil — winrate, KDA médio, CS/m e campeão mais jogado.' },
      { version: '', date: '', tag: 'melhoria', text: 'Data relativa e patch de cada partida visíveis direto no histórico ("há 2 dias · Patch 16.7").' },
      { version: '', date: '', tag: 'melhoria', text: 'CS/m colorido por performance — verde ≥8, amarelo ≥6, vermelho abaixo.' },
      { version: '', date: '', tag: 'melhoria', text: 'Temas de cor agora salvam automaticamente ao fazer login e sincronizam entre dispositivos.' },
      { version: '', date: '', tag: 'novo',     text: 'Cinco temas de cor com modo claro e escuro separados — incluindo tema Dourado.' },
    ],
  },
  {
    version: 'Alpha v0.6.3',
    date: '04/2026',
    label: '',
    current: false,
    entries: [
      { version: '', date: '', tag: 'novo',     text: 'Histórico de partidas carrega 15 partidas na abertura e mais 10 por clique em "Carregar mais".' },
      { version: '', date: '', tag: 'novo',     text: 'Apenas partidas ranqueadas (SoloQ e Flex) aparecem no histórico — remakes e outras filas ficam separados.' },
      { version: '', date: '', tag: 'melhoria', text: 'Ícones de posição (Top, Jungle, Mid, ADC, Suporte) e emblemas de elo agora carregam localmente, sem depender de CDN externa.' },
      { version: '', date: '', tag: 'melhoria', text: 'Busca de jogadores separada em dois campos: Nome e #TAG, com exemplo visível.' },
      { version: '', date: '', tag: 'fix',      text: 'Campeões novos (Yunara e outros) agora aparecem com foto corretamente.' },
    ],
  },
  {
    version: 'Alpha v0.6.2',
    date: '04/2026',
    label: '',
    entries: [
      { version: '', date: '', tag: 'novo',     text: 'Quatro temas de cor — Azul, Roxo, Verde e Vermelho. Preferência salva automaticamente.' },
      { version: '', date: '', tag: 'novo',     text: 'Destaques do Meta na home — top 6 campeões do patch visíveis sem precisar de login.' },
      { version: '', date: '', tag: 'melhoria', text: 'Navegação entre todas as telas disponível em qualquer página, inclusive Tier List sem login.' },
      { version: '', date: '', tag: 'melhoria', text: 'Badge de versão Alpha visível no header.' },
    ],
  },
  {
    version: 'Alpha v0.6.1',
    date: '04/2026',
    label: '',
    entries: [
      { version: '', date: '', tag: 'novo', text: 'Tier List de campeões com filtros por posição, região e patch.' },
      { version: '', date: '', tag: 'novo', text: 'Histórico de partidas detalhado por jogador — KDA, ouro, dano e duração.' },
      { version: '', date: '', tag: 'novo', text: 'Cadastro de conta com confirmação por e-mail.' },
      { version: '', date: '', tag: 'novo', text: 'Página "O que é novo?" e "Conheça a Equipe".' },
      { version: '', date: '', tag: 'fix',  text: 'Correções de estabilidade no servidor e no pipeline de dados.' },
    ],
  },
  {
    version: 'Alpha v0.5.0',
    date: '04/2026',
    label: '',
    entries: [
      { version: '', date: '', tag: 'novo',     text: 'Sistema de supervisão — salve jogadores favoritos na sua conta.' },
      { version: '', date: '', tag: 'novo',     text: 'Chat Metis disponível para contas premium.' },
      { version: '', date: '', tag: 'novo',     text: 'Perfis públicos de jogadores — sem precisar de login.' },
      { version: '', date: '', tag: 'melhoria', text: 'Busca por Riot ID (Nome#TAG) além de PUUID.' },
    ],
  },
  {
    version: 'Alpha v0.4.0',
    date: '04/2026',
    label: '',
    entries: [
      { version: '', date: '', tag: 'novo', text: 'Lançamento do site Metis.' },
      { version: '', date: '', tag: 'novo', text: 'Login com e-mail e senha.' },
      { version: '', date: '', tag: 'novo', text: 'Busca de jogadores por PUUID ou Riot ID.' },
    ],
  },
  {
    version: 'Alpha v0.3.0',
    date: '03/2026',
    label: '',
    entries: [
      { version: '', date: '', tag: 'novo',     text: 'Estatísticas médias de campeões — winrate, KDA, ouro, DPM.' },
      { version: '', date: '', tag: 'novo',     text: 'Sincronização de partidas via Riot API.' },
      { version: '', date: '', tag: 'melhoria', text: 'Pipeline de dados automatizado rodando diariamente.' },
    ],
  },
  {
    version: 'Alpha v0.2.0',
    date: '03/2026',
    label: '',
    entries: [
      { version: '', date: '', tag: 'novo', text: 'Esqueleto do projeto — backend FastAPI, banco Supabase e repositório estruturados.' },
      { version: '', date: '', tag: 'novo', text: 'Planejamento no Trello e definição das tecnologias da stack.' },
    ],
  },
  {
    version: 'Alpha v0.1.0',
    date: '03/2026',
    label: '',
    entries: [
      { version: '', date: '', tag: 'novo', text: 'Criação do repositório e estrutura inicial de pastas.' },
    ],
  },
]

const TAG_STYLES: Record<Entry['tag'], string> = {
  novo: 'bg-metis-accent/15 text-metis-accent border border-metis-accent/30',
  melhoria: 'bg-amber-500/10 text-amber-400 border border-amber-500/20',
  fix: 'bg-red-500/10 text-red-400 border border-red-500/20',
  big: 'bg-purple-500/15 text-purple-400 border border-purple-500/30',
}

const TAG_LABELS: Record<Entry['tag'], string> = {
  novo: 'novo',
  melhoria: 'melhoria',
  fix: 'fix',
  big: 'big update',
}

export default function ChangelogPage() {
  return (
    <div className="min-h-screen bg-metis-bg text-metis-text">
      <Header />

      <main className="max-w-2xl mx-auto px-4 py-12">
        {/* Hero */}
        <div className="mb-12">
          <div className="flex items-center gap-2 mb-3">
            <Sparkles className="w-4 h-4 text-metis-accent" />
            <span className="text-xs font-medium text-metis-accent uppercase tracking-widest">Novidades</span>
          </div>
          <h1 className="text-3xl font-bold text-metis-text mb-2">O que é novo?</h1>
          <p className="text-metis-text-dim text-sm">
            Acompanhe as evoluções da Metis. Cada versão traz melhorias reais — sem promessas, só entregas.
          </p>
        </div>

        {/* Timeline */}
        <div className="relative">
          {/* Linha vertical */}
          <div className="absolute left-3 top-2 bottom-0 w-px bg-metis-border" />

          <div className="flex flex-col gap-10">
            {RELEASES.map((release) => (
              <div key={release.version} className="relative pl-10">
                {/* Dot */}
                <div className={`absolute left-0 top-1.5 w-6 h-6 rounded-full flex items-center justify-center border-2 ${
                  release.current
                    ? 'bg-metis-accent border-metis-accent'
                    : 'bg-metis-surface border-metis-border'
                }`}>
                  <div className={`w-2 h-2 rounded-full ${release.current ? 'bg-white' : 'bg-metis-text-dim'}`} />
                </div>

                {/* Header da versão */}
                <div className="flex items-center gap-3 mb-4">
                  <h2 className="text-lg font-bold text-metis-text">{release.version}</h2>
                  {release.current && (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-metis-accent/20 text-metis-accent border border-metis-accent/30 font-medium">
                      atual
                    </span>
                  )}
                  <span className="text-xs text-metis-text-dim ml-auto">{release.date}</span>
                </div>

                {/* Entries */}
                <div className="bg-metis-surface border border-metis-border rounded-xl overflow-hidden">
                  {release.entries.map((entry, i) => (
                    <div
                      key={i}
                      className={`flex items-start gap-3 px-4 py-3 ${
                        i < release.entries.length - 1 ? 'border-b border-metis-border/50' : ''
                      }`}
                    >
                      <span className={`mt-0.5 text-[10px] font-semibold px-1.5 py-0.5 rounded uppercase tracking-wide flex-shrink-0 ${TAG_STYLES[entry.tag]}`}>
                        {TAG_LABELS[entry.tag]}
                      </span>
                      <p className="text-sm text-metis-text leading-relaxed">{entry.text}</p>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-16 text-center">
          <p className="text-xs text-metis-text-dim">
            Metis está em Alpha — bugs fazem parte. Encontrou algo?{' '}
            <Link href="/chat" className="text-metis-accent hover:underline">
              Fale com a gente.
            </Link>
          </p>
        </div>
      </main>
    </div>
  )
}
