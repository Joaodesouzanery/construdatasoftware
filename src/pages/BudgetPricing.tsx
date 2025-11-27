import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowLeft, Upload, Search, Download, Save } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import * as XLSX from 'xlsx';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface ProcessedItem {
  description: string;
  quantity: number;
  unit: string;
  unit_price: number;
  unit_price_material: number;
  unit_price_labor: number;
  total: number;
  material_id: string | null;
  material_name?: string;
  matched: boolean;
  match_type?: string;
  originalRow?: any;
}

const BudgetPricing = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [file, setFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSearchingPrices, setIsSearchingPrices] = useState(false);
  const [processedItems, setProcessedItems] = useState<ProcessedItem[]>([]);
  const [selectedBudgetId, setSelectedBudgetId] = useState<string>("");
  const [showReview, setShowReview] = useState(false);

  const { data: budgets } = useQuery({
    queryKey: ['budgets'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('budgets')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data || [];
    }
  });

  const normalizeText = (text: string): string => {
    return text
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/\s+/g, " ")
      .trim();
  };

  const findMatchingMaterial = async (description: string) => {
    const { data: materials } = await supabase
      .from('materials')
      .select('*');
    
    if (!materials || materials.length === 0) return null;

    const normalizedDescription = normalizeText(description);

    // 1. BUSCA EXATA
    const exactMatch = materials.find(m => 
      normalizeText(m.name) === normalizedDescription
    );
    if (exactMatch) {
      console.log(`[MATCH EXATO] ${description} → ${exactMatch.name}`);
      return { material: exactMatch, matchType: 'Exato' };
    }

    // 2. BUSCA PARCIAL
    const partialMatch = materials.find(m => {
      const normalizedMaterialName = normalizeText(m.name);
      return normalizedDescription.includes(normalizedMaterialName) || 
             normalizedMaterialName.includes(normalizedDescription);
    });
    
    if (partialMatch) {
      console.log(`[MATCH PARCIAL] ${description} → ${partialMatch.name}`);
      return { material: partialMatch, matchType: 'Parcial' };
    }

    console.log(`[SEM MATCH] ${description}`);
    return null;
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
    }
  };

  const processFile = async () => {
    if (!file) {
      toast({
        title: "Erro",
        description: "Selecione um arquivo primeiro",
        variant: "destructive",
      });
      return;
    }

    setIsProcessing(true);
    try {
      let jsonData: any[] = [];

      // Verifica se é PDF
      if (file.type === 'application/pdf') {
        console.log('Processing PDF file...');
        
        // Converte PDF para base64
        const arrayBuffer = await file.arrayBuffer();
        const base64 = btoa(
          new Uint8Array(arrayBuffer).reduce(
            (data, byte) => data + String.fromCharCode(byte),
            ''
          )
        );

        // Chama edge function para extrair dados do PDF
        const { data: pdfData, error: pdfError } = await supabase.functions.invoke(
          'extract-pdf-data',
          {
            body: { pdfBase64: base64 }
          }
        );

        if (pdfError) {
          throw new Error(`Erro ao processar PDF: ${pdfError.message}`);
        }

        if (!pdfData?.items || pdfData.items.length === 0) {
          throw new Error('Nenhum dado encontrado no PDF');
        }

        jsonData = pdfData.items;
        console.log('PDF processed successfully:', jsonData.length, 'items found');
        
      } else {
        // Processa arquivo Excel
        console.log('Processing Excel file...');
        const data = await file.arrayBuffer();
        const workbook = XLSX.read(data);
        const worksheet = workbook.Sheets[workbook.SheetNames[0]];
        jsonData = XLSX.utils.sheet_to_json(worksheet);
        console.log('Excel processed:', jsonData.length, 'rows found');
      }

      if (!jsonData || jsonData.length === 0) {
        throw new Error("O arquivo está vazio ou não pôde ser lido");
      }

      const findColumnValue = (row: any, variations: string[]): string => {
        for (const key of Object.keys(row)) {
          const normalizedKey = normalizeText(key);
          for (const variation of variations) {
            if (normalizedKey.includes(normalizeText(variation))) {
              return String(row[key] || '').trim();
            }
          }
        }
        return '';
      };

      const items: ProcessedItem[] = [];

      for (let i = 0; i < jsonData.length; i++) {
        const rowData: any = jsonData[i];
        
        const description = findColumnValue(rowData, [
          'descricao', 'description', 'desc', 'item', 'material', 'servico'
        ]);
        
        const quantityStr = findColumnValue(rowData, [
          'quantidade', 'quantity', 'qtd', 'qtde'
        ]);
        const quantity = parseFloat(quantityStr.replace(',', '.')) || 0;

        const unit = findColumnValue(rowData, [
          'unidade', 'unit', 'un', 'und'
        ]) || 'UN';

        if (!description || description.length < 2 || quantity <= 0) {
          continue;
        }

        items.push({
          description,
          quantity,
          unit,
          unit_price: 0,
          unit_price_material: 0,
          unit_price_labor: 0,
          total: 0,
          material_id: null,
          matched: false,
          match_type: 'Não buscado',
          originalRow: rowData
        });
      }

      if (items.length === 0) {
        throw new Error("Nenhum item válido encontrado");
      }

      setProcessedItems(items);
      setShowReview(true);

      toast({
        title: "Planilha importada",
        description: `${items.length} itens carregados. Clique em "Buscar Preços" para precificar.`,
      });

    } catch (error: any) {
      toast({
        title: "Erro ao processar arquivo",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const searchPrices = async () => {
    setIsSearchingPrices(true);
    try {
      const updatedItems: ProcessedItem[] = [];
      let foundCount = 0;
      let notFoundCount = 0;

      for (const item of processedItems) {
        const match = await findMatchingMaterial(item.description);
        
        if (match) {
          const material = match.material;
          
          const baseMaterialPrice = (material.material_price ?? 0) as number;
          const baseLaborPrice = (material.labor_price ?? 0) as number;
          const computedFallbackPrice = baseMaterialPrice + baseLaborPrice;
          const unitPrice = (material.current_price && material.current_price > 0
            ? material.current_price
            : computedFallbackPrice) || 0;

          const hasValidPrice = unitPrice > 0;

          updatedItems.push({
            ...item,
            unit_price: hasValidPrice ? unitPrice : 0,
            unit_price_material: baseMaterialPrice,
            unit_price_labor: baseLaborPrice,
            total: hasValidPrice ? item.quantity * unitPrice : 0,
            material_id: material.id,
            material_name: material.name,
            matched: hasValidPrice,
            match_type: hasValidPrice ? 'Encontrado' : 'Preço não encontrado',
          });
          
          if (hasValidPrice) foundCount++;
          else notFoundCount++;
        } else {
          updatedItems.push({
            ...item,
            matched: false,
            match_type: 'Preço não encontrado',
          });
          notFoundCount++;
        }
      }

      setProcessedItems(updatedItems);
      
      toast({
        title: "Precificação concluída",
        description: `${foundCount} itens precificados e ${notFoundCount} não encontrados.`,
      });

    } catch (error: any) {
      toast({
        title: "Erro ao buscar preços",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsSearchingPrices(false);
    }
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!selectedBudgetId) {
        throw new Error("Selecione um orçamento");
      }

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      const { data: existingItems } = await supabase
        .from('budget_items')
        .select('item_number')
        .eq('budget_id', selectedBudgetId)
        .order('item_number', { ascending: false })
        .limit(1);

      const startNumber = existingItems && existingItems.length > 0 
        ? existingItems[0].item_number + 1 
        : 1;

      const itemsToInsert = processedItems.map((item, index) => ({
        budget_id: selectedBudgetId,
        item_number: startNumber + index,
        description: item.description,
        unit: item.unit,
        quantity: item.quantity,
        unit_price_material: item.unit_price_material || 0,
        unit_price_labor: item.unit_price_labor || 0,
        bdi_percentage: 0,
        subtotal_material: item.quantity * (item.unit_price_material || 0),
        subtotal_labor: item.quantity * (item.unit_price_labor || 0),
        subtotal_bdi: 0,
        total: item.total,
        material_id: item.material_id || null,
        price_at_creation: item.unit_price || null
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
        description: "Orçamento salvo com sucesso!",
      });
      handleReset();
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao salvar",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleExport = () => {
    const exportData = processedItems.map((item) => ({
      'Descrição': item.description,
      'Quantidade': item.quantity,
      'Unidade': item.unit,
      'Preço Unitário (R$)': item.unit_price.toFixed(2),
      'Preço Total (R$)': item.total.toFixed(2),
      'Status': item.match_type || 'Não buscado',
    }));

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Precificação');
    
    const fileName = file?.name.replace(/\.(xlsx|xls|pdf)$/i, '') || 'orcamento';
    XLSX.writeFile(wb, `${fileName}_precificado_${new Date().getTime()}.xlsx`);

    toast({
      title: "Sucesso",
      description: "Planilha exportada!",
    });
  };

  const handleReset = () => {
    setFile(null);
    setProcessedItems([]);
    setShowReview(false);
    setSelectedBudgetId("");
  };

  const matchedCount = processedItems.filter(i => i.matched && i.unit_price > 0).length;
  const totalValue = processedItems.reduce((sum, item) => sum + item.total, 0);

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/budgets')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold text-foreground">Precificação de Planilhas</h1>
            <p className="text-muted-foreground">Importe uma planilha (Excel ou PDF) e busque preços automaticamente</p>
          </div>
        </div>

        {!showReview ? (
          <div className="space-y-6 max-w-2xl">
            <div className="space-y-4 p-6 border rounded-lg bg-card">
              <div className="space-y-2">
                <Label htmlFor="file">Arquivo da Planilha (.xlsx, .xls, .pdf)</Label>
                <Input
                  id="file"
                  type="file"
                  accept=".xlsx,.xls,.pdf"
                  onChange={handleFileChange}
                />
                <p className="text-sm text-muted-foreground">
                  O arquivo deve conter: <strong>Descrição</strong>, <strong>Quantidade</strong> e <strong>Unidade</strong>
                  <br />
                  <strong>Formatos aceitos:</strong> Excel (.xlsx, .xls) ou PDF
                </p>
              </div>

              <Button 
                onClick={processFile} 
                disabled={!file || isProcessing}
                className="w-full"
              >
                <Upload className="h-4 w-4 mr-2" />
                {isProcessing ? "Processando..." : "Importar Planilha"}
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
              <div className="space-y-1">
                <p className="text-sm font-medium">
                  {matchedCount} de {processedItems.length} itens precificados
                </p>
                <p className="text-2xl font-bold">
                  Total: R$ {totalValue.toFixed(2)}
                </p>
              </div>
              <Badge variant={matchedCount === processedItems.length ? "default" : "secondary"}>
                {matchedCount === processedItems.length ? "Todos precificados" : "Revisão necessária"}
              </Badge>
            </div>

            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Descrição</TableHead>
                    <TableHead>Quantidade</TableHead>
                    <TableHead>Unidade</TableHead>
                    <TableHead>Preço Unitário</TableHead>
                    <TableHead>Preço Total</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {processedItems.map((item, index) => (
                    <TableRow key={index}>
                      <TableCell className="font-medium max-w-xs" title={item.description}>
                        {item.description}
                      </TableCell>
                      <TableCell>{item.quantity}</TableCell>
                      <TableCell>{item.unit}</TableCell>
                      <TableCell>
                        <span className={item.unit_price > 0 ? "font-semibold text-green-600" : "text-muted-foreground"}>
                          R$ {item.unit_price.toFixed(2)}
                        </span>
                      </TableCell>
                      <TableCell className="font-semibold">
                        R$ {item.total.toFixed(2)}
                      </TableCell>
                      <TableCell>
                        <Badge 
                          variant={item.match_type === 'Encontrado' ? 'default' : 'destructive'}
                        >
                          {item.match_type || 'Não buscado'}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Salvar em qual orçamento? (opcional)</Label>
                <Select value={selectedBudgetId} onValueChange={setSelectedBudgetId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione um orçamento" />
                  </SelectTrigger>
                  <SelectContent>
                    {budgets?.map((budget) => (
                      <SelectItem key={budget.id} value={budget.id}>
                        {budget.name} {budget.budget_number ? `(${budget.budget_number})` : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex justify-between items-center pt-4 border-t">
                <Button variant="outline" onClick={handleReset}>
                  Nova Importação
                </Button>
                <div className="flex gap-2">
                  <Button 
                    onClick={searchPrices}
                    disabled={isSearchingPrices || processedItems.every(i => i.matched && i.unit_price > 0)}
                    variant="secondary"
                  >
                    <Search className="h-4 w-4 mr-2" />
                    {isSearchingPrices ? "Buscando..." : "Buscar Preços na Gestão de Preços"}
                  </Button>
                  <Button 
                    variant="secondary" 
                    onClick={handleExport}
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Exportar
                  </Button>
                  {selectedBudgetId && (
                    <Button 
                      onClick={() => saveMutation.mutate()}
                      disabled={saveMutation.isPending}
                    >
                      <Save className="h-4 w-4 mr-2" />
                      Salvar no Orçamento
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default BudgetPricing;
