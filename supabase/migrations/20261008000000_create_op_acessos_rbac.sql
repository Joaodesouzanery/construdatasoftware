-- =============================================
-- MÓDULO OPERACIONAL: controle de acesso por papel (admin/gestor/sem acesso)
-- =============================================
-- Substitui o modelo "dono vê o que é seu" (auth.uid() = organization_id)
-- por papéis: admin (tudo), gestor (leitura das telas operacionais + pode
-- disparar upload manual via Edge Function), sem linha em op_acessos (ou
-- ativo=false) = sem acesso a NADA - é o comportamento padrão de RLS sem
-- nenhuma policy casando, não precisa de lógica extra para negar.

CREATE TABLE IF NOT EXISTS public.op_acessos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  papel TEXT NOT NULL CHECK (papel IN ('admin', 'gestor')),
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.op_acessos ENABLE ROW LEVEL SECURITY;

INSERT INTO public.op_acessos (email, papel, ativo)
VALUES ('joaodsouzanery@gmail.com', 'admin', true)
ON CONFLICT (email) DO NOTHING;

-- Mesmo estilo de has_role/is_admin (já usados em outro módulo deste
-- repositório): LANGUAGE sql STABLE SECURITY DEFINER SET search_path.
-- SECURITY DEFINER é o que permite ler auth.users e a própria op_acessos
-- (que não tem policy permissiva para o usuário comum) sem recursão de RLS.
CREATE OR REPLACE FUNCTION public.op_papel()
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT a.papel
  FROM public.op_acessos a
  JOIN auth.users u ON u.email = a.email
  WHERE u.id = auth.uid() AND a.ativo = true
  LIMIT 1
$$;

CREATE POLICY "Op acessos geridos por admin"
  ON public.op_acessos FOR ALL
  USING (public.op_papel() = 'admin')
  WITH CHECK (public.op_papel() = 'admin');

-- Remove TODAS as policies antigas (dono-based) das tabelas do módulo antes
-- de criar as novas - mais seguro que listar de memória cada nome exato:
-- uma policy antiga esquecida ficaria ATIVA ao lado da nova (RLS combina
-- policies do mesmo comando com OR) e furaria a restrição nova em silêncio.
DO $$
DECLARE
  pol RECORD;
BEGIN
  FOR pol IN
    SELECT policyname, tablename
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename IN (
        'op_sources', 'op_uploads', 'op_alert_rules', 'op_runs', 'op_snapshots',
        'op_records', 'op_changes', 'op_exceptions', 'op_lists', 'op_alerts'
      )
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', pol.policyname, pol.tablename);
  END LOOP;
END $$;

-- Admin: tudo (Fontes, tokens/segredos, Simulador via op_runs/op_snapshots
-- de teste, regras de alerta).
CREATE POLICY "Op sources admin only" ON public.op_sources
  FOR ALL USING (public.op_papel() = 'admin') WITH CHECK (public.op_papel() = 'admin');
CREATE POLICY "Op uploads admin only" ON public.op_uploads
  FOR ALL USING (public.op_papel() = 'admin') WITH CHECK (public.op_papel() = 'admin');
CREATE POLICY "Op alert rules admin only" ON public.op_alert_rules
  FOR ALL USING (public.op_papel() = 'admin') WITH CHECK (public.op_papel() = 'admin');

-- Admin e gestor: só leitura (toda escrita nestas tabelas já passa por RPC
-- SECURITY DEFINER chamada pela Edge Function com service role, nunca pelo
-- navegador direto - por isso não há policy de INSERT/UPDATE/DELETE aqui).
CREATE POLICY "Op runs leitura admin e gestor" ON public.op_runs
  FOR SELECT USING (public.op_papel() IN ('admin', 'gestor'));
CREATE POLICY "Op snapshots leitura admin e gestor" ON public.op_snapshots
  FOR SELECT USING (public.op_papel() IN ('admin', 'gestor'));
CREATE POLICY "Op records leitura admin e gestor" ON public.op_records
  FOR SELECT USING (public.op_papel() IN ('admin', 'gestor'));
CREATE POLICY "Op changes leitura admin e gestor" ON public.op_changes
  FOR SELECT USING (public.op_papel() IN ('admin', 'gestor'));
CREATE POLICY "Op exceptions leitura admin e gestor" ON public.op_exceptions
  FOR SELECT USING (public.op_papel() IN ('admin', 'gestor'));
CREATE POLICY "Op lists leitura admin e gestor" ON public.op_lists
  FOR SELECT USING (public.op_papel() IN ('admin', 'gestor'));
CREATE POLICY "Op alerts leitura admin e gestor" ON public.op_alerts
  FOR SELECT USING (public.op_papel() IN ('admin', 'gestor'));

-- Segredos de op_sources (token_hash, upload_webhook_secret) nunca legíveis
-- pelo navegador, nem por admin - só as Edge Functions (service role, que
-- não passa por GRANT/REVOKE de role) leem. REVOKE total + GRANT só das
-- colunas permitidas é o jeito correto de restringir coluna no Postgres -
-- um REVOKE de coluna sozinho NÃO sobrepõe um GRANT de tabela já existente.
REVOKE SELECT ON public.op_sources FROM authenticated, anon;
GRANT SELECT (
  id, organization_id, profile, label, drive_file_id, active,
  last_checked_at, last_file_name, last_file_modified_at,
  created_at, updated_at, upload_webhook_url
) ON public.op_sources TO authenticated;

-- Listagem sem as colunas de segredo (token_hash, upload_webhook_secret -
-- upload_webhook_secret com uma flag booleana no lugar do valor real,
-- "configurado: sim/não"; token_hash é NOT NULL, sempre existe, por isso
-- não tem flag equivalente, só fica de fora).
--
-- É uma FUNCTION (SECURITY DEFINER), não uma VIEW: a tela "Fontes" é
-- admin-only (RLS de op_sources acima), mas o Painel de Execuções - que
-- mostra um resumo por fonte (nome, ativo, última leitura) - é visível
-- também para gestor. Uma VIEW comum herdaria a RLS de op_sources (ficaria
-- admin-only igual à tabela, mesmo sem expor as colunas de segredo) - a
-- function, sendo SECURITY DEFINER, decide ela mesma quem pode ver
-- (admin OU gestor) através do WHERE abaixo, sem reabrir a tabela em si.
CREATE OR REPLACE FUNCTION public.op_sources_lista()
RETURNS TABLE (
  id UUID,
  organization_id UUID,
  profile TEXT,
  label TEXT,
  drive_file_id TEXT,
  active BOOLEAN,
  last_checked_at TIMESTAMP WITH TIME ZONE,
  last_file_name TEXT,
  last_file_modified_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE,
  updated_at TIMESTAMP WITH TIME ZONE,
  upload_webhook_url TEXT,
  tem_upload_webhook_secret BOOLEAN
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    s.id, s.organization_id, s.profile, s.label, s.drive_file_id, s.active,
    s.last_checked_at, s.last_file_name, s.last_file_modified_at,
    s.created_at, s.updated_at, s.upload_webhook_url,
    (s.upload_webhook_secret IS NOT NULL)
  FROM public.op_sources s
  WHERE public.op_papel() IN ('admin', 'gestor')
$$;
