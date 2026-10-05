-- =============================================
-- MÓDULO OPERACIONAL: aplicação do diff em lotes (corrige timeout em abas grandes)
-- =============================================
-- op_apply_interpreted_rows (migration 20261001000700) processa p_rows num
-- loop linha a linha (1 SELECT + 1 INSERT/UPDATE por linha) numa ÚNICA
-- chamada - para ~20 mil linhas (ex. "08. CUSTOS") isso excede o
-- statement_timeout do Postgres. A versão em lotes abaixo:
--  1) resolve o diff com um JOIN set-based (1 query grande em vez de N
--     pequenas) - muito mais rápido por lote;
--  2) é desenhada para ser chamada várias vezes (uma por lote de ~2000
--     linhas), cada chamada seu próprio statement/timeout.
-- A função antiga fica para trás sem uso (nenhuma migration deste
-- repositório edita migrations já aplicadas).

-- Rastreia, por (fonte, sheet_key), quais chaves naturais já foram vistas
-- nos lotes já aplicados desta leitura - necessário porque o cálculo de
-- "ausente" (o que existia e não apareceu mais) só pode ser feito depois do
-- ÚLTIMO lote, comparando contra TUDO que foi visto, não só o lote atual.
CREATE TABLE IF NOT EXISTS public.op_apply_seen_keys (
  source_id UUID NOT NULL,
  sheet_key TEXT NOT NULL,
  natural_key TEXT NOT NULL,
  PRIMARY KEY (source_id, sheet_key, natural_key)
);

ALTER TABLE public.op_apply_seen_keys ENABLE ROW LEVEL SECURITY;
-- Sem policy nenhuma de propósito: é tabela de apoio interna, só lida/escrita
-- pela function SECURITY DEFINER abaixo (a edge function usa service role,
-- que ignora RLS) - nunca consultada direto pelas telas.

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

  WITH entrada AS (
    SELECT
      (r->>'natural_key') AS natural_key,
      (r->'data') AS data,
      (r->>'source_row')::INTEGER AS source_row,
      md5((r->'data')::text) AS data_hash
    FROM jsonb_array_elements(p_rows) AS r
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
  -- As 3 subqueries escalares abaixo não têm outro papel que não forçar a
  -- execução das 3 CTEs de escrita acima (upsert/mudancas/vistos são
  -- INSERT ... RETURNING - precisam ser referenciadas para o Postgres
  -- garantir que rodam, já que esta query principal não os usa diretamente).
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
