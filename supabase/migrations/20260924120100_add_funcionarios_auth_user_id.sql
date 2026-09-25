-- =============================================
-- PONTO ELETRÔNICO: login individual do funcionário
-- =============================================
-- funcionarios.user_id já existe e representa o GESTOR/dono do cadastro.
-- auth_user_id é a conta de login do próprio funcionário (Supabase Auth),
-- usada pelo Ponto Eletrônico para identificar "quem está batendo o ponto".

ALTER TABLE public.funcionarios
  ADD COLUMN IF NOT EXISTS auth_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;

-- Garante no máximo um login por funcionário e um funcionário por login
CREATE UNIQUE INDEX IF NOT EXISTS funcionarios_auth_user_id_unique
  ON public.funcionarios (auth_user_id)
  WHERE auth_user_id IS NOT NULL;

-- O próprio funcionário pode ler seu registro de RH (nome, cargo, etc.)
CREATE POLICY "Funcionario can view own record"
  ON public.funcionarios FOR SELECT
  USING (auth.uid() = auth_user_id);
