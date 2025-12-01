import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";
import { ArrowLeft, Shield, Users, Database, UserPlus } from "lucide-react";
import { useUserRole } from "@/hooks/useUserRole";

interface UserRole {
  id: string;
  user_id: string;
  role: 'admin' | 'user';
  project_id: string;
  created_at: string;
  projects?: { name: string };
}

interface UserQuota {
  id: string;
  user_id: string;
  max_projects: number;
  max_employees: number;
}

export default function Admin() {
  const navigate = useNavigate();
  const { isSuperAdmin, loading: roleLoading } = useUserRole();
  const [loading, setLoading] = useState(true);
  const [userRoles, setUserRoles] = useState<UserRole[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [selectedProject, setSelectedProject] = useState<string>("");
  const [addUserOpen, setAddUserOpen] = useState(false);
  const [newUserEmail, setNewUserEmail] = useState("");
  const [newUserPassword, setNewUserPassword] = useState("");
  const [newUserRole, setNewUserRole] = useState<'admin' | 'user'>('user');
  const [maxProjects, setMaxProjects] = useState(3);
  const [maxEmployees, setMaxEmployees] = useState(50);
  const [userQuotas, setUserQuotas] = useState<UserQuota[]>([]);

  useEffect(() => {
    if (!roleLoading && isSuperAdmin) {
      loadData();
    }
  }, [roleLoading, isSuperAdmin]);

  const loadData = async () => {
    await loadProjects();
    await loadUserRoles();
    await loadUserQuotas();
    setLoading(false);
  };

  const loadProjects = async () => {
    const { data, error } = await supabase
      .from("projects")
      .select("*")
      .order("name");

    if (error) {
      toast.error("Erro ao carregar projetos");
      return;
    }

    setProjects(data || []);
  };

  const loadUserRoles = async () => {
    // Get all auth users first
    const { data: authUsers, error: authError } = await supabase.auth.admin.listUsers();
    
    if (authError) {
      toast.error("Erro ao carregar usuários");
      return;
    }

    // Get user roles
    const { data: rolesData, error: rolesError } = await supabase
      .from("user_roles")
      .select("*, projects(name)")
      .order("created_at", { ascending: false });

    if (rolesError) {
      toast.error("Erro ao carregar funções de usuários");
      return;
    }

    // Merge auth users with roles data
    const usersWithRoles = authUsers.users.map(user => {
      const userRole = rolesData?.find(role => role.user_id === user.id);
      return {
        id: userRole?.id || user.id,
        user_id: user.id,
        email: user.email,
        role: userRole?.role || 'user',
        project_id: userRole?.project_id || null,
        created_at: userRole?.created_at || user.created_at,
        projects: userRole?.projects
      };
    });

    setUserRoles(usersWithRoles as any);
  };

  const loadUserQuotas = async () => {
    const { data, error } = await supabase
      .from("user_quotas")
      .select("*");

    if (error) {
      toast.error("Erro ao carregar quotas de usuários");
      return;
    }

    setUserQuotas(data || []);
  };

  const addNewUser = async () => {
    if (!newUserEmail || !newUserPassword) {
      toast.error("Preencha todos os campos obrigatórios");
      return;
    }

    try {
      // Create the user using Supabase Auth
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: newUserEmail,
        password: newUserPassword,
      });

      if (authError) throw authError;

      if (!authData.user) {
        throw new Error("Falha ao criar usuário");
      }

      // Add the user role (without project_id - user will create their own projects)
      const { error: roleError } = await supabase
        .from("user_roles")
        .insert({
          user_id: authData.user.id,
          role: newUserRole,
        });

      if (roleError) throw roleError;

      // Add user quota
      const { error: quotaError } = await supabase
        .from("user_quotas")
        .insert({
          user_id: authData.user.id,
          max_projects: maxProjects,
          max_employees: maxEmployees,
        });

      if (quotaError) throw quotaError;

      toast.success("Usuário criado com sucesso!");
      setAddUserOpen(false);
      setNewUserEmail("");
      setNewUserPassword("");
      setNewUserRole('user');
      setMaxProjects(3);
      setMaxEmployees(50);
      await loadUserRoles();
      await loadUserQuotas();
    } catch (error: any) {
      console.error("Error creating user:", error);
      toast.error(error.message || "Erro ao criar usuário");
    }
  };

  const updateUserRole = async (roleId: string, newRole: 'admin' | 'user') => {
    const { error } = await supabase
      .from("user_roles")
      .update({ role: newRole })
      .eq("id", roleId);

    if (error) {
      toast.error("Erro ao atualizar função do usuário");
      return;
    }

    toast.success("Função atualizada com sucesso");
    await loadUserRoles();
  };

  const deleteUserRole = async (roleId: string) => {
    if (!confirm("Deseja realmente remover esta função?")) return;

    const { error } = await supabase
      .from("user_roles")
      .delete()
      .eq("id", roleId);

    if (error) {
      toast.error("Erro ao remover função");
      return;
    }

    toast.success("Função removida com sucesso");
    await loadUserRoles();
  };

  if (roleLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!isSuperAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardHeader>
            <CardTitle className="text-center">Acesso Negado</CardTitle>
          </CardHeader>
          <CardContent className="text-center space-y-4">
            <p className="text-muted-foreground">
              Apenas o super administrador pode acessar esta página.
            </p>
            <Button onClick={() => navigate('/')}>
              Voltar para Início
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">Carregando...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate("/dashboard")}
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-3xl font-bold flex items-center gap-2">
                <Shield className="h-8 w-8" />
                Painel Administrativo
              </h1>
              <p className="text-muted-foreground">
                Gerencie usuários e permissões do sistema
              </p>
            </div>
          </div>
          <Dialog open={addUserOpen} onOpenChange={setAddUserOpen}>
            <DialogTrigger asChild>
              <Button>
                <UserPlus className="mr-2 h-4 w-4" />
                Adicionar Usuário
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Adicionar Novo Usuário</DialogTitle>
                <DialogDescription>
                  Crie um novo usuário com acesso ao sistema
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <Label htmlFor="email">E-mail</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="usuario@exemplo.com"
                    value={newUserEmail}
                    onChange={(e) => setNewUserEmail(e.target.value)}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="password">Senha</Label>
                  <Input
                    id="password"
                    type="password"
                    placeholder="Senha segura"
                    value={newUserPassword}
                    onChange={(e) => setNewUserPassword(e.target.value)}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="role">Função</Label>
                  <Select value={newUserRole} onValueChange={(value: 'admin' | 'user') => setNewUserRole(value)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="admin">Administrador</SelectItem>
                      <SelectItem value="user">Colaborador</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="maxProjects">Limite de Projetos</Label>
                  <Input
                    id="maxProjects"
                    type="number"
                    min="1"
                    value={maxProjects}
                    onChange={(e) => setMaxProjects(parseInt(e.target.value) || 3)}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="maxEmployees">Limite de Funcionários</Label>
                  <Input
                    id="maxEmployees"
                    type="number"
                    min="1"
                    value={maxEmployees}
                    onChange={(e) => setMaxEmployees(parseInt(e.target.value) || 50)}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setAddUserOpen(false)}>
                  Cancelar
                </Button>
                <Button onClick={addNewUser}>
                  Criar Usuário
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        <div className="grid gap-6 md:grid-cols-3">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total de Usuários</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{userRoles.length}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Administradores</CardTitle>
              <Shield className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {userRoles.filter(r => r.role === 'admin').length}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Projetos Ativos</CardTitle>
              <Database className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{projects.length}</div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Gerenciar Funções de Usuários</CardTitle>
            <CardDescription>
              Visualize e altere as permissões dos usuários nos projetos
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Email</TableHead>
                  <TableHead>Projeto</TableHead>
                  <TableHead>Função</TableHead>
                  <TableHead>Data de Criação</TableHead>
                  <TableHead>Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {userRoles.map((role: any) => (
                  <TableRow key={role.user_id}>
                    <TableCell className="font-medium">
                      {role.email}
                    </TableCell>
                    <TableCell>
                      {role.projects?.name || "Sem projeto"}
                    </TableCell>
                    <TableCell>
                      <Badge variant={role.role === 'admin' ? 'default' : 'secondary'}>
                        {role.role === 'admin' ? 'Administrador' : 'Colaborador'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {new Date(role.created_at).toLocaleDateString('pt-BR')}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Select
                          value={role.role}
                          onValueChange={(value: 'admin' | 'user') =>
                            updateUserRole(role.id, value)
                          }
                        >
                          <SelectTrigger className="w-32">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="admin">Admin</SelectItem>
                            <SelectItem value="user">Colaborador</SelectItem>
                          </SelectContent>
                        </Select>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => deleteUserRole(role.id)}
                        >
                          Remover
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
