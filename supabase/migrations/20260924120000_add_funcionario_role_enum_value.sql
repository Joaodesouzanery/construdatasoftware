-- Adiciona o papel restrito de funcionário (Ponto Eletrônico) ao enum de papéis existente.
-- Este valor só é usado pelo frontend para identificar rapidamente uma conta restrita
-- (ver RestrictedEmployeeGate) - a autorização real dos dados de ponto NÃO depende dele,
-- e sim de is_own_funcionario()/owns_funcionario() (ver migration de funções auxiliares).
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'funcionario';
