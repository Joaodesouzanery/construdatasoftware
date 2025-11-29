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

interface UserRole {
  id: string;
  user_id: string;
  role: 'admin' | 'user';
  project_id: string;
  created_at: string;
  is_super_admin: boolean;
  projects?: { name: string };
}

export default function Admin() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [userRoles, setUserRoles] = useState<UserRole[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [selectedProject, setSelectedProject] = useState<string>("");
  const [addUserOpen, setAddUserOpen] = useState(false);
  const [newUserEmail, setNewUserEmail] = useState("");
  const [newUserPassword, setNewUserPassword] = useState("");
  const [newUserRole, setNewUserRole] = useState<'admin' | 'user'>('user');
  const [newUserProject, setNewUserProject] = useState("");

  useEffect(() => {
    checkAdminAccess();
  }, []);

  const checkAdminAccess = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate("/auth");
        return;
      }

      const { data: roleData } = await supabase
        .from("user_roles")
        .select("*")
        .eq("user_id", user.id)
        .eq("role", "admin")
        .single();

      if (!roleData) {
        toast.error("Acesso negado. Apenas administradores podem acessar esta página.");
        navigate("/dashboard");
        return;
      }

      setIsAdmin(true);
      setIsSuperAdmin(roleData.is_super_admin || false);
      await loadProjects();
      await loadUserRoles();
    } catch (error) {
      console.error("Error checking admin access:", error);
      navigate("/dashboard");
    } finally {
      setLoading(false);
    }
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
    const { data, error } = await supabase
      .from("user_roles")
      .select("*, projects(name)")
      .order("created_at", { ascending: false });

    if (error) {
      toast.error("Erro ao carregar funções de usuários");
      return;
    }

    setUserRoles(data || []);
  };

  const addNewUser = async () => {
    if (!newUserEmail || !newUserPassword || !newUserProject) {
      toast.error("Preencha todos os campos obrigatórios");
      return;
    }

    // Apenas super admins podem criar admins
    if (newUserRole === 'admin' && !isSuperAdmin) {
      toast.error("Apenas o super administrador pode criar outros administradores");
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

      // Add the user role
      const { error: roleError } = await supabase
        .from("user_roles")
        .insert({
          user_id: authData.user.id,
          role: newUserRole,
          project_id: newUserProject,
        });

      if (roleError) throw roleError;

      toast.success("Usuário criado com sucesso!");
      setAddUserOpen(false);
      setNewUserEmail("");
      setNewUserPassword("");
      setNewUserRole('user');
      setNewUserProject("");
      await loadUserRoles();
    } catch (error: any) {
      console.error("Error creating user:", error);
      toast.error(error.message || "Erro ao criar usuário");
    }
  };

  const updateUserRole = async (roleId: string, newRole: 'admin' | 'user') => {
    // Apenas super admins podem alterar roles para admin
    if (newRole === 'admin' && !isSuperAdmin) {
      toast.error("Apenas o super administrador pode promover usuários a administrador");
      return;
    }

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

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">Carregando...</div>
      </div>
    );
  }

  if (!isAdmin) {
    return null;
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
                {isSuperAdmin && <span className="ml-2 text-[#FFA500] font-semibold">• Você é o Super Administrador</span>}
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
                      <SelectItem value="admin" disabled={!isSuperAdmin}>
                        Administrador {!isSuperAdmin && "(Apenas Super Admin)"}
                      </SelectItem>
                      <SelectItem value="user">Colaborador</SelectItem>
                    </SelectContent>
                  </Select>
                  {!isSuperAdmin && (
                    <p className="text-xs text-muted-foreground">
                      Apenas o Super Administrador pode criar outros administradores
                    </p>
                  )}
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="project">Projeto</Label>
                  <Select value={newUserProject} onValueChange={setNewUserProject}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione um projeto" />
                    </SelectTrigger>
                    <SelectContent>
                      {projects.map((project) => (
                        <SelectItem key={project.id} value={project.id}>
                          {project.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
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
                  <TableHead>Projeto</TableHead>
                  <TableHead>Função</TableHead>
                  <TableHead>Data de Criação</TableHead>
                  <TableHead>Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {userRoles.map((role) => (
                  <TableRow key={role.id}>
                    <TableCell>
                      {role.projects?.name || "N/A"}
                    </TableCell>
                     <TableCell>
                       <div className="flex items-center gap-2">
                         <Badge variant={role.role === 'admin' ? 'default' : 'secondary'}>
                           {role.role === 'admin' ? 'Administrador' : 'Colaborador'}
                         </Badge>
                         {role.is_super_admin && (
                           <Badge className="bg-[#FFA500] text-black hover:bg-[#FF8C00]">
                             Super Admin
                           </Badge>
                         )}
                       </div>
                     </TableCell>
                    <TableCell>
                      {new Date(role.created_at).toLocaleDateString('pt-BR')}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        {!role.is_super_admin ? (
                          <>
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
                          </>
                        ) : (
                          <Badge variant="outline" className="border-[#FFA500]/30 text-[#FFA500]">
                            Não pode ser alterado
                          </Badge>
                        )}
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
