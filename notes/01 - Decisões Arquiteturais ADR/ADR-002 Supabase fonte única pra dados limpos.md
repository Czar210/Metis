## 1. Contexto

O projeto Metis necessita de uma infraestrutura de dados robusta capaz de suportar três frentes distintas:

1. Armazenamento de dados estruturados e tabulares das partidas de League of Legends (Camada Prata).
2. Armazenamento de embeddings matemáticos dos guias de campeões para busca semântica da IA (Camada Ouro Vetorial).
3. Sistema de autenticação de usuários para o Frontend (Next.js).

Uma abordagem tradicional na nuvem exigiria a contratação e orquestração de múltiplos serviços separados (ex: AWS RDS para SQL, Auth0 para Autenticação e Pinecone/Milvus para banco vetorial), o que aumentaria drasticamente a complexidade da arquitetura, a latência de rede entre serviços e, principalmente, os custos financeiros.

## 2. Decisão

Optamos por utilizar o **Supabase** (um ecossistema open-source baseado em PostgreSQL) como nossa plataforma central de banco de dados e autenticação, ativando a extensão **`pgvector`** para o armazenamento de vetores da IA.

## 3. Motivação

A escolha do Supabase resolve simultaneamente todos os nossos gargalos arquiteturais e financeiros:

- **Unificação Relacional e Vetorial:** O Postgres lida perfeitamente com os dados das partidas. Ao ativar o `pgvector`, o mesmo banco ganha a habilidade de armazenar embeddings. Isso permite buscas híbridas poderosas em uma única query SQL (ex: buscar um guia vetorial restringindo exatamente pelo nome do campeão na coluna relacional).

- **Custo Zero para o Projeto:** Sendo um trabalho acadêmico, o controle de custos é vital. O "Free Tier" do Supabase atende perfeitamente à volumetria atual do Metis (500MB de banco de dados e 50.000 MAU na autenticação), eliminando a necessidade de pagar instâncias caras em provedores tradicionais ou ferramentas de IA especializadas como o Pinecone.

- **Ecossistema "Pronto para Uso":** O Supabase fornece APIs auto-geradas (PostgREST) e um módulo de Autenticação integrado. Isso poupa semanas de desenvolvimento no backend, permitindo que a equipe foque na inteligência do RAG e nos scripts de engenharia de dados.

## 4. Consequências

- **Positivas:** Redução massiva da complexidade da stack. Menos chaves de API para gerenciar, zero custo inicial, e garantia de consistência de dados (ACID) tanto para as partidas quanto para os vetores.

- **Negativas:** Menor controle sobre a infraestrutura fina do banco. Além disso, existe o risco de _Vendor Lock-in_ com as bibliotecas de autenticação do Supabase. Em um cenário futuro de hiperescala comercial, os custos de storage e processamento vetorial podem exigir um planejamento de migração ou upgrade de plano.
