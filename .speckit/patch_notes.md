# Metis - Patch Notes

*Diário de mudanças significativas no ecossistema e na stack do projeto.*

## v0.2.0 - Revisão das mudanças do André + Correção de Testabilidade (2026-04-02)
- Revisão e aprovação das mudanças do André (CORS, health check, ChatRequest, bugs.md)
- Escrita de 15 testes funcionais cobrindo todas as mudanças (`tests/test_api_andre_changes.py`)
- BUG-001 resolvido: `process_timelines.py` refatorado com injeção de dependência (`db_client`), função `extrair_dados_timeline()` extraída (parsing puro) e lazy init do Supabase
- BUG-002 resolvido: pasta `scripts/Processing` renomeada para `processing` (case fix Windows)
- Adicionados `__init__.py` em todos os pacotes de `scripts/`
- Configurado `[tool.pytest.ini_options]` no `pyproject.toml` (pythonpath + testpaths)
- Total: 17/17 testes passando

## v0.1.0 - Saneamento e Pivot Estrutural
- Pivot oficializado: Abandono do Pinecone em favor do `Supabase (PostgreSQL + pgvector)`
- Introdução do orquestrador `OpenRAG`.
- Implementação inicial da pasta `.speckit` para centralização de estado do AI Context Director.
- Remoção de trackers de tarefas genéricos em favor de Milestones atômicos (`plano_atual.md`).
