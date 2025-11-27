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

  // Função para normalizar texto (remover acentos, espaços extras, etc)
  const normalizeText = (text: string): string => {
    return text
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/\s+/g, " ")
      .trim();
  };

  // Função para calcular similaridade entre duas strings
  const calculateSimilarity = (str1: string, str2: string): number => {
    const s1 = normalizeText(str1);
    const s2 = normalizeText(str2);
    
    // Verifica se uma string contém a outra
    if (s1.includes(s2) || s2.includes(s1)) return 0.9;
    
    // Conta palavras em comum
    const words1 = s1.split(" ");
    const words2 = s2.split(" ");
    const commonWords = words1.filter(word => words2.includes(word) && word.length > 2);
    
    if (commonWords.length === 0) return 0;
    
    return commonWords.length / Math.max(words1.length, words2.length);
  };

  // Função para buscar material correspondente
  const findMatchingMaterial = async (description: string, unit?: string) => {
    const { data: materials } = await supabase
      .from('materials')
      .select('*');
    
    if (!materials || materials.length === 0) return null;

    // Busca exata primeiro
    const exactMatch = materials.find(m => 
      normalizeText(m.name) === normalizeText(description)
    );
    if (exactMatch) return { material: exactMatch, confidence: 1.0 };

    // Busca por similaridade
    let bestMatch = null;
    let bestSimilarity = 0;

    for (const material of materials) {
      const nameSimilarity = calculateSimilarity(material.name, description);
      const descSimilarity = material.description 
        ? calculateSimilarity(material.description, description)
        : 0;
      
      const similarity = Math.max(nameSimilarity, descSimilarity);
      
      // Considera correspondência de unidade
      const unitMatch = !unit || !material.unit || 
        normalizeText(material.unit) === normalizeText(unit);
      const finalSimilarity = unitMatch ? similarity : similarity * 0.8;

      if (finalSimilarity > bestSimilarity && finalSimilarity > 0.6) {
        bestSimilarity = finalSimilarity;
        bestMatch = material;
      }
    }

    return bestMatch ? { material: bestMatch, confidence: bestSimilarity } : null;
  };

  const importMutation = useMutation({
    mutationFn: async (items: any[]) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      // Busca o maior item_number atual
      const { data: existingItems } = await supabase
        .from('budget_items')
        .select('item_number')
        .eq('budget_id', budgetId)
        .order('item_number', { ascending: false })
        .limit(1);

      const startNumber = existingItems && existingItems.length > 0 
        ? existingItems[0].item_number + 1 
        : 1;

      const itemsToInsert = items.map((item, index) => ({
        budget_id: budgetId,
        item_number: startNumber + index,
        description: item.description,
        unit: item.unit || 'UN',
        quantity: parseFloat(item.quantity) || 0,
        unit_price_material: item.unit_price_material || 0,
        unit_price_labor: item.unit_price_labor || 0,
        bdi_percentage: item.bdi_percentage || 0,
        subtotal_material: item.subtotal_material || 0,
        subtotal_labor: item.subtotal_labor || 0,
        subtotal_bdi: item.subtotal_bdi || 0,
        total: item.total || 0,
        material_id: item.material_id || null,
        price_at_creation: item.price_at_creation || null
      }));

      const { error } = await supabase
        .from('budget_items')
        .insert(itemsToInsert);

      if (error) throw error;

      return items.filter(i => i.matched).length;
    },
    onSuccess: (matchedCount) => {
      queryClient.invalidateQueries({ queryKey: ['budget-items'] });
      queryClient.invalidateQueries({ queryKey: ['budgets'] });
      toast({
        title: "Sucesso",
        description: `Planilha importada! ${matchedCount} itens precificados automaticamente.`,
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

      const processedItems = [];
      let matchedCount = 0;

      for (const row of jsonData) {
        const rowData: any = row;
        
        // Identifica colunas
        const description = 
          rowData['Descrição'] || 
          rowData['Description'] || 
          rowData['Item'] || 
          rowData['Material'] ||
          rowData['Serviço'] ||
          rowData['Servico'] ||
          '';
        
        const quantity = parseFloat(
          rowData['Quantidade'] || 
          rowData['Quantity'] || 
          rowData['Qtd'] || 
          '0'
        );

        const unit = 
          rowData['Unidade'] || 
          rowData['Unit'] || 
          rowData['Un'] || 
          'UN';

        if (!description || quantity === 0) continue;

        // Busca material correspondente
        const match = await findMatchingMaterial(description, unit);
        
        let itemData: any = {
          description,
          quantity,
          unit,
          matched: false
        };

        if (match && match.confidence > 0.6) {
          const material = match.material;
          const materialPrice = material.material_price || 0;
          const laborPrice = material.labor_price || 0;
          const totalPrice = materialPrice + laborPrice;
          
          itemData = {
            ...itemData,
            unit_price_material: materialPrice,
            unit_price_labor: laborPrice,
            bdi_percentage: 0,
            subtotal_material: quantity * materialPrice,
            subtotal_labor: quantity * laborPrice,
            subtotal_bdi: 0,
            total: quantity * totalPrice,
            material_id: material.id,
            price_at_creation: totalPrice,
            matched: true
          };
          
          matchedCount++;
        } else {
          // Material não encontrado - adiciona sem preço
          itemData = {
            ...itemData,
            unit_price_material: 0,
            unit_price_labor: 0,
            bdi_percentage: 0,
            subtotal_material: 0,
            subtotal_labor: 0,
            subtotal_bdi: 0,
            total: 0,
            matched: false
          };
        }

        processedItems.push(itemData);
      }

      if (processedItems.length === 0) {
        throw new Error("Nenhum item válido encontrado na planilha");
      }

      await importMutation.mutateAsync(processedItems);
    } catch (error: any) {
      toast({
        title: "Erro ao processar arquivo",
        description: error.message || "Verifique se o arquivo está no formato correto",
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
              A planilha deve conter as colunas: Descrição, Unidade, Quantidade.
              O sistema buscará preços automaticamente na Gestão de Preços.
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
