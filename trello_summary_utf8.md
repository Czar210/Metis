### [Pegue Suas Tarefas] Data Lake Local

### [Pegue Suas Tarefas] teste

### [Depende de Outras Tarefas] Vetorização dos Guias (Camada Ouro)
Descrição: > O coração do nosso RAG. O objetivo é criar um script autônomo que conecte no nosso Data Lake (Cloudflare R2 - Camada Bronze), baixe os arquivos **JSON estruturados** que já foram limpos pelo nosso scraper, e use o **OpenRAG** para "fatiar" (chunking) os capítulos e convertê-los em embeddings. Por fim, o script salva tudo na tabela definitiva (Camada Ouro) do Supabase usando o `pgvector`. Esse script vai rodar via GitHub Actions para manter a base sempre atualizada.

**Onde codar (Pastas):**

- Script: `scripts/ouro/vectorize_guides.py`
- Automação: `.github/workflows/vetorizacao_diaria.yml`

 **Bibliotecas Necessárias (**`requirements.txt`**):**

- `boto3` (Para ler os JSONs do Cloudflare R2 via API compatível com S3)
- `openrag` (Core para geração dos embeddings em cima dos textos)
- `supabase` (Cliente oficial do banco)
- `python-dotenv` (Para ler as chaves de API com segurança)
Checklist: Checklist de Execução
- [incomplete] Criar um novo arquivo .yml na pasta .github/workflows para a rotina de vetorização no github actions (configure pra rodar por exemplo todo dia as 3 da manhã com cron: '0 3 * *' )
- [incomplete] No script Python, usar o boto3 para listar e fazer o download dos arquivos HTML brutos salvos no bucket do Cloudflare R2 (Camada Bronze).
- [incomplete] Fazer o parse do JSON nativo do Python (json.loads()) e iterar sobre o array de chapters.
- [incomplete] Passar o conteúdo de cada capítulo (chapter['content']) para o pipeline do OpenRAG processar (chunking).
- [incomplete] Chamar a função de vetorização do OpenRAG para transformar os blocos de texto em matrizes numéricas (Embeddings).
- [incomplete] Fazer um UPSERT na tabela da Camada Ouro no Supabase, inserindo o texto extraído, os metadados (campeão, patch, autor) e o vetor numérico na coluna embedding.

### [Depende de Outras Tarefas] Conectar o FastAPI com o Supabase (Pra Busca Semântica)
Descrição: > Aqui a mágica começa a acontecer. Quando a rota de chat do FastAPI receber a pergunta do jogador (Ex: "Como jogar contra Zed?"), o backend precisa transformar essa pergunta exata em um vetor, e ir lá no Supabase procurar as dicas mais matematicamente próximas usando a função de distância do pgvector.

**Onde codar (Pastas):**

- Lógica do RAG: `backend/services/rag_service.py`
- Banco de Dados: Criar a função RPC direto no painel SQL do Supabase.

 **Bibliotecas Necessárias (**`requirements.txt`**):**

- `openrag` (Para vetorizar a pergunta do usuário na hora)
- `supabase` (Para chamar a função RPC do banco)
Checklist: Checklist de Execução
- [incomplete] No painel do Supabase, criar a função SQL RPC match_documents (usando o operador <-> do pgvector pra achar a distância vetorial).
- [incomplete] No arquivo rag_service.py, receber a string da pergunta do usuário
- [incomplete] Chamar a mesma engine de modelo do OpenRAG usada em outra tarefa pra transformar dessa vez a pergunta em um embedding
- [incomplete] Usar supabase.rpc('match_documents', {'query_embedding': vetor, 'match_threshold': 0.78, 'match_count': 3}).execute() (Bruxaria sinistra de dados pra evitar alucinação)
- [incomplete] Extrair apenas o texto dos resultados e formatar em um grande bloco de Contexto para devolver ao FastAPI.

### [PUC Zaras] Automatizar a Raspagem do Mobafire + Bugfix
Descrição: Pegar o script do Playwright que fizemos e colocar para rodar automaticamente no GitHub Actions 1x por semana. O script deve salvar o HTML cru no Cloudflare R2 (Nossa Camada Bronze).

‌

Tem um Bug portanto não terminado

### [PUC Zaras] Script de Limpeza de Partidas (Bronze -> Prata)
Descrição: Criar o script em Python (`process_matches.py`) que lê os JSONs da Riot, deleta as partidas de menos de 3 minutos, remove remakes e salva os dados limpos nas tabelas relacionais do Supabase.
Checklist: Checklist
- [complete] Criar a Lógica
- [incomplete] Montar o Loop
- [incomplete] Subir como action
- [incomplete] Bugfix

