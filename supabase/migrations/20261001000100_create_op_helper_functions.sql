-- =============================================
-- MÓDULO OPERACIONAL: Fase 1 - funções auxiliares de RLS
-- =============================================
-- Mesmo estilo de owns_funcionario/is_own_funcionario (Ponto Eletrônico):
-- LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public.

CREATE OR REPLACE FUNCTION public.owns_op_source(_user_id UUID, _source_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.op_sources
    WHERE id = _source_id AND organization_id = _user_id
  )
$$;
