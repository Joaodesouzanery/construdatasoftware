-- =============================================
-- MÓDULO OPERACIONAL: Fase 1 - op_alert_rules e op_alerts
-- =============================================
-- Avaliação das regras acontece na Fase 6 (a cada ingestão) - as tabelas já
-- entram agora para a Fase 1 não precisar de outra migração de schema depois.

CREATE TABLE IF NOT EXISTS public.op_alert_rules (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL,
  code TEXT NOT NULL,
  label TEXT NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT true,
  severity TEXT NOT NULL DEFAULT 'aviso' CHECK (severity IN ('bloqueante', 'confirmacao', 'aviso')),
  params JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (organization_id, code)
);

ALTER TABLE public.op_alert_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Op alert rules visible to owner"
  ON public.op_alert_rules FOR SELECT
  USING (auth.uid() = organization_id);

CREATE POLICY "Op alert rules update by owner"
  ON public.op_alert_rules FOR UPDATE
  USING (auth.uid() = organization_id);

CREATE TABLE IF NOT EXISTS public.op_alerts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL,
  source_id UUID REFERENCES public.op_sources(id) ON DELETE CASCADE,
  rule_code TEXT NOT NULL,
  severity TEXT NOT NULL CHECK (severity IN ('bloqueante', 'confirmacao', 'aviso')),
  message TEXT NOT NULL,
  subject_key TEXT NOT NULL,
  opened_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  closed_at TIMESTAMP WITH TIME ZONE
);

-- Nunca dois alertas abertos para a mesma regra+assunto (índice único parcial,
-- só entre os ainda abertos - históricos fechados podem se repetir).
CREATE UNIQUE INDEX IF NOT EXISTS idx_op_alerts_open_unique
  ON public.op_alerts (organization_id, source_id, rule_code, subject_key)
  WHERE closed_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_op_alerts_org_open ON public.op_alerts (organization_id) WHERE closed_at IS NULL;

ALTER TABLE public.op_alerts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Op alerts visible to owner"
  ON public.op_alerts FOR SELECT
  USING (auth.uid() = organization_id);
