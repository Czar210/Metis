"""
validate_match_analysis.py  Task 2.2: valida qualidade do match-analysis com Gemini 2.5 Flash.

Puxa N partidas reais do Supabase, roda match-analysis em cada uma e exporta CSV para reviso.

Uso:
    python scripts/sampling/validate_match_analysis.py
    python scripts/sampling/validate_match_analysis.py --count 20 --output analysis/sampling/ma_20260520.csv
"""

from __future__ import annotations

import argparse
import csv
import json
import re
import sys
import time
from datetime import date
from pathlib import Path

from dotenv import load_dotenv

load_dotenv()

_BACKEND = Path(__file__).resolve().parents[2] / "backend"
if str(_BACKEND) not in sys.path:
    sys.path.insert(0, str(_BACKEND))

from services.llm_adapter import get_llm  # type: ignore[import]  # noqa: E402
from app.ai.prompts.match_analysis import (  # type: ignore[import]  # noqa: E402
    MATCH_ANALYSIS_SYSTEM,
    build_match_analysis_prompt,
)

#  Verificadores de violao (mesmos do sample_responses.py) 

_FORBIDDEN = re.compile(
    r"\b(timo trabalho|great job|parabns|que jogada|boa pergunta!|"
    r"claro!|com certeza!|tima observao|sem dvida!|"
    r"muito bem jogado|muito bem feito|perfeito demais)\b",
    re.IGNORECASE,
)
_CHAMP_TRANSLATED = re.compile(
    r"\b(a leoa|o jardineiro|a aranha|o detetive|o rei dos gelos|a sereia|"
    r"o palhao|rei macaco)\b",
    re.IGNORECASE,
)


def _check_violations(text: str) -> list[str]:
    v: list[str] = []
    if _FORBIDDEN.search(text):
        v.append("validacao_vazia")
    if _CHAMP_TRANSLATED.search(text):
        v.append("traducao_campeon")
    return v


#  Metis Score (espelho de match.py  sem importar a rota) 

_ROLE_WEIGHTS: dict[str, dict[str, float]] = {
    "TOP":     {"kda": 0.25, "dmg": 0.15, "gold": 0.20, "vis": 0.05, "cs": 0.15, "kp": 0.10},
    "JUNGLE":  {"kda": 0.25, "dmg": 0.10, "gold": 0.10, "vis": 0.15, "cs": 0.10, "kp": 0.25},
    "MIDDLE":  {"kda": 0.25, "dmg": 0.20, "gold": 0.20, "vis": 0.05, "cs": 0.20, "kp": 0.25},
    "BOTTOM":  {"kda": 0.25, "dmg": 0.30, "gold": 0.25, "vis": 0.05, "cs": 0.25, "kp": 0.10},
    "UTILITY": {"kda": 0.25, "dmg": 0.05, "gold": 0.05, "vis": 0.30, "cs": 0.05, "kp": 0.25},
}
_DEFAULT_W = {"kda": 0.20, "dmg": 0.15, "gold": 0.15, "vis": 0.15, "cs": 0.15, "kp": 0.15}


def _compute_metis_scores(participants: list[dict]) -> None:
    n = len(participants)
    if not n:
        return

    def s(v) -> float:
        return float(v) if v else 0.0

    avg_gold = sum(s(p.get("gold_earned")) for p in participants) / n or 1
    avg_vis  = sum(s(p.get("vision_score")) for p in participants) / n or 1
    avg_cspm = sum(s(p.get("cs_per_minute")) for p in participants) / n or 1

    team_dmg: dict[int, float] = {}
    for p in participants:
        tid = p.get("team_id", 0)
        team_dmg[tid] = team_dmg.get(tid, 0) + s(p.get("total_damage_dealt_to_champions"))

    for p in participants:
        kills   = s(p.get("kills"))
        deaths  = s(p.get("deaths"))
        assists = s(p.get("assists"))
        gold    = s(p.get("gold_earned"))
        damage  = s(p.get("total_damage_dealt_to_champions"))
        vision  = s(p.get("vision_score"))
        cspm    = s(p.get("cs_per_minute"))
        kp      = s(p.get("kill_participation"))

        role = (p.get("team_position") or "UNKNOWN").upper()
        w = _ROLE_WEIGHTS.get(role, _DEFAULT_W)
        t_dmg = team_dmg.get(p.get("team_id", 0), 1) or 1

        raw = (
            w["kda"]  * min((kills + assists) / max(deaths, 1) / 5.0, 1.0)
            + w["dmg"]  * min(damage / t_dmg / 0.3, 1.0)
            + w["gold"] * min(gold / avg_gold / 1.5, 1.0)
            + w["vis"]  * min(vision / avg_vis / 1.5, 1.0)
            + w["cs"]   * (min(cspm / avg_cspm / 1.5, 1.0) if avg_cspm > 0 else 0)
            + w["kp"]   * min(kp / 0.7, 1.0)
        )
        p["metis_score"] = round(raw * 100, 1)


