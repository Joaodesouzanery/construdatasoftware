-- =============================================
-- MÓDULO OPERACIONAL: Fase 1 - op_records e op_changes (núcleo do diff)
-- =============================================

-- Estado atual de cada registro interpretado, por (fonte, perfil de aba,
-- chave natural). "ausente" nunca é apagado, só muda de status (Regra de Ouro 3).
CREATE TABLE IF NOT EXISTS public.op_records (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  source_id UUID NOT NULL REFERENCES public.op_sources(id) ON DELETE CASCADE,
  sheet_key TEXT NOT NULL,
  natural_key TEXT NOT NULL,
  data JSONB NOT NULL,
  data_hash TEXT NOT NULL,
  source_row INTEGER,
  status TEXT NOT NULL DEFAULT 'ativo' CHECK (status IN ('ativo', 'ausente')),
  first_seen_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  last_seen_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  last_changed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (source_id, sheet_key, natural_key)
);

CREATE INDEX IF NOT EXISTS idx_op_records_source_sheet_status
  ON public.op_records (source_id, sheet_key, status);

ALTER TABLE public.op_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Op records visible to source owner"
  ON public.op_records FOR SELECT
  USING (public.owns_op_source(auth.uid(), source_id));

-- Trilha de auditoria de toda mudança detectada - nunca editada, só inserida
-- (pelo trigger/função de apply, com service role, nunca pelo cliente).
CREATE TABLE IF NOT EXISTS public.op_changes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  source_id UUID NOT NULL REFERENCES public.op_sources(id) ON DELETE CASCADE,
  run_id TEXT NOT NULL,
  sheet_key TEXT NOT NULL,
  natural_key TEXT NOT NULL,
  change_type TEXT NOT NULL CHECK (change_type IN ('novo', 'alterado', 'ausente', 'reapareceu')),
  before JSONB,
  after JSONB,
  fields_changed TEXT[],
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_op_changes_source_created ON public.op_changes (source_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_op_changes_source_run ON public.op_changes (source_id, run_id);

ALTER TABLE public.op_changes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Op changes visible to source owner"
  ON public.op_changes FOR SELECT
  USING (public.owns_op_source(auth.uid(), source_id));
