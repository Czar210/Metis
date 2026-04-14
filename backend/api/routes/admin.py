"""
admin.py — Rotas de administração (prefixo: /api/v1/admin)

Acesso restrito à conta admin (app_metadata.is_admin = true).
Token Supabase validado via supabase.auth.get_user(jwt).

Endpoints:
  GET /api/v1/admin/stats  →  Estatísticas globais do sistema
"""

import os
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, HTTPException, Header
from supabase import create_client

router = APIRouter(prefix="/api/v1/admin", tags=["Admin"])

DIRTY_REASONS = ["remake", "short_game", "wrong_queue"]


def _get_supabase():
    url = os.environ.get("SUPABASE_URL")
    key = os.environ.get("SUPABASE_KEY")
    if not url or not key:
        raise RuntimeError("SUPABASE_URL e SUPABASE_KEY são obrigatórios no .env")
    return create_client(url, key)


def _verify_admin(authorization: str | None) -> None:
    """Valida JWT via Supabase e exige app_metadata.is_admin = true."""
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Token de autenticação obrigatório.")
    token = authorization.split(" ", 1)[1]
    db = _get_supabase()
    try:
        user_resp = db.auth.get_user(token)
        user = user_resp.user
        if not user:
            raise HTTPException(status_code=401, detail="Token inválido.")
        if not (user.app_metadata or {}).get("is_admin"):
            raise HTTPException(status_code=403, detail="Acesso negado — requer conta admin.")
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(status_code=401, detail="Token inválido ou expirado.")


@router.get("/stats")
def get_admin_stats(authorization: str | None = Header(default=None)):
    """
    📊 Estatísticas Globais do Sistema (admin only)

    Retorna contagens agregadas de players, matches, dirty matches,
    timelines e sincronizações recentes.
    """
    _verify_admin(authorization)

    try:
        db = _get_supabase()

        # ── Contagens principais ──────────────────────────────
        players_total = (
            db.table("players").select("puuid", count="exact").execute().count or 0
        )
        matches_clean = (
            db.table("matches").select("match_id", count="exact").execute().count or 0
        )
        participants_total = (
            db.table("match_participants").select("puuid", count="exact").execute().count or 0
        )
        timelines_saved = (
            db.table("match_timelines").select("match_id", count="exact").execute().count or 0
        )

        # ── Dirty matches por motivo ──────────────────────────
        dirty_by_reason: dict[str, int] = {}
        dirty_total = 0
        for reason in DIRTY_REASONS:
            count = (
                db.table("matches_dirty")
                .select("match_id", count="exact")
                .like("reason", f"{reason}%")
                .execute()
                .count or 0
            )
            dirty_by_reason[reason] = count
            dirty_total += count

        # ── Sincronizações nas últimas 24h ────────────────────
        since = (datetime.now(timezone.utc) - timedelta(hours=24)).isoformat()
        synced_24h = (
            db.table("players")
            .select("puuid", count="exact")
            .gte("last_synced_at", since)
            .execute()
            .count or 0
        )

        # ── Sincronizações na última semana (por dia) ─────────
        synced_7d = (
            db.table("players")
            .select("puuid", count="exact")
            .gte("last_synced_at", (datetime.now(timezone.utc) - timedelta(days=7)).isoformat())
            .execute()
            .count or 0
        )

        return {
            "players_total":          players_total,
            "matches_clean":          matches_clean,
            "matches_dirty_total":    dirty_total,
            "matches_dirty_by_reason": dirty_by_reason,
            "participants_total":     participants_total,
            "timelines_saved":        timelines_saved,
            "synced_last_24h":        synced_24h,
            "synced_last_7d":         synced_7d,
        }

    except HTTPException:
        raise
    except RuntimeError as err:
        raise HTTPException(status_code=500, detail=str(err))
    except Exception as err:
        import logging; logging.getLogger(__name__).error(f"Erro interno: {err}"); raise HTTPException(status_code=500, detail="Erro interno. Tente novamente.")
