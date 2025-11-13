import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Search, Upload, Download, Edit } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { AddMaterialDialog } from "@/components/materials/AddMaterialDialog";
import { EditMaterialDialog } from "@/components/materials/EditMaterialDialog";
import { MaterialsTable } from "@/components/materials/MaterialsTable";
import { MaterialFilters } from "@/components/materials/MaterialFilters";
import { SpreadsheetUploadDialog } from "@/components/materials/SpreadsheetUploadDialog";
import { KeywordsManagementDialog } from "@/components/materials/KeywordsManagementDialog";
import { BulkEditDialog } from "@/components/materials/BulkEditDialog";

const Materials = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isUploadDialogOpen, setIsUploadDialogOpen] = useState(false);
  const [isKeywordsDialogOpen, setIsKeywordsDialogOpen] = useState(false);
  const [isBulkEditOpen, setIsBulkEditOpen] = useState(false);
  const [editingMaterial, setEditingMaterial] = useState<any>(null);
  const [selectedMaterials, setSelectedMaterials] = useState<string[]>([]);
  const [filters, setFilters] = useState({
    brands: [] as string[],
    colors: [] as string[],
    minPrice: "",
    maxPrice: "",
    stockStatus: [] as string[]
  });

  const { data: materials, isLoading } = useQuery({
    queryKey: ['materials'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('materials')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data || [];
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('materials')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['materials'] });
      toast({ title: "Material deletado com sucesso" });
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao deletar material",
        description: error.message,
        variant: "destructive"
      });
    }
  });

  const filteredMaterials = materials?.filter(material => {
    const matchesSearch = !searchTerm || 
      material.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      material.brand?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      material.description?.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesBrand = filters.brands.length === 0 || 
      (material.brand && filters.brands.includes(material.brand));

    const matchesColor = filters.colors.length === 0 || 
      (material.color && filters.colors.includes(material.color));

    const matchesPrice = 
      (!filters.minPrice || material.current_price >= parseFloat(filters.minPrice)) &&
      (!filters.maxPrice || material.current_price <= parseFloat(filters.maxPrice));

    const matchesStock = filters.stockStatus.length === 0 ||
      (filters.stockStatus.includes('low') && material.current_stock <= material.minimum_stock) ||
      (filters.stockStatus.includes('out') && material.current_stock === 0) ||
      (filters.stockStatus.includes('normal') && material.current_stock > material.minimum_stock);

    return matchesSearch && matchesBrand && matchesColor && matchesPrice && matchesStock;
  }) || [];

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Materiais</h1>
            <p className="text-muted-foreground">Gerencie seu catálogo de materiais</p>
          </div>
          <div className="flex gap-2">
            {selectedMaterials.length > 0 && (
              <Button onClick={() => setIsBulkEditOpen(true)} variant="outline">
                <Edit className="h-4 w-4 mr-2" />
                Editar {selectedMaterials.length} selecionados
              </Button>
            )}
            <Button onClick={() => setIsKeywordsDialogOpen(true)} variant="outline">
              <Download className="h-4 w-4 mr-2" />
              Palavras-chave
            </Button>
            <Button onClick={() => setIsUploadDialogOpen(true)} variant="outline">
              <Upload className="h-4 w-4 mr-2" />
              Importar
            </Button>
            <Button onClick={() => setIsAddDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Novo Material
            </Button>
          </div>
        </div>

        <div className="flex flex-col md:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar materiais..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
          <MaterialFilters filters={filters} onFiltersChange={setFilters} materials={materials || []} />
        </div>

        <MaterialsTable
          materials={filteredMaterials}
          isLoading={isLoading}
          onEdit={setEditingMaterial}
          onDelete={(id) => deleteMutation.mutate(id)}
          selectedMaterials={selectedMaterials}
          onSelectionChange={setSelectedMaterials}
        />

        <AddMaterialDialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen} />
        
        {editingMaterial && (
          <EditMaterialDialog
            material={editingMaterial}
            open={!!editingMaterial}
            onOpenChange={(open) => !open && setEditingMaterial(null)}
          />
        )}

        <SpreadsheetUploadDialog open={isUploadDialogOpen} onOpenChange={setIsUploadDialogOpen} />
        <KeywordsManagementDialog open={isKeywordsDialogOpen} onOpenChange={setIsKeywordsDialogOpen} />
        <BulkEditDialog
          open={isBulkEditOpen}
          onOpenChange={setIsBulkEditOpen}
          selectedMaterials={selectedMaterials}
          onClearSelection={() => setSelectedMaterials([])}
        />
      </div>
    </div>
  );
};

export default Materials;
