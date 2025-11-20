import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Pencil, Check, X, Search, Plus } from "lucide-react";
import { AddMaterialDialog } from "@/components/materials/AddMaterialDialog";

export const PriceManagementTable = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editPrice, setEditPrice] = useState("");
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);

  const { data: materials, isLoading } = useQuery({
    queryKey: ['materials-prices'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('materials')
        .select('*')
        .order('name');
      
      if (error) throw error;
      return data || [];
    }
  });

  const updatePriceMutation = useMutation({
    mutationFn: async ({ id, newPrice }: { id: string; newPrice: number }) => {
      const material = materials?.find(m => m.id === id);
      if (!material) throw new Error("Material não encontrado");

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      // Insert price history
      const { error: historyError } = await supabase
        .from('price_history')
        .insert({
          material_id: id,
          old_price: material.current_price,
          new_price: newPrice,
          changed_by_user_id: user.id
        });

      if (historyError) throw historyError;

      // Update material price
      const { error: updateError } = await supabase
        .from('materials')
        .update({ current_price: newPrice })
        .eq('id', id);

      if (updateError) throw updateError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['materials-prices'] });
      toast({
        title: "Preço atualizado!",
        description: "O novo preço será usado automaticamente em novos orçamentos."
      });
      setEditingId(null);
      setEditPrice("");
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao atualizar preço",
        description: error.message,
        variant: "destructive"
      });
    }
  });

  const filteredMaterials = materials?.filter(material => 
    material.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    material.brand?.toLowerCase().includes(searchTerm.toLowerCase())
  ) || [];

  const startEdit = (id: string, currentPrice: number) => {
    setEditingId(id);
    setEditPrice(currentPrice.toString());
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditPrice("");
  };

  const saveEdit = (id: string) => {
    const newPrice = parseFloat(editPrice);
    if (isNaN(newPrice) || newPrice < 0) {
      toast({
        title: "Preço inválido",
        description: "Por favor, insira um valor válido.",
        variant: "destructive"
      });
      return;
    }
    updatePriceMutation.mutate({ id, newPrice });
  };

  if (isLoading) {
    return <div className="text-center py-8">Carregando...</div>;
  }

  return (
    <Card className="p-6">
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-foreground mb-2">Gestão de Preços</h2>
            <p className="text-muted-foreground">
              Atualize os preços dos materiais. Novos orçamentos usarão automaticamente os preços mais recentes.
            </p>
          </div>
          <Button onClick={() => setIsAddDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Novo Preço
          </Button>
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar materiais..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>

        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Material</TableHead>
                <TableHead>Marca</TableHead>
                <TableHead>Categoria</TableHead>
                <TableHead>Fornecedor</TableHead>
                <TableHead>Medida</TableHead>
                <TableHead>Unidade</TableHead>
                <TableHead>Preço Atual</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredMaterials.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                    Nenhum material cadastrado
                  </TableCell>
                </TableRow>
              ) : (
                filteredMaterials.map((material) => (
                  <TableRow key={material.id}>
                    <TableCell className="font-medium">{material.name}</TableCell>
                    <TableCell>{material.brand || "-"}</TableCell>
                    <TableCell>{material.category || "-"}</TableCell>
                    <TableCell>{material.supplier || "-"}</TableCell>
                    <TableCell>{material.measurement || "-"}</TableCell>
                    <TableCell>{material.unit}</TableCell>
                    <TableCell>
                      {editingId === material.id ? (
                        <Input
                          type="number"
                          step="0.01"
                          value={editPrice}
                          onChange={(e) => setEditPrice(e.target.value)}
                          className="w-32"
                          autoFocus
                        />
                      ) : (
                        `R$ ${material.current_price.toFixed(2)}`
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      {editingId === material.id ? (
                        <div className="flex justify-end gap-2">
                          <Button
                            size="sm"
                            onClick={() => saveEdit(material.id)}
                            disabled={updatePriceMutation.isPending}
                          >
                            <Check className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={cancelEdit}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      ) : (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => startEdit(material.id, material.current_price)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      <AddMaterialDialog 
        open={isAddDialogOpen} 
        onOpenChange={setIsAddDialogOpen}
      />
    </Card>
  );
};
