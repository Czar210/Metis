# 🐛 Bug Tracker — Metis

Registro de bugs encontrados durante o desenvolvimento. Cada entrada deve conter:
- **Data** de identificação
- **Descrição** breve do problema
- **Contexto** (onde/como ocorreu)
- **Status** (`🔴 Aberto` | `🟡 Em progresso` | `🟢 Resolvido`)

---

## Template

```
### [Título curto do bug]
- **Data:** YYYY-MM-DD
- **Status:** 🔴 Aberto
- **Onde:** arquivo/módulo afetado
- **Descrição:** O que aconteceu vs. o que era esperado.
- **Solução:** (preencher quando resolvido)
```

---

## Bugs Registrados

### [Erro 500 no endpoint /fetch-matches]
- **Data:** 2026-03-26
- **Status:** 🟢 Resolvido
- **Onde:** `backend/main.py` e `scripts/ingestion/fetch_matches.py`
- **Descrição:** A API estava gerando `AttributeError: 'bool' object has no attribute 'get'` porque a função de buscar partidas retornava `True`/`False`, mas o backend tentava ler o dicionário `resultado.get("status")`.
- **Solução:** O arquivo `fetch_matches.py` foi alterado para retornar um dicionário padronizado do tipo `{"status": "success/error", "message/error": "..."}` em vez de booleanos.

### [Hashtag na Riot API causando erro 404]
- **Data:** 2026-03-26
- **Status:** 🟢 Resolvido
- **Onde:** `scripts/ingestion/fetch_matches.py`
- **Descrição:** Se o usuário enviasse `#BR1` como string, a API batera 404 porque a Riot não aceita o caractere de sustenido na chamada `tag_line`.
- **Solução:** Adicionada verificação `if tag_line.startswith("#"): tag_line = tag_line[1:]` antes da requisição.

### [Crash por falta de credenciais do S3 (R2) em dev local]
- **Data:** 2026-03-26
- **Status:** 🟢 Resolvido
- **Onde:** `backend/main.py`
- **Descrição:** Um bloqueio rígido impediria o endpoint `fetch-matches` de rodar se o Cloudflare R2 estivesse em branco no `.env`, dando crash mesmo para debug local da Riot.
- **Solução:** O erro `raise HTTPException(500)` foi trocado por um aviso não-bloqueante via logging, permitindo a busca sem upload.

### [BUG-001] process_timelines: interface real ≠ interface do teste
- **Data:** 2026-04-02
- **Status:** 🟢 Resolvido
- **Onde:** `scripts/processing/process_timelines.py` vs `tests/test_process_timelines.py`
- **Descrição:** O teste foi escrito esperando uma interface que não foi implementada:
  1. **Função inexistente:** O teste importa `extrair_dados_timeline` que não existia — apenas `processar_timeline` estava implementada.
  2. **Assinatura incompatível:** O teste chama `processar_timeline(json, db_client=mock)` mas a função não aceitava `db_client` — usava cliente Supabase global no nível de módulo, quebrando qualquer mock.
  3. **Efeito colateral no import:** `create_client()` rodava ao importar o módulo, tentando conexão real com Supabase em ambiente de teste.
- **Solução:** Refatorado `process_timelines.py`: extraída `extrair_dados_timeline()` (parsing puro, sem I/O), `processar_timeline()` passa a aceitar `db_client=None` (injeção de dependência), e `create_client()` movido para lazy init dentro da função. 17/17 testes passando.

### [BUG-002] Windows: pasta scripts/Processing com P maiúsculo
- **Data:** 2026-04-02
- **Status:** 🟢 Resolvido
- **Onde:** `scripts/Processing/` (Windows case-insensitive)
- **Descrição:** No Windows, o diretório foi gravado como `Processing` (P maiúsculo), fazendo com que `pkgutil` encontrasse o módulo como `scripts.Processing`. Imports `from scripts.processing import ...` falhavam com `ModuleNotFoundError` apesar dos `__init__.py` presentes.
- **Solução:** Renomeado via `ren Processing processing_tmp && ren processing_tmp processing` no cmd do Windows.
