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
- **Camada Prata/Ouro (Data Warehouse)**: Dados processados e limpos no **Supabase (PostgreSQL)**.
- **Busca Semântica (RAG)**: Vetores estratégicos e guias armazenados no **Pinecone**.

---
*Esta arquitetura garante soberania, baixo custo e alta precisão nas respostas da Metis.*
