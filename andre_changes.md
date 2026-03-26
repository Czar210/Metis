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
