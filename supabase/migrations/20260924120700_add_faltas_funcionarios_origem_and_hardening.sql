-- =============================================
-- PONTO ELETRÔNICO: origem das faltas + hardening de RLS
-- =============================================

ALTER TABLE public.faltas_funcionarios
  ADD COLUMN IF NOT EXISTS origem TEXT NOT NULL DEFAULT 'manual'
    CHECK (origem IN ('manual', 'ponto_automatico'));

-- Eleva faltas_funcionarios ao mesmo padrão "dono OU super admin" já usado em
-- funcionarios (ver 20260130181656_...sql), e adiciona leitura para o próprio
-- funcionário. A policy de INSERT ("Users can insert own faltas") permanece
-- como estava - o gestor continua lançando faltas manuais, e faltas com origem
-- 'ponto_automatico' são inseridas pela edge function calcular-banco-horas
-- usando o client do próprio gestor (que já tem permissão sobre seus funcionários).
DROP POLICY IF EXISTS "Users can view own faltas" ON public.faltas_funcionarios;
DROP POLICY IF EXISTS "Users can update own faltas" ON public.faltas_funcionarios;
DROP POLICY IF EXISTS "Users can delete own faltas" ON public.faltas_funcionarios;

CREATE POLICY "Faltas visible to owner or super admin"
  ON public.faltas_funcionarios FOR SELECT
  USING (
    auth.uid() = user_id
    OR EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND is_super_admin = true)
  );

CREATE POLICY "Faltas update by owner or super admin"
  ON public.faltas_funcionarios FOR UPDATE
  USING (
    auth.uid() = user_id
    OR EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND is_super_admin = true)
  );

CREATE POLICY "Faltas delete by owner or super admin"
  ON public.faltas_funcionarios FOR DELETE
  USING (
    auth.uid() = user_id
    OR EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND is_super_admin = true)
  );

CREATE POLICY "Faltas visible to own funcionario"
  ON public.faltas_funcionarios FOR SELECT
  USING (public.is_own_funcionario(auth.uid(), funcionario_id));
