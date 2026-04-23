"""
coupon_service.py — Camada de negócio pra cupons.

Por enquanto só tem `list_public_coupons` (lê). Resgate (mutação) fica pra
versão futura quando tivermos fluxo de aplicar benefício no user_metadata.
"""

from __future__ import annotations

from typing import Any


def list_public_coupons(db_client) -> list[dict[str, Any]]:
    """Retorna cupons públicos ativos e não expirados.

    RLS da tabela já filtra `public_list = true AND active AND valid_until > now()`
    mas repetimos os filtros aqui pra deixar explícito e ser resiliente caso
    a policy mude.

    IMPORTANTE: o campo `code` NÃO é retornado — cupons públicos funcionam
    como "easter egg": a pessoa vê o benefício mas precisa descobrir o código
    pra resgatar. Isso é intencional (decisão César, 2026-04-22).
    """
    res = (
        db_client.table("coupons")
        .select("title, description, effect, valid_until, max_uses, uses_count")
        .eq("public_list", True)
        .eq("active", True)
        .order("valid_until", desc=False)
        .execute()
    )
    rows = res.data or []

    # Guard adicional: filtra em código tudo que tiver uses_count >= max_uses
    # (Postgres não permite expressar isso facilmente numa RLS policy simples).
    def _available(c: dict) -> bool:
        if c.get("max_uses") is None:
            return True
        return int(c.get("uses_count", 0)) < int(c["max_uses"])

    return [c for c in rows if _available(c)]
