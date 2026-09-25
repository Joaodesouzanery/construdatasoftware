-- =============================================
-- PONTO ELETRÔNICO: banco de horas mensal (resultado reconciliado)
-- =============================================
-- Fica separada de escalas_clt (que é só o planejado) e de registros_ponto (que
-- é só o realizado, imutável) para manter "planejado" x "realizado" x
-- "resultado reconciliado" em camadas distintas.

CREATE TABLE IF NOT EXISTS public.banco_horas_mensal (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  funcionario_id UUID NOT NULL REFERENCES public.funcionarios(id) ON DELETE CASCADE,
  competencia DATE NOT NULL, -- sempre o primeiro dia do mês de referência
  horas_normais_total NUMERIC NOT NULL DEFAULT 0,
  horas_extras_50_total NUMERIC NOT NULL DEFAULT 0,
  horas_extras_100_total NUMERIC NOT NULL DEFAULT 0,
  horas_noturnas_total NUMERIC NOT NULL DEFAULT 0,
  horas_faltas_total NUMERIC NOT NULL DEFAULT 0,
  saldo_banco_horas_anterior NUMERIC NOT NULL DEFAULT 0,
  saldo_banco_horas_atual NUMERIC NOT NULL DEFAULT 0,
  saldo_banco_horas_acumulado NUMERIC NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'calculado' CHECK (status IN ('calculado', 'revisado', 'fechado')),
  calculado_em TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  calculado_por UUID,
  detalhes JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (funcionario_id, competencia)
);

ALTER TABLE public.banco_horas_mensal ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Banco de horas visible to own funcionario, owner or super admin"
  ON public.banco_horas_mensal FOR SELECT
  USING (
    public.is_own_funcionario(auth.uid(), funcionario_id)
    OR auth.uid() = user_id
    OR EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND is_super_admin = true)
  );

CREATE POLICY "Banco de horas insert by owner or super admin"
  ON public.banco_horas_mensal FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    OR EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND is_super_admin = true)
  );

CREATE POLICY "Banco de horas update by owner or super admin"
  ON public.banco_horas_mensal FOR UPDATE
  USING (
    auth.uid() = user_id
    OR EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND is_super_admin = true)
  );

CREATE POLICY "Banco de horas delete by owner or super admin"
  ON public.banco_horas_mensal FOR DELETE
  USING (
    auth.uid() = user_id
    OR EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND is_super_admin = true)
  );

CREATE TRIGGER update_banco_horas_mensal_updated_at
  BEFORE UPDATE ON public.banco_horas_mensal
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
