-- =============================================
-- MÓDULO OPERACIONAL: Fase G1 - Espelho de abas (qualquer perfil)
-- =============================================
-- Texto exatamente como aparece no Excel ("R$ 3.329.907,97", "41,29%",
-- "set/26"), mesma forma de `rows` - OPCIONAL, não muda o hash de mudança
-- (que continua calculado só sobre `rows`) nem a idempotência existente.
ALTER TABLE public.op_snapshots
  ADD COLUMN IF NOT EXISTS formatted_rows JSONB;
