import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Upload, Download, FileSpreadsheet, Loader2, CheckCircle2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import * as XLSX from 'xlsx';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface PriceSpreadsheetDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const PriceSpreadsheetDialog = ({ open, onOpenChange }: PriceSpreadsheetDialogProps) => {
  const [file, setFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processedMaterials, setProcessedMaterials] = useState<any[]>([]);
  const [step, setStep] = useState<'upload' | 'preview'>('upload');
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: catalogedMaterials } = useQuery({
    queryKey: ['cataloged-materials-pricing'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('materials')
        .select('*');
      
      if (error) throw error;
      return data || [];
    }
  });

  const { data: budgets } = useQuery({
    queryKey: ['budgets'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];
      
      const { data, error } = await supabase
        .from('budgets')
        .select('*')
        .eq('created_by_user_id', user.id)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data || [];
    }
  });

  const [selectedBudget, setSelectedBudget] = useState<string>("");

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
    }
  };

  const matchMaterial = (description: string, catalogedMaterials: any[]) => {
    const descLower = description.toLowerCase().trim();
    if (!descLower) return null;
    
    // Normalizar descrição removendo caracteres especiais e espaços extras
    const normalizeText = (text: string) => 
      text.toLowerCase()
        .replace(/[^\w\s]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
    
    const descNormalized = normalizeText(descLower);
    const descWords = descNormalized.split(' ').filter(w => w.length > 2);
    
    let bestMatch: any = null;
    let bestConfidence = 0;
    
    for (const material of catalogedMaterials) {
      const nameLower = material.name.toLowerCase();
      const nameNormalized = normalizeText(nameLower);
      
      // 1. Match exato (confiança 95%)
      if (descNormalized === nameNormalized || descLower === nameLower) {
        return {
          ...material,
          confidence: 95
        };
      }
      
      // 2. Match por nome contido (confiança 90%)
      if (descNormalized.includes(nameNormalized) || nameNormalized.includes(descNormalized)) {
        if (90 > bestConfidence) {
          bestMatch = material;
          bestConfidence = 90;
        }
      }
      
      // 3. Match por keywords/sinônimos (confiança 85-88%)
      if (material.keywords && Array.isArray(material.keywords)) {
        for (const keyword of material.keywords) {
          const keywordNormalized = normalizeText(keyword);
          
          // Match exato de keyword
          if (descNormalized === keywordNormalized || descLower.includes(keyword.toLowerCase())) {
            if (88 > bestConfidence) {
              bestMatch = material;
              bestConfidence = 88;
            }
          }
          
          // Keyword parcial
          if (descNormalized.includes(keywordNormalized) || keywordNormalized.includes(descNormalized)) {
            if (85 > bestConfidence) {
              bestMatch = material;
              bestConfidence = 85;
            }
          }
        }
      }
      
      // 4. Match por palavras individuais (confiança baseada em % de match)
      const nameWords = nameNormalized.split(' ').filter(w => w.length > 2);
      
      if (nameWords.length > 0 && descWords.length > 0) {
        const matchedWords = nameWords.filter(nameWord => 
          descWords.some(descWord => 
            descWord.includes(nameWord) || nameWord.includes(descWord)
          )
        );
        
        const matchPercentage = matchedWords.length / nameWords.length;
        const confidence = Math.round(matchPercentage * 80); // Max 80%
        
        if (confidence >= 50 && confidence > bestConfidence) {
          bestMatch = material;
          bestConfidence = confidence;
        }
      }
      
      // 5. Match por palavras da descrição (invertido - confiança 60-75%)
      if (descWords.length > 0) {
        const matchedDescWords = descWords.filter(descWord =>
          nameNormalized.includes(descWord)
        );
        
        const matchPercentage = matchedDescWords.length / descWords.length;
        const confidence = Math.round(matchPercentage * 75); // Max 75%
        
        if (confidence >= 50 && confidence > bestConfidence) {
          bestMatch = material;
          bestConfidence = confidence;
        }
      }
    }
    
    return bestMatch ? { ...bestMatch, confidence: bestConfidence } : null;
  };

  const processFile = async () => {
    if (!file || !catalogedMaterials) return;

    setIsProcessing(true);
    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data);
      const worksheet = workbook.Sheets[workbook.SheetNames[0]];
      const jsonData: any[] = XLSX.utils.sheet_to_json(worksheet);

      toast({
        title: "Processando planilha...",
        description: "Identificando materiais e preenchendo preços"
      });

      const processed = jsonData.map((row: any, index: number) => {
        // Função helper para buscar valores case-insensitive e com variações
        const getColumnValue = (possibleNames: string[]) => {
          for (const name of possibleNames) {
            // Tentar buscar exato
            if (row[name] !== undefined && row[name] !== null && row[name] !== '') {
              return row[name];
            }
            // Tentar buscar case-insensitive
            const key = Object.keys(row).find(k => 
              k.toLowerCase().trim() === name.toLowerCase().trim()
            );
            if (key && row[key] !== undefined && row[key] !== null && row[key] !== '') {
              return row[key];
            }
            // Tentar buscar por substring (parcial)
            const partialKey = Object.keys(row).find(k => 
              k.toLowerCase().includes(name.toLowerCase()) || 
              name.toLowerCase().includes(k.toLowerCase())
            );
            if (partialKey && row[partialKey] !== undefined && row[partialKey] !== null && row[partialKey] !== '') {
              return row[partialKey];
            }
          }
          return '';
        };

        // Log para debug - ver quais colunas estão disponíveis
        if (index === 0) {
          console.log('Colunas disponíveis na planilha:', Object.keys(row));
        }

        // Tentar identificar colunas comuns (case-insensitive e variações)
        const description = getColumnValue([
          'Descrição', 'DESCRIÇÃO', 'Descricao', 'DESCRICAO', 'Descrição Original',
          'Material', 'MATERIAL', 
          'Item', 'ITEM', 
          'Produto', 'PRODUTO', 
          'Nome', 'NOME',
          'Serviço', 'SERVIÇO', 'Servico', 'SERVICO',
          'Desc', 'DESC'
        ]);
        const quantityRaw = getColumnValue([
          'Quantidade', 'QUANTIDADE', 'Qtd', 'QTD', 'QTDE', 'Qtde', 
          'Quant', 'QUANT', 'Qnt', 'QNT'
        ]);
        const quantity = quantityRaw ? parseFloat(String(quantityRaw).replace(',', '.')) : 1;
        const unit = getColumnValue([
          'Unidade', 'UNIDADE', 'Un', 'UN', 'Unit', 'UNIT', 
          'UNID.', 'UNID', 'Unid', 'UND', 'Und'
        ]) || 'UN';

        // Buscar material correspondente no catálogo
        const matched = matchMaterial(description, catalogedMaterials);

        if (matched) {
          const materialPrice = matched.material_price || 0;
          const laborPrice = matched.labor_price || 0;
          const totalPrice = materialPrice + laborPrice;
          const totalAmount = quantity * totalPrice;

          return {
            originalDescription: description,
            name: matched.name,
            brand: matched.brand,
            color: matched.color,
            measurement: matched.measurement,
            unit: matched.unit || unit,
            quantity: quantity,
            material_price: materialPrice,
            labor_price: laborPrice,
            price: totalPrice,
            total: totalAmount,
            confidence: matched.confidence,
            matched: true
          };
        } else {
          // Não encontrou correspondência
          return {
            originalDescription: description,
            name: description,
            brand: null,
            color: null,
            measurement: null,
            unit: unit,
            quantity: quantity,
            material_price: 0,
            labor_price: 0,
            price: 0,
            total: 0,
            confidence: 0,
            matched: false
          };
        }
      });

      const matchedCount = processed.filter(p => p.matched).length;

      setProcessedMaterials(processed);
      setStep('preview');

      toast({
        title: "Processamento concluído!",
        description: `${matchedCount} de ${processed.length} materiais encontrados no catálogo`,
        variant: matchedCount > 0 ? "default" : "destructive"
      });
    } catch (error: any) {
      console.error('Erro ao processar planilha:', error);
      toast({
        title: "Erro ao processar",
        description: error.message || "Não foi possível processar a planilha",
        variant: "destructive"
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const exportAndCreateBudget = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      // Create the budget first
      const budgetName = `Orçamento Automático - ${new Date().toLocaleDateString('pt-BR')}`;
      const { data: newBudget, error: budgetError } = await supabase
        .from('budgets')
        .insert({
          name: budgetName,
          description: 'Orçamento criado automaticamente via precificação de planilha',
          status: 'draft',
          created_by_user_id: user.id
        })
        .select()
        .single();

      if (budgetError) throw budgetError;

      // Add items to the budget
      const itemsToInsert = processedMaterials.map((material, index) => {
        const unitPriceMaterial = material.material_price || 0;
        const unitPriceLabor = material.labor_price || 0;
        const quantity = material.quantity || 0;

        return {
          budget_id: newBudget.id,
          item_number: index + 1,
          description: `${material.name}${material.brand ? ' - ' + material.brand : ''}${material.color ? ' - ' + material.color : ''}${material.measurement ? ' - ' + material.measurement : ''}`,
          unit: material.unit,
          quantity: quantity,
          unit_price_material: unitPriceMaterial,
          unit_price_labor: unitPriceLabor,
          bdi_percentage: 0,
          subtotal_material: quantity * unitPriceMaterial,
          subtotal_labor: quantity * unitPriceLabor,
          subtotal_bdi: 0,
          total: quantity * (unitPriceMaterial + unitPriceLabor),
        };
      });

      const { error: itemsError } = await supabase
        .from('budget_items')
        .insert(itemsToInsert);

      if (itemsError) throw itemsError;

      // Export spreadsheet
      const ws = XLSX.utils.json_to_sheet(
        processedMaterials.map(m => ({
          'Descrição Original': m.originalDescription,
          'Material': m.name,
          'Marca': m.brand || '',
          'Cor': m.color || '',
          'Medida': m.measurement || '',
          'Unidade': m.unit,
          'Quantidade': m.quantity,
          'Preço Material (R$)': m.material_price,
          'Preço M.O. (R$)': m.labor_price,
          'Preço Total Unit. (R$)': m.price,
          'Total (R$)': m.total,
          'Encontrado': m.matched ? 'Sim' : 'Não',
          'Confiança (%)': Math.round(m.confidence)
        }))
      );
      
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Materiais Precificados');
      XLSX.writeFile(wb, `orcamento_${newBudget.budget_number || 'precificado'}_${new Date().toISOString().split('T')[0]}.xlsx`);

      queryClient.invalidateQueries({ queryKey: ['budgets'] });

      toast({
        title: "Sucesso!",
        description: `Orçamento "${budgetName}" criado e planilha exportada com sucesso!`
      });

      onOpenChange(false);
      resetDialog();
    } catch (error: any) {
      toast({
        title: "Erro ao exportar",
        description: error.message,
        variant: "destructive"
      });
    }
  };

  const importToBudget = async () => {
    if (!selectedBudget) {
      toast({
        title: "Selecione um orçamento",
        description: "Escolha o orçamento onde deseja importar os materiais",
        variant: "destructive"
      });
      return;
    }

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      const { data: existingItems } = await supabase
        .from('budget_items')
        .select('item_number')
        .eq('budget_id', selectedBudget)
        .order('item_number', { ascending: false })
        .limit(1);

      const startNumber = existingItems && existingItems.length > 0 
        ? existingItems[0].item_number + 1 
        : 1;

      const itemsToInsert = processedMaterials.map((material, index) => {
        const unitPriceMaterial = material.material_price || 0;
        const unitPriceLabor = material.labor_price || 0;
        const quantity = material.quantity || 0;

        return {
          budget_id: selectedBudget,
          item_number: startNumber + index,
          description: `${material.name}${material.brand ? ' - ' + material.brand : ''}${material.color ? ' - ' + material.color : ''}${material.measurement ? ' - ' + material.measurement : ''}`,
          unit: material.unit,
          quantity: quantity,
          unit_price_material: unitPriceMaterial,
          unit_price_labor: unitPriceLabor,
          bdi_percentage: 0,
          subtotal_material: quantity * unitPriceMaterial,
          subtotal_labor: quantity * unitPriceLabor,
          subtotal_bdi: 0,
          total: quantity * (unitPriceMaterial + unitPriceLabor),
        };
      });

      const { error } = await supabase
        .from('budget_items')
        .insert(itemsToInsert);

      if (error) throw error;

      queryClient.invalidateQueries({ queryKey: ['budget-items'] });
      queryClient.invalidateQueries({ queryKey: ['budgets'] });

      toast({
        title: "Sucesso!",
        description: `${itemsToInsert.length} materiais importados para o orçamento`
      });

      onOpenChange(false);
      resetDialog();
    } catch (error: any) {
      toast({
        title: "Erro ao importar",
        description: error.message,
        variant: "destructive"
      });
    }
  };

  const resetDialog = () => {
    setFile(null);
    setStep('upload');
    setProcessedMaterials([]);
    setSelectedBudget("");
  };

  const matchedMaterials = processedMaterials.filter(m => m.matched);
  const unmatchedMaterials = processedMaterials.filter(m => !m.matched);

  return (
    <Dialog open={open} onOpenChange={(open) => {
      onOpenChange(open);
      if (!open) resetDialog();
    }}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Precificação Automática de Planilhas</DialogTitle>
        </DialogHeader>

        {step === 'upload' && (
          <div className="space-y-4">
            <div>
              <Label htmlFor="file">Upload da Planilha (sem preços)</Label>
              <Input
                id="file"
                type="file"
                accept=".xlsx,.xls"
                onChange={handleFileChange}
                className="mt-2"
              />
              <p className="text-sm text-muted-foreground mt-2">
                O sistema identificará os materiais e preencherá automaticamente com os preços cadastrados em "Gestão de Preços"
              </p>
            </div>

            <div className="bg-muted p-4 rounded-lg">
              <h4 className="font-semibold mb-2">Como funciona:</h4>
              <ol className="list-decimal list-inside space-y-1 text-sm">
                <li>Faça upload da planilha com descrições de materiais (colunas: Descrição/Material, Quantidade, Unidade)</li>
                <li>O sistema busca correspondências nos materiais cadastrados usando nomes e palavras-chave</li>
                <li>Os preços são preenchidos automaticamente dos materiais encontrados</li>
                <li>Revise os materiais e exporte a planilha com preços ou importe para um orçamento</li>
              </ol>
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button 
                onClick={processFile} 
                disabled={!file || isProcessing || !catalogedMaterials}
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Processando...
                  </>
                ) : (
                  <>
                    <FileSpreadsheet className="h-4 w-4 mr-2" />
                    Processar e Precificar
                  </>
                )}
              </Button>
            </div>
          </div>
        )}

        {step === 'preview' && processedMaterials.length > 0 && (
          <div className="space-y-4">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2 text-green-600">
                <CheckCircle2 className="h-5 w-5" />
                <p className="font-semibold">{matchedMaterials.length} materiais encontrados</p>
              </div>
              {unmatchedMaterials.length > 0 && (
                <p className="text-sm text-yellow-600">
                  {unmatchedMaterials.length} materiais não encontrados no catálogo
                </p>
              )}
            </div>

            <div className="border rounded-lg max-h-[400px] overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Descrição Original</TableHead>
                    <TableHead>Material</TableHead>
                    <TableHead>Marca</TableHead>
                    <TableHead>Un</TableHead>
                    <TableHead>Qtd</TableHead>
                    <TableHead>Preço Mat.</TableHead>
                    <TableHead>Preço M.O.</TableHead>
                    <TableHead>Preço Unit.</TableHead>
                    <TableHead>Total</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {processedMaterials.map((material, index) => (
                    <TableRow key={index} className={!material.matched ? 'bg-yellow-50' : ''}>
                      <TableCell className="text-xs max-w-[200px] truncate">
                        {material.originalDescription}
                      </TableCell>
                      <TableCell className="font-medium">{material.name}</TableCell>
                      <TableCell>{material.brand || '-'}</TableCell>
                      <TableCell>{material.unit}</TableCell>
                      <TableCell>{material.quantity}</TableCell>
                      <TableCell>R$ {material.material_price.toFixed(2)}</TableCell>
                      <TableCell>R$ {material.labor_price.toFixed(2)}</TableCell>
                      <TableCell>R$ {material.price.toFixed(2)}</TableCell>
                      <TableCell className="font-medium">R$ {material.total.toFixed(2)}</TableCell>
                      <TableCell>
                        {material.matched ? (
                          <span className="text-green-600 text-xs">
                            ✓ {Math.round(material.confidence)}%
                          </span>
                        ) : (
                          <span className="text-yellow-600 text-xs">
                            ⚠ Não encontrado
                          </span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            <div className="space-y-4">
              <div>
                <Label htmlFor="budget-select">Importar para Orçamento (Opcional)</Label>
                <Select value={selectedBudget} onValueChange={setSelectedBudget}>
                  <SelectTrigger id="budget-select">
                    <SelectValue placeholder="Selecione um orçamento" />
                  </SelectTrigger>
                  <SelectContent>
                    {budgets?.map(budget => (
                      <SelectItem key={budget.id} value={budget.id}>
                        {budget.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setStep('upload')}>
                  Voltar
                </Button>
                <Button onClick={exportAndCreateBudget}>
                  <Download className="h-4 w-4 mr-2" />
                  Exportar e Criar Orçamento
                </Button>
                {selectedBudget && (
                  <Button variant="outline" onClick={importToBudget}>
                    <Upload className="h-4 w-4 mr-2" />
                    Importar para Orçamento Existente
                  </Button>
                )}
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
