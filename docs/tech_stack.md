# 🛠️ Metis Tech Stack

A stack de tecnologia da Metis foi projetada como um ecossistema híbrido e escalável, unindo o que há de mais moderno em engenharia de dados e inteligência artificial.

## 🎨 Front-end
- **Next.js + Tailwind CSS**: Entrega uma interface de alta performance e dashboard responsivo.
- **Hospedagem**: Vercel para deploy contínuo e baixa latência.

## 🧠 Back-end & Inteligência Artificial
- **FastAPI (Python)**: Maestro do sistema.
- **LangChain**: Orquestração entre fontes de dados e LLM.
- **LLM**: Llama 3 rodando localmente via **Ollama**.
- **Segurança**: **Cloudflare Tunnels** para exposição segura do modelo local para a nuvem.
- **Hospedagem**: Railway (Conteinerizado com Docker).

## 📊 Engenharia de Dados (Arquitetura Medalhão)
- **Camada Bronze (Data Lake)**: Dados brutos da API da Riot Games capturados via **GitHub Actions** e armazenados no **Cloudflare R2**.
- **Camada Prata/Ouro (Data Warehouse & Busca Semântica)**: Dados estruturados, limpos e conhecimento estratégico vetorizado no **Supabase Puro (PostgreSQL + pgvector)**, garantindo atomicidade total e RLS (Row Level Security).
- **RAG e Inteligência**: Orquestração via **OpenRAG** interagindo diretamente com os índices vetoriais do Supabase.

---
*Esta arquitetura garante soberania, segurança RLS nativa, isolamento e alta precisão nas respostas da Metis.*
