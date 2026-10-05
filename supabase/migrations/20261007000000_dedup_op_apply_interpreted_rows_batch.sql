-- =============================================
-- MÓDULO OPERACIONAL: corrige "ON CONFLICT DO UPDATE... a second time"
-- =============================================
-- Regressão da função em lotes (20261006000000): se o MESMO natural_key
-- aparecer duas vezes dentro do mesmo lote (ex. mesma CONTA repetida em
-- duas sub-seções da aba real, sem interpretarComoSerieMensal aplicar
-- sufixo ainda - corrigido no código TS também, mas esta é a defesa do
-- lado do banco para qualquer interpretador, presente ou futuro, que
-- cometa o mesmo erro), um único INSERT ... ON CONFLICT DO UPDATE não
-- aceita o mesmo conflito duas vezes na mesma instrução e o Postgres
-- derruba o lote inteiro. Dedup aqui: mantém só a ÚLTIMA ocorrência de
-- cada natural_key dentro do lote (pela ordem de chegada no array
-- p_rows), nunca falha o lote por isso.
CREATE OR REPLACE FUNCTION public.op_apply_interpreted_rows_batch(
  p_source_id UUID,
  p_run_id TEXT,
  p_sheet_key TEXT,
  p_rows JSONB,
  p_is_first_batch BOOLEAN DEFAULT true,
  p_is_last_batch BOOLEAN DEFAULT true,
  p_skip_ausente_check BOOLEAN DEFAULT false
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_counts JSONB;
  v_ausente INTEGER := 0;
BEGIN
  IF p_is_first_batch THEN
    DELETE FROM public.op_apply_seen_keys
    WHERE source_id = p_source_id AND sheet_key = p_sheet_key;
  END IF;

  WITH bruto AS (
    SELECT
      (r->>'natural_key') AS natural_key,
      (r->'data') AS data,
      (r->>'source_row')::INTEGER AS source_row,
      md5((r->'data')::text) AS data_hash,
      ord
    FROM jsonb_array_elements(p_rows) WITH ORDINALITY AS t(r, ord)
  ),
  entrada AS (
    -- Defesa contra natural_key duplicado dentro do mesmo lote - mantém a
    -- ocorrência que chegou por último no array (maior ord).
    SELECT DISTINCT ON (natural_key) natural_key, data, source_row, data_hash
    FROM bruto
    ORDER BY natural_key, ord DESC
  ),
  antes AS (
    SELECT o.natural_key, o.data AS data_antes, o.data_hash AS hash_antes, o.status AS status_antes
    FROM public.op_records o
    WHERE o.source_id = p_source_id AND o.sheet_key = p_sheet_key
      AND o.natural_key IN (SELECT natural_key FROM entrada)
  ),
  classificado AS (
    SELECT
      e.natural_key, e.data, e.source_row, e.data_hash, a.data_antes,
      CASE
        WHEN a.natural_key IS NULL THEN 'novo'
        WHEN a.status_antes = 'ausente' THEN 'reapareceu'
        WHEN a.hash_antes = e.data_hash THEN 'inalterado'
        ELSE 'alterado'
      END AS tipo
    FROM entrada e
    LEFT JOIN antes a ON a.natural_key = e.natural_key
  ),
  upsert AS (
    INSERT INTO public.op_records (source_id, sheet_key, natural_key, data, data_hash, source_row, status, first_seen_at, last_seen_at, last_changed_at)
    SELECT p_source_id, p_sheet_key, c.natural_key, c.data, c.data_hash, c.source_row, 'ativo', now(), now(), now()
    FROM classificado c
    ON CONFLICT (source_id, sheet_key, natural_key) DO UPDATE SET
      data = EXCLUDED.data,
      data_hash = EXCLUDED.data_hash,
      source_row = EXCLUDED.source_row,
      status = 'ativo',
      last_seen_at = now(),
      last_changed_at = CASE
        WHEN public.op_records.data_hash IS DISTINCT FROM EXCLUDED.data_hash OR public.op_records.status <> 'ativo'
        THEN now()
        ELSE public.op_records.last_changed_at
      END
    RETURNING 1
  ),
  mudancas AS (
    INSERT INTO public.op_changes (source_id, run_id, sheet_key, natural_key, change_type, before, after, fields_changed)
    SELECT
      p_source_id, p_run_id, p_sheet_key, c.natural_key, c.tipo, c.data_antes, c.data,
      CASE WHEN c.tipo = 'alterado' THEN (
        SELECT array_agg(k) FROM (
          SELECT key AS k FROM jsonb_each(c.data)
          UNION
          SELECT key AS k FROM jsonb_each(c.data_antes)
        ) keys
        WHERE c.data->k IS DISTINCT FROM c.data_antes->k
      ) ELSE NULL END
    FROM classificado c
    WHERE c.tipo IN ('novo', 'alterado', 'reapareceu')
    RETURNING 1
  ),
  vistos AS (
    INSERT INTO public.op_apply_seen_keys (source_id, sheet_key, natural_key)
    SELECT p_source_id, p_sheet_key, natural_key FROM entrada
    ON CONFLICT (source_id, sheet_key, natural_key) DO NOTHING
    RETURNING 1
  )
  SELECT jsonb_build_object(
    'novo', count(*) FILTER (WHERE c.tipo = 'novo'),
    'alterado', count(*) FILTER (WHERE c.tipo = 'alterado'),
    'inalterado', count(*) FILTER (WHERE c.tipo = 'inalterado'),
    'reapareceu', count(*) FILTER (WHERE c.tipo = 'reapareceu'),
    '_garante_upsert', (SELECT count(*) FROM upsert),
    '_garante_mudancas', (SELECT count(*) FROM mudancas),
    '_garante_vistos', (SELECT count(*) FROM vistos)
  )
  INTO v_counts
  FROM classificado c;

  IF p_is_last_batch AND NOT p_skip_ausente_check THEN
    WITH ausentes AS (
      UPDATE public.op_records
      SET status = 'ausente', last_changed_at = now()
      WHERE source_id = p_source_id
        AND sheet_key = p_sheet_key
        AND status = 'ativo'
        AND NOT EXISTS (
          SELECT 1 FROM public.op_apply_seen_keys sk
          WHERE sk.source_id = p_source_id AND sk.sheet_key = p_sheet_key AND sk.natural_key = op_records.natural_key
        )
      RETURNING natural_key, data
    )
    INSERT INTO public.op_changes (source_id, run_id, sheet_key, natural_key, change_type, before, after, fields_changed)
    SELECT p_source_id, p_run_id, p_sheet_key, natural_key, 'ausente', data, NULL, NULL
    FROM ausentes;

    GET DIAGNOSTICS v_ausente = ROW_COUNT;
  END IF;

  IF p_is_last_batch THEN
    DELETE FROM public.op_apply_seen_keys
    WHERE source_id = p_source_id AND sheet_key = p_sheet_key;
  END IF;

  RETURN jsonb_build_object(
    'novo', (v_counts->>'novo')::int,
    'alterado', (v_counts->>'alterado')::int,
    'inalterado', (v_counts->>'inalterado')::int,
    'ausente', v_ausente,
    'reapareceu', (v_counts->>'reapareceu')::int
  );
END;
$$;
