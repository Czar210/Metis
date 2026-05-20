"""
match_analysis.py — Prompt canônico para Match Deep Analysis (Ticket C).

Shape de saída (MatchAnalysis):
  tldr, score, strengths[], weaknesses[], keyMoments[], coaching
"""

from __future__ import annotations

MATCH_ANALYSIS_SYSTEM = (
    "Você é a Metis, analista tática de League of Legends. "
    "Sua tarefa é analisar estatísticas de uma partida e retornar APENAS um JSON válido. "
    "Sem texto antes ou depois do JSON.\n\n"
    "Regras absolutas:\n"
    "- Cite sempre métricas concretas com números (nunca 'bom' sem um número)\n"
    "- Nomes de campeões SEMPRE em inglês (Kayn, não Rei Macaco; Wukong, não Rei Macaba)\n"
    "- NUNCA use 'Excellent!', 'Ótimo jogo!', 'Parabéns!' ou elogios vazios\n"
    "- NUNCA invente estatísticas que não estão no contexto fornecido\n"
    "- keyMoments: infira momentos prováveis dos stats (first blood ~min 3, drakes ~min 5-8) — "
    "você não tem a timeline real\n"
    "- Responda no idioma indicado pelo campo locale (pt → português, en → inglês)"
)

_PROMPT_TEMPLATE = """\
Analise a performance do jogador e retorne o JSON de MatchAnalysis.

## Partida
- Match ID: {match_id}
- Duração: {duration_min}min {duration_sec}s
- Patch: {patch}
- Locale: {locale}

## Jogador analisado
- Invocador: {game_name}#{tag_line}
- Campeão: {champion_name}
- Role: {role}
- Resultado: {result}
- KDA: {kills}/{deaths}/{assists}
- CS/min: {cspm:.1f}
- Dano total: {damage:,} ({damage_pct:.0f}% do time)
- Gold: {gold_earned:,}
- Vision score: {vision_score}
- Kill participation: {kp:.0f}%
- Metis Score: {metis_score}/100

## Time Azul
{blue_team}

## Time Vermelho
{red_team}

## JSON de saída (retorne APENAS isto):
{{
  "tldr": "1-2 frases diretas com métrica concreta. Ex: Você dominou o early com 3 ganks certeiros, mas desapareceu no late — apenas 8% de participação nos teamfights após os 25min.",
  "score": {metis_score},
  "strengths": [
    {{"label": "string", "value": "string (opcional, ex: 3.8 KDA)", "note": "1 frase com métrica"}}
  ],
  "weaknesses": [
    {{"label": "string", "value": "string (opcional)", "note": "1 frase com métrica"}}
  ],
  "keyMoments": [
    {{"t": 180, "title": "string", "analysis": "2-4 frases em markdown leve", "impact": "positive"}}
  ],
  "coaching": {{
    "drill": "ação específica (Practice Tool ou em partida)",
    "goal": "o que melhora com esse drill",
    "estimated_minutes": 15
  }}
}}

Contagem obrigatória: strengths 2-3 itens · weaknesses 2-3 itens · keyMoments exatamente 3 itens · coaching 1 item.
"""


def _build_team_summary(participants: list[dict], target_puuid: str | None = None) -> str:
    lines: list[str] = []
    for p in participants:
        player = p.get("players") or {}
        name = f"{player.get('game_name', '?')}#{player.get('tag_line', '?')}"
        champ = p.get("champion_name", "?")
        role = p.get("team_position", "UNKNOWN")
        k = p.get("kills", 0)
        d = p.get("deaths", 0)
        a = p.get("assists", 0)
        cspm = p.get("cs_per_minute") or 0
        marker = " ← ANALISADO" if target_puuid and p.get("puuid") == target_puuid else ""
        lines.append(f"  {name} | {champ} {role} | {k}/{d}/{a} | {cspm:.1f} CS/min{marker}")
    return "\n".join(lines)


def build_match_analysis_prompt(
    match_id: str,
    participants: list[dict],
    target_puuid: str,
    locale: str = "pt",
) -> str:
    """Constrói o prompt de match-analysis para um jogador específico.

    Pré-condição: participants já deve ter o campo 'metis_score' calculado.
    """
    target = next((p for p in participants if p.get("puuid") == target_puuid), None)
    if target is None:
        raise ValueError(f"PUUID {target_puuid!r} não encontrado nos participantes")

    blue_team = [p for p in participants if p.get("team_id") == 100]
    red_team = [p for p in participants if p.get("team_id") == 200]

    meta = target.get("matches") or {}
    duration_s = int(meta.get("game_duration") or 0)
    patch = meta.get("game_version", "?")

    player = target.get("players") or {}

    team_dmg = sum(
        (p.get("total_damage_dealt_to_champions") or 0)
        for p in participants
        if p.get("team_id") == target.get("team_id")
    ) or 1
    damage = target.get("total_damage_dealt_to_champions") or 0
    kp = (target.get("kill_participation") or 0.0) * 100

    if locale == "en":
        side = "Blue Side" if target.get("team_id") == 100 else "Red Side"
        result_str = f"{'Win' if target.get('win') else 'Loss'} ({side})"
    else:
        side = "Time Azul" if target.get("team_id") == 100 else "Time Vermelho"
        result_str = f"{'Vitória' if target.get('win') else 'Derrota'} ({side})"

    return _PROMPT_TEMPLATE.format(
        match_id=match_id,
        duration_min=duration_s // 60,
        duration_sec=duration_s % 60,
        patch=patch,
        locale=locale,
        game_name=player.get("game_name", "?"),
        tag_line=player.get("tag_line", "?"),
        champion_name=target.get("champion_name", "?"),
        role=target.get("team_position", "UNKNOWN"),
        result=result_str,
        kills=target.get("kills", 0),
        deaths=target.get("deaths", 0),
        assists=target.get("assists", 0),
        cspm=target.get("cs_per_minute") or 0.0,
        damage=damage,
        damage_pct=(damage / team_dmg) * 100,
        gold_earned=target.get("gold_earned") or 0,
        vision_score=target.get("vision_score") or 0,
        kp=kp,
        metis_score=target.get("metis_score", 50),
        blue_team=_build_team_summary(blue_team, target_puuid),
        red_team=_build_team_summary(red_team, target_puuid),
    )
