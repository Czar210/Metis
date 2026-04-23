-- Migration 002 — Tabela `coupons` (p-0.9.9)
--
-- Cupons com validade e efeito arbitrário. Feature aparece na /pricing
-- com a lista dos cupons públicos e ativos; cupons privados são resgatados
-- via código (fluxo de resgate fica pra versão futura).
--
-- RLS: leitura pública filtra só cupons públicos, ativos e não expirados.
-- Writes ficam restritos a service_role (admin cria via SQL ou futura UI).

CREATE TABLE IF NOT EXISTS coupons (
  code          TEXT PRIMARY KEY,
  title         TEXT NOT NULL,
  description   TEXT,
  -- Efeito estruturado em JSONB pra flexibilidade (tier, tokens, duração, etc).
  -- Ex: {"tier":"premium","tokens_per_day":10000,"duration":"until_end_of_month"}
  effect        JSONB NOT NULL DEFAULT '{}'::jsonb,
  valid_from    TIMESTAMPTZ NOT NULL DEFAULT now(),
  valid_until   TIMESTAMPTZ NOT NULL,
  max_uses      INT,                  -- NULL = ilimitado
  uses_count    INT NOT NULL DEFAULT 0,
  public_list   BOOLEAN NOT NULL DEFAULT false,  -- TRUE = listar na /pricing
  active        BOOLEAN NOT NULL DEFAULT true,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Índice pro endpoint público (filtro mais comum).
CREATE INDEX IF NOT EXISTS coupons_public_live_idx
  ON coupons (valid_until)
  WHERE public_list = true AND active = true;

COMMENT ON TABLE  coupons IS 'Cupons com validade e efeito. Público (public_list) aparece em /pricing; resgate via code.';
COMMENT ON COLUMN coupons.effect      IS 'JSONB flexível: tier, tokens_per_day, duration, etc. Semântica definida pelo serviço de resgate.';
COMMENT ON COLUMN coupons.public_list IS 'Se TRUE, cupom fica visível na pricing page. Se FALSE, só acessível por código.';

ALTER TABLE coupons ENABLE ROW LEVEL SECURITY;

-- Leitura pública: só cupons ativos, públicos e ainda válidos.
DROP POLICY IF EXISTS "coupons_public_select" ON coupons;
CREATE POLICY "coupons_public_select"
  ON coupons
  FOR SELECT
  TO public
  USING (
    public_list = true
    AND active = true
    AND valid_until > now()
  );

-- Writes ficam só no service_role (que bypassa RLS).
