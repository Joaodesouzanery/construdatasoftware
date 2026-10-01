-- =============================================
-- MÓDULO OPERACIONAL: Fase 1 - op_runs e op_snapshots
-- =============================================

-- Uma linha por (fonte, run_id, aba) recebida do n8n - idempotência: reenviar
-- o mesmo run_id+aba devolve o resultado já guardado em "response", sem reprocessar.
CREATE TABLE IF NOT EXISTS public.op_runs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  source_id UUID NOT NULL REFERENCES public.op_sources(id) ON DELETE CASCADE,
  run_id TEXT NOT NULL,
  sheet_name TEXT,
  received_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  file_name TEXT,
  file_modified_at TIMESTAMP WITH TIME ZONE,
  status TEXT NOT NULL CHECK (status IN ('processada', 'inalterada', 'rejeitada', 'nao_interpretada', 'batimento')),
  counts JSONB NOT NULL DEFAULT '{}'::jsonb,
  response JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (source_id, run_id, sheet_name)
);

CREATE INDEX IF NOT EXISTS idx_op_runs_source_received ON public.op_runs (source_id, received_at DESC);

ALTER TABLE public.op_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Op runs visible to source owner"
  ON public.op_runs FOR SELECT
  USING (public.owns_op_source(auth.uid(), source_id));

-- Apenas o snapshot MAIS RECENTE de cada aba é consultado para comparação de
-- hash (não todo o histórico) - o índice cobre essa consulta.
CREATE TABLE IF NOT EXISTS public.op_snapshots (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  source_id UUID NOT NULL REFERENCES public.op_sources(id) ON DELETE CASCADE,
  sheet_name TEXT NOT NULL,
  sheet_hash TEXT NOT NULL,
  received_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  run_id TEXT NOT NULL,
  rows JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_op_snapshots_source_sheet_received
  ON public.op_snapshots (source_id, sheet_name, received_at DESC);

ALTER TABLE public.op_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Op snapshots visible to source owner"
  ON public.op_snapshots FOR SELECT
  USING (public.owns_op_source(auth.uid(), source_id));