### [PUC Zaras] Modelagem e Ingestão de Itens (Builds dos Campeões)
Descrição: > Dar ao Metis o conhecimento exato do que está sendo construído no jogo. Precisamos de um espaço dedicado no Supabase para armazenar a popularidade e a taxa de vitória dos itens para cada campeão. Isso exige atualizar nosso script de partidas (para ler o que o jogador comprou) e cruzar com os dados oficiais da Riot (Data Dragon) para termos o nome real do item, e não apenas o ID numérico.

**Onde codar:**

- Banco de Dados: Painel SQL do Supabase.
- Script de Limpeza: Atualizar o `scripts/prata/process_matches.py` (do Cartão 2).
- Dicionário de Itens: `data/static/item.json` (do Data Dragon).

 **Bibliotecas Necessárias (**`requirements.txt`**):**

- `supabase` (Para inserir os dados tabulados).
- `requests` (Caso precisemos baixar o `item.json` mais atualizado direto do servidor da Riot).

**Checklist de Execução:**
Checklist: Checklist de Execução
- [incomplete] No Supabase, criar a tabela champion_builds contendo: champion_name, item_id, item_name, pick_count, win_count, patch.
- [incomplete] Baixar o arquivo item.json do Data Dragon da Riot para mapear os IDs (ex: 3078 = Força da Trindade).
- [incomplete] Atualizar a lógica do Cartão 2 (Script de Limpeza) para que, ao processar um jogador na partida, o script extraia os 6 espaços de itens dele (item0 até item5).
- [incomplete] Inserir/Atualizar a contagem desses itens na tabela champion_builds do Supabase.
- [incomplete] (Opcional) Criar uma View no SQL que calcula o Winrate e Pickrate de cada item por campeão automaticamente, para o FastAPI e o RAG consultarem rápido.

### [André] Prompt Engeneering (Whua) com o Llama 3
Descrição: ‌

> O modelo Llama 3 é inteligente, mas se deixarmos solto, ele pode alucinar ou agir como um bot genérico. O objetivo é criar o "System Prompt" implacável que força a IA a assumir a identidade do Metis e, obrigatoriamente, cruzar a pergunta do usuário com o contexto que puxamos do Cartão 5, sem inventar estatísticas.

**Onde codar (Pastas):**

- Orquestração LLM: `backend/services/llm_service.py`
- Prompts: `backend/prompts/system_prompt.txt`

**Bibliotecas Necessárias (**`requirements.txt`**):**

- SDK do provedor do Llama 3 (ex: `groq` se estiver usando a Groq Cloud, ou `openai` se for endpoint compatível).
Checklist: Checklist de Execução
- [incomplete] Escrever o system_prompt.txt definindo regras claras ("Você é Metis, o estrategista. Nunca alucine. Responda APENAS com base no contexto.").
- [incomplete] Criar a função no llm_service.py que monta a requisição final contendo: Prompt do Sistema + Contexto (do Cartão 5) + Pergunta do Usuário.
- [incomplete] Configurar a temperatura do modelo para um valor muito baixo (ex: temperature=0.1) para garantir respostas analíticas e determinísticas.
- [incomplete] Retornar a string gerada pelo Llama 3 para a rota original /api/v1/chat

### [Takis] Tela de Chat e Autenticação no Next.js
Descrição: ‌

> Construir o nosso produto final visível como chat pra Lucy. É a interface onde o pro-player ou jogador casual fará login para pedir as táticas. Precisamos garantir uma experiência fluida, reativa e integrada com o sistema de autenticação nativo do nosso banco, evitando que curiosos sem conta gastem nossos tokens de IA.

**Onde codar (Pastas):**

- Autenticação: `frontend/src/app/auth/`
- Tela do Chat: `frontend/src/app/chat/`
- Componentes: `frontend/src/components/ui/`

 **Bibliotecas Necessárias (**`package.json`**):**

- `next` e `react`
- `@supabase/supabase-js` e `@supabase/ssr` (Para autenticação)
- `tailwindcss` (Para a estilização rápida e responsiva)
- `lucide-react` (Para os ícones de envio, usuário e IA)
Checklist: Checklist de Execução
- [incomplete] Instalar as bibliotecas e inicializar o cliente do Supabase no Frontend com as variáveis NEXT_PUBLIC_SUPABASE_URL e ANON_KEY.
- [incomplete] Criar a página de Login (Email/Senha) e a lógica para gerar a sessão do usuário.
- [incomplete] Criar o componente de input de texto e o botão de Enviar (usando ícone do lucide-react).
- [incomplete] Gerenciar o estado das mensagens da tela usando o hook useState (histórico de mensagens do usuário e do bot).
- [incomplete] Ao clicar em enviar, disparar uma requisição fetch (POST) para a URL do nosso FastAPI hospedado no Railway.
- [incomplete] Capturar a resposta da API e atualizar a tela com a sabedoria tática do Metis. Fazer deploy no Vercel.

