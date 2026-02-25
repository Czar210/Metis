# Estrutura de Pastas e Uso por Membro - Metis

Este documento explica o que cada pasta do repositório contém e quais membros da equipe devem atuar nelas.

---

## 📂 Visão Geral do Projeto

Abaixo, a explicação de cada nível da estrutura:

### 📁 `/backend`
**O que é:** O cérebro do projeto. Contém o servidor FastAPI, lógica de IA e modelos de dados.
- **Responsável Principal:** **Membro 3** (FastAPI/DB) e **Membro 1** (AI/RAG).
- **Subpastas:**
    - `api/`: Rotas e endpoints.
    - `core/`: Lógica central e processamento.
    - `models/`: Definição dos Schemas de banco de dados e modelos IA.

### 📁 `/frontend`
**O que é:** A interface visual do usuário. Contém o código Next.js.
- **Responsável Principal:** **Membro 2** (UX/React).
- **Subpastas:** Seguindo o App Router do Next.js (components, app, styles).

### 📁 `/data`
**O que é:** Pasta local para testes e armazenamento temporário de dados baixados da Riot API.
- **Responsável Principal:** **Membro 3** (Ingestão) e **Membro 1** (Embedding process).
- **Atenção:** Nunca commitar arquivos JSON gigantes aqui (usar `.gitignore`).

### 📁 `/scripts`
**O que é:** Scripts utilitários para tarefas automatizadas (Scrapers, Ingestão, Limpeza).
- **Responsável Principal:** **Membro 1** (Scrapers) e **Membro 3** (Data Pipelines).

### 📁 `/infra`
**O que é:** Configurações de infraestrutura (Terraform, Docker extras, configurações Cloudflare).
- **Responsável Principal:** **Membro 3** (CloudOps).

### 📁 `/docs`
**O que é:** Toda a documentação técnica, arquitetura, rastreamento de tarefas e manuais.
- **Responsável Principal:** **Todos os Membros**.

### 📁 `/tests`
**O que é:** Testes unitários e de integração para garantir que nada quebre.
- **Responsável Principal:** **Todos os Membros**.

---

## 🛠️ Quem usa o quê? (Matriz de Responsabilidade)

| Pasta | Membro 1 (IA) | Membro 2 (UX) | Membro 3 (Data) |
| :--- | :---: | :---: | :---: |
| `/backend` | ⭐ (AI/RAG) | 📞 (Consumo) | ⭐ (Core/DB) |
| `/frontend` | ❌ | ⭐ | ❌ |
| `/data` | 🛠️ (Embeddings) | ❌ | 🛠️ (Ingestão) |
| `/scripts` | ⭐ (Scrapers) | ❌ | ⭐ (Pipelines) |
| `/infra` | ❌ | ❌ | ⭐ |
| `/docs` | ✍️ | ✍️ | ✍️ |
| `/tests` | ✅ | ✅ | ✅ |

**Legenda:**
- ⭐ **Responsável Principal**: Dono da lógica da pasta.
- 🛠️ **Uso Técnico**: Usa a pasta para processos e execução.
- 📞 **Consumo**: Apenas lê ou chama os dados desta pasta.
- ✍️ **Documentação**: Todos devem manter atualizado.
- ✅ **Qualidade**: Todos devem criar testes para suas próprias entregas.
- ❌ **Evitar**: Não costuma atuar nessa área para evitar conflitos.