#  Fetch de partidas 

def _fetch_matches(count: int) -> list[dict]:
    import os
    from supabase import create_client

    url = os.environ.get("SUPABASE_URL")
    key = os.environ.get("SUPABASE_KEY")
    if not url or not key:
        raise RuntimeError("SUPABASE_URL e SUPABASE_KEY ausentes no .env")

    db = create_client(url, key)

    matches_res = (
        db.table("matches")
        .select("match_id")
        .order("created_at", desc=True)
        .limit(count * 2)  # busca extra pra filtrar partidas sem 10 participantes
        .execute()
    )
    match_ids = [m["match_id"] for m in (matches_res.data or [])]
    if not match_ids:
        raise RuntimeError("Nenhuma partida encontrada no Supabase")

    result: list[dict] = []
    for mid in match_ids:
        p_res = (
            db.table("match_participants")
            .select(
                "puuid, champion_name, team_position, team_id, win, "
                "kills, deaths, assists, gold_earned, "
                "total_damage_dealt_to_champions, vision_score, "
                "kill_participation, cs_per_minute, "
                "players(game_name, tag_line), "
                "matches(match_id, game_version, game_duration)"
            )
            .eq("match_id", mid)
            .execute()
        )
        participants = p_res.data or []
        if len(participants) == 10:
            result.append({"match_id": mid, "participants": participants})
        if len(result) >= count:
            break

    return result[:count]


#  Runner principal 

