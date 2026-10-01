-- =============================================
-- MÓDULO OPERACIONAL: Fase 6 - reconciliação de alertas (aplicação atômica)
-- =============================================
-- Identidade de um alerta: (organization_id, source_id, rule_code,
-- subject_key). Abre quando a condição é verdadeira, fecha sozinho quando
-- deixa de ser - nunca dois abertos para a mesma regra+assunto (garantido
-- também pelo índice único parcial de 20261001000500_create_op_alerts.sql).

CREATE OR REPLACE FUNCTION public.op_reconcile_alerts(
  p_organization_id UUID,
  p_source_id UUID,
  p_alerts JSONB
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_alert JSONB;
  v_seen TEXT[] := ARRAY[]::TEXT[];
  v_abertos INTEGER := 0;
  v_existe BOOLEAN;
BEGIN
  FOR v_alert IN SELECT * FROM jsonb_array_elements(p_alerts)
  LOOP
    v_seen := array_append(v_seen, (v_alert->>'rule_code') || '|' || (v_alert->>'subject_key'));

    SELECT EXISTS (
      SELECT 1 FROM public.op_alerts
      WHERE organization_id = p_organization_id AND source_id = p_source_id
        AND rule_code = v_alert->>'rule_code' AND subject_key = v_alert->>'subject_key'
        AND closed_at IS NULL
    ) INTO v_existe;

    IF NOT v_existe THEN
      INSERT INTO public.op_alerts (organization_id, source_id, rule_code, severity, message, subject_key)
      VALUES (p_organization_id, p_source_id, v_alert->>'rule_code', v_alert->>'severity', v_alert->>'message', v_alert->>'subject_key');
      v_abertos := v_abertos + 1;
    ELSE
      UPDATE public.op_alerts
      SET message = v_alert->>'message', severity = v_alert->>'severity'
      WHERE organization_id = p_organization_id AND source_id = p_source_id
        AND rule_code = v_alert->>'rule_code' AND subject_key = v_alert->>'subject_key'
        AND closed_at IS NULL;
    END IF;
  END LOOP;

  -- Fecha sozinho: alertas desta fonte que estavam abertos e não foram
  -- reproduzidos nesta rodada de avaliação.
  UPDATE public.op_alerts
  SET closed_at = now()
  WHERE organization_id = p_organization_id AND source_id = p_source_id
    AND closed_at IS NULL
    AND NOT ((rule_code || '|' || subject_key) = ANY(v_seen));

  RETURN v_abertos;
END;
$$;
