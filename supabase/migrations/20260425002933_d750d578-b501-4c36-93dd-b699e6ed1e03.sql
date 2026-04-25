-- Tornar project_id opcional para permitir RDOs Sabesp sem vínculo a projeto
ALTER TABLE public.rdo_sabesp ALTER COLUMN project_id DROP NOT NULL;

-- Remover FK estrita para permitir NULL (mantém integridade quando preenchido)
-- A FK existente já tem ON DELETE CASCADE; aceita NULL automaticamente.

-- Adicionar campos de assinatura (recortes em base64/URL) extraídos da foto
ALTER TABLE public.rdo_sabesp
  ADD COLUMN IF NOT EXISTS assinatura_empreiteira_url text,
  ADD COLUMN IF NOT EXISTS assinatura_consorcio_url text,
  ADD COLUMN IF NOT EXISTS paralisacao_outro text;

-- Atualizar policies para permitir RDOs sem projeto (acessíveis apenas pelo criador)
DROP POLICY IF EXISTS "Users with project access can view rdo_sabesp" ON public.rdo_sabesp;
DROP POLICY IF EXISTS "Users with project access can insert rdo_sabesp" ON public.rdo_sabesp;
DROP POLICY IF EXISTS "Users with project access can update rdo_sabesp" ON public.rdo_sabesp;
DROP POLICY IF EXISTS "Users with project access can delete rdo_sabesp" ON public.rdo_sabesp;

CREATE POLICY "View rdo_sabesp"
  ON public.rdo_sabesp FOR SELECT
  USING (
    auth.uid() = created_by_user_id
    OR (project_id IS NOT NULL AND has_project_access(auth.uid(), project_id))
  );

CREATE POLICY "Insert rdo_sabesp"
  ON public.rdo_sabesp FOR INSERT
  WITH CHECK (
    auth.uid() = created_by_user_id
    AND (project_id IS NULL OR has_project_access(auth.uid(), project_id))
  );

CREATE POLICY "Update rdo_sabesp"
  ON public.rdo_sabesp FOR UPDATE
  USING (
    auth.uid() = created_by_user_id
    OR (project_id IS NOT NULL AND has_project_access(auth.uid(), project_id))
  );

CREATE POLICY "Delete rdo_sabesp"
  ON public.rdo_sabesp FOR DELETE
  USING (
    auth.uid() = created_by_user_id
    OR (project_id IS NOT NULL AND has_project_access(auth.uid(), project_id))
  );