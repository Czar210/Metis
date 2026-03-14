## 1. Contexto

A principal fonte de conhecimento tático para o sistema de IA (RAG) do projeto Metis são os guias de campeões da plataforma Mobafire. Precisamos de uma ferramenta automatizada capaz de acessar essas páginas, aguardar o carregamento de elementos dinâmicos (Lazy Loading) e extrair o HTML para a nossa Camada Bronze no Cloudflare R2.

_Nota Ética/Legal:_ O web scraping desses guias é realizado estritamente para fins acadêmicos e educacionais (projeto de faculdade), sem fins lucrativos ou comerciais, justificando o consumo e armazenamento automatizado destes dados de terceiros.

## 2. Decisão

Optamos por utilizar o **Playwright** (implementação em Python) como nossa engine oficial de navegação e extração web.

## 3. Motivação

A escolha do Playwright em detrimento de bibliotecas mais antigas (como Selenium) ou puramente HTTP (como Requests) baseou-se nos seguintes pontos:

- **Familiaridade da Equipe:** Domínio prévio com a ferramenta, o que zera a curva de aprendizado e acelera drasticamente o tempo de desenvolvimento dos scripts.
    
- **Modernidade e Resiliência:** Lida nativamente com páginas modernas construídas em React/Vue, garantindo o carregamento completo do DOM antes da extração.
    
- **Execução Headless:** Possui suporte robusto para rodar navegadores de forma invisível, o que é um pré-requisito obrigatório para executar nossa rotina na esteira de CI/CD (GitHub Actions) sem depender de uma interface gráfica.
    

## 4. Consequências

- **Positivas:** Desenvolvimento ágil, alta taxa de sucesso na captura de dados complexos e integração transparente com ambientes de nuvem.
    
- **Negativas:** O ambiente de execução fica ligeiramente mais pesado, exigindo a instalação dos binários do Chromium (`playwright install chromium`) tanto no setup local dos desenvolvedores quanto nas instâncias do GitHub Actions.
