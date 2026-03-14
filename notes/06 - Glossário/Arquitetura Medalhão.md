---
aliases: [Arquitetura Medalhão, Medallion Architecture, Camada Bronze, Camada Prata, Camada Ouro, Data Lakehouse]
---

# Arquitetura Medalhão

## O que é (Conceito Geral)
A **Arquitetura Medalhão** (ou *Medallion Architecture*) é um padrão de design de dados amplamente utilizado no mercado de Engenharia de Dados (popularizado pela Databricks). O objetivo é organizar os dados em um *Data Lakehouse* através de camadas sucessivas de qualidade e refinamento. 

Em vez de tentar limpar, transformar e analisar os dados tudo de uma vez, o fluxo é dividido em três estágios lógicos: **Bronze (Bruto)**, **Prata (Limpo)** e **Ouro (Pronto para Consumo)**.

## Como aplicamos no Metis
No nosso ecossistema, cada camada tem uma responsabilidade, uma ferramenta e um script de [[GitHub Actions]] associado:

### 🥉 Camada Bronze (Raw / Aterrissagem)
É o "lixão organizado" do projeto. Aqui, os dados são armazenados exatamente como vieram da fonte original, sem nenhuma alteração ou filtro, focando apenas em salvar o mais rápido possível e de forma barata.
* **Onde fica:** [[Cloudflare R2]] (Object Storage).
* **O que tem lá:** JSONs gigantescos e intocados da API da Riot (Partidas e Timelines) e arquivos brutos extraídos do Mobafire pelo [[Playwright]].
* **Regra de Ouro:** Os dados da Bronze **nunca** são apagados ou alterados. Se o nosso script de limpeza der erro no futuro, sempre teremos a versão original intacta para reprocessar.

### 🥈 Camada Prata (Cleaned / Padronizada)
É a camada da "Verdade". Aqui entram os scripts de ETL (Extract, Transform, Load). O dado sai da Bronze, é higienizado e ganha formato de tabela (linhas e colunas com tipagem correta).
* **Onde fica:** [[Supabase]] (Tabelas Relacionais do PostgreSQL).
* **O que tem lá:** O banco de dados estruturado das partidas.
* **O que acontece aqui:** Scripts como o `process_matches.py` removem lixos (partidas de 3 minutos, *remakes*, jogadores AFK), padronizam os nomes das colunas e garantem que a tabela reflita fielmente o histórico de League of Legends com qualidade.

### 🥇 Camada Ouro (Enriched / Serving Layer)
É a "vitrine" do projeto. Os dados aqui estão mastigados, cruzados e super otimizados para serem entregues na velocidade da luz para o usuário final ou para a Inteligência Artificial.
* **Onde fica:** [[Supabase]] (Tabelas de Agregação SQL e Banco Vetorial `pgvector`).
* **O que tem lá:** 1. **Ouro Relacional:** Tabelas resumo (Ex: *Taxa de vitória do Lee Sin no Patch 14.5*). O [[FastAPI]] do backend não precisa somar 10.000 linhas da Camada Prata, ele só lê o número pronto na Ouro.
  2. **Ouro Vetorial:** Os textos dos guias já picotados e transformados em [[Embedding|Embeddings]] matemáticos para o motor de busca do [[RAG]] alimentar o Llama 3.

## Por que essa arquitetura importa?
1. **Performance:** O Frontend e a IA só conversam com a Camada Ouro, garantindo respostas em milissegundos.
2. **Isolamento de Erros:** Se a Riot mudar a estrutura do JSON amanhã, a Camada Bronze continua salvando. Apenas o script de transformação da Prata quebra, protegendo o banco de dados de receber sujeira.
3. **Custo:** Armazenar terabytes de lixo na Bronze (R2) é quase de graça. Só pagamos processamento para os dados que realmente importam (Prata e Ouro no Supabase).