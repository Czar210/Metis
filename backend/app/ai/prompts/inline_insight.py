"""
inline_insight.py — Prompt para insights compactos (1-2 bullets por escopo).

Shape de saida (AIInsight[]):
  severity, title, body, action?
"""

from __future__ import annotations

INLINE_INSIGHT_SYSTEM = (
    "Voce e a Metis, analista tatica de League of Legends. "
    "Retorne APENAS um JSON valido — sem texto antes ou depois.\n\n"
    "Regras:\n"
    "- Cite sempre metricas concretas (numeros, percentuais)\n"
    "- Nomes de campeoes SEMPRE em ingles (Kayn, Jinx, Thresh)\n"
    "- NUNCA use elogios vazios ('Otimo!', 'Parabens!', 'Great job!')\n"
    "- Seja direto: maximo 2 frases por insight\n"
    "- severity: 'positive' se destaque positivo, 'negative' se ponto critico, "
    "'neutral' se observacao, 'critical' se erro grave"
)

_MATCH_PROMPT = """\
Gere 2 insights compactos para esta partida.

Campeao: {champion} ({role}) | Resultado: {result}
KDA: {kills}/{deaths}/{assists} | CS/min: {cspm:.1f} | KP: {kp:.0f}%
Dano: {damage_pct:.0f}% do time | Vision: {vision_score} | Score: {metis_score}/100
Duracao: {duration_min}min

JSON esperado (retorne APENAS isto):
[
  {{
    "severity": "positive" | "negative" | "neutral" | "critical",
    "title": "string curto (3-6 palavras)",
    "body": "1-2 frases com metrica concreta"
  }},
  {{
    "severity": "...",
    "title": "...",
    "body": "..."
  }}
]
"""

_PLAYER_PROMPT = """\
Gere 2 insights compactos para o perfil deste jogador.

Invocador: {game_name}#{tag_line}
WR recente: {winrate:.0f}% ({wins}V/{losses}D) | Partidas: {total_games}
Campeao mais jogado: {top_champion} ({top_games} jogos, {top_wr:.0f}% WR)
CS/min medio: {avg_cspm:.1f} | KDA medio: {avg_kda:.1f}

JSON esperado (retorne APENAS isto):
[
  {{
    "severity": "positive" | "negative" | "neutral" | "critical",
    "title": "string curto (3-6 palavras)",
    "body": "1-2 frases com metrica concreta"
  }},
  {{
    "severity": "...",
    "title": "...",
    "body": "..."
  }}
]
"""

_CHAMPION_PROMPT = """\
Gere 2 insights compactos sobre este campeao no meta atual.

Campeao: {champion} | WR: {winrate:.1f}% | Pick rate: {pick_rate:.1f}% | Ban rate: {ban_rate:.1f}%
Roles: {roles} | Tier: {tier}
Amostra: {sample_size} partidas

JSON esperado (retorne APENAS isto):
[
  {{
    "severity": "positive" | "negative" | "neutral" | "critical",
    "title": "string curto (3-6 palavras)",
    "body": "1-2 frases com metrica concreta"
  }},
  {{
    "severity": "...",
    "title": "...",
    "body": "..."
  }}
]
"""


def build_inline_insight_prompt(scope: str, context: dict) -> str:
    """Monta o prompt de inline insight de acordo com o scope."""
    if scope == "match":
        return _MATCH_PROMPT.format(**context)
    if scope == "player":
        return _PLAYER_PROMPT.format(**context)
    if scope == "champion":
        return _CHAMPION_PROMPT.format(**context)
    raise ValueError(f"Scope invalido: {scope!r}. Use 'match', 'player' ou 'champion'.")
