# Registro de Alterações

Data: 2026-03-26

## 1) Backend - habilitação de CORS configurável
Arquivo impactado: backend/main.py

### O que foi alterado
- Adicionado import de `os` para ler variável de ambiente.
- Adicionado import de `CORSMiddleware` do FastAPI.
- Incluída configuração de origens permitidas para CORS:
	- Padrão para desenvolvimento local: `http://localhost:3000` e `http://localhost:3001`.
	- Possibilidade de sobrescrever via `CORS_ORIGINS` (lista separada por vírgula).
- Middleware registrado com:
	- `allow_origins=allowed_origins`
	- `allow_credentials=True`
	- `allow_methods=["*"]`
	- `allow_headers=["*"]`

### Por que essa alteração foi feita
- O frontend (Next.js) e o backend rodam em origens diferentes no desenvolvimento e, potencialmente, em domínios diferentes em produção.
- Sem CORS, o navegador bloqueia chamadas do frontend para a API, impedindo funcionalidades como busca de partidas e consumo de endpoints.
- A configuração por variável de ambiente evita hardcode de domínio de produção e permite ajuste por ambiente sem alterar código.

### Lógica de negócio por trás
- Objetivo de negócio: garantir que a aplicação web consiga consultar os serviços de dados do Metis com confiabilidade em dev e prod.
- Regra aplicada:
	- Em desenvolvimento, permitir origens locais para acelerar ciclo de teste.
	- Em produção, restringir explicitamente as origens ao domínio oficial (via `CORS_ORIGINS`) para reduzir risco de acesso indevido por frontends não autorizados.
- Efeito no produto:
	- Usuário final consegue acionar fluxos de consulta sem erro de bloqueio no navegador.
	- Time mantém controle de segurança por ambiente sem retrabalho no código.

### Exemplo de uso em produção
- Definir no ambiente:
	- `CORS_ORIGINS=https://metis.vercel.app`
- Para múltiplos domínios:
	- `CORS_ORIGINS=https://metis.vercel.app,https://app.metis.com`


## 2) Backend - rota de health check versionada
Arquivo impactado: backend/main.py

### O que foi alterado
- Rota `GET /health` renomeada para `GET /api/v1/health`.
- Retorno mantido: `{"status": "online", "system": "Metis"}`.

### Por que essa alteração foi feita
- O Railway utiliza um endpoint de health check para monitorar se a API está no ar e reiniciá-la automaticamente em caso de falha.
- Padronizar a rota sob `/api/v1/` mantém consistência com os demais endpoints da aplicação.

### Lógica de negócio por trás
- Garantir que a infraestrutura de deploy (Railway) consiga detectar quedas e fazer restart automático, aumentando a disponibilidade do serviço para os usuários.
- Manter todas as rotas sob o mesmo prefixo versionado facilita configuração de proxy, rate limiting e documentação da API.

## 4) Criação do Bug Tracker
Arquivo impactado: bugs.md

### O que foi alterado
- Criado arquivo `bugs.md` na raiz do projeto com template padronizado para registro de bugs.
- Cada entrada prevê: data, status visual (🔴/🟡/🟢), localização, descrição e solução.

### Por que essa alteração foi feita
- Centralizar o rastreamento de bugs em um lugar acessível a todos os membros do time.
- Evitar que bugs sejam comunicados informalmente e se percam.

### Lógica de negócio por trás
- Melhorar a qualidade do produto ao garantir que todo bug identificado tenha registro, acompanhamento e resolução documentada.
- Reduzir retrabalho ao evitar que o mesmo bug seja investigado múltiplas vezes por pessoas diferentes.

## 5) Backend - modelo ChatRequest (Pydantic)
Arquivo impactado: backend/main.py

### O que foi alterado
- Criada classe `ChatRequest(BaseModel)` com o campo `mensagem: str`.
- Posicionada logo após `MatchRequest`, agrupando os contratos de entrada da API.

### Por que essa alteração foi feita
- O endpoint de chat precisa de um contrato tipado para validar automaticamente o corpo da requisição.
- Pydantic garante que requisições sem o campo `mensagem` ou com tipo errado retornem erro 422 antes de chegarem à lógica de negócio.

### Lógica de negócio por trás
- Preparar a estrutura de dados que o agente de IA (Ollama + RAG) vai consumir no fluxo de chat interativo.
- Validação automática reduz código defensivo nos handlers e melhora a experiência do desenvolvedor.

## 6) Backend - esqueleto da rota POST /api/v1/chat
Arquivo impactado: backend/main.py

### O que foi alterado
- Criado endpoint `POST /api/v1/chat` que recebe `ChatRequest` e retorna resposta placeholder.
- Retorno atual: `{"resposta": "...", "status": "skeleton"}`.
- Docstring com `TODO` indicando integração futura com Ollama (Llama 3) + pipeline RAG (Pinecone).

### Por que essa alteração foi feita
- Estabelecer o contrato da rota de chat antes de implementar a lógica de IA, permitindo que o frontend comece a integrar em paralelo.
- O esqueleto serve como stub para testes de conectividade frontend ↔ backend.

