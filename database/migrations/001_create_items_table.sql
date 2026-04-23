-- Migration 001 — Tabela `items` (p-0.9.8.1)
--
-- Cria a tabela de itens com campos puxados do Data Dragon + colunas
-- proprietárias (category, trend) pra curadoria e análise.
--
-- RLS: leitura pública (itens são dados estáticos do LoL, não são sensíveis).
-- Write só via service_role (scripts de sync + curadoria).

CREATE TABLE IF NOT EXISTS items (
  item_id     INT PRIMARY KEY,
  name        TEXT NOT NULL,
  gold_total  INT NOT NULL DEFAULT 0,
  gold_base   INT NOT NULL DEFAULT 0,
  gold_sell   INT NOT NULL DEFAULT 0,
  purchasable BOOLEAN NOT NULL DEFAULT TRUE,
  tags        JSONB NOT NULL DEFAULT '[]'::jsonb,
  plaintext   TEXT,
  -- Colunas proprietárias — populadas manualmente (César) ou por jobs futuros.
  category    TEXT,         -- ex: 'Lendário' | 'Botas' | 'Inicial' | 'Utilitário'
  trend       TEXT,         -- 'up' | 'down' | 'flat' — cálculo fica pra depois
  -- Metadata
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Índices
CREATE INDEX IF NOT EXISTS items_category_idx ON items (category) WHERE category IS NOT NULL;
CREATE INDEX IF NOT EXISTS items_tags_gin_idx ON items USING GIN (tags);

-- Comentários pra futuros mantenedores
COMMENT ON TABLE  items IS 'Catálogo de itens do LoL — gold/tags/plaintext vem do Data Dragon; category e trend são proprietárias.';
COMMENT ON COLUMN items.category IS 'Categoria proprietária (Lendário, Botas, Inicial, Utilitário, etc). NULL até curadoria.';
COMMENT ON COLUMN items.trend    IS 'Tendência calculada ("up"/"down"/"flat"). NULL até job de cálculo existir.';

-- RLS
ALTER TABLE items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "items_select_public" ON items;
CREATE POLICY "items_select_public"
  ON items
  FOR SELECT
  TO public
  USING (true);

-- Sem policy de INSERT/UPDATE/DELETE pra public nem authenticated:
-- writes ficam restritos ao service_role (que bypass RLS por padrão).
