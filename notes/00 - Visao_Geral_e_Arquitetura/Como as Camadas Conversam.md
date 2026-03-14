
Este documento descreve em alto nível o fluxo de dados e requisições entre a interface do usuário, a API, o banco de dados e o modelo de Inteligência Artificial do **Metis**. A arquitetura baseia-se no padrão de **[[RAG]]**.

## O Fluxo Principal de Resposta (Chat [[RAG]])

Quando o usuário faz uma pergunta complexa no chat (ex: _"Como jogar de Lee Sin contra Elise no patch atual?"_), a comunicação segue esta trilha:

1. **Frontend (Vercel / Next.js):**
    
    - O usuário digita a pergunta na interface.
    - O Next.js empacota essa requisição (payload JSON) e envia um `HTTP POST` para o nosso backend.
    
2. **API Backend (Railway / FastAPI):**
    
    - O FastAPI recebe a requisição, valida o token de segurança do usuário e atua como o **Orquestrador** central.
    - Ele identifica que é uma requisição de IA e repassa a pergunta para o nosso motor de raciocínio (Langflow / OpenRAG).
    
3. **Vetorização e Busca de Contexto (Supabase pgvector):**
    
    - O Langflow converte a pergunta do usuário em um vetor matemático (Embedding).
    - Ele conecta-se à **Camada Ouro** no Supabase e faz uma busca híbrida:
    - _Busca Relacional (SQL):_ Filtra apenas vetores que pertençam à tag "Lee Sin".
    - _Busca Semântica (pgvector):_ Encontra os parágrafos do Mobafire (raspados pelos nossos scripts) que tenham maior similaridade matemática com a palavra "Elise" e "matchup".
	    - O Supabase devolve os textos brutos das dicas para o backend.
    
4. **Geração de Resposta (Llama 3 via Ollama):**
    
    - O backend junta a Pergunta do Usuário + As Dicas do Supabase em um único "Mega Prompt".
    - Esse prompt é enviado ao LLM (Llama 3).
    - O Llama 3 lê as dicas, formula uma resposta inteligente com a persona da Metis e devolve para o FastAPI.
    
5. **Retorno ao Usuário:**
    
    - O FastAPI envia a resposta (via Server-Sent Events/Streaming ou requisição normal) de volta para o Next.js, que renderiza a mensagem na tela em tempo real.


---

## Autenticação, Filas e Cache

Para garantir performance e segurança em produção, as camadas utilizam os seguintes mecanismos de suporte:

- **Autenticação (Supabase Auth):**
    
    - O Next.js gerencia o login do usuário. Quando o front faz um pedido ao FastAPI, ele envia um **JWT (JSON Web Token)** no cabeçalho `Authorization: Bearer <token>`.
    - O FastAPI intercepta, valida a assinatura do token com o Supabase e autoriza a rota.
    
- **Cache Estratégico (Redis / In-Memory):**
    
    - Requisições para a **Camada Ouro Relacional** (ex: _"Qual o winrate global do Lee Sin?"_) mudam pouco durante o dia.
    - O FastAPI armazena essa resposta em Cache por X horas. Se outro usuário fizer a mesma pergunta, o backend responde instantaneamente sem bater no Supabase, economizando recursos e acelerando a UI.
    
- **Filas (Background Tasks):**
    
    - A execução dos scripts pesados (Scraping de Guias, ETL da Riot) **não** é feita no fluxo do usuário para não travar a requisição (Timeout).
    - Esses processos rodam via **GitHub Actions** (CRON Jobs) de forma totalmente assíncrona, apenas "injetando" os dados novos no Supabase e no Cloudflare R2 por debaixo dos panos.

TODO: detalhar endpoints, formatos de payload e exemplos.
