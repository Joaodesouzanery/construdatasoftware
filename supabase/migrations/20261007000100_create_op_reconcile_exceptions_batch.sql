-- =============================================
-- MÓDULO OPERACIONAL: reconciliação de exceções em lotes (timeout em abas grandes)
-- =============================================
-- Mesmo motivo de op_apply_interpreted_rows_batch (20261006000000): abas
-- grandes podem gerar muitas exceções (ex. "08. CUSTOS"), e op_reconcile_
-- exceptions (migration 20261001000800) processa tudo num loop linha a
-- linha numa única chamada - possível causa do timeout mesmo já aplicando
-- o diff de registros em lotes. Mesma estratégia: diff set-based, chamada
-- em lotes, fechamento de exceção que não reapareceu só no último lote.

-- Rastreia, por (fonte, aba), quais exceções (row_number, type) já foram
-- vistas nos lotes já aplicados desta leitura - necessário para o
-- "fecha sozinha" só poder ser calculado depois do ÚLTIMO lote.
CREATE TABLE IF NOT EXISTS public.op_reconcile_seen_exceptions (
  source_id UUID NOT NULL,
  sheet_name TEXT NOT NULL,
  row_number INTEGER NOT NULL,
  type TEXT NOT NULL,
  PRIMARY KEY (source_id, sheet_name, row_number, type)
);

ALTER TABLE public.op_reconcile_seen_exceptions ENABLE ROW LEVEL SECURITY;
-- Sem policy de propósito - tabela de apoio interna, só a function abaixo
-- (SECURITY DEFINER, chamada pela edge function com service role) usa.

CREATE OR REPLACE FUNCTION public.op_reconcile_exceptions_batch(
  p_source_id UUID,
  p_run_id TEXT,
  p_sheet_name TEXT,
  p_exceptions JSONB,
  p_is_first_batch BOOLEAN DEFAULT true,
  p_is_last_batch BOOLEAN DEFAULT true
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_counts JSONB;
BEGIN
  IF p_is_first_batch THEN
    DELETE FROM public.op_reconcile_seen_exceptions
    WHERE source_id = p_source_id AND sheet_name = p_sheet_name;
  END IF;

  WITH bruto AS (
    SELECT
      (e->>'row_number')::INTEGER AS row_number,
      e->>'type' AS type,
      e->>'severity' AS severity,
      e->>'message' AS message,
      e->'value_current' AS value_current,
      e->'value_suggested' AS value_suggested,
      ord
    FROM jsonb_array_elements(p_exceptions) WITH ORDINALITY AS t(e, ord)
  ),
  entrada AS (
    -- Defesa contra (row_number, type) duplicado dentro do mesmo lote -
    -- mantém a ocorrência que chegou por último no array.
    SELECT DISTINCT ON (row_number, type) row_number, type, severity, message, value_current, value_suggested
    FROM bruto
    ORDER BY row_number, type, ord DESC
  ),
  upsert AS (
    INSERT INTO public.op_exceptions (
      source_id, run_id, sheet_name, row_number, severity, type, message,
      value_current, value_suggested, status
    )
    SELECT
      p_source_id, p_run_id, p_sheet_name, e.row_number, e.severity, e.type, e.message,
      e.value_current, e.value_suggested, 'aberta'
    FROM entrada e
    ON CONFLICT (source_id, sheet_name, row_number, type)
    DO UPDATE SET
      run_id = EXCLUDED.run_id,
      severity = EXCLUDED.severity,
      message = EXCLUDED.message,
      value_current = EXCLUDED.value_current,
      value_suggested = EXCLUDED.value_suggested,
      status = CASE WHEN public.op_exceptions.status = 'fechada' THEN 'aberta' ELSE public.op_exceptions.status END,
      closed_at = CASE WHEN public.op_exceptions.status = 'fechada' THEN NULL ELSE public.op_exceptions.closed_at END
    RETURNING 1
  ),
  vistos AS (
    INSERT INTO public.op_reconcile_seen_exceptions (source_id, sheet_name, row_number, type)
    SELECT p_source_id, p_sheet_name, row_number, type FROM entrada
    ON CONFLICT (source_id, sheet_name, row_number, type) DO NOTHING
    RETURNING 1
  )
  SELECT jsonb_build_object(
    'bloqueante', count(*) FILTER (WHERE e.severity = 'bloqueante'),
    'confirmacao', count(*) FILTER (WHERE e.severity = 'confirmacao'),
    'aviso', count(*) FILTER (WHERE e.severity NOT IN ('bloqueante', 'confirmacao')),
    '_garante_upsert', (SELECT count(*) FROM upsert),
    '_garante_vistos', (SELECT count(*) FROM vistos)
  )
  INTO v_counts
  FROM entrada e;

  IF p_is_last_batch THEN
    UPDATE public.op_exceptions
    SET status = 'fechada', closed_at = now()
    WHERE source_id = p_source_id
      AND sheet_name = p_sheet_name
      AND status IN ('aberta', 'em_analise')
      AND NOT EXISTS (
        SELECT 1 FROM public.op_reconcile_seen_exceptions sk
        WHERE sk.source_id = p_source_id AND sk.sheet_name = p_sheet_name
          AND sk.row_number = op_exceptions.row_number AND sk.type = op_exceptions.type
      );

    DELETE FROM public.op_reconcile_seen_exceptions
    WHERE source_id = p_source_id AND sheet_name = p_sheet_name;
  END IF;

  RETURN jsonb_build_object(
    'bloqueante', COALESCE((v_counts->>'bloqueante')::int, 0),
    'confirmacao', COALESCE((v_counts->>'confirmacao')::int, 0),
    'aviso', COALESCE((v_counts->>'aviso')::int, 0)
  );
END;
$$;