### [Takis] Lógica de Login (Supabase + FastAPI)
Descrição: > Proteger nossa infraestrutura. Não queremos que qualquer pessoa acesse a IA ou faça chamadas na nossa API gastando nossos tokens. Precisamos implementar o fluxo completo de autenticação: o usuário cria a conta/loga pelo Frontend (Next.js) usando o Supabase Auth, e o Frontend manda o token de segurança (JWT) para o FastAPI em cada requisição. O FastAPI deve verificar se o token é válido antes de responder.

**Onde codar:**

- Frontend: `frontend/src/app/auth/`
- Backend: `backend/core/security.py` e rotas do FastAPI.

**Bibliotecas Necessárias:**

- Frontend: `@supabase/supabase-js`, `@supabase/ssr`
- Backend: `fastapi`, `python-jose` (para validar o JWT JWT) ou o próprio cliente `supabase`.
Checklist: Checklist de Execução
- [incomplete] No Frontend, criar a página de Login e Cadastro (Email/Senha ou Google).
- [incomplete] Salvar a sessão do usuário no navegador (Cookies/Local Storage via Supabase SSR).
- [incomplete] No interceptador de requisições do Frontend (fetch/axios), adicionar o cabeçalho Authorization: Bearer <TOKEN>.
- [incomplete] No Backend (FastAPI), criar uma dependência (Depends) chamada get_current_user que lê o header da requisição.
- [incomplete] Validar o token recebido com a chave pública do nosso projeto no Supabase. Se for inválido, retornar erro 401 (Unauthorized).

