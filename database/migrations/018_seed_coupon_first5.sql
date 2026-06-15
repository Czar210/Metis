-- Migration 018 — Seed do cupom `FIRST5`
--
-- Cupom promocional: +5.000 tokens/dia no chat ate o fim do mes (junho/2026).
-- Resgate ilimitado por enquanto (max_uses = NULL) — qualquer um que resgatar
-- ganha o bonus. Aparece na /pricing e na /account (public_list = true) com o
-- codigo escondido (easter-egg, decisao Cesar 2026-04-22).
--
-- Semantica do efeito (aplicada pela migration 019 + backend):
--   effect.tokens = 5000 → bonus somado ao limite DIARIO do chat (/api/v1/chat)
--   enquanto o cupom estiver valido (expires_at = valid_until). Como o chat
--   reseta a meia-noite UTC, na pratica sao +5.000 tokens por dia ate 30/06.
--
-- A trava "primeiros 5" fica como plano futuro: basta trocar max_uses NULL → 5
-- que a RPC redeem_coupon (migration 019) ja a impoe de forma atomica.
--
-- code em MAIUSCULO: os inputs de resgate fazem .toUpperCase(), entao o codigo
-- armazenado precisa casar.
--
-- Idempotente: ON CONFLICT (code) atualiza o efeito/limites para o estado atual
-- (re-rodar nao duplica; uses_count e preservado).

INSERT INTO coupons (
  code,
  title,
  description,
  effect,
  valid_from,
  valid_until,
  max_uses,
  public_list,
  active
)
VALUES (
  'FIRST5',
  'First 5',
  '+5.000 tokens por dia no chat da Metis ate o fim do mes. Resgate ja!',
  '{"tier":"premium","tokens":5000,"duration":"until_end_of_month"}'::jsonb,
  '2026-06-01T00:00:00Z',
  '2026-06-30T23:59:59Z',
  NULL,
  true,
  true
)
ON CONFLICT (code) DO UPDATE SET
  title        = EXCLUDED.title,
  description  = EXCLUDED.description,
  effect       = EXCLUDED.effect,
  valid_from   = EXCLUDED.valid_from,
  valid_until  = EXCLUDED.valid_until,
  max_uses     = EXCLUDED.max_uses,
  public_list  = EXCLUDED.public_list,
  active       = EXCLUDED.active;
