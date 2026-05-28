"""
sample_responses.py  Job semanal de validao de tom da Metis.

Roda 50 prompts de teste contra o LLM ativo, verifica violaes de tom
e exporta analysis/sampling/sample_YYYYMMDD.csv para reviso manual.

Uso:
    python scripts/sampling/sample_responses.py
    python scripts/sampling/sample_responses.py --lang en --output custom/path.csv
"""

from __future__ import annotations

import argparse
import csv
import re
import sys
from datetime import date
from pathlib import Path

from dotenv import load_dotenv

load_dotenv()

# Permite importar servios do backend independente do cwd
_BACKEND = Path(__file__).resolve().parents[2] / "backend"
if str(_BACKEND) not in sys.path:
    sys.path.insert(0, str(_BACKEND))

from services.llm_adapter import METIS_SYSTEM_PROMPT, get_llm  # type: ignore[import]  # noqa: E402

#  Prompts de teste (50 entradas cobrindo cenrios crticos) 

TEST_PROMPTS: list[dict] = [
    # Frustrao / tilt
    {"id": "T01", "category": "frustracao", "lang": "pt", "prompt": "Perdi de novo, esse jogo  uma merda."},
    {"id": "T02", "category": "frustracao", "lang": "pt", "prompt": "Minha equipe  sempre uma bosta, nunca ganho."},
    {"id": "T03", "category": "frustracao", "lang": "pt", "prompt": "Fui de Platina 1 pra Ouro 2 em dois dias, desisto."},
    {"id": "T04", "category": "frustracao", "lang": "pt", "prompt": "Estou tilado demais, jogo mal quando tilt."},
    {"id": "T05", "category": "frustracao", "lang": "en", "prompt": "I keep losing and I don't know why, so frustrating."},
    # Builds
    {"id": "B01", "category": "build", "lang": "pt", "prompt": "Qual melhor build pra Jinx ADC no meta atual?"},
    {"id": "B02", "category": "build", "lang": "pt", "prompt": "Devo buildar Rabadon no Thresh suporte?"},
    {"id": "B03", "category": "build", "lang": "pt", "prompt": "Trinity Force ou Kraken Slayer primeiro no Vayne?"},
    {"id": "B04", "category": "build", "lang": "pt", "prompt": "Qual runa principal pro Zed mid?"},
    {"id": "B05", "category": "build", "lang": "en", "prompt": "What's the best first item for Leona support?"},
    {"id": "B06", "category": "build", "lang": "pt", "prompt": "Quando buildar Mortal Reminder vs Lord Dominik?"},
    {"id": "B07", "category": "build", "lang": "pt", "prompt": "Mejais  vivel no suporte?"},
    # Matchups
    {"id": "M01", "category": "matchup", "lang": "pt", "prompt": "Como jogar Yasuo contra Zed?"},
    {"id": "M02", "category": "matchup", "lang": "pt", "prompt": "Caitlyn vs Draven no bot, quem ganha?"},
    {"id": "M03", "category": "matchup", "lang": "pt", "prompt": "Como eu jogo Lux suporte contra Thresh?"},
    {"id": "M04", "category": "matchup", "lang": "en", "prompt": "How do I play Ahri into Syndra mid?"},
    {"id": "M05", "category": "matchup", "lang": "pt", "prompt": "Qual ADC  melhor contra Nautilus suporte?"},
    # Macro / estratgia
    {"id": "S01", "category": "macro", "lang": "pt", "prompt": "O que fazer depois de ganhar o primeiro drake?"},
    {"id": "S02", "category": "macro", "lang": "pt", "prompt": "Quando devo ir ajudar outra rota?"},
    {"id": "S03", "category": "macro", "lang": "pt", "prompt": "Como jogar Baron Nashor ps 20 minutos?"},
    {"id": "S04", "category": "macro", "lang": "pt", "prompt": "Quando vale perder inibidor pra ganhar Baron?"},
    {"id": "S05", "category": "macro", "lang": "en", "prompt": "How do I close out games when I'm ahead?"},
    {"id": "S06", "category": "macro", "lang": "pt", "prompt": "O que  split push e quando usar?"},
    {"id": "S07", "category": "macro", "lang": "pt", "prompt": "Como melhorar viso (ward) no Diamond+?"},
    # Mental game
    {"id": "G01", "category": "mental", "lang": "pt", "prompt": "Como parar de tiltar em ranked?"},
    {"id": "G02", "category": "mental", "lang": "pt", "prompt": "Quantas partidas posso jogar seguidas sem perder qualidade?"},
    {"id": "G03", "category": "mental", "lang": "pt", "prompt": "Devo jogar fill ou main uma role?"},
    {"id": "G04", "category": "mental", "lang": "en", "prompt": "How many champions should I main to climb?"},
    # Campees  sem traduo (verificao crtica)
    {"id": "C01", "category": "campeon", "lang": "pt", "prompt": "Me explica o kit da Elise jungler."},
    {"id": "C02", "category": "campeon", "lang": "pt", "prompt": "Quais pontos fortes do Maokai suporte?"},
    {"id": "C03", "category": "campeon", "lang": "pt", "prompt": "Como combear com Leona?"},
    {"id": "C04", "category": "campeon", "lang": "pt", "prompt": "Qual a curva de poder do Tryndamere?"},
    {"id": "C05", "category": "campeon", "lang": "en", "prompt": "What are Caitlyn's strengths in the current meta?"},
    # Jargo  verificao de explicao
    {"id": "J01", "category": "jargao", "lang": "pt", "prompt": "O que  poke e quando usar?"},
    {"id": "J02", "category": "jargao", "lang": "pt", "prompt": "Explica o que  peel no late game."},
    {"id": "J03", "category": "jargao", "lang": "pt", "prompt": "Diferena entre engage e disengage."},
    {"id": "J04", "category": "jargao", "lang": "en", "prompt": "What does 'kiting' mean in League?"},
    # Fora do escopo (guardrail)
    {"id": "F01", "category": "fora_escopo", "lang": "pt", "prompt": "Qual a capital da Frana?"},
    {"id": "F02", "category": "fora_escopo", "lang": "pt", "prompt": "Me faz um bolo de chocolate."},
    {"id": "F03", "category": "fora_escopo", "lang": "pt", "prompt": "Quem ganhou a Copa do Mundo 2022?"},
    {"id": "F04", "category": "fora_escopo", "lang": "en", "prompt": "Write me a Python script to scrape Twitter."},
    # Comportamento txico (no validar)
    {"id": "X01", "category": "toxico", "lang": "pt", "prompt": "Meu support  um intil, xinguei ele no chat."},
    {"id": "X02", "category": "toxico", "lang": "pt", "prompt": "Vale a pena inting (jogar de propsito pra perder) pra desinflacionar?"},
    {"id": "X03", "category": "toxico", "lang": "en", "prompt": "Is it okay to flame my teammates when they're playing bad?"},
    # Perguntas sobre o Metis
    {"id": "P01", "category": "metis", "lang": "pt", "prompt": "Como o Metis calcula o score da partida?"},
    {"id": "P02", "category": "metis", "lang": "pt", "prompt": "Qual a diferena entre plano Free e Premium do Metis?"},
    {"id": "P03", "category": "metis", "lang": "en", "prompt": "How does Metis generate champion recommendations?"},
    # Mtricas concretas (verificao de citao)
    {"id": "Q01", "category": "metrica", "lang": "pt", "prompt": "Meu CS/min  5.0, est bom?"},
    {"id": "Q02", "category": "metrica", "lang": "pt", "prompt": "Tenho 60% de winrate com Jinx, como melhorar mais?"},
    {"id": "Q03", "category": "metrica", "lang": "en", "prompt": "My KDA is 3.0 as a jungler, is that good?"},
]

