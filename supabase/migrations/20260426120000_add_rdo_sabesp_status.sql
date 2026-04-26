ALTER TABLE public.rdo_sabesp
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'finalized',
  ADD COLUMN IF NOT EXISTS finalized_at timestamptz;

ALTER TABLE public.rdo_sabesp
  DROP CONSTRAINT IF EXISTS rdo_sabesp_status_check;

ALTER TABLE public.rdo_sabesp
  ADD CONSTRAINT rdo_sabesp_status_check
  CHECK (status IN ('draft', 'finalized'));

UPDATE public.rdo_sabesp
SET
  status = COALESCE(status, 'finalized'),
  finalized_at = COALESCE(finalized_at, created_at)
WHERE status IS NULL OR finalized_at IS NULL;
