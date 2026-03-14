---
aliases: [Arquitetura, Arquitetura do Sistema, Arquitetura Metis, Stack]
---
A **Arquitetura** do projeto Metis foi desenhada para ser um ecossistema completo de ponta a ponta, unindo Engenharia de Dados robusta com Inteligência Artificial. Ela utiliza o padrão [[Arquitetura Medalhão]] para garantir que os dados fluam da fonte original até o usuário final com segurança, rapidez e baixíssimo custo.

O sistema é dividido em quatro grandes pilares funcionais:

## 1. Ingestão e Coleta (O Motor de Busca)
Nossa esteira de extração de dados roda de forma autônoma e invisível.

* **Dados Oficiais:** Usamos scripts em Python com a biblioteca RiotWatcher para consumir a API da Riot Games, gerenciando cuidadosamente o [[Rate Limit]] e rastreando o [[PUUID]] imutável de jogadores profissionais.
* **Conhecimento Tático:** Utilizamos o [[Playwright]] rodando em modo [[Headless]] para varrer sites restritos (como Mobafire e Lolpedia). O robô simula interações humanas (como o scroll para forçar o [[Lazy Loading]]) para extrair guias de forma resiliente.
* **Orquestração:** Todo o agendamento cronometrado é executado gratuitamente nos servidores em nuvem do GitHub Actions.

## 2. Armazenamento (O Data Lakehouse)
Aqui separamos a sujeira do ouro, aplicando a [[Arquitetura Medalhão]]:

* **[[Arquitetura Medalhão|Camada Bronze]]:** Onde os scripts de ingestão despejam os arquivos brutos (JSONs intocados da Riot e HTMLs do Mobafire). Utilizamos o Cloudflare R2 devido à isenção de taxas de saída de dados (egress fee).
* **[[Arquitetura Medalhão|Camada Prata]]:** Scripts de ETL abrem os arquivos da Bronze, filtram o "lixo" (partidas de 3 minutos, jogadores AFK, remakes) e salvam os dados em tabelas relacionais altamente estruturadas no nosso banco Supabase (PostgreSQL).
* **[[Arquitetura Medalhão|Camada Ouro]]:** A vitrine do projeto. É dividida em Ouro Relacional (onde salvamos agregações e estatísticas pré-calculadas) e Ouro Vetorial (onde os dados textuais ficam prontos para a IA).

## 3. Inteligência Artificial (O Cérebro)
O diferencial do Metis não é apenas coletar dados, mas saber interpretá-los sob demanda.

* O sistema utiliza a arquitetura de [[RAG]] para cruzar o conhecimento de especialistas com o raciocínio da IA, impedindo qualquer chance de [[Alucinação]] do modelo.
* Os guias textuais são convertidos em um [[Embedding]] e armazenados usando a extensão pgvector (nativa do nosso Supabase).
* Através de uma [[Busca Semântica]], nosso fluxo guiado (orquestrado via Langflow) encontra os trechos exatos de texto que respondem à pergunta do usuário e os injeta como contexto para o modelo Llama 3 formular a resposta perfeita.

## 4. Aplicação Web (A Fronteira)
A interface onde o jogador final interage com o nosso estrategista:

* **Backend:** Uma API construída em FastAPI (hospedada no Railway). É o maestro que recebe as requisições do front, gerencia o cache e se comunica de forma assíncrona com o Supabase e com o motor RAG.
* **Frontend:** Aplicação moderna construída em Next.js (hospedada na Vercel). Garante uma interface reativa, segura e que gerencia o login do usuário em total sincronia com o Supabase Auth.