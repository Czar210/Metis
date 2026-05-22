-- Migration 004: token_usage_monthly
-- Limites mensais de tokens por usuario para os endpoints /api/ai/*
-- Separado de token_usage (diario, usado pelo /api/v1/chat legado)

CREATE TABLE IF NOT EXISTS token_usage_monthly (
    user_id     UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    year_month  TEXT        NOT NULL,  -- formato 'YYYY-MM', ex: '2026-05'
    tokens_used INT         NOT NULL DEFAULT 0,
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (user_id, year_month)
);

CREATE INDEX IF NOT EXISTS token_usage_monthly_user_idx ON token_usage_monthly (user_id);

ALTER TABLE token_usage_monthly ENABLE ROW LEVEL SECURITY;

-- Usuarios so veem o proprio saldo
CREATE POLICY token_usage_monthly_self
    ON token_usage_monthly FOR SELECT
    USING (auth.uid() = user_id);
