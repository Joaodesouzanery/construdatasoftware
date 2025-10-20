import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Plus, Filter, Search, Building2, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { AddMaterialRequestDialog } from "@/components/materials/AddMaterialRequestDialog";

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
  const [user, setUser] = useState<any>(null);
  const [requests, setRequests] = useState<MaterialRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    checkAuth();
    fetchRequests();
  }, [statusFilter]);

  const checkAuth = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      navigate('/auth');
      return;
    }
    setUser(session.user);
  };

  const fetchRequests = async () => {
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
        <div className="container mx-auto px-3 sm:px-4 py-3 sm:py-4">
          <div className="flex items-center gap-3 sm:gap-4">
            <Button variant="ghost" onClick={() => navigate('/dashboard')} className="p-2">
              <Building2 className="w-5 h-5 sm:w-6 sm:h-6 mr-1 sm:mr-2" />
              <span className="font-bold text-sm sm:text-base">ConstruData</span>
            </Button>
            <h1 className="text-base sm:text-xl font-semibold">Pedidos de Material</h1>
          </div>
        </div>
      </header>

      <main className="container mx-auto p-3 sm:p-6 space-y-4 sm:space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h2 className="text-xl sm:text-2xl font-bold">Gerencie as solicitações de materiais</h2>
            <p className="text-sm text-muted-foreground">Acompanhe e aprove pedidos</p>
          </div>
          <Button onClick={() => setShowAddDialog(true)} className="w-full sm:w-auto">
            <Plus className="mr-2 h-4 w-4" />
            Novo Pedido
          </Button>
        </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base sm:text-lg">Filtros</CardTitle>
          <CardDescription className="text-sm">Filtre os pedidos por status ou material</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
          <CardTitle className="text-base sm:text-lg">Lista de Pedidos</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p>Carregando...</p>
          ) : filteredRequests.length === 0 ? (
            <p className="text-center text-muted-foreground py-8 text-sm">Nenhum pedido encontrado</p>
          ) : (
            <div className="overflow-x-auto -mx-3 sm:mx-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="min-w-[100px]">Data</TableHead>
                    <TableHead className="min-w-[150px]">Material</TableHead>
                    <TableHead className="min-w-[100px]">Quantidade</TableHead>
                    <TableHead className="hidden md:table-cell min-w-[120px]">Solicitante</TableHead>
                    <TableHead className="hidden lg:table-cell min-w-[100px]">Prazo</TableHead>
                    <TableHead className="hidden lg:table-cell min-w-[120px]">Local de Uso</TableHead>
                    <TableHead className="hidden xl:table-cell min-w-[150px]">Projeto</TableHead>
                    <TableHead className="hidden xl:table-cell min-w-[120px]">Frente</TableHead>
                    <TableHead className="min-w-[100px]">Status</TableHead>
                    <TableHead className="min-w-[130px]">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredRequests.map((request) => (
                    <TableRow key={request.id}>
                      <TableCell className="text-sm">{new Date(request.request_date).toLocaleDateString("pt-BR")}</TableCell>
                      <TableCell className="font-medium text-sm">{request.material_name}</TableCell>
                      <TableCell className="text-sm">
                        {request.quantity} {request.unit}
                      </TableCell>
                      <TableCell className="hidden md:table-cell text-sm">
                        {request.employees?.name || '-'}
                      </TableCell>
                      <TableCell className="hidden lg:table-cell text-sm">
                        {request.needed_date ? new Date(request.needed_date).toLocaleDateString("pt-BR") : '-'}
                      </TableCell>
                      <TableCell className="hidden lg:table-cell text-sm">
                        {request.usage_location || '-'}
                      </TableCell>
                      <TableCell className="hidden xl:table-cell text-sm">{request.projects.name}</TableCell>
                      <TableCell className="hidden xl:table-cell text-sm">{request.service_fronts.name}</TableCell>
                      <TableCell>{getStatusBadge(request.status)}</TableCell>
                      <TableCell>
                        <Select
                          value={request.status}
                          onValueChange={(value) => updateRequestStatus(request.id, value)}
                        >
                          <SelectTrigger className="w-[120px] h-8 text-xs">
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
            </div>
          )}
        </CardContent>
      </Card>

      <AddMaterialRequestDialog
        open={showAddDialog}
        onOpenChange={setShowAddDialog}
        onSuccess={fetchRequests}
      />
      </main>
    </div>
  );
}
