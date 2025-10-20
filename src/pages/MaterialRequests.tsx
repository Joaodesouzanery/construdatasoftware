import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Plus, Filter, Search, Building2, Eye, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { AddMaterialRequestDialog } from "@/components/materials/AddMaterialRequestDialog";
import { AddEmployeeDialog } from "@/components/employees/AddEmployeeDialog";
import { demoMaterialRequests, demoUser } from "@/lib/demo-data";

interface MaterialRequest {
  id: string;
  request_date: string;
  material_name: string;
  quantity: number;
  unit: string;
  status: string;
  needed_date?: string;
  usage_location?: string;
  projects: { name: string };
  service_fronts: { name: string };
  employees?: { name: string };
}

export default function MaterialRequests() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const isDemoMode = searchParams.get('demo') === 'true';
  const [user, setUser] = useState<any>(null);
  const [requests, setRequests] = useState<MaterialRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showEmployeeDialog, setShowEmployeeDialog] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    checkAuth();
    fetchRequests();
  }, [statusFilter]);

  const checkAuth = async () => {
    if (isDemoMode) {
      setUser(demoUser);
      return;
    }

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      navigate('/auth');
      return;
    }
    setUser(session.user);
  };

  const fetchRequests = async () => {
    if (isDemoMode) {
      let filtered = demoMaterialRequests;
      if (statusFilter !== "all") {
        filtered = filtered.filter(req => req.status === statusFilter);
      }
      setRequests(filtered);
      setIsLoading(false);
      return;
    }
    try {
      let query = supabase
        .from("material_requests")
        .select(`
          *,
          projects (name),
          service_fronts (name),
          employees (name)
        `)
        .order("request_date", { ascending: false });

      if (statusFilter !== "all") {
        query = query.eq("status", statusFilter);
      }

      const { data, error } = await query;

      if (error) throw error;
      setRequests(data || []);
    } catch (error: any) {
      toast.error("Erro ao carregar pedidos: " + error.message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchRequests();
  }, [statusFilter]);

  const updateRequestStatus = async (id: string, newStatus: string) => {
    if (isDemoMode) {
      toast.info("No modo demo, alterações não são salvas");
      return;
    }

    try {
      const { error } = await supabase
        .from("material_requests")
        .update({ status: newStatus })
        .eq("id", id);

      if (error) throw error;

      toast.success("Status atualizado com sucesso!");
      fetchRequests();
    } catch (error: any) {
      toast.error("Erro ao atualizar status: " + error.message);
    }
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
      pendente: "secondary",
      aprovado: "default",
      rejeitado: "destructive",
      entregue: "outline",
    };
    return <Badge variant={variants[status] || "default"}>{status.toUpperCase()}</Badge>;
  };

  const filteredRequests = requests.filter((req) =>
    req.material_name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-secondary/5">
      <header className="border-b bg-card/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center gap-4">
            <Button variant="ghost" onClick={() => navigate(isDemoMode ? '/dashboard?demo=true' : '/dashboard')}>
              <Building2 className="w-6 h-6 mr-2" />
              <span className="font-bold">ConstruData</span>
            </Button>
            <h1 className="text-xl font-semibold">Pedidos de Material</h1>
            {isDemoMode && (
              <span className="text-xs bg-primary/10 text-primary px-2 py-1 rounded-full flex items-center gap-1">
                <Eye className="w-3 h-3" />
                Demo
              </span>
            )}
          </div>
        </div>
      </header>

      <main className="container mx-auto p-6 space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-2xl font-bold">Gerencie as solicitações de materiais</h2>
            <p className="text-muted-foreground">Acompanhe e aprove pedidos</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setShowEmployeeDialog(true)} disabled={isDemoMode}>
              <Users className="mr-2 h-4 w-4" />
              Adicionar Funcionário
            </Button>
            <Button onClick={() => setShowAddDialog(true)} disabled={isDemoMode}>
              <Plus className="mr-2 h-4 w-4" />
              Novo Pedido
            </Button>
          </div>
        </div>

      <Card>
        <CardHeader>
          <CardTitle>Filtros</CardTitle>
          <CardDescription>Filtre os pedidos por status ou material</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Status</label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="pendente">Pendente</SelectItem>
                  <SelectItem value="aprovado">Aprovado</SelectItem>
                  <SelectItem value="rejeitado">Rejeitado</SelectItem>
                  <SelectItem value="entregue">Entregue</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Buscar Material</label>
              <div className="relative">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Nome do material..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-8"
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Lista de Pedidos</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p>Carregando...</p>
          ) : filteredRequests.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">Nenhum pedido encontrado</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Material</TableHead>
                  <TableHead>Quantidade</TableHead>
                  <TableHead>Solicitante</TableHead>
                  <TableHead>Prazo</TableHead>
                  <TableHead>Local de Uso</TableHead>
                  <TableHead>Projeto</TableHead>
                  <TableHead>Frente</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredRequests.map((request) => (
                  <TableRow key={request.id}>
                    <TableCell>{new Date(request.request_date).toLocaleDateString("pt-BR")}</TableCell>
                    <TableCell className="font-medium">{request.material_name}</TableCell>
                    <TableCell>
                      {request.quantity} {request.unit}
                    </TableCell>
                    <TableCell className="text-sm">
                      {request.employees?.name || '-'}
                    </TableCell>
                    <TableCell className="text-sm">
                      {request.needed_date ? new Date(request.needed_date).toLocaleDateString("pt-BR") : '-'}
                    </TableCell>
                    <TableCell className="text-sm">
                      {request.usage_location || '-'}
                    </TableCell>
                    <TableCell>{request.projects.name}</TableCell>
                    <TableCell>{request.service_fronts.name}</TableCell>
                    <TableCell>{getStatusBadge(request.status)}</TableCell>
                    <TableCell>
                      <Select
                        value={request.status}
                        onValueChange={(value) => updateRequestStatus(request.id, value)}
                      >
                        <SelectTrigger className="w-[130px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="pendente">Pendente</SelectItem>
                          <SelectItem value="aprovado">Aprovado</SelectItem>
                          <SelectItem value="rejeitado">Rejeitado</SelectItem>
                          <SelectItem value="entregue">Entregue</SelectItem>
                        </SelectContent>
                      </Select>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <AddEmployeeDialog
        open={showEmployeeDialog}
        onOpenChange={setShowEmployeeDialog}
        onSuccess={fetchRequests}
      />
      </main>
    </div>
  );
}
