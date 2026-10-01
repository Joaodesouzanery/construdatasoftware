-- =============================================
-- MÓDULO OPERACIONAL: Fase 1 - op_exceptions
-- =============================================
-- Identidade de uma exceção ao longo do tempo: (fonte, aba, linha, tipo).
-- Isso permite fechar sozinha quando a leitura seguinte não a reproduz, e
-- reabrir se reaparecer (mesmo se fechada à mão) - ver função
-- op_reconcile_exceptions.

CREATE TABLE IF NOT EXISTS public.op_exceptions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  source_id UUID NOT NULL REFERENCES public.op_sources(id) ON DELETE CASCADE,
  run_id TEXT NOT NULL,
  sheet_name TEXT NOT NULL,
  row_number INTEGER NOT NULL,
  severity TEXT NOT NULL CHECK (severity IN ('bloqueante', 'confirmacao', 'aviso')),
  type TEXT NOT NULL,
  message TEXT NOT NULL,
  value_current JSONB,
  value_suggested JSONB,
  status TEXT NOT NULL DEFAULT 'aberta' CHECK (status IN ('aberta', 'em_analise', 'fechada')),
  assigned_to UUID,
  note TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  closed_at TIMESTAMP WITH TIME ZONE,
  UNIQUE (source_id, sheet_name, row_number, type)
);

CREATE INDEX IF NOT EXISTS idx_op_exceptions_source_status ON public.op_exceptions (source_id, status);

ALTER TABLE public.op_exceptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Op exceptions visible to source owner"
  ON public.op_exceptions FOR SELECT
  USING (public.owns_op_source(auth.uid(), source_id));

-- O dono pode atribuir/comentar/mudar status manualmente (ex. marcar
-- "em_analise") - a reabertura automática por reaparecimento é feita pela
-- função op_reconcile_exceptions via service role, não por esta policy.
CREATE POLICY "Op exceptions update by source owner"
  ON public.op_exceptions FOR UPDATE
  USING (public.owns_op_source(auth.uid(), source_id));