### [Takis] Tela de Histórico de Partidas do Jogador
Descrição: > Nem só de IA vive o jogador! Precisamos de uma tela clássica de perfil (estilo [http://OP.GG](http://OP.GG "smartCard-inline") ) onde o usuário logado possa ver as suas últimas partidas. Isso gera retenção, pois o cara entra no Metis para ver como ele foi na partida anterior e aproveita para pedir dicas para a IA.

**Onde codar:**

- Telas: `frontend/src/app/profile/` ou `frontend/src/app/history/`
- Componentes: `frontend/src/components/matches/MatchCard.tsx`

**Bibliotecas Necessárias (**`package.json`**):**

- `next`, `react`
- `tailwindcss` (Para os cards de vitória/derrota).
- `date-fns` (Para formatar o tempo: "Há 2 horas").
- `lucide-react` (Ícones de espada, escudo, ouro).
Checklist: Checklist de Execução
- [incomplete] Criar a rota /history no Next.js.
- [incomplete] Fazer um fetch na nossa API para buscar a lista de partidas do jogador.
- [incomplete] Criar o componente MatchCard que recebe as propriedades: Resultado (Vitória/Derrota), Campeão jogado, KDA (Abates/Mortes/Assistências) e Ouro.
- [incomplete] Estilizar os cards dinamicamente: Fundo levemente azul para Vitória, fundo avermelhado para Derrota.
- [incomplete] Adicionar um botão "Analisar com Metis" ao lado da partida, que joga os dados daquela partida pro chat da IA. (junto do ID pra ela procurar os eventos)

### [Takis] Tela de Estatísticas Globais (Tier List / Meta)
Descrição: > Mostrar o valor do nosso banco de dados pro mundo. Uma página dedicada ("O Meta" ou "Tier List") onde qualquer usuário pode visualizar uma tabela completa com o desempenho de todos os campeões no patch atual, consumindo a rota criada no Cartão 11.

**Onde codar:**

- Telas: `frontend/src/app/champions/` ou `frontend/src/app/tierlist/`
- Componentes: `frontend/src/components/stats/StatsTable.tsx`

**Bibliotecas Necessárias (**`package.json`**):**

- `next`, `react`
- `recharts` ou `chart.js` (Para fazer gráficos de barrinhas de winrate).
- `clsx` e `tailwind-merge` (Para formatar as classes css).
Checklist: Checklist de Execução
- [incomplete] Criar a rota /champions no frontend.
- [incomplete] Fazer um fetch na rota /api/v1/stats/champions
- [incomplete] Montar uma tabela (Grid/Table) que exiba: Ícone do Campeão, Nome, Winrate (%), Pickrate e Banrate.
- [incomplete] Implementar a lógica de ordenação (Sort) clicando no cabeçalho da tabela (ex: clicar em Winrate para ordenar do maior pro menor).
- [incomplete] Usar cores (Vermelho < 49%, Verde > 51%) para destacar quem está forte no meta atual.

### [Revisão] Configuração do pgvector e Tabela Ouro no Supabase
Descrição: > Transformar o nosso PostgreSQL tradicional em um Banco de Dados Vetorial. Por enquanto, o Supabase só sabe guardar textos e números comuns. Precisamos habilitar a extensão nativa de IA (`pgvector`), criar a tabela definitiva da Camada Ouro que vai receber os guias mastigados, e já deixar a função de "Busca Semântica" pronta no banco para quando o FastAPI precisar chamar.

**Onde codar:**

- Painel Web do Supabase (SQL Editor) ou arquivos de migração na pasta `supabase/migrations/`.

 **Ferramentas Necessárias:**

- Painel SQL do Supabase.
- Documentação do OpenRAG (apenas para conferir o número de dimensões do vetor gerado, ex: 1536 ou 384).
Checklist: Checklist de Execução
- [complete] Acessar o SQL Editor no painel do Supabase
- [complete] Rodar o comando  pra habilitar a extensão vetorial: CREATE EXTENSION IF NOT EXISTS vector;
- [complete] Criar a tabela guides_gold (Camada Ouro) com as colunas essenciais: id, champion, title, author, content (texto limpo) e embedding (do tipo vector(DIMENSOES_DO_OPENRAG)).
- [complete] Criar um índice de performance HNSW na coluna do embedding para buscas super rápidas: CREATE INDEX ON guides_gold USING hnsw (embedding vector_cosine_ops);
- [complete] Criar a função SQL (RPC) chamada match_documents que recebe um vetor de query, usa o operador de distância (<=>) e retorna as linhas mais similares.

### [Revisão] Testes Funcionais — API Metis
Descrição: ### Health Check

- [ ] `GET /api/v1/health` → deve retornar 200 com `{"status": "online", "system": "Metis"}`

### POST /api/v1/player/update-history

- [ ] Request válido `{"nick":"Faker","tag":"KR1","server":"KR","count":5}` → 200 com relatório
- [ ] Nick vazio `{"nick":"","tag":"KR1","server":"KR","count":5}` → 404 jogador não encontrado
- [ ] Count = 0 → 422 erro de validação Pydantic (mínimo 1)
- [ ] Count = 25 → 422 erro de validação Pydantic (máximo 20)
- [ ] Servidor inválido `"server":"XYZ"` → 500 ValueError servidor desconhecido
- [ ] Sem RIOT\_API\_KEY no .env → 500 RuntimeError

### POST /api/v1/player/sync

- [ ] Request válido `{"riot_id":"Faker#KR1","server":"KR","count":5}` → 200 com relatório
- [ ] Sem `#` no riot_id `{"riot_id":"FakerKR1"}` → 400 "Formato inválido"
- [ ] Nick vazio `{"riot_id":"#KR1"}` → 400 "Nome e Tag não podem ser vazios"
- [ ] Tag vazia `{"riot_id":"Faker#"}` → 400 "Nome e Tag não podem ser vazios"
- [ ] Ambos vazios `{"riot_id":"#"}` → 400 "Nome e Tag não podem ser vazios"

### GET /api/v1/stats/champions

- [ ] `?champion=Ahri` → 200 com stats ou mensagem "dados insuficientes"
- [ ] `?champion=Ahri&role=MIDDLE` → 200 filtrado por role
- [ ] `?champion=Ahri&server=BR1` → 200 filtrado por servidor
- [ ] `?champion=Ahri&elo=DIAMOND` → 200 filtrado por elo
- [ ] `?champion=Ahri&patch=14.5` → 200 filtrado por patch
- [ ] Todos os filtros combinados `?champion=Ahri&role=MIDDLE&server=BR1&elo=DIAMOND&patch=14.5` → 200
- [ ] min_matches muito alto `?champion=Ahri&min_matches=99999` → 200 com total_matches: 0
- [ ] Sem parâmetro champion → 422 campo obrigatório
- [ ] Campeão que não existe `?champion=XYZ` → 200 com total_matches: 0
- [ ] min_matches = 0 → 422 erro de validação (mínimo 1)
- [ ] Champion minúsculo `?champion=ahri` → 200 (ilike é case-insensitive)

### CORS

- [ ] Request do `localhost:3000` → deve ser aceito
- [ ] Request de origem não permitida → deve ser bloqueado

### Exception Handling

- [ ] Operações Supabase com banco indisponível → deve retornar erro claro, não crash
- [ ] Riot API com rate limit (429) → deve retornar mensagem amigável
- [ ] Riot API com key expirada (403) → deve retornar mensagem amigável

### [Revisão] Endpoint FastAPI - Sincronizar Partidas do Jogador
Descrição: > Fazer a ponte entre o jogador real e o banco do Metis. Quando o usuário clica em "Atualizar Histórico", o backend precisa bater na API oficial da Riot Games, pegar as últimas 10-20 partidas daquele jogador, passar pela nossa lógica de limpeza (Camada Prata) e salvar na nossa tabela do Supabase.

 **Onde codar:**

- Rotas: `backend/api/routes/player.py`
- Integração: `backend/services/riot_service.py`

 **Bibliotecas Necessárias:**

- `fastapi`
- `riotwatcher` (Biblioteca oficial da Riot API em Python, já cuida do Rate Limit).
- `supabase`
Checklist: Checklist de Execução
- [complete] Criar a rota POST /api/v1/player/sync que recebe o Riot ID (ex: Zaras#0210 ou Monochaco#BR1).
- [complete] Usar o riotwatcher para descobrir o PUUID eterno dessa conta.
- [complete] Chamar o endpoint da Riot match.matchlist_by_puuid para pegar os IDs das últimas partidas.
- [complete] Para cada Match ID, baixar os dados detalhados.
- [complete] Passar os dados pela nossa regra de negócio: descartar remakes e partidas < 15 min.
- [complete] Fazer o UPSERT das partidas válidas na nossa tabela matches do Supabase.

### [Revisão] Criar Endpoints Base do FastAPI
Descrição: > Erguer o maestro do nosso sistema. O frontend não vai conversar direto com a IA ou com o banco de dados por questões de segurança e performance. O FastAPI será a ponte veloz e assíncrona. O objetivo é subir a estrutura do servidor, configurar as regras de CORS (para aceitar requisições apenas do nosso domínio na Vercel) e criar o contrato dos dados que vamos transacionar.

**Onde codar (Pastas):**

- App Principal: `backend/main.py`
- Rotas: `backend/api/routes.py`
- Modelos de Dados: `backend/models/schemas.py`

 **Bibliotecas Necessárias (**`requirements.txt`**):**

- `fastapi` (Framework da API)
- `uvicorn` (Servidor ASGI para rodar o FastAPI)
- `pydantic` (Para validar se a pergunta do usuário veio no formato certo)
Checklist: Checklist de Execução
- [complete] Inicializar o FastAPI no arquivo main.py
- [complete] Configurar o CORSMiddleware permitindo as origens do nosso app Next.js
- [complete] Criar a rota GET api/v1/health retornando o status online (padrão do Railway pra ele saber que a API caiu ou não)
- [complete] Usar o Pydantic para criar a classe ChatRequest (para quando estiver esperando um campo mensagem que é um str)
- [complete] Criar o esqueleto da rota POST /api/v1/chat que vai receber o ChatRequest
- [complete] Fazer o deploy continuo do Railway apontando pra pasta  backend/

### [Revisão] Endpoint FastAPI - Estatísticas Médias de Campeões
Descrição: > Alimentar a inteligência do nosso sistema com números frios. O FastAPI precisa consultar a nossa base de dados (Camada Prata/Ouro Relacional) e calcular agregações vitais dos campeões (ex: Qual a taxa de vitória da Ahri? Qual a média de ouro do Lee Sin no minuto 15?).

 **Onde codar:**

- Rotas: `backend/api/routes/stats.py`
- Serviços: `backend/services/stats_service.py`

 **Bibliotecas Necessárias:**

- `fastapi`
- `supabase` (Cliente Python para rodar as queries).
Checklist: Checklist de Execução
- [complete] Criar uma rota GET /api/v1/stats/champions.
- [complete] Escrever uma query SQL (ou usar as funções agregadoras do Supabase RPC) que agrupe as partidas válidas por campeão.
- [complete] Calcular as métricas: winrate (Vitórias / Total de Partidas), avg_kda, avg_gold ...
- [complete] Adicionar filtros via Query Params no FastAPI, como /stats/champions?elo=diamond ou ?patch=14.5.
- [complete] Retornar os dados em um JSON estruturado para o Frontend consumir.

