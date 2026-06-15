"""
test_coupon_redeem.py — Testes do endpoint POST /api/v1/coupons/redeem

Cobre o comportamento da rota (a lógica atômica de fato vive na RPC SQL
`redeem_coupon`, exercitada via os status que ela retorna):
  1. happy path: status ok → 200 + granted; código é normalizado p/ MAIÚSCULO
  2. código inexistente: not_found → 404
  3. já resgatado: already_redeemed → 409
  4. expirado/inativo: expired → 400
  5. não autenticado: get_user_from_token levanta 401
  6. código vazio: 422 sem chamar o serviço
  7. tentativa de injeção: código passa como PARÂMETRO da RPC (sem sanitização frágil)
"""

from unittest.mock import patch
from fastapi import HTTPException
from fastapi.testclient import TestClient

from backend.main import app

client = TestClient(app)

HEADERS = {"X-API-Key": "test"}  # conftest.py garante METIS_API_KEY=test
TOKEN = "valid-supabase-token"


def _post(code: str = "FIRST5", token: str = TOKEN):
    return client.post(
        "/api/v1/coupons/redeem",
        json={"code": code, "supabase_token": token},
        headers=HEADERS,
    )


# ── 1. happy path ─────────────────────────────────────────────────────────────

def test_redeem_happy_path_uppercases_code():
    with (
        patch("backend.api.routes.coupon.get_user_from_token", return_value=("free", "user-uuid-1")),
        patch(
            "backend.api.routes.coupon.redeem_coupon",
            return_value={"status": "ok", "tokens_granted": 5000, "expires_at": "2026-06-30T23:59:59Z"},
        ) as mock_redeem,
    ):
        resp = _post(code="first5")  # minúsculo de propósito

    assert resp.status_code == 200
    body = resp.json()
    assert body["status"] == "ok"
    assert body["granted"] == 5000
    assert body["expires_at"] == "2026-06-30T23:59:59Z"
    # Código normalizado para MAIÚSCULO antes de ir pro serviço/RPC
    args, _ = mock_redeem.call_args
    assert args[2] == "FIRST5"


# ── 2. código inexistente ─────────────────────────────────────────────────────

def test_redeem_not_found():
    with (
        patch("backend.api.routes.coupon.get_user_from_token", return_value=("free", "u")),
        patch("backend.api.routes.coupon.redeem_coupon", return_value={"status": "not_found"}),
    ):
        resp = _post(code="NAOEXISTE")
    assert resp.status_code == 404


# ── 3. já resgatado ───────────────────────────────────────────────────────────

def test_redeem_already_redeemed():
    with (
        patch("backend.api.routes.coupon.get_user_from_token", return_value=("free", "u")),
        patch("backend.api.routes.coupon.redeem_coupon", return_value={"status": "already_redeemed"}),
    ):
        resp = _post()
    assert resp.status_code == 409


# ── 4. expirado / inativo ─────────────────────────────────────────────────────

def test_redeem_expired():
    with (
        patch("backend.api.routes.coupon.get_user_from_token", return_value=("free", "u")),
        patch("backend.api.routes.coupon.redeem_coupon", return_value={"status": "expired"}),
    ):
        resp = _post()
    assert resp.status_code == 400


# ── 5. não autenticado ────────────────────────────────────────────────────────

def test_redeem_unauthenticated():
    with patch(
        "backend.api.routes.coupon.get_user_from_token",
        side_effect=HTTPException(status_code=401, detail="Login necessario."),
    ):
        resp = _post(token="")
    assert resp.status_code == 401


# ── 6. código vazio → 422 sem tocar o serviço ─────────────────────────────────

def test_redeem_empty_code():
    with (
        patch("backend.api.routes.coupon.get_user_from_token", return_value=("free", "u")),
        patch("backend.api.routes.coupon.redeem_coupon") as mock_redeem,
    ):
        resp = _post(code="   ")  # só espaços → vazio após strip
    assert resp.status_code == 422
    mock_redeem.assert_not_called()


# ── 7. tentativa de injeção ───────────────────────────────────────────────────

def test_redeem_sql_injection_attempt_is_safe():
    malicious = "FIRST5'; DROP TABLE coupons;--"
    with (
        patch("backend.api.routes.coupon.get_user_from_token", return_value=("free", "u")),
        patch("backend.api.routes.coupon.redeem_coupon", return_value={"status": "not_found"}) as mock_redeem,
    ):
        resp = _post(code=malicious)
    # Tratado como código comum (404) — vai como PARÂMETRO da RPC, sem SQL dinâmico.
    assert resp.status_code == 404
    args, _ = mock_redeem.call_args
    assert args[2] == malicious.upper()
