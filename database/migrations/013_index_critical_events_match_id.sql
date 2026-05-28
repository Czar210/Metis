-- Índice em critical_events.match_id
-- Necessário para que DELETE WHERE match_id = X não faça full table scan
-- (a tabela tem centenas de milhares de linhas após o backfill de timelines)
CREATE INDEX IF NOT EXISTS idx_critical_events_match_id
    ON critical_events (match_id);
