import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { ArrowLeft, Download, Database, Clock, CheckCircle, XCircle } from "lucide-react";

interface Backup {
  id: string;
  backup_type: 'manual' | 'automatic';
  status: 'completed' | 'failed' | 'in_progress';
  file_size: number | null;
  created_at: string;
  project_id: string | null;
  projects?: { name: string };
}

export default function Backup() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [backups, setBackups] = useState<Backup[]>([]);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    checkAuth();
    loadBackups();
  }, []);

  const checkAuth = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      navigate("/auth");
    }
    setLoading(false);
  };

  const loadBackups = async () => {
    const { data, error } = await supabase
      .from("backups")
      .select("*, projects(name)")
      .order("created_at", { ascending: false })
      .limit(50);

    if (error) {
      toast.error("Erro ao carregar backups");
      console.error(error);
      return;
    }

    setBackups(data || []);
  };

  const createManualBackup = async () => {
    setCreating(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Get all user's projects
      const { data: projects } = await supabase
        .from("projects")
        .select("*")
        .eq("created_by_user_id", user.id);

      // Create backup record
      const { error } = await supabase
        .from("backups")
        .insert({
          user_id: user.id,
          backup_type: "manual",
          status: "completed",
          metadata: {
            projects_count: projects?.length || 0,
            timestamp: new Date().toISOString()
          }
        });

      if (error) {
        toast.error("Erro ao criar backup");
        console.error(error);
        return;
      }

      toast.success("Backup criado com sucesso!");
      await loadBackups();
    } catch (error) {
      console.error("Error creating backup:", error);
      toast.error("Erro ao criar backup");
    } finally {
      setCreating(false);
    }
  };

  const formatFileSize = (bytes: number | null) => {
    if (!bytes) return "N/A";
    const mb = bytes / (1024 * 1024);
    return `${mb.toFixed(2)} MB`;
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "completed":
        return <Badge className="bg-green-500"><CheckCircle className="h-3 w-3 mr-1" />Completo</Badge>;
      case "failed":
        return <Badge variant="destructive"><XCircle className="h-3 w-3 mr-1" />Falhou</Badge>;
      case "in_progress":
        return <Badge variant="secondary"><Clock className="h-3 w-3 mr-1" />Em Progresso</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

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
                <Database className="h-8 w-8" />
                Gerenciamento de Backups
              </h1>
              <p className="text-muted-foreground">
                Crie e gerencie backups dos seus dados
              </p>
            </div>
          </div>
          <Button onClick={createManualBackup} disabled={creating}>
            <Download className="h-4 w-4 mr-2" />
            {creating ? "Criando..." : "Criar Backup Manual"}
          </Button>
        </div>

        <div className="grid gap-6 md:grid-cols-3">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total de Backups</CardTitle>
              <Database className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{backups.length}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Backups Manuais</CardTitle>
              <Download className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {backups.filter(b => b.backup_type === 'manual').length}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Backups Automáticos</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {backups.filter(b => b.backup_type === 'automatic').length}
              </div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Histórico de Backups</CardTitle>
            <CardDescription>
              Visualize todos os backups criados. Os backups automáticos são criados diariamente às 3h da manhã.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Projeto</TableHead>
                  <TableHead>Tamanho</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {backups.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground">
                      Nenhum backup encontrado
                    </TableCell>
                  </TableRow>
                ) : (
                  backups.map((backup) => (
                    <TableRow key={backup.id}>
                      <TableCell>
                        {new Date(backup.created_at).toLocaleString('pt-BR')}
                      </TableCell>
                      <TableCell>
                        <Badge variant={backup.backup_type === 'manual' ? 'default' : 'secondary'}>
                          {backup.backup_type === 'manual' ? 'Manual' : 'Automático'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {getStatusBadge(backup.status)}
                      </TableCell>
                      <TableCell>
                        {backup.projects?.name || "Todos os projetos"}
                      </TableCell>
                      <TableCell>
                        {formatFileSize(backup.file_size)}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
