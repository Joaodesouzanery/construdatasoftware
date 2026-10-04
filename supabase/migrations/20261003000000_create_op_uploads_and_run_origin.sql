-- =============================================
-- MÓDULO OPERACIONAL: upload manual de planilha (botão "Atualizar agora")
-- =============================================
-- op_runs ganha de onde veio cada execução - sem isso, não dá pra distinguir
-- na tela "última origem: Drive automático" de "upload de <usuário>".
-- DEFAULT 'drive_auto' preserva o contrato: quem já envia sem o campo `meta`
-- continua sendo registrado exatamente como antes.
ALTER TABLE public.op_runs
  ADD COLUMN IF NOT EXISTS origin TEXT NOT NULL DEFAULT 'drive_auto'
    CHECK (origin IN ('drive_auto', 'upload'));

-- E-mail de quem fez o upload manual (não UUID - este app não tem tela de
-- "outros usuários" para resolver um id em nome, e cada organização aqui é
-- um único dono de conta, então o e-mail já identifica quem fez o quê).
ALTER TABLE public.op_runs
  ADD COLUMN IF NOT EXISTS uploaded_by_email TEXT;

-- Uma linha por tentativa de upload manual (a Edge Function op-upload-planilha
-- grava "pending" antes de chamar o n8n e atualiza para "enviado"/"erro" depois
-- - histórico de quem tentou subir o quê, mesmo quando o n8n falha).
CREATE TABLE IF NOT EXISTS public.op_uploads (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  source_id UUID NOT NULL REFERENCES public.op_sources(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  filename TEXT NOT NULL,
  size INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'enviado', 'erro')),
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_op_uploads_source_created ON public.op_uploads (source_id, created_at DESC);

ALTER TABLE public.op_uploads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Op uploads visible to source owner"
  ON public.op_uploads FOR SELECT
  USING (public.owns_op_source(auth.uid(), source_id));

CREATE POLICY "Op uploads insert by source owner"
  ON public.op_uploads FOR INSERT
  WITH CHECK (public.owns_op_source(auth.uid(), source_id) AND auth.uid() = user_id);
