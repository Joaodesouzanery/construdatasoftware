import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useGeolocation } from "@/hooks/useGeolocation";
import { Plus, Search, Pencil, Trash2, MapPin, Users, Crosshair } from "lucide-react";

interface LocalPonto {
  id: string;
  nome: string;
  endereco: string | null;
  latitude: number;
  longitude: number;
  raio_metros: number;
  unidade_id: string | null;
  ativo: boolean;
}

// CRUD de "Locais de Ponto" - quase um espelho de Unidades.tsx, com a adição
// de lat/long/raio (geofence) e um diálogo para autorizar funcionários a
// bater ponto neste local (funcionario_locais_ponto). Sem nenhum local
// cadastrado e sem funcionários autorizados, o trigger do banco recusa
// qualquer batida - ver o card de estado vazio abaixo.
export const LocaisPonto = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { location, isLoading: geoLoading, error: geoError, getCurrentLocation } = useGeolocation();
  const [search, setSearch] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingLocal, setEditingLocal] = useState<LocalPonto | null>(null);
  const [funcionariosLocal, setFuncionariosLocal] = useState<LocalPonto | null>(null);

  const [formData, setFormData] = useState({
    nome: "",
    endereco: "",
    latitude: "",
    longitude: "",
    raio_metros: 200,
    unidade_id: "",
  });

  useEffect(() => {
    if (location && isDialogOpen) {
      setFormData((prev) => ({
        ...prev,
        latitude: location.latitude.toFixed(8),
        longitude: location.longitude.toFixed(8),
      }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location]);

  const { data: locais = [], isLoading } = useQuery({
    queryKey: ["ponto-locais"],
    queryFn: async () => {
      const { data, error } = await supabase.from("locais_ponto").select("*").eq("ativo", true).order("nome");
      if (error) throw error;
      return (data || []) as LocalPonto[];
    },
  });

  const { data: unidades = [] } = useQuery({
    queryKey: ["rh-unidades-select"],
    queryFn: async () => {
      const { data, error } = await supabase.from("unidades").select("id, nome").eq("ativo", true).order("nome");
      if (error) throw error;
      return data || [];
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw new Error("Não autenticado");

      const { error } = await supabase.from("locais_ponto").insert({
        user_id: userData.user.id,
        nome: data.nome,
        endereco: data.endereco || null,
        latitude: parseFloat(data.latitude),
        longitude: parseFloat(data.longitude),
        raio_metros: data.raio_metros,
        unidade_id: data.unidade_id || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ponto-locais"] });
      toast({ title: "Local de ponto cadastrado!" });
      resetForm();
    },
    onError: (error: Error) => {
      toast({ title: "Erro ao cadastrar", description: error.message, variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: typeof formData }) => {
      const { error } = await supabase
        .from("locais_ponto")
        .update({
          nome: data.nome,
          endereco: data.endereco || null,
          latitude: parseFloat(data.latitude),
          longitude: parseFloat(data.longitude),
          raio_metros: data.raio_metros,
          unidade_id: data.unidade_id || null,
        })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ponto-locais"] });
      toast({ title: "Local de ponto atualizado!" });
      resetForm();
    },
    onError: (error: Error) => {
      toast({ title: "Erro ao atualizar", description: error.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("locais_ponto").update({ ativo: false }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ponto-locais"] });
      toast({ title: "Local de ponto desativado" });
    },
  });

  const resetForm = () => {
    setFormData({ nome: "", endereco: "", latitude: "", longitude: "", raio_metros: 200, unidade_id: "" });
    setEditingLocal(null);
    setIsDialogOpen(false);
  };

  const handleSubmit = () => {
    if (!formData.nome.trim()) {
      toast({ title: "Nome é obrigatório", variant: "destructive" });
      return;
    }
    if (!formData.latitude || !formData.longitude) {
      toast({ title: "Latitude e longitude são obrigatórias", variant: "destructive" });
      return;
    }
    if (editingLocal) {
      updateMutation.mutate({ id: editingLocal.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const openEdit = (local: LocalPonto) => {
    setEditingLocal(local);
    setFormData({
      nome: local.nome,
      endereco: local.endereco || "",
      latitude: String(local.latitude),
      longitude: String(local.longitude),
      raio_metros: local.raio_metros,
      unidade_id: local.unidade_id || "",
    });
    setIsDialogOpen(true);
  };

  const filteredLocais = locais.filter((l) => l.nome.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar locais..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10 w-64" />
        </div>
        <Button
          onClick={() => {
            resetForm();
            setIsDialogOpen(true);
          }}
        >
          <Plus className="h-4 w-4 mr-2" />
          Novo Local de Ponto
        </Button>
      </div>

      {!isLoading && locais.length === 0 && (
        <Card className="p-6 text-center space-y-2 border-dashed">
          <MapPin className="h-8 w-8 mx-auto text-muted-foreground" />
          <p className="text-sm font-medium">Nenhum local de ponto cadastrado</p>
          <p className="text-sm text-muted-foreground">
            Sem um local cadastrado, nenhum funcionário conseguirá bater o ponto. Cadastre o primeiro local da obra
            para liberar o Ponto Eletrônico.
          </p>
        </Card>
      )}

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Endereço</TableHead>
                <TableHead>Raio</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center py-8">
                    Carregando...
                  </TableCell>
                </TableRow>
              ) : filteredLocais.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                    Nenhum local encontrado
                  </TableCell>
                </TableRow>
              ) : (
                filteredLocais.map((local) => (
                  <TableRow key={local.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                          <MapPin className="h-4 w-4 text-primary" />
                        </div>
                        <span className="font-medium">{local.nome}</span>
                      </div>
                    </TableCell>
                    <TableCell>{local.endereco || "-"}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{local.raio_metros}m</Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button variant="ghost" size="icon" onClick={() => setFuncionariosLocal(local)} title="Gerenciar funcionários">
                          <Users className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => openEdit(local)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => deleteMutation.mutate(local.id)}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingLocal ? "Editar Local de Ponto" : "Novo Local de Ponto"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Nome *</Label>
              <Input value={formData.nome} onChange={(e) => setFormData({ ...formData, nome: e.target.value })} />
            </div>
            <div>
              <Label>Endereço</Label>
              <Input value={formData.endereco} onChange={(e) => setFormData({ ...formData, endereco: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Latitude *</Label>
                <Input value={formData.latitude} onChange={(e) => setFormData({ ...formData, latitude: e.target.value })} />
              </div>
              <div>
                <Label>Longitude *</Label>
                <Input value={formData.longitude} onChange={(e) => setFormData({ ...formData, longitude: e.target.value })} />
              </div>
            </div>
            <Button type="button" variant="outline" size="sm" onClick={getCurrentLocation} disabled={geoLoading}>
              <Crosshair className="h-4 w-4 mr-2" />
              {geoLoading ? "Obtendo localização..." : "Usar minha localização atual"}
            </Button>
            {geoError && <p className="text-xs text-destructive">{geoError}</p>}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Raio permitido (metros)</Label>
                <Input
                  type="number"
                  min={1}
                  max={5000}
                  value={formData.raio_metros}
                  onChange={(e) => setFormData({ ...formData, raio_metros: Number(e.target.value) })}
                />
              </div>
              <div>
                <Label>Unidade (opcional)</Label>
                <Select value={formData.unidade_id} onValueChange={(v) => setFormData({ ...formData, unidade_id: v })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione..." />
                  </SelectTrigger>
                  <SelectContent>
                    {unidades.map((u) => (
                      <SelectItem key={u.id} value={u.id}>
                        {u.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={resetForm}>
              Cancelar
            </Button>
            <Button onClick={handleSubmit}>{editingLocal ? "Salvar" : "Cadastrar"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {funcionariosLocal && <GerenciarFuncionariosDialog local={funcionariosLocal} onClose={() => setFuncionariosLocal(null)} />}
    </div>
  );
};

interface GerenciarFuncionariosDialogProps {
  local: LocalPonto;
  onClose: () => void;
}

const GerenciarFuncionariosDialog = ({ local, onClose }: GerenciarFuncionariosDialogProps) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: funcionarios = [] } = useQuery({
    queryKey: ["rh-funcionarios-select"],
    queryFn: async () => {
      const { data, error } = await supabase.from("funcionarios").select("id, nome").eq("ativo", true).order("nome");
      if (error) throw error;
      return data || [];
    },
  });

  const { data: vinculos = [] } = useQuery({
    queryKey: ["ponto-funcionario-locais", local.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("funcionario_locais_ponto")
        .select("id, funcionario_id")
        .eq("local_ponto_id", local.id)
        .is("data_fim", null);
      if (error) throw error;
      return data || [];
    },
  });

  const vinculoPorFuncionario = new Map(vinculos.map((v: any) => [v.funcionario_id, v.id]));

  const toggleMutation = useMutation({
    mutationFn: async ({ funcionarioId, vinculado }: { funcionarioId: string; vinculado: boolean }) => {
      if (vinculado) {
        const vinculoId = vinculoPorFuncionario.get(funcionarioId);
        if (!vinculoId) return;
        const { error } = await supabase
          .from("funcionario_locais_ponto")
          .update({ data_fim: new Date().toISOString().split("T")[0] })
          .eq("id", vinculoId);
        if (error) throw error;
      } else {
        const { data: userData } = await supabase.auth.getUser();
        if (!userData.user) throw new Error("Não autenticado");
        const { error } = await supabase.from("funcionario_locais_ponto").insert({
          user_id: userData.user.id,
          funcionario_id: funcionarioId,
          local_ponto_id: local.id,
        });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ponto-funcionario-locais", local.id] });
    },
    onError: (error: Error) => {
      toast({ title: "Erro ao atualizar vínculo", description: error.message, variant: "destructive" });
    },
  });

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Funcionários autorizados em {local.nome}</DialogTitle>
        </DialogHeader>
        <div className="space-y-2 max-h-80 overflow-y-auto">
          {funcionarios.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum funcionário cadastrado ainda.</p>
          ) : (
            funcionarios.map((f: any) => {
              const vinculado = vinculoPorFuncionario.has(f.id);
              return (
                <label key={f.id} className="flex items-center gap-2 text-sm py-1 cursor-pointer">
                  <Checkbox checked={vinculado} onCheckedChange={() => toggleMutation.mutate({ funcionarioId: f.id, vinculado })} />
                  {f.nome}
                </label>
              );
            })
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Fechar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
