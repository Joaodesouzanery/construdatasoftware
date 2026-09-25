-- =============================================
-- PONTO ELETRÔNICO: funções auxiliares de RLS e geolocalização
-- =============================================
-- Mesmo estilo de has_role/is_admin/has_project_access já usadas no projeto:
-- LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public.

-- Distância em metros entre duas coordenadas (fórmula de Haversine).
-- Sem PostGIS/earthdistance: consistente com o resto do projeto, que usa
-- NUMERIC simples para lat/long (obras, projects) e não tem essa extensão habilitada.
CREATE OR REPLACE FUNCTION public.calcular_distancia_metros(
  lat1 NUMERIC, lon1 NUMERIC, lat2 NUMERIC, lon2 NUMERIC
)
RETURNS NUMERIC
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT 6371000 * 2 * asin(
    sqrt(
      power(sin(radians(lat2 - lat1) / 2), 2) +
      cos(radians(lat1)) * cos(radians(lat2)) *
      power(sin(radians(lon2 - lon1) / 2), 2)
    )
  );
$$;

-- O usuário autenticado é o GESTOR dono deste funcionário?
CREATE OR REPLACE FUNCTION public.owns_funcionario(_user_id UUID, _funcionario_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.funcionarios
    WHERE id = _funcionario_id AND user_id = _user_id
  )
$$;

-- O usuário autenticado É este funcionário (login próprio)? Esta função, não o
-- enum de papel, sustenta a autorização real dos dados de ponto - um user_roles
-- mal configurado nunca amplia acesso indevido, só degrada a navegação no frontend.
CREATE OR REPLACE FUNCTION public.is_own_funcionario(_auth_user_id UUID, _funcionario_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.funcionarios
    WHERE id = _funcionario_id AND auth_user_id = _auth_user_id
  )
$$;

-- Este local de ponto está atribuído (na data de hoje) ao funcionário deste login?
CREATE OR REPLACE FUNCTION public.is_assigned_local_ponto(_auth_user_id UUID, _local_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.funcionario_locais_ponto flp
    JOIN public.funcionarios f ON f.id = flp.funcionario_id
    WHERE f.auth_user_id = _auth_user_id
      AND flp.local_ponto_id = _local_id
      AND flp.data_inicio <= CURRENT_DATE
      AND (flp.data_fim IS NULL OR flp.data_fim >= CURRENT_DATE)
  )
$$;

-- Este local é uma atribuição válida para este funcionário nesta data?
CREATE OR REPLACE FUNCTION public.funcionario_local_valido(
  _funcionario_id UUID, _local_id UUID, _data DATE DEFAULT CURRENT_DATE
)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.funcionario_locais_ponto
    WHERE funcionario_id = _funcionario_id
      AND local_ponto_id = _local_id
      AND data_inicio <= _data
      AND (data_fim IS NULL OR data_fim >= _data)
  )
$$;

-- Funcionário pode ver os locais de ponto aos quais está atribuído
CREATE POLICY "Locais de ponto visible to assigned funcionario"
  ON public.locais_ponto FOR SELECT
  USING (public.is_assigned_local_ponto(auth.uid(), id));

-- Funcionário pode ver seus próprios vínculos de local
CREATE POLICY "Funcionario locais visible to own funcionario"
  ON public.funcionario_locais_ponto FOR SELECT
  USING (public.is_own_funcionario(auth.uid(), funcionario_id));
