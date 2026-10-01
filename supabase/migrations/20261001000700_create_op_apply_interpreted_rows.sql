-- =============================================
-- MÓDULO OPERACIONAL: Fase 1 - motor de diff (aplicação atômica)
-- =============================================
-- Recebe linhas JÁ interpretadas (natural_key + data), produzidas por um
-- interpretador puro (TypeScript, sem acesso a banco - Regra de Ouro 7) do
-- lado da edge function op-ingest-sheet, e aplica o diff inteiro numa única
-- transação de função SQL: novo/alterado/inalterado/ausente/reapareceu.
--
-- p_skip_ausente_check: quando o interpretador rejeitou alguma linha nesta
-- rodada (erro bloqueante que impede calcular a chave natural), não dá para
-- saber com segurança quais chaves antigas realmente desapareceram vs. quais
-- só não puderam ser recalculadas - por segurança, pula a detecção de
-- "ausente" no todo para este sheet_key nesta rodada em vez de arriscar marcar
-- como ausente um registro que na verdade só teve uma linha vizinha rejeitada.

CREATE OR REPLACE FUNCTION public.op_apply_interpreted_rows(
  p_source_id UUID,
  p_run_id TEXT,
  p_sheet_key TEXT,
  p_rows JSONB,
  p_skip_ausente_check BOOLEAN DEFAULT false
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row JSONB;
  v_natural_key TEXT;
  v_data JSONB;
  v_source_row INTEGER;
  v_data_hash TEXT;
  v_existing RECORD;
  v_seen_keys TEXT[] := ARRAY[]::TEXT[];
  v_novo INTEGER := 0;
  v_alterado INTEGER := 0;
  v_inalterado INTEGER := 0;
  v_ausente INTEGER := 0;
  v_reapareceu INTEGER := 0;
BEGIN
  FOR v_row IN SELECT * FROM jsonb_array_elements(p_rows)
  LOOP
    v_natural_key := v_row->>'natural_key';
    v_data := v_row->'data';
    v_source_row := (v_row->>'source_row')::INTEGER;
    v_data_hash := md5(v_data::text);

    v_seen_keys := array_append(v_seen_keys, v_natural_key);

    SELECT * INTO v_existing
    FROM public.op_records
    WHERE source_id = p_source_id AND sheet_key = p_sheet_key AND natural_key = v_natural_key;

    IF NOT FOUND THEN
      INSERT INTO public.op_records (source_id, sheet_key, natural_key, data, data_hash, source_row, status, first_seen_at, last_seen_at, last_changed_at)
      VALUES (p_source_id, p_sheet_key, v_natural_key, v_data, v_data_hash, v_source_row, 'ativo', now(), now(), now());

      INSERT INTO public.op_changes (source_id, run_id, sheet_key, natural_key, change_type, before, after, fields_changed)
      VALUES (p_source_id, p_run_id, p_sheet_key, v_natural_key, 'novo', NULL, v_data, NULL);

      v_novo := v_novo + 1;

    ELSIF v_existing.status = 'ausente' THEN
      UPDATE public.op_records
      SET data = v_data, data_hash = v_data_hash, source_row = v_source_row, status = 'ativo',
          last_seen_at = now(), last_changed_at = now()
      WHERE id = v_existing.id;

      INSERT INTO public.op_changes (source_id, run_id, sheet_key, natural_key, change_type, before, after, fields_changed)
      VALUES (p_source_id, p_run_id, p_sheet_key, v_natural_key, 'reapareceu', v_existing.data, v_data, NULL);

      v_reapareceu := v_reapareceu + 1;

    ELSIF v_existing.data_hash = v_data_hash THEN
      UPDATE public.op_records SET last_seen_at = now(), source_row = v_source_row WHERE id = v_existing.id;
      v_inalterado := v_inalterado + 1;

    ELSE
      UPDATE public.op_records
      SET data = v_data, data_hash = v_data_hash, source_row = v_source_row,
          last_seen_at = now(), last_changed_at = now()
      WHERE id = v_existing.id;

      INSERT INTO public.op_changes (source_id, run_id, sheet_key, natural_key, change_type, before, after, fields_changed)
      VALUES (
        p_source_id, p_run_id, p_sheet_key, v_natural_key, 'alterado', v_existing.data, v_data,
        (
          SELECT array_agg(k) FROM (
            SELECT key AS k FROM jsonb_each(v_data)
            UNION
            SELECT key AS k FROM jsonb_each(v_existing.data)
          ) keys
          WHERE v_data->k IS DISTINCT FROM v_existing.data->k
        )
      );

      v_alterado := v_alterado + 1;
    END IF;
  END LOOP;

  IF NOT p_skip_ausente_check THEN
    WITH ausentes AS (
      UPDATE public.op_records
      SET status = 'ausente', last_changed_at = now()
      WHERE source_id = p_source_id
        AND sheet_key = p_sheet_key
        AND status = 'ativo'
        AND NOT (natural_key = ANY(v_seen_keys))
      RETURNING natural_key, data
    )
    INSERT INTO public.op_changes (source_id, run_id, sheet_key, natural_key, change_type, before, after, fields_changed)
    SELECT p_source_id, p_run_id, p_sheet_key, natural_key, 'ausente', data, NULL, NULL
    FROM ausentes;

    GET DIAGNOSTICS v_ausente = ROW_COUNT;
  END IF;

  RETURN jsonb_build_object(
    'novo', v_novo,
    'alterado', v_alterado,
    'inalterado', v_inalterado,
    'ausente', v_ausente,
    'reapareceu', v_reapareceu
  );
END;
$$;
