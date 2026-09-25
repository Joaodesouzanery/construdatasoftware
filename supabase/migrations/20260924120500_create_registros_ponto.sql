-- =============================================
-- PONTO ELETRÔNICO: registros de ponto (ledger imutável)
-- =============================================

CREATE TYPE public.tipo_ponto AS ENUM ('entrada', 'inicio_intervalo', 'fim_intervalo', 'saida');

CREATE TABLE IF NOT EXISTS public.registros_ponto (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  funcionario_id UUID NOT NULL REFERENCES public.funcionarios(id) ON DELETE RESTRICT,
  local_ponto_id UUID REFERENCES public.locais_ponto(id) ON DELETE SET NULL,
  tipo public.tipo_ponto NOT NULL,
  momento TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  device_timestamp TIMESTAMP WITH TIME ZONE,
  latitude NUMERIC(10,8) NOT NULL CHECK (latitude BETWEEN -90 AND 90),
  longitude NUMERIC(11,8) NOT NULL CHECK (longitude BETWEEN -180 AND 180),
  precisao_metros NUMERIC,
  distancia_metros NUMERIC,
  dentro_raio BOOLEAN NOT NULL DEFAULT false,
  ip_address INET,
  user_agent TEXT,
  origem TEXT NOT NULL DEFAULT 'app',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_registros_ponto_funcionario_momento
  ON public.registros_ponto (funcionario_id, momento DESC);

ALTER TABLE public.registros_ponto ENABLE ROW LEVEL SECURITY;

-- SELECT: o próprio funcionário vê seu histórico; o gestor dono vê todos os seus
-- funcionários; super admin vê tudo.
CREATE POLICY "Registros de ponto visible to own funcionario, owner or super admin"
  ON public.registros_ponto FOR SELECT
  USING (
    public.is_own_funcionario(auth.uid(), funcionario_id)
    OR public.owns_funcionario(auth.uid(), funcionario_id)
    OR EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND is_super_admin = true)
  );

-- INSERT: só o próprio funcionário pode registrar seu ponto - nem o gestor pode
-- inserir em nome de outra pessoa, nem para o MVP.
CREATE POLICY "Registros de ponto insert by own funcionario"
  ON public.registros_ponto FOR INSERT
  WITH CHECK (public.is_own_funcionario(auth.uid(), funcionario_id));

-- Nenhuma política de UPDATE ou DELETE é criada de propósito: com RLS habilitada
-- e nenhuma policy para esses comandos, ninguém - nem super admin - consegue
-- alterar ou apagar um registro de ponto através do cliente (PostgREST/app).
-- Correções devem ser registros de "ajuste" separados referenciando o original
-- (Portaria 671 / Art. 74 CLT), nunca um UPDATE. Uma correção excepcional só é
-- possível via acesso direto ao banco (service role/DB admin), fora deste app,
-- e deve ser tratada como exceção documentada, não como fluxo do produto.
