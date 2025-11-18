import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Upload } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import * as XLSX from 'xlsx';

interface SpreadsheetUploadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  budgetId: string;
}

export const SpreadsheetUploadDialog = ({ open, onOpenChange, budgetId }: SpreadsheetUploadDialogProps) => {
  const [file, setFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const importMutation = useMutation({
    mutationFn: async (items: any[]) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      const itemsToInsert = items.map((item, index) => ({
        budget_id: budgetId,
        item_number: index + 1,
        description: item.description,
        unit: item.unit || 'UN',
        quantity: parseFloat(item.quantity) || 0,
        unit_price_material: 0, // Preço será adicionado manualmente
        unit_price_labor: 0,
        bdi_percentage: 0,
        subtotal_material: 0,
        subtotal_labor: 0,
        subtotal_bdi: 0,
        total: 0,
      }));

      const { error } = await supabase
        .from('budget_items')
        .insert(itemsToInsert);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['budget-items'] });
      queryClient.invalidateQueries({ queryKey: ['budgets'] });
      toast({
        title: "Sucesso",
        description: "Itens importados com sucesso. Agora você pode adicionar os preços.",
      });
      onOpenChange(false);
      setFile(null);
    },
    onError: (error) => {
      toast({
        title: "Erro ao importar",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
    }
  };

  const processFile = async () => {
    if (!file) return;

    setIsProcessing(true);
    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data);
      const worksheet = workbook.Sheets[workbook.SheetNames[0]];
      const jsonData = XLSX.utils.sheet_to_json(worksheet);

      const items = jsonData.map((row: any) => ({
        description: row['Descrição'] || row['Description'] || row['Item'] || '',
        unit: row['Unidade'] || row['Unit'] || 'UN',
        quantity: row['Quantidade'] || row['Quantity'] || 0,
      }));

      await importMutation.mutateAsync(items);
    } catch (error) {
      toast({
        title: "Erro ao processar arquivo",
        description: "Verifique se o arquivo está no formato correto",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Importar Planilha de Orçamento</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label htmlFor="file">Arquivo da Planilha (.xlsx, .xls)</Label>
            <Input
              id="file"
              type="file"
              accept=".xlsx,.xls"
              onChange={handleFileChange}
              className="mt-2"
            />
            <p className="text-sm text-muted-foreground mt-2">
              A planilha deve conter as colunas: Descrição, Unidade, Quantidade
            </p>
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button 
              onClick={processFile} 
              disabled={!file || isProcessing}
            >
              <Upload className="h-4 w-4 mr-2" />
              {isProcessing ? "Processando..." : "Importar"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