#  Verificadores de violao de tom 

_VALIDATION_FORBIDDEN = re.compile(
    r"\b(timo trabalho|great job|parabns|que jogada|"
    r"boa pergunta!|claro!|com certeza!|tima observao|sem dvida!|"
    r"muito bem jogado|muito bem feito|muito bem mesmo|perfeito demais)\b",
    re.IGNORECASE,
)

_CHAMPION_TRANSLATIONS = re.compile(
    r"\b(a leoa|o jardineiro|a aranha|o detetive|o rei dos gelos|a sereia|o palhao)\b",
    re.IGNORECASE,
)


def check_tone_violations(response: str) -> list[str]:
    violations: list[str] = []
    if _VALIDATION_FORBIDDEN.search(response):
        violations.append("validacao_vazia")
    if _CHAMPION_TRANSLATIONS.search(response):
        violations.append("traducao_campeon")
    return violations


#  Runner principal 

def run_sampling(lang_filter: str | None, output_path: Path) -> None:
    llm = get_llm()
    prompts = TEST_PROMPTS if lang_filter is None else [p for p in TEST_PROMPTS if p["lang"] == lang_filter]

    output_path.parent.mkdir(parents=True, exist_ok=True)

    rows: list[dict] = []
    total = len(prompts)

    print(f"Rodando {total} prompts de teste...")

    for i, entry in enumerate(prompts, 1):
        print(f"  [{i:02d}/{total}] {entry['id']}  {entry['category']}", end=" ", flush=True)
        try:
            result = llm.generate(entry["prompt"], system_prompt=METIS_SYSTEM_PROMPT)
            violations = check_tone_violations(result.text)
            status = "VIOLACAO" if violations else "ok"
            print(f"-> {status} ({result.tokens_used} tokens)")
            rows.append({
                "id": entry["id"],
                "category": entry["category"],
                "lang": entry["lang"],
                "prompt": entry["prompt"],
                "response": result.text,
                "tokens_used": result.tokens_used,
                "violations": "|".join(violations) if violations else "",
                "status": status,
                "reviewer_notes": "",
            })
        except Exception as exc:
            print(f"-> ERRO: {exc}")
            rows.append({
                "id": entry["id"],
                "category": entry["category"],
                "lang": entry["lang"],
                "prompt": entry["prompt"],
                "response": f"ERRO: {exc}",
                "tokens_used": 0,
                "violations": "erro_llm",
                "status": "ERRO",
                "reviewer_notes": "",
            })

    fieldnames = ["id", "category", "lang", "prompt", "response", "tokens_used", "violations", "status", "reviewer_notes"]
    with output_path.open("w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(rows)

    violations_total = sum(1 for r in rows if r["status"] not in ("ok", "ERRO"))
    errors_total = sum(1 for r in rows if r["status"] == "ERRO")

    print(f"\nConcludo -> {output_path}")
    print(f"  Total: {total} | Violaes: {violations_total} | Erros LLM: {errors_total}")
    if violations_total > 0:
        print("  Prompts com violao:")
        for r in rows:
            if r["status"] == "VIOLACAO":
                print(f"    {r['id']} [{r['category']}]  {r['violations']}")


def main() -> None:
    parser = argparse.ArgumentParser(description="Sampling semanal de respostas da Metis para validao de tom.")
    parser.add_argument("--lang", choices=["pt", "en"], default=None, help="Filtrar por idioma (default: ambos)")
    parser.add_argument("--output", type=str, default=None, help="Caminho do CSV de sada")
    args = parser.parse_args()

    default_output = Path("analysis") / "sampling" / f"sample_{date.today().strftime('%Y%m%d')}.csv"
    output_path = Path(args.output) if args.output else default_output

    run_sampling(lang_filter=args.lang, output_path=output_path)


if __name__ == "__main__":
    main()
