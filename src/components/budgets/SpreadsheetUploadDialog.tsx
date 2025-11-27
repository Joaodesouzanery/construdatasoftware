import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Upload, Download, Save, CheckCircle, AlertCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
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

interface SpreadsheetUploadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  budgetId: string;
}

interface ProcessedItem {
  description: string;
  quantity: number;
  unit: string;
  unit_price_material: number;
  unit_price_labor: number;
  total: number;
  material_id: string | null;
  matched: boolean;
  confidence?: number;
}

export const SpreadsheetUploadDialog = ({ open, onOpenChange, budgetId }: SpreadsheetUploadDialogProps) => {
  const [file, setFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processedItems, setProcessedItems] = useState<ProcessedItem[]>([]);
  const [showReview, setShowReview] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Mapeamento de variações e sinônimos comuns
  const commonSynonyms: Record<string, string[]> = {
    'fornecimento': ['fornecimento', 'fornecer', 'fornec'],
    'instalacao': ['instalacao', 'instalar', 'instal', 'montagem', 'montar'],
    'execucao': ['execucao', 'executar', 'exec'],
    'anotacao': ['anotacao', 'anotar', 'anot'],
    'responsabilidade': ['responsabilidade', 'resp'],
    'tecnica': ['tecnica', 'tec', 'tecnico'],
  };

  // Função para normalizar texto (remover acentos, espaços extras, etc)
  const normalizeText = (text: string): string => {
    return text
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/\s+/g, " ")
      .trim();
  };

  // Função para detectar siglas importantes (palavras curtas em maiúsculas)
  const detectAcronyms = (text: string): string[] => {
    const matches = text.match(/\b[A-Z]{2,}\b/g);
    return matches ? matches.map(m => m.toLowerCase()) : [];
  };

  // Função para extrair tokens importantes (palavras-chave individuais)
  const extractKeyTokens = (text: string): string[] => {
    const normalized = normalizeText(text);
    const acronyms = detectAcronyms(text);
    const words = normalized.split(" ");
    
    // Remove stopwords comuns
    const stopwords = ['de', 'da', 'do', 'em', 'para', 'com', 'e', 'ou', 'a', 'o', 'os', 'as'];
    const filteredWords = words.filter(word => 
      word.length >= 2 && !stopwords.includes(word)
    );
    
    // Combina palavras filtradas com siglas detectadas
    return [...new Set([...filteredWords, ...acronyms])];
  };

  // Função para expandir sinônimos
  const expandSynonyms = (word: string): string[] => {
    const normalized = normalizeText(word);
    for (const [key, synonyms] of Object.entries(commonSynonyms)) {
      if (synonyms.some(syn => normalizeText(syn) === normalized)) {
        return synonyms;
      }
    }
    return [word];
  };

  // Função para calcular similaridade entre duas strings
  const calculateSimilarity = (str1: string, str2: string): number => {
    const s1 = normalizeText(str1);
    const s2 = normalizeText(str2);
    
    // Verifica correspondência exata
    if (s1 === s2) return 1.0;
    
    // Verifica se uma string contém a outra completamente
    if (s1.includes(s2) || s2.includes(s1)) return 0.95;
    
    // Extrai tokens importantes de ambas as strings
    const tokens1 = extractKeyTokens(str1);
    const tokens2 = extractKeyTokens(str2);
    
    // Detecta siglas em ambas
    const acronyms1 = detectAcronyms(str1);
    const acronyms2 = detectAcronyms(str2);
    
    // Se houver siglas em comum, aumenta muito a pontuação
    const commonAcronyms = acronyms1.filter(acr => acronyms2.includes(acr));
    if (commonAcronyms.length > 0) {
      return 0.9; // Alta confiança quando siglas importantes coincidem
    }
    
    // Expande tokens com sinônimos
    const expandedTokens1: string[] = [];
    tokens1.forEach(token => {
      expandedTokens1.push(...expandSynonyms(token));
    });
    
    const expandedTokens2: string[] = [];
    tokens2.forEach(token => {
      expandedTokens2.push(...expandSynonyms(token));
    });
    
    // Conta tokens em comum (considerando sinônimos)
    const commonTokens = expandedTokens1.filter(token => 
      expandedTokens2.includes(token)
    );
    
    if (commonTokens.length === 0) return 0;
    
    // Calcula score base
    const baseScore = commonTokens.length / Math.max(tokens1.length, tokens2.length);
    
    // Bônus para tokens curtos importantes (2-4 caracteres, geralmente siglas ou termos técnicos)
    const shortTokenMatches = commonTokens.filter(token => 
      token.length >= 2 && token.length <= 4
    ).length;
    const shortTokenBonus = shortTokenMatches > 0 ? 0.15 : 0;
    
    // Bônus se a ordem das palavras principais for similar
    let orderBonus = 0;
    if (tokens1.length >= 2 && tokens2.length >= 2) {
      const firstTokenMatch = tokens1[0] === tokens2[0];
      const lastTokenMatch = tokens1[tokens1.length - 1] === tokens2[tokens2.length - 1];
      if (firstTokenMatch || lastTokenMatch) {
        orderBonus = 0.1;
      }
    }
    
    return Math.min(baseScore + shortTokenBonus + orderBonus, 1.0);
  };

  // Função para buscar material correspondente
  const findMatchingMaterial = async (description: string, unit?: string) => {
    const { data: materials } = await supabase
      .from('materials')
      .select('*');
    
    const { data: customKeywords } = await supabase
      .from('custom_keywords')
      .select('*');
    
    if (!materials || materials.length === 0) return null;

    // Busca exata primeiro
    const exactMatch = materials.find(m => 
      normalizeText(m.name) === normalizeText(description)
    );
    if (exactMatch) return { material: exactMatch, confidence: 1.0 };

    // Extrai tokens da descrição buscada
    const descriptionTokens = extractKeyTokens(description);

    // Busca por similaridade considerando nome, descrição e palavras-chave
    let bestMatch = null;
    let bestSimilarity = 0;

    for (const material of materials) {
      let maxSimilarity = 0;

      // Similaridade com nome
      const nameSimilarity = calculateSimilarity(material.name, description);
      maxSimilarity = Math.max(maxSimilarity, nameSimilarity);

      // Similaridade com descrição
      if (material.description) {
        const descSimilarity = calculateSimilarity(material.description, description);
        maxSimilarity = Math.max(maxSimilarity, descSimilarity);
      }

      // Similaridade com palavras-chave do material
      if (material.keywords && Array.isArray(material.keywords)) {
        for (const keyword of material.keywords) {
          const keywordSimilarity = calculateSimilarity(keyword, description);
          maxSimilarity = Math.max(maxSimilarity, keywordSimilarity);

          // Busca por tokens individuais das keywords
          const keywordTokens = extractKeyTokens(keyword);
          const matchingTokens = descriptionTokens.filter(token => 
            keywordTokens.includes(token)
          );
          if (matchingTokens.length > 0) {
            const tokenScore = matchingTokens.length / Math.max(keywordTokens.length, 1);
            maxSimilarity = Math.max(maxSimilarity, tokenScore * 0.85);
          }
        }
      }

      // Similaridade com custom keywords e sinônimos
      if (customKeywords) {
        for (const ck of customKeywords) {
          const ckSimilarity = calculateSimilarity(ck.keyword_value, description);
          maxSimilarity = Math.max(maxSimilarity, ckSimilarity);

          // Verifica sinônimos
          if (ck.synonyms && Array.isArray(ck.synonyms)) {
            for (const synonym of ck.synonyms) {
              const synSimilarity = calculateSimilarity(synonym, description);
              maxSimilarity = Math.max(maxSimilarity, synSimilarity);

              // Busca por tokens nos sinônimos
              const synonymTokens = extractKeyTokens(synonym);
              const matchingTokens = descriptionTokens.filter(token => 
                synonymTokens.includes(token)
              );
              if (matchingTokens.length > 0) {
                const tokenScore = matchingTokens.length / Math.max(synonymTokens.length, 1);
                maxSimilarity = Math.max(maxSimilarity, tokenScore * 0.85);
              }
            }
          }
        }
      }
      
      // Considera correspondência de unidade
      const unitMatch = !unit || !material.unit || 
        normalizeText(material.unit) === normalizeText(unit);
      const finalSimilarity = unitMatch ? maxSimilarity : maxSimilarity * 0.8;

      if (finalSimilarity > bestSimilarity && finalSimilarity > 0.5) {
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
        // Processa arquivo Excel localmente
        console.log('Processing Excel file...');
        const data = await file.arrayBuffer();
        const workbook = XLSX.read(data);
        const worksheet = workbook.Sheets[workbook.SheetNames[0]];
        jsonData = XLSX.utils.sheet_to_json(worksheet);
        console.log('Excel processed:', jsonData.length, 'rows found');
      }

      if (!jsonData || jsonData.length === 0) {
        throw new Error("A planilha está vazia ou não pôde ser lida");
      }

      // Função para encontrar valor por múltiplas variações de nome de coluna
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
      const skippedRows: string[] = [];

      for (let i = 0; i < jsonData.length; i++) {
        const rowData: any = jsonData[i];
        
        // Busca descrição com múltiplas variações
        const description = findColumnValue(rowData, [
          'descricao', 'description', 'desc', 'item', 
          'material', 'servico', 'service', 'produto'
        ]);
        
        // Busca quantidade
        const quantityStr = findColumnValue(rowData, [
          'quantidade', 'quantity', 'qtd', 'qtde', 'quant'
        ]);
        const quantity = parseFloat(quantityStr.replace(',', '.')) || 0;

        // Busca unidade
        const unit = findColumnValue(rowData, [
          'unidade', 'unit', 'un', 'und', 'medida'
        ]) || 'UN';

        // Validação mais permissiva
        if (!description || description.length < 2) {
          skippedRows.push(`Linha ${i + 2}: Descrição inválida ou vazia`);
          continue;
        }

        if (quantity <= 0) {
          skippedRows.push(`Linha ${i + 2}: Quantidade inválida (${quantityStr})`);
          continue;
        }

        // Busca material correspondente
        const match = await findMatchingMaterial(description, unit);
        
        if (match && match.confidence > 0.6) {
          const material = match.material;
          const materialPrice = material.material_price || 0;
          const laborPrice = material.labor_price || 0;
          const totalPrice = materialPrice + laborPrice;
          
          items.push({
            description,
            quantity,
            unit,
            unit_price_material: materialPrice,
            unit_price_labor: laborPrice,
            total: quantity * totalPrice,
            material_id: material.id,
            matched: true,
            confidence: match.confidence
          });
        } else {
          // Material não encontrado
          items.push({
            description,
            quantity,
            unit,
            unit_price_material: 0,
            unit_price_labor: 0,
            total: 0,
            material_id: null,
            matched: false
          });
        }
      }

      if (items.length === 0) {
        let errorMsg = "Nenhum item válido encontrado na planilha.";
        if (skippedRows.length > 0) {
          errorMsg += "\n\nLinhas ignoradas:\n" + skippedRows.slice(0, 5).join('\n');
          if (skippedRows.length > 5) {
            errorMsg += `\n... e mais ${skippedRows.length - 5} linhas`;
          }
        }
        errorMsg += "\n\nVerifique se a planilha contém as colunas: Descrição, Quantidade e Unidade";
        throw new Error(errorMsg);
      }

      // Feedback sobre linhas ignoradas
      if (skippedRows.length > 0) {
        console.warn(`${skippedRows.length} linhas foram ignoradas:`, skippedRows);
        toast({
          title: "Atenção",
          description: `${items.length} itens processados. ${skippedRows.length} linhas foram ignoradas por dados inválidos.`,
          variant: "default",
        });
      }

      setProcessedItems(items);
      setShowReview(true);
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

  const handleExport = async () => {
    try {
      // Primeiro, salva no backend
      await importMutation.mutateAsync(processedItems);

      // Depois, exporta a planilha
      const exportData = processedItems.map(item => ({
        'Descrição': item.description,
        'Unidade': item.unit,
        'Quantidade': item.quantity,
        'Preço Unitário Material': item.unit_price_material.toFixed(2),
        'Preço Unitário Mão de Obra': item.unit_price_labor.toFixed(2),
        'Preço Total': item.total.toFixed(2),
        'Status': item.matched ? 'Precificado' : 'Sem Preço'
      }));

      const ws = XLSX.utils.json_to_sheet(exportData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Orçamento');
      XLSX.writeFile(wb, `orcamento_${new Date().getTime()}.xlsx`);

      toast({
        title: "Sucesso",
        description: "Orçamento exportado e salvo no sistema!",
      });
      
      handleClose();
    } catch (error: any) {
      toast({
        title: "Erro ao exportar",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleImport = async () => {
    await importMutation.mutateAsync(processedItems);
  };

  const handleClose = () => {
    setFile(null);
    setProcessedItems([]);
    setShowReview(false);
    onOpenChange(false);
  };

  const matchedCount = processedItems.filter(i => i.matched).length;
  const totalValue = processedItems.reduce((sum, item) => sum + item.total, 0);

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {showReview ? "Revisão do Orçamento" : "Importar Planilha de Orçamento"}
          </DialogTitle>
        </DialogHeader>

        {!showReview ? (
          <div className="space-y-4">
            <div>
              <Label htmlFor="file">Arquivo da Planilha (.xlsx, .xls, .pdf)</Label>
              <Input
                id="file"
                type="file"
                accept=".xlsx,.xls,.pdf"
                onChange={handleFileChange}
                className="mt-2"
              />
              <p className="text-sm text-muted-foreground mt-2">
                A planilha deve conter colunas com os seguintes dados:
                <br />
                <strong>• Descrição</strong> (ou Item, Material, Serviço)
                <br />
                <strong>• Quantidade</strong> (ou Qtd, Qtde)
                <br />
                <strong>• Unidade</strong> (ou Un, Und) - opcional, padrão: UN
                <br />
                <br />
                <strong>Formatos aceitos:</strong> Excel (.xlsx, .xls) ou PDF
                <br />
                Para PDFs, o sistema usa IA para extrair os dados automaticamente.
                <br />
                O sistema buscará preços automaticamente na Gestão de Preços.
              </p>
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={handleClose}>
                Cancelar
              </Button>
              <Button 
                onClick={processFile} 
                disabled={!file || isProcessing}
              >
                <Upload className="h-4 w-4 mr-2" />
                {isProcessing ? "Processando..." : "Analisar Planilha"}
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
              <div className="space-y-1">
                <p className="text-sm font-medium">
                  {matchedCount} de {processedItems.length} itens precificados automaticamente
                </p>
                <p className="text-2xl font-bold">
                  Total: R$ {totalValue.toFixed(2)}
                </p>
              </div>
              <div className="flex gap-2">
                <Badge variant={matchedCount === processedItems.length ? "default" : "secondary"}>
                  {matchedCount === processedItems.length ? "Todos precificados" : "Revisão necessária"}
                </Badge>
              </div>
            </div>

            <div className="border rounded-lg">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Status</TableHead>
                    <TableHead>Descrição</TableHead>
                    <TableHead>Qtd</TableHead>
                    <TableHead>Un</TableHead>
                    <TableHead>Preço Unit. Material</TableHead>
                    <TableHead>Preço Unit. M.O.</TableHead>
                    <TableHead>Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {processedItems.map((item, index) => (
                    <TableRow key={index}>
                      <TableCell>
                        {item.matched ? (
                          <CheckCircle className="h-5 w-5 text-green-500" />
                        ) : (
                          <AlertCircle className="h-5 w-5 text-yellow-500" />
                        )}
                      </TableCell>
                      <TableCell className="font-medium">{item.description}</TableCell>
                      <TableCell>{item.quantity}</TableCell>
                      <TableCell>{item.unit}</TableCell>
                      <TableCell>R$ {item.unit_price_material.toFixed(2)}</TableCell>
                      <TableCell>R$ {item.unit_price_labor.toFixed(2)}</TableCell>
                      <TableCell className="font-semibold">R$ {item.total.toFixed(2)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            <div className="flex justify-between items-center pt-4 border-t">
              <Button variant="outline" onClick={handleClose}>
                Cancelar
              </Button>
              <div className="flex gap-2">
                <Button 
                  variant="secondary" 
                  onClick={handleExport}
                  disabled={importMutation.isPending}
                >
                  <Download className="h-4 w-4 mr-2" />
                  Exportar e Salvar
                </Button>
                <Button 
                  onClick={handleImport}
                  disabled={importMutation.isPending}
                >
                  <Save className="h-4 w-4 mr-2" />
                  Importar para Orçamento
                </Button>
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