### Lógica de negócio por trás
- O chat interativo é uma das features pagas do Metis (objetivo #5 do projeto).
- Ter a rota pronta permite desenvolvimento paralelo: frontend consome o stub enquanto o AI Engineer implementa o agente real.

## 7) Backend - Serviço de Integração Riot API + Supabase
Arquivos impactados: backend/services/riot_service.py e backend/services/__init__.py

### O que foi alterado
- Criado o arquivo `riot_service.py` isolando a lógica de negócio que orquestra RiotWatcher e Supabase.
- Movemos toda a triagem "Prata" (filtragem de remakes, tempo de partida, AFK status) para dentro de funções como `_processar_e_salvar()`.
- Cria a função principal `atualizar_historico()` que busca o PUUID, filtra partidas velhas/repetidas, consome as API oficiais e salva em Bulk no Supabase as partidas e participantes.

### Por que essa alteração foi feita
- Ter lógica complexa dentro da *rota* (`main.py` ou `player.py`) é um antipadrão. Criar um "serviço" deixa o código mais limpo e desacoplado.
- Os scripts originais rodavam leitura de JSONs `.gz` locais. Precisávamos da mesma lógica convertida para lidar diretamente com o retorno real da API para uso _on-demand_.

### Lógica de negócio por trás
- Automatiza a atualização perfeitamente para quando o usuário clicar no botão "Atualizar Histórico" na plataforma Metis.
- Evita estourar o banco de dados e duplicar dados realizando checagem de existência (`_match_exists`).

## 8) Backend - Rota de Player e Integração no main.py
Arquivos impactados: backend/api/routes/player.py, backend/api/__init__.py, backend/api/routes/__init__.py e backend/main.py

### O que foi alterado
- Criada a rota `POST /api/v1/player/update-history` usando `APIRouter`.
- A rota valida os inputs usando `UpdateHistoryRequest` (Pydantic com `nick`, `tag`, `server`, `count`).
- A rota consome a função `atualizar_historico()` do nosso novo modulo `riot_service`.
- Inclusão de tratamento elegante de erros (`Rate Limit 429`, `Not Found 404`).
- Registrado (app.include_router) no arquivo principal `backend/main.py`.

### Por que essa alteração foi feita
- Expor a funcionalidade para o Frontend em um formato JSON limpo e amigável.
- Tratamento explícito de erros HTTP para garantir que o cliente (Next.js) mostre mensagens corretas ao usuário nos casos de limite de rate ou summoner não existente.

### Lógica de negócio por trás
- Fornece o contrato base onde a experiência do usuário de atualizar os próprios dados da Riot se baseia. A integridade do serviço depende dessa rota responder de maneira confiável e descritiva.

## 9) Backend - Novo endpoint de sincronização simplificada (/sync)
Arquivo impactado: backend/api/routes/player.py

### O que foi alterado
- Criado o novo endpoint `POST /api/v1/player/sync`.
- Aceita um payload com um único campo `riot_id` no formato combinado `Nome#Tag` (ex: `Monochaco#BR1`).
- Instancia o `atualizar_historico` parseando automaticamente esse `riot_id`.

### Por que essa alteração foi feita
- Ter endpoints recebendo campos complexos separados dificulta conexões via Webhooks ou Chatbots simples onde frequentemente a extração de linguagem natural capta o ID do LoL como uma string só.

### Lógica de negócio por trás
- Tornar a API mais resiliente e flexível para os futuros clientes e integrações do agente que operará a base de dados do Metis via linguagem natural.

## 10) Debugging - Correções no Fetch de Partidas e Bypass de Storage Local
Arquivos impactados: backend/main.py, scripts/ingestion/fetch_matches.py

### O que foi alterado
- A função que engatilhava o fetch antigo (`fetch_player_matches`) foi refatorada para retornar um Dicionário ao invés de Booleano (corrigindo `500 Server Error`).
- Resolvido impedimento de `#` duplo bloqueando as chamadas 404 da Riot.
- Remoção do erro travante (raise 500) caso as credenciais da Cloudflare R2 faltassem no ambiente local (`.env`). Substituído por um aviso não impeditivo no console.

### Por que essa alteração foi feita
- Desenvolvedores precisam testar as integrações básicas (chamadas da Riot) sem precisarem obrigatoriamente criar ou ter acesso à infraestrutura pesada em nuvem (Cloudflare).
- Garantir que erros simples (como passar Hash numa API REST) não custem valioso tempo de debug do projeto principal.

## 11) Backend - Atualização da Regra de Negócios (Camada Prata)
Arquivo impactado: backend/services/riot_service.py

### O que foi alterado
- O limite mínimo de tempo (`game_duration`) para que uma partida seja salva no banco de dados do Metis subiu de `190` segundos (3m10s) para `900` segundos (15m00s).

### Por que essa alteração foi feita
- Antigamente o script descartava puramente partidas identificadas matematicamente como Remake/Drop de Servidor. 
- A nova regra de negócio visa limpar ainda mais o pipeline do Supabase, descartando qualquer partida "curta demais" (inferior a 15 minutos), já que partidas ranqueadas competitivas que acabam em menos tempo que isso geralmente sofrem de distorções severas de métricas de KDA/Visão (ex: open mid, griefing explícito).

### Lógica de negócio por trás
- Alimentar o banco (e consequentemente o agente de IA e os painéis de análise tática) exclusivamente com amostras onde o jogador experimentou uma verdadeira fase de rotas ou um jogo normal. Dados de partidas relâmpago costumam envenenar a média histórica de desempenho.
