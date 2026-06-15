-- Migration 019 — Resgate de cupons (coupon_redemptions + RPC atomica)
--
-- Torna os cupons FUNCIONAIS: registra quem resgatou o que e por quanto tempo,
-- e concede tokens. O bonus e somado ao limite DIARIO do chat enquanto
-- expires_at > now() (ver backend/main.py: _get_coupon_bonus).
--
-- Regras de ouro respeitadas:
--   - Mutação 100% atomica via funcao redeem_coupon() (uma transacao):
--     valida janela + valida max_uses + insere resgate + incrementa uses_count.
--   - UNIQUE(user_id, coupon_code): cada usuario resgata um cupom UMA vez.
--   - RLS: usuario le so os proprios resgates; escrita so via RPC/service_role.

-- ── Tabela ────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS coupon_redemptions (
  id             BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id        UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  coupon_code    TEXT NOT NULL REFERENCES coupons(code),
  tokens_granted INT  NOT NULL DEFAULT 0,
  expires_at     TIMESTAMPTZ NOT NULL,          -- ate quando o bonus vale
  redeemed_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, coupon_code)
);

-- Index do hot-path: somar bonus ativo de um usuario.
CREATE INDEX IF NOT EXISTS coupon_redemptions_active_idx
  ON coupon_redemptions (user_id, expires_at);

COMMENT ON TABLE coupon_redemptions IS
  'Resgates de cupons por usuario. tokens_granted vale como bonus de tokens ate expires_at.';

ALTER TABLE coupon_redemptions ENABLE ROW LEVEL SECURITY;

-- Usuario le so os proprios resgates.
DROP POLICY IF EXISTS "coupon_redemptions_self_select" ON coupon_redemptions;
CREATE POLICY "coupon_redemptions_self_select"
  ON coupon_redemptions
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);
-- Sem policy de INSERT/UPDATE: escrita so via redeem_coupon() (SECURITY DEFINER)
-- ou service_role (que bypassa RLS).

-- ── RPC atomica de resgate ────────────────────────────────────────────────────
-- Retorna JSONB com status:
--   ok               → {status:'ok', tokens_granted:N, expires_at:...}
--   not_found        → codigo nao existe
--   expired          → inativo ou fora da janela de validade
--   already_redeemed → usuario ja resgatou este cupom
--   exhausted        → max_uses atingido (quando max_uses NÃO for NULL)
CREATE OR REPLACE FUNCTION redeem_coupon(p_user_id UUID, p_code TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_coupon  coupons%ROWTYPE;
  v_tokens  INT;
  v_existing INT;
BEGIN
  -- Lock na linha do cupom: serializa resgates concorrentes (trava "primeiros N").
  SELECT * INTO v_coupon FROM coupons WHERE code = p_code FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('status', 'not_found');
  END IF;

  IF NOT v_coupon.active
     OR now() < v_coupon.valid_from
     OR now() > v_coupon.valid_until THEN
    RETURN jsonb_build_object('status', 'expired');
  END IF;

  SELECT count(*) INTO v_existing
    FROM coupon_redemptions
   WHERE user_id = p_user_id AND coupon_code = p_code;
  IF v_existing > 0 THEN
    RETURN jsonb_build_object('status', 'already_redeemed');
  END IF;

  -- max_uses NULL = ilimitado. Quando setado, a trava e atomica por causa do lock acima.
  IF v_coupon.max_uses IS NOT NULL AND v_coupon.uses_count >= v_coupon.max_uses THEN
    RETURN jsonb_build_object('status', 'exhausted');
  END IF;

  v_tokens := COALESCE((v_coupon.effect->>'tokens')::INT, 0);

  INSERT INTO coupon_redemptions (user_id, coupon_code, tokens_granted, expires_at)
  VALUES (p_user_id, p_code, v_tokens, v_coupon.valid_until);

  UPDATE coupons SET uses_count = uses_count + 1 WHERE code = p_code;

  RETURN jsonb_build_object(
    'status', 'ok',
    'tokens_granted', v_tokens,
    'expires_at', v_coupon.valid_until
  );
END;
$$;

-- So o backend (service_role) chama a RPC. Nao expomos a clients para evitar
-- que um usuario autenticado resgate em nome de outro (p_user_id arbitrario).
REVOKE ALL ON FUNCTION redeem_coupon(UUID, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION redeem_coupon(UUID, TEXT) FROM anon;
REVOKE ALL ON FUNCTION redeem_coupon(UUID, TEXT) FROM authenticated;
GRANT EXECUTE ON FUNCTION redeem_coupon(UUID, TEXT) TO service_role;