def run_validation(count: int, output_path: Path, debug: bool = False) -> None:
    llm = get_llm()

    print(f"Buscando {count} partidas do Supabase...")
    matches = _fetch_matches(count)
    print(f"Encontradas: {len(matches)} partidas\n")

    output_path.parent.mkdir(parents=True, exist_ok=True)
    rows: list[dict] = []

    for i, match_data in enumerate(matches, 1):
        mid = match_data["match_id"]
        participants = match_data["participants"]
        _compute_metis_scores(participants)

        # Analisa o jogador do time azul com maior Metis Score
        blue = [p for p in participants if p.get("team_id") == 100]
        target = max(blue, key=lambda p: p.get("metis_score", 0))
        puuid = target["puuid"]
        champ = target.get("champion_name", "?")
        role = target.get("team_position", "?")
        result_label = "win" if target.get("win") else "loss"
        ms = target.get("metis_score", 0)

        print(f"[{i:02d}/{len(matches)}] {mid[:20]}... | {champ} {role} | {result_label} | score={ms}", end=" ", flush=True)

        t0 = time.perf_counter()
        try:
            prompt = build_match_analysis_prompt(mid, participants, puuid)
            llm_result = llm.generate(prompt, system_prompt=MATCH_ANALYSIS_SYSTEM)
            elapsed = round(time.perf_counter() - t0, 1)

            raw = llm_result.text.strip()
            if debug and i == 1:
                print(f"\n[DEBUG raw response]\n{raw[:1200]}\n[/DEBUG]\n")
            # Extrai JSON pelo primeiro { e ultimo } (robusto contra text antes/depois da fence)
            json_start = raw.find("{")
            json_end = raw.rfind("}")
            if json_start != -1 and json_end > json_start:
                raw = raw[json_start : json_end + 1]

            json_valid = False
            tldr_preview = ""
            score = None
            strengths_n = weaknesses_n = key_moments_n = 0
            has_coaching = False

            try:
                parsed = json.loads(raw)
                json_valid = True
                tldr_preview = str(parsed.get("tldr", ""))[:120]
                score = parsed.get("score")
                strengths_n = len(parsed.get("strengths") or [])
                weaknesses_n = len(parsed.get("weaknesses") or [])
                key_moments_n = len(parsed.get("keyMoments") or [])
                has_coaching = bool(parsed.get("coaching"))
            except json.JSONDecodeError as jde:
                tldr_preview = f"[JSONErr:{jde}] {raw[:80]}"

            violations = _check_violations(raw)
            if violations:
                status = "VIOLACAO"
            elif not json_valid:
                status = "JSON_INVALIDO"
            else:
                status = "ok"

            print(f"-> {status} | {llm_result.tokens_used} tok | {elapsed}s")

            rows.append({
                "match_id": mid,
                "puuid_prefix": puuid[:12] + "...",
                "champion": champ,
                "role": role,
                "result": result_label,
                "metis_score": ms,
                "json_valid": json_valid,
                "score": score,
                "strengths_n": strengths_n,
                "weaknesses_n": weaknesses_n,
                "key_moments_n": key_moments_n,
                "has_coaching": has_coaching,
                "tokens_used": llm_result.tokens_used,
                "latency_s": elapsed,
                "violations": "|".join(violations) if violations else "",
                "status": status,
                "tldr_preview": tldr_preview,
                "reviewer_notes": "",
            })

        except Exception as exc:
            elapsed = round(time.perf_counter() - t0, 1)
            print(f"-> ERRO: {exc}")
            rows.append({
                "match_id": mid,
                "puuid_prefix": puuid[:12] + "...",
                "champion": champ,
                "role": role,
                "result": result_label,
                "metis_score": ms,
                "json_valid": False,
                "score": None,
                "strengths_n": 0,
                "weaknesses_n": 0,
                "key_moments_n": 0,
                "has_coaching": False,
                "tokens_used": 0,
                "latency_s": elapsed,
                "violations": "erro_llm",
                "status": "ERRO",
                "tldr_preview": str(exc)[:120],
                "reviewer_notes": "",
            })

    #  Exportar CSV 
    fieldnames = [
        "match_id", "puuid_prefix", "champion", "role", "result", "metis_score",
        "json_valid", "score", "strengths_n", "weaknesses_n", "key_moments_n", "has_coaching",
        "tokens_used", "latency_s", "violations", "status", "tldr_preview", "reviewer_notes",
    ]
    with output_path.open("w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(rows)

    #  Resumo 
    ok_n      = sum(1 for r in rows if r["status"] == "ok")
    inv_n     = sum(1 for r in rows if r["status"] == "JSON_INVALIDO")
    viol_n    = sum(1 for r in rows if r["status"] == "VIOLACAO")
    err_n     = sum(1 for r in rows if r["status"] == "ERRO")
    valid_tok = [r["tokens_used"] for r in rows if r["tokens_used"] > 0]
    avg_tok   = sum(valid_tok) / len(valid_tok) if valid_tok else 0
    avg_lat   = sum(r["latency_s"] for r in rows) / len(rows) if rows else 0
    cost_est  = (sum(valid_tok) / 1_000_000) * 0.50  # ~$0.50/1M tokens blended

    print(f"\n{'-' * 60}")
    print(f"Concluido -> {output_path}")
    print(f"  Total: {len(rows)} | OK: {ok_n} | JSON invlido: {inv_n} | Violaes: {viol_n} | Erros: {err_n}")
    print(f"  Tokens mdios/anlise: {avg_tok:.0f}")
    print(f"  Latncia mdia: {avg_lat:.1f}s")
    print(f"  Custo total estimado: ${cost_est:.4f}")

    if inv_n > 0:
        print(f"\n  [!] {inv_n} respostas nao sao JSON valido -- revisar no CSV")
    if viol_n > 0:
        print(f"  [!] {viol_n} violacoes de tom detectadas:")
        for r in rows:
            if r["status"] == "VIOLACAO":
                print(f"    {r['match_id'][:20]} [{r['champion']}] -- {r['violations']}")


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Task 2.2  Valida qualidade do match-analysis com Gemini 2.5 Flash."
    )
    parser.add_argument("--count", type=int, default=20, help="Partidas a analisar (default: 20)")
    parser.add_argument("--output", type=str, default=None, help="Caminho do CSV de sada")
    parser.add_argument("--debug", action="store_true", help="Imprime raw da 1a resposta")
    args = parser.parse_args()

    default_out = Path("analysis") / "sampling" / f"match_analysis_{date.today().strftime('%Y%m%d')}.csv"
    output_path = Path(args.output) if args.output else default_out

    run_validation(count=args.count, output_path=output_path, debug=args.debug)


if __name__ == "__main__":
    main()
