# Como funciona o Fetch Guides

Explicação técnica do pipeline de `fetch_guides.py` e seus componentes.

---

## Visão Geral

O `fetch_guides.py` é responsável por coletar guias de campeões do Mobafire usando Playwright em modo headless. O Mobafire renderiza seu conteúdo via JavaScript, o que inviabiliza soluções simples como `requests` + `BeautifulSoup` — daí a escolha do Playwright (ver [[ADR-001 Playwright e os Guias]]).

O pipeline segue o fluxo:

```
URLs de guias → Playwright (headless) → Extração HTML → Normalização → Salvo em data/bronze/
```

---

## Entradas

- Uma lista de URLs de guias do Mobafire (ex: `https://www.mobafire.com/league-of-legends/champion/jinx-guide`)
- Opcionalmente, um arquivo `guias.json` ou `guias.csv` com URLs pré-coletadas por campeão

As URLs podem ser passadas diretamente no script ou carregadas de um arquivo de configuração. A recomendação é manter uma lista versionada em `data/config/guias_urls.json` para rastreabilidade.

---

## O que o Playwright faz aqui

O Playwright abre uma instância de Chromium headless e navega até cada URL. Ele espera o conteúdo dinâmico carregar (JavaScript executado) antes de capturar o HTML da página. Isso é fundamental porque o Mobafire usa lazy loading — partes do guia (builds, runas, comentários) só aparecem após eventos do DOM.

Pontos críticos da execução:
- `page.wait_for_selector()` garante que o conteúdo principal foi renderizado antes do scraping
- `page.evaluate()` pode ser usado para extrair dados diretamente do estado do JavaScript da página
- Screenshots opcionais para debug quando o conteúdo esperado não aparece

---

## Extração

Após a renderização, o script extrai os seguintes blocos de cada guia:

| Campo | Seletor / Origem | Descrição |
|---|---|---|
| `champion_name` | título da página | Nome do campeão |
| `guide_title` | `h1.guide-title` | Título do guia |
| `author` | `.guide-author` | Autor do guia |
| `rating` | `.guide-rating` | Avaliação da comunidade |
| `rune_page` | `.rune-page-block` | Runas primárias e secundárias |
| `item_build` | `.item-block` | Build de itens (core + situacionais) |
| `summoner_spells` | `.summoner-spell` | Feitiços de invocador |
| `skill_order` | `.skill-order-block` | Ordem de evolução de habilidades |
| `matchups` | `.matchup-section` | Vantagens e desvantagens por inimigo |
| `guide_text` | `.chapter-content` | Texto descritivo da estratégia |

---

## Normalização

Após a extração bruta, os dados passam por uma etapa de limpeza antes de serem salvos:

- Remoção de tags HTML residuais (`<br>`, `<span>`, etc.)
- Normalização de unicode (emojis, caracteres especiais)
- Padronização de nomes de campeões e itens (lower case + slug)
- Remoção de blocos de anúncio e elementos de UI que vazaram na extração

---

## Salvamento (Camada Bronze)

Os dados extraídos são salvos em `data/bronze/guides/` no formato JSON linha a linha (JSONL), um arquivo por campeão:

```
data/
└── bronze/
    └── guides/
        ├── jinx.jsonl
        ├── yasuo.jsonl
        └── ...
```

Cada linha do JSONL representa um guia completo com todos os campos extraídos + metadados de coleta (`scraped_at`, `source_url`, `playwright_version`).

---

## Execução via GitHub Actions

O script é orquestrado pelo GitHub Actions com um cron job semanal. Isso garante que os guias se mantenham atualizados sem necessidade de execução manual. O workflow define:

- Ambiente: Ubuntu + Python + Playwright (Chromium)
- Artefatos de saída: novos arquivos JSONL commitados ou enviados ao bucket S3/Supabase Storage
- Notificação em caso de falha

---

## Conceitos Relacionados

- [[Headless]] — por que o Playwright opera sem interface gráfica
- [[Lazy Loading]] — por que o `requests` simples não funciona aqui
- [[ADR-001 Playwright e os Guias]] — decisão arquitetural que justifica essa escolha
- [[Arquitetura Medalhão]] — onde a camada Bronze se encaixa no pipeline maior
- [[Tratamento de Erros e Cloudflare]] — o que fazer quando o scraping falha
