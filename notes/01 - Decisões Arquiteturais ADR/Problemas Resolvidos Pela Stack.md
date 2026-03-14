# Mapeamento de Problemas e Soluções (A Stack do Metis)

Este documento detalha os principais desafios técnicos enfrentados na construção da arquitetura de dados e IA do projeto **Metis** e como cada ferramenta da nossa Stack foi escolhida para resolvê-los.

## 1. Coleta e Extração de Dados (Ingestão)

- **Problema 0: Consumir a API oficial da Riot de forma eficiente.**
    
    - _Solução:_ **Python + RiotWatcher.** O uso da linguagem Python aliada a uma biblioteca wrapper oficial agilizou o tratamento de rate limits e a paginação, dispensando a necessidade de escrever chamadas HTTP cruas e tratamento de headers na mão.
        
- **Problema 2: Obter dados táticos em texto para vetorizar (Base de Conhecimento).**
    
    - _Solução:_ **Playwright (no Mobafire).** Como a plataforma não possui API e [[ADR-001 Playwright e os Guias|bloqueia scrapers simples (Cloudflare), checar ADR 01 pra mais infos]], o Playwright rodando um navegador real (Headless) permitiu contornar bloqueios, rolar a página para ativar o _lazy loading_ e extrair os guias com alta fidelidade.
        
- **Problema 3: Mapear contas secretas (smurfs) de Pro Players.**
    
    - _Solução:_ **Playwright (na Lolpedia).** Automação para varrer a wiki de e-sports, extraindo e atualizando os PUUIDs das contas reais dos jogadores profissionais de forma automatizada.
        

## 2. Orquestração e Data Lake (Camada Bronze)

- **Problema 0.5: Processamento contínuo a longo prazo sem servidores caros.**
    
    - _Solução:_ **GitHub Actions.** Utilização de rotinas cronometradas (CRON) nativas e gratuitas do GitHub para rodar os scripts pesados de coleta e processamento, criando um pipeline de ETL sem o custo de instâncias EC2 ou servidores dedicados 24/7.
        
- **Problema 1: Armazenamento barato para o volume massivo de dados brutos.**
    
    - _Solução:_ **Cloudflare R2.** Um _Object Storage_ compatível com S3, mas com taxa zero de saída de dados (egress fee). Perfeito para armazenar gigabytes de JSONs crus das partidas e HTMLs de guias sem estourar o orçamento.
        

## 3. Data Warehouse (Camada Prata)

- **Problema 4: Banco de dados relacional online e gratuito para os dados limpos.**
    
    - _Solução:_ **Supabase (PostgreSQL).** Solução de banco de dados na nuvem que oferece excelente tier gratuito, APIs prontas e painel de controle fácil para abrigar a "Camada Prata", onde salvamos as partidas validadas e prontas para análise matemática.
        

## 4. Inteligência Artificial e Vetores (Camada Ouro)

- **Problema 5: Como orquestrar e criar os embeddings matemáticos?**
    
    - _Solução:_ **OpenRAG / Langflow (Local → Actions).** Atualmente rodando localmente pela facilidade visual de orquestração do LLM. O roadmap inclui a automação desse processo via GitHub Actions, conectando o fluxo de RAG de forma autônoma.
        
- **Problema 6: Onde e como armazenar os vetores (Embeddings) sem pagar caro?**
    
    - _Solução:_ **Supabase (pgvector).** Eliminação da necessidade de um banco vetorial externo (como o Pinecone). O `pgvector` permite armazenar os embeddings na mesma infraestrutura relacional das partidas, possibilitando buscas híbridas poderosas.
        

## 5. Aplicação Web e APIs

- **Problema 7: Criar a interface de usuário (Frontend) e mantê-la online.**
    
    - _Solução:_ **Next.js + Vercel.** Framework moderno focado na experiência do usuário e otimização. A Vercel cuida do deploy contínuo (CD) com zero configuração. (A arquitetura é desacoplada, permitindo troca futura do host se necessário).
        
- **Problema 8: API rápida para o Chat da IA e consultas utilitárias ao banco.**
    
    - _Solução:_ **FastAPI + Railway.** O FastAPI garante rotas assíncronas e documentação automática (Swagger) com altíssima performance em Python. O Railway atua como o motor de hospedagem da aplicação backend, garantindo que o orquestrador do Metis esteja sempre disponível.
