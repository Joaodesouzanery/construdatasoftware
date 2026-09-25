-- =============================================
-- PONTO ELETRÔNICO: leitura da escala planejada pelo próprio funcionário
-- =============================================
CREATE POLICY "Escalas visible to own funcionario"
  ON public.escalas_clt FOR SELECT
  USING (public.is_own_funcionario(auth.uid(), funcionario_id));
