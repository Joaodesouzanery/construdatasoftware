-- =============================================
-- MÓDULO OPERACIONAL: Fase 1 - op_lists
-- =============================================
-- Listas de referência extraídas de abas auxiliares (ex. categorias da
-- "Planilha1" do perfil caixa) - não são registros versionados, apenas o
-- conteúdo mais recente por lista.

CREATE TABLE IF NOT EXISTS public.op_lists (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  source_id UUID NOT NULL REFERENCES public.op_sources(id) ON DELETE CASCADE,
  list_key TEXT NOT NULL,
  items JSONB NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (source_id, list_key)
);

ALTER TABLE public.op_lists ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Op lists visible to source owner"
  ON public.op_lists FOR SELECT
  USING (public.owns_op_source(auth.uid(), source_id));
