import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";

interface AddMaterialDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const AddMaterialDialog = ({ open, onOpenChange }: AddMaterialDialogProps) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    brand: "",
    color: "",
    measurement: "",
    unit: "",
    current_price: "",
    minimum_stock: "",
    current_stock: ""
  });

  const createMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      const { error } = await supabase.from('materials').insert({
        ...data,
        current_price: parseFloat(data.current_price) || 0,
        minimum_stock: parseFloat(data.minimum_stock) || 0,
        current_stock: parseFloat(data.current_stock) || 0,
        created_by_user_id: user.id
      });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['materials'] });
      toast({ title: "Material criado com sucesso" });
      onOpenChange(false);
      setFormData({
        name: "",
        description: "",
        brand: "",
        color: "",
        measurement: "",
        unit: "",
        current_price: "",
        minimum_stock: "",
        current_stock: ""
      });
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao criar material",
        description: error.message,
        variant: "destructive"
      });
    }
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createMutation.mutate(formData);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Novo Material</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="name">Nome *</Label>
              <Input
                id="name"
                required
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="brand">Marca</Label>
              <Input
                id="brand"
                value={formData.brand}
                onChange={(e) => setFormData({ ...formData, brand: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="color">Cor</Label>
              <Input
                id="color"
                value={formData.color}
                onChange={(e) => setFormData({ ...formData, color: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="measurement">Medida</Label>
              <Input
                id="measurement"
                value={formData.measurement}
                onChange={(e) => setFormData({ ...formData, measurement: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="unit">Unidade *</Label>
              <Input
                id="unit"
                required
                placeholder="m, m², kg, un..."
                value={formData.unit}
                onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="current_price">Preço Unitário (R$) *</Label>
              <Input
                id="current_price"
                type="number"
                step="0.01"
                required
                value={formData.current_price}
                onChange={(e) => setFormData({ ...formData, current_price: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="minimum_stock">Estoque Mínimo</Label>
              <Input
                id="minimum_stock"
                type="number"
                step="0.01"
                value={formData.minimum_stock}
                onChange={(e) => setFormData({ ...formData, minimum_stock: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="current_stock">Estoque Atual</Label>
              <Input
                id="current_stock"
                type="number"
                step="0.01"
                value={formData.current_stock}
                onChange={(e) => setFormData({ ...formData, current_stock: e.target.value })}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="description">Descrição</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={createMutation.isPending}>
              {createMutation.isPending ? "Criando..." : "Criar Material"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
