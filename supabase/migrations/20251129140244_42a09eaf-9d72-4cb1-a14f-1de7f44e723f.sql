-- Adicionar coluna para super admin
ALTER TABLE user_roles ADD COLUMN IF NOT EXISTS is_super_admin BOOLEAN DEFAULT false;

-- Criar índice para consultas de super admin
CREATE INDEX IF NOT EXISTS idx_user_roles_super_admin ON user_roles(is_super_admin) WHERE is_super_admin = true;

-- Função para tornar o primeiro usuário super admin automaticamente
CREATE OR REPLACE FUNCTION public.ensure_first_super_admin()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  admin_count INTEGER;
BEGIN
  -- Contar quantos super admins existem
  SELECT COUNT(*) INTO admin_count
  FROM user_roles
  WHERE is_super_admin = true;
  
  -- Se não existe nenhum super admin, tornar este o primeiro
  IF admin_count = 0 THEN
    NEW.is_super_admin = true;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Trigger para garantir que o primeiro admin seja super admin
DROP TRIGGER IF EXISTS ensure_first_super_admin_trigger ON user_roles;
CREATE TRIGGER ensure_first_super_admin_trigger
  BEFORE INSERT ON user_roles
  FOR EACH ROW
  WHEN (NEW.role = 'admin')
  EXECUTE FUNCTION public.ensure_first_super_admin();

-- Comentários para documentação
COMMENT ON COLUMN user_roles.is_super_admin IS 'Indica se o usuário é o super administrador (dono do sistema). Apenas super admins podem criar outros admins.';