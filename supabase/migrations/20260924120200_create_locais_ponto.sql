-- =============================================
-- PONTO ELETRÔNICO: Locais de Ponto (geofence)
-- =============================================
-- Local físico onde o ponto pode ser batido, com raio configurável (metros).
-- Deliberadamente uma tabela nova e independente de `obras`/`unidades`: uma
-- unidade (filial administrativa) pode corresponder a várias frentes de obra
-- fisicamente distintas, então unidade_id aqui é só informativo/organizacional,
-- nunca a fonte de verdade do geofence.

CREATE TABLE IF NOT EXISTS public.locais_ponto (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  unidade_id UUID REFERENCES public.unidades(id) ON DELETE SET NULL,
  nome TEXT NOT NULL,
  endereco TEXT,
  latitude NUMERIC(10,8) NOT NULL CHECK (latitude BETWEEN -90 AND 90),
  longitude NUMERIC(11,8) NOT NULL CHECK (longitude BETWEEN -180 AND 180),
  raio_metros INTEGER NOT NULL DEFAULT 200 CHECK (raio_metros > 0 AND raio_metros <= 5000),
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.locais_ponto ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Locais de ponto visible to owner or super admin"
  ON public.locais_ponto FOR SELECT
  USING (
    auth.uid() = user_id
    OR EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND is_super_admin = true)
  );

CREATE POLICY "Locais de ponto insert by owner"
  ON public.locais_ponto FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Locais de ponto update by owner or super admin"
  ON public.locais_ponto FOR UPDATE
  USING (
    auth.uid() = user_id
    OR EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND is_super_admin = true)
  );

CREATE POLICY "Locais de ponto delete by owner or super admin"
  ON public.locais_ponto FOR DELETE
  USING (
    auth.uid() = user_id
    OR EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND is_super_admin = true)
  );

CREATE TRIGGER update_locais_ponto_updated_at
  BEFORE UPDATE ON public.locais_ponto
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
