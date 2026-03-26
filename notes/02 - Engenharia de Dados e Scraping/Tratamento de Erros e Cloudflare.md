# Tratamento de Erros e Cloudflare

Boas práticas para lidar com bloqueios, CAPTCHAs, rate-limits e falhas de scraping no Metis.

---

## Por que isso é um problema?

O Mobafire usa Cloudflare como CDN e proteção contra bots. O Cloudflare detecta padrões de acesso automatizado e pode:

1. **Servir um desafio JS** (challenge page) — a página retorna um HTML de verificação ao invés do conteúdo real
2. **Apresentar um CAPTCHA** (raro, mas possível em acessos suspeitos)
3. **Bloquear o IP temporariamente** via rate-limit (HTTP 429) ou ban (HTTP 403)
4. **Fingerprinting do browser** — detectar que o Chromium não tem extensões, fontes ou comportamento humano

O Playwright reduz parte desse risco por executar um browser real com JavaScript, mas não é invulnerável — especialmente quando rodando em IPs de datacenter (GitHub Actions, Railway).

---

## Estratégias Implementadas no Metis

### 1. Delays Humanizados
Em vez de fazer requests sequenciais imediatos, o script insere delays aleatórios entre requisições:

```python
import random, asyncio

async def humano_delay():
    await asyncio.sleep(random.uniform(2.5, 6.0))  # entre 2.5 e 6 segundos
```

Delays muito curtos (< 1s) são a principal causa de bloqueio por rate-limit. O padrão humano tem variância — delays constantes também levantam suspeita.

### 2. Rotação de User-Agent
O Playwright é configurado com user-agents realistas de browsers comuns:

```python
user_agents = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
    # ...
]
browser = await playwright.chromium.launch()
context = await browser.new_context(user_agent=random.choice(user_agents))
```

### 3. Retry com Backoff Exponencial
Falhas transitórias (timeout, 503, challenge page) são tratadas com retry automático:

```python
async def fetch_with_retry(url, max_retries=3):
    for attempt in range(max_retries):
        try:
            response = await page.goto(url)
            if response.status == 200:
                return await page.content()
        except Exception:
            pass
        wait = 2 ** attempt + random.uniform(0, 1)  # 1s, 2s, 4s + jitter
        await asyncio.sleep(wait)
    raise ScrapingException(f"Falhou após {max_retries} tentativas: {url}")
```

O **jitter** (aleatoriedade adicionada ao tempo de espera) é importante — sem ele, múltiplos workers reintentando simultaneamente criam um novo pico de requisições.

### 4. Detecção de Challenge Page
Antes de extrair o conteúdo, verificar se o Cloudflare interceptou a requisição:

```python
async def is_cloudflare_challenge(page) -> bool:
    title = await page.title()
    return "Just a moment" in title or "Checking your browser" in title
```

Se detectado, o script aguarda mais tempo, tenta recarregar ou registra a URL para retry posterior.

---

## Quando o IP de Datacenter é Bloqueado

GitHub Actions e Railway usam IPs de provedores de nuvem conhecidos, que o Cloudflare identifica facilmente. Quando os bloqueios forem sistemáticos (não transitórios), as opções são:

| Solução | Custo | Complexidade | Quando usar |
|---|---|---|---|
| **Aumentar o delay** | Gratuito | Baixa | Primeiro passo sempre |
| **Rodar em horários diferentes** (cron) | Gratuito | Baixa | Evitar pico de tráfego do Mobafire |
| **Residential Proxy** (ex: Bright Data, Oxylabs) | ~U$15–50/mês | Média | Quando IP de datacenter é sistematicamente bloqueado |
| **Serviço anti-captcha** (ex: 2captcha) | ~U$2/1000 captchas | Média | Se CAPTCHAs aparecerem com frequência |
| **Playwright Stealth Plugin** | Gratuito | Média | Reduz fingerprint do browser automatizado |

Para o escopo atual do Metis (coleta semanal), aumentar os delays e ajustar o horário do cron deve ser suficiente antes de recorrer a proxies pagos.

---

## Tratamento de Erros de Rede (não-Cloudflare)

Além do Cloudflare, outros erros comuns:

| Erro | Causa | Tratamento |
|---|---|---|
| `TimeoutError` | Página demorou mais de 30s | Retry com timeout maior (60s) |
| `net::ERR_CONNECTION_REFUSED` | Servidor fora do ar | Retry após 5 minutos |
| `HTTP 404` | Guia removido ou URL mudou | Marcar URL como inválida em `data/config/guias_urls.json` |
| `HTTP 429` | Rate-limit atingido | Parar tudo, esperar 10 minutos, reiniciar com delay maior |
| Conteúdo vazio | Lazy loading não terminou | `wait_for_selector` com timeout maior |

---

## Quarentena de URLs Problemáticas

URLs que falharam sistematicamente (após todos os retries) são movidas para uma lista de quarentena:

```
data/
└── config/
    ├── guias_urls.json        ← lista ativa
    └── guias_urls_quarantine.json  ← URLs problemáticas para revisão manual
```

Isso evita que o pipeline inteiro trave tentando reprocessar uma URL que nunca vai funcionar.

---

## Conceitos Relacionados

- [[Como funciona o Fetch Guides]] — o pipeline que usa estas estratégias
- [[Headless]] — por que o Playwright pode ser detectado como bot
- [[ADR-001 Playwright e os Guias]] — a decisão de usar Playwright no lugar de soluções mais simples
