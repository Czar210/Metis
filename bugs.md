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
- **Solução:** O erro `raise HTTPException(500)` foi trocado por um aviso não-bloqueante (`print("Waviso...")`), permitindo a busca sem upload.
