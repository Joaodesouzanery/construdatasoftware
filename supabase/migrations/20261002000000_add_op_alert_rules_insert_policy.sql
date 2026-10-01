-- =============================================
-- MÓDULO OPERACIONAL: limiares de alerta configuráveis
-- =============================================
-- op_alert_rules (Fase 1) só tinha SELECT/UPDATE - faltava INSERT, então a
-- primeira vez que o usuário edita um limiar (criando a linha daquela regra)
-- falhava. A tela de configuração faz upsert (insert se não existir, update
-- se já existir).

CREATE POLICY "Op alert rules insert by owner"
  ON public.op_alert_rules FOR INSERT
  WITH CHECK (auth.uid() = organization_id);
