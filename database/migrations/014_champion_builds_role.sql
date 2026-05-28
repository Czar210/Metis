-- Migration 014 — Adiciona role à champion_builds e recria RPC de upsert
--
-- champion_builds é dados derivados (repopuláveis por process_matches.py),
-- portanto truncamos para evitar mistura de linhas sem role com linhas com role.
-- Após rodar esta migration, execute o pipeline process_matches para repopular.

-- 1. Adiciona coluna role (temporariamente nullable para não quebrar durante ALTER)
ALTER TABLE champion_builds
    ADD COLUMN IF NOT EXISTS role varchar(20);

-- 2. Troca o unique constraint para incluir role
ALTER TABLE champion_builds
    DROP CONSTRAINT IF EXISTS champion_builds_champion_name_item_id_patch_key;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'champion_builds_champion_name_item_id_patch_role_key'
    ) THEN
        ALTER TABLE champion_builds
            ADD CONSTRAINT champion_builds_champion_name_item_id_patch_role_key
            UNIQUE (champion_name, item_id, patch, role);
    END IF;
END $$;

-- 3. Limpa dados sem role (serão reprocessados pelo pipeline)
TRUNCATE champion_builds;

-- 4. Torna role NOT NULL após truncate
ALTER TABLE champion_builds
    ALTER COLUMN role SET NOT NULL,
    ALTER COLUMN role SET DEFAULT 'UNKNOWN';

-- 5. Recria a função de upsert com suporte a role
CREATE OR REPLACE FUNCTION upsert_champion_builds(builds jsonb)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
    INSERT INTO champion_builds (
        champion_name, item_id, item_name, patch, role, pick_count, win_count
    )
    SELECT
        (b->>'champion_name')::varchar,
        (b->>'item_id')::int,
        (b->>'item_name')::varchar,
        (b->>'patch')::varchar,
        COALESCE(NULLIF(b->>'role', ''), 'UNKNOWN')::varchar,
        (b->>'pick_count')::int,
        (b->>'win_count')::int
    FROM jsonb_array_elements(builds) AS b
    ON CONFLICT (champion_name, item_id, patch, role)
    DO UPDATE SET
        pick_count = champion_builds.pick_count + EXCLUDED.pick_count,
        win_count  = champion_builds.win_count  + EXCLUDED.win_count;
END;
$$;
