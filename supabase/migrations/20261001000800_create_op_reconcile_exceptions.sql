-- =============================================
-- MÓDULO OPERACIONAL: Fase 1 - reconciliação de exceções (aplicação atômica)
-- =============================================
-- Identidade de uma exceção: (source_id, sheet_name, row_number, type). Se a
-- mesma exceção aparece de novo (mesmo que tenha sido fechada à mão), ela
-- reabre. Se uma exceção que estava aberta/em_analise não é reproduzida nesta
-- rodada, fecha sozinha.

CREATE OR REPLACE FUNCTION public.op_reconcile_exceptions(
  p_source_id UUID,
  p_run_id TEXT,
  p_sheet_name TEXT,
  p_exceptions JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_exc JSONB;
  v_row_number INTEGER;
  v_type TEXT;
  v_seen TEXT[] := ARRAY[]::TEXT[];
  v_bloqueante INTEGER := 0;
  v_confirmacao INTEGER := 0;
  v_aviso INTEGER := 0;
BEGIN
  FOR v_exc IN SELECT * FROM jsonb_array_elements(p_exceptions)
  LOOP
    v_row_number := (v_exc->>'row_number')::INTEGER;
    v_type := v_exc->>'type';
    v_seen := array_append(v_seen, v_row_number::TEXT || '|' || v_type);

    INSERT INTO public.op_exceptions (
      source_id, run_id, sheet_name, row_number, severity, type, message,
      value_current, value_suggested, status
    )
    VALUES (
      p_source_id, p_run_id, p_sheet_name, v_row_number,
      v_exc->>'severity', v_type, v_exc->>'message',
      v_exc->'value_current', v_exc->'value_suggested', 'aberta'
    )
    ON CONFLICT (source_id, sheet_name, row_number, type)
    DO UPDATE SET
      run_id = EXCLUDED.run_id,
      severity = EXCLUDED.severity,
      message = EXCLUDED.message,
      value_current = EXCLUDED.value_current,
      value_suggested = EXCLUDED.value_suggested,
      status = CASE WHEN public.op_exceptions.status = 'fechada' THEN 'aberta' ELSE public.op_exceptions.status END,
      closed_at = CASE WHEN public.op_exceptions.status = 'fechada' THEN NULL ELSE public.op_exceptions.closed_at END;

    IF v_exc->>'severity' = 'bloqueante' THEN
      v_bloqueante := v_bloqueante + 1;
    ELSIF v_exc->>'severity' = 'confirmacao' THEN
      v_confirmacao := v_confirmacao + 1;
    ELSE
      v_aviso := v_aviso + 1;
    END IF;
  END LOOP;

  UPDATE public.op_exceptions
  SET status = 'fechada', closed_at = now()
  WHERE source_id = p_source_id
    AND sheet_name = p_sheet_name
    AND status IN ('aberta', 'em_analise')
    AND NOT ((row_number::TEXT || '|' || type) = ANY(v_seen));

  RETURN jsonb_build_object('bloqueante', v_bloqueante, 'confirmacao', v_confirmacao, 'aviso', v_aviso);
END;
$$;
