-- =============================================
-- MÓDULO OPERACIONAL: corrige drive_file_id com caractere invisível + webhook
-- de upload por fonte (em vez de secret global)
-- =============================================

-- Limpa de uma vez só os IDs já salvos com espaço/tab/caractere invisível no
-- meio ou nas pontas (ex.: a fonte "Caixa" tinha um TAB no final, fazendo
-- source.drive_file_id nunca bater com o que o n8n envia). Mesma lista de
-- caracteres tratada por normalizarDriveFileId (ingestAuth.ts) no lado do
-- código - aqui é só o backfill único dos dados já sujos.
UPDATE public.op_sources
SET drive_file_id = regexp_replace(
  drive_file_id,
  '[' || chr(9) || chr(10) || chr(13) || chr(160) || chr(8203) || chr(8204) || chr(8205) || chr(65279) || ' ]+',
  '', 'g'
)
WHERE drive_file_id ~ ('[' || chr(9) || chr(10) || chr(13) || chr(160) || chr(8203) || chr(8204) || chr(8205) || chr(65279) || ' ]');

-- Cada fonte tem seu próprio webhook de upload manual (antes era um secret
-- global no ambiente da function) - NULL = upload ainda não configurado
-- para esta fonte, e a tela Fontes deve desabilitar o botão "Atualizar
-- agora" nesse caso.
ALTER TABLE public.op_sources
  ADD COLUMN IF NOT EXISTS upload_webhook_url TEXT,
  ADD COLUMN IF NOT EXISTS upload_webhook_secret TEXT;
