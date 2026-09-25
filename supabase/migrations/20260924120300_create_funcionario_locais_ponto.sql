-- =============================================
-- PONTO ELETRÔNICO: vínculo funcionário <-> locais de ponto (M:N)
-- =============================================
-- Um funcionário pode estar autorizado a bater ponto em mais de um local
-- (frentes de obra diferentes) ao mesmo tempo. data_inicio/data_fim preserva
-- o histórico de qual local valia em qual data, para auditoria, sem precisar
-- tocar em registros de ponto já gravados.

CREATE TABLE IF NOT EXISTS public.funcionario_locais_ponto (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  funcionario_id UUID NOT NULL REFERENCES public.funcionarios(id) ON DELETE CASCADE,
  local_ponto_id UUID NOT NULL REFERENCES public.locais_ponto(id) ON DELETE CASCADE,
  data_inicio DATE NOT NULL DEFAULT CURRENT_DATE,
  data_fim DATE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (funcionario_id, local_ponto_id)
);

CREATE INDEX IF NOT EXISTS idx_funcionario_locais_ponto_funcionario
  ON public.funcionario_locais_ponto (funcionario_id);

ALTER TABLE public.funcionario_locais_ponto ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Funcionario locais visible to owner or super admin"
  ON public.funcionario_locais_ponto FOR SELECT
  USING (
    auth.uid() = user_id
    OR EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND is_super_admin = true)
  );

CREATE POLICY "Funcionario locais insert by owner"
  ON public.funcionario_locais_ponto FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Funcionario locais update by owner or super admin"
  ON public.funcionario_locais_ponto FOR UPDATE
  USING (
    auth.uid() = user_id
    OR EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND is_super_admin = true)
  );

CREATE POLICY "Funcionario locais delete by owner or super admin"
  ON public.funcionario_locais_ponto FOR DELETE
  USING (
    auth.uid() = user_id
    OR EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND is_super_admin = true)
  );
