-- Migration 018 — Seed do cupom `FIRST5`
--
-- Cupom de escassez: 5.000 tokens validos ate o fim do mes (junho/2026),
-- so para os 5 primeiros que resgatarem. Aparece na /pricing e na /account
-- (public_list = true) com o contador "X restantes"; o codigo fica escondido
-- (easter-egg, decisao Cesar 2026-04-22).
--
-- ATENCAO (estado real do sistema em 2026-06-08):
--   O efeito NAO e aplicado por codigo ainda. O botao "Resgatar" da /account e
--   stub (account/page.tsx) e o token_guard.py e 100% mensal por tier — nao ha
--   fluxo que valide o codigo, incremente uses_count nem conceda os 5k tokens.
--   Esta linha e EXIBICAO. O enforcement (resgate atomico "primeiros 5" + grant
--   de tokens ate o fim do mes) e um ticket futuro.
--
-- code em MAIUSCULO: os inputs de resgate ja fazem .toUpperCase(), entao o
-- codigo armazenado precisa casar quando o resgate existir.
--
-- Idempotente: ON CONFLICT (code) DO NOTHING — re-rodar a migration nao duplica
-- nem reseta uses_count.

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
  '5.000 tokens validos ate o fim do mes. So para os 5 primeiros que resgatarem.',
  '{"tier":"premium","tokens":5000,"duration":"until_end_of_month"}'::jsonb,
  '2026-06-01T00:00:00Z',
  '2026-06-30T23:59:59Z',
  5,
  true,
  true
)
ON CONFLICT (code) DO NOTHING;
