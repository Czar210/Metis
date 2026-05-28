-- Migration 016 — Backfill champion_builds a partir de match_participants
--
-- champion_builds foi truncado pela migration 014 (adição do campo role).
-- Este script reconstrói os dados agregados diretamente do Supabase:
--   match_participants → items (JSONB array, slots 0-5) + team_position + win
--   matches            → game_version (patch)
--   items              → name (para item_name)
--
-- Idempotente: ON CONFLICT substitui pick_count/win_count com valores recalculados.
-- Slot 6 (trinket) é excluído via idx <= 6 (ORDINALITY começa em 1).

INSERT INTO champion_builds (champion_name, item_id, item_name, patch, role, pick_count, win_count)
SELECT
    mp.champion_name,
    t.item_id,
    COALESCE(i.name, 'Item ' || t.item_id) AS item_name,
    m.game_version                          AS patch,
    COALESCE(NULLIF(mp.team_position, ''), 'UNKNOWN') AS role,
    COUNT(*)                                AS pick_count,
    SUM(CASE WHEN mp.win THEN 1 ELSE 0 END) AS win_count
FROM match_participants mp
JOIN matches m ON m.match_id = mp.match_id
CROSS JOIN LATERAL (
    SELECT (elem.val)::int AS item_id
    FROM jsonb_array_elements_text(mp.items) WITH ORDINALITY AS elem(val, idx)
    WHERE elem.idx <= 6          -- exclui slot 6 (trinket)
      AND (elem.val)::int > 0    -- exclui slots vazios
) AS t
LEFT JOIN items i ON i.item_id = t.item_id
WHERE mp.champion_name IS NOT NULL
GROUP BY mp.champion_name, t.item_id, i.name, m.game_version, mp.team_position
ON CONFLICT (champion_name, item_id, patch, role)
DO UPDATE SET
    pick_count = EXCLUDED.pick_count,
    win_count  = EXCLUDED.win_count;
