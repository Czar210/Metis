-- Migration 003: ai_cache
-- Cache de respostas da IA por escopo + hash do input
-- TTL controlado pelo campo expires_at (limpeza via cron ou on-read)

CREATE TABLE IF NOT EXISTS ai_cache (
    scope        TEXT        NOT NULL,  -- 'match_analysis' | 'inline_insight'
    id_hash      TEXT        NOT NULL,  -- SHA-256 hex do input canonicalizado
    response     JSONB       NOT NULL,
    tokens_used  INT         NOT NULL DEFAULT 0,
    computed_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at   TIMESTAMPTZ NOT NULL,
    PRIMARY KEY (scope, id_hash)
);

CREATE INDEX IF NOT EXISTS ai_cache_expires_idx ON ai_cache (expires_at);

-- RLS: apenas service_role escreve; leitura publica desabilitada (acesso via backend)
ALTER TABLE ai_cache ENABLE ROW LEVEL SECURITY;
