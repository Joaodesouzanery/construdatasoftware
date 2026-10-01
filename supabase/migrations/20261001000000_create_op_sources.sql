-- =============================================
-- MÓDULO OPERACIONAL: Fase 1 - op_sources
-- =============================================
-- "Organização" neste repositório é o próprio dono da conta (user_id/auth.uid()),
-- igual a todo o resto do app - não existe conceito de empresa multi-usuário aqui.
-- organization_id abaixo é esse dono, não uma entidade nova.

CREATE TABLE IF NOT EXISTS public.op_sources (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL,
  profile TEXT NOT NULL CHECK (profile IN ('caixa', 'operacional_sabesp', 'gestao_empresa')),
  label TEXT NOT NULL,
  drive_file_id TEXT NOT NULL,
  token_hash TEXT NOT NULL UNIQUE,
  active BOOLEAN NOT NULL DEFAULT true,
  last_checked_at TIMESTAMP WITH TIME ZONE,
  last_file_name TEXT,
  last_file_modified_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.op_sources ENABLE ROW LEVEL SECURITY;

-- A edge function de ingestão autentica por token (não por JWT de usuário) e
-- usa o client de service role, que ignora RLS - estas policies só valem para
-- as telas administrativas (Fontes, Painel de execuções) acessadas pelo dono.
CREATE POLICY "Op sources visible to owner"
  ON public.op_sources FOR SELECT
  USING (auth.uid() = organization_id);

CREATE POLICY "Op sources insert by owner"
  ON public.op_sources FOR INSERT
  WITH CHECK (auth.uid() = organization_id);

CREATE POLICY "Op sources update by owner"
  ON public.op_sources FOR UPDATE
  USING (auth.uid() = organization_id);

CREATE POLICY "Op sources delete by owner"
  ON public.op_sources FOR DELETE
  USING (auth.uid() = organization_id);

CREATE TRIGGER update_op_sources_updated_at
  BEFORE UPDATE ON public.op_sources
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
