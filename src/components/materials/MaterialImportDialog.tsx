import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Upload, Save, X, CheckCircle, AlertCircle, Check, SkipForward, Plus } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
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

interface MaterialImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface ExtractedMaterial {
  name: string;
  description?: string;
  unit: string;
  quantity?: number;
  current_price?: number;
  material_price?: number;
  labor_price?: number;
  category?: string;
  supplier?: string;
  existingMaterial?: any;
  similarity?: number;
  matchType?: string;
  needsApproval?: boolean;
  approved?: boolean;
  isNew?: boolean;
}

export const MaterialImportDialog = ({ open, onOpenChange }: MaterialImportDialogProps) => {
  const [file, setFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [extractedMaterials, setExtractedMaterials] = useState<ExtractedMaterial[]>([]);
  const [showReview, setShowReview] = useState(false);
  const [pendingApprovalIndex, setPendingApprovalIndex] = useState<number | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: existingMaterials } = useQuery({
    queryKey: ['materials-for-import'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('materials')
        .select('*');
      if (error) throw error;
      return data || [];
    }
  });

  const normalizeText = (text: string): string => {
    return text
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^\w\s]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  };

  const levenshteinDistance = (str1: string, str2: string): number => {
    const len1 = str1.length;
    const len2 = str2.length;
    const matrix: number[][] = [];

    for (let i = 0; i <= len1; i++) matrix[i] = [i];
    for (let j = 0; j <= len2; j++) matrix[0][j] = j;

    for (let i = 1; i <= len1; i++) {
      for (let j = 1; j <= len2; j++) {
        const cost = str1[i - 1] === str2[j - 1] ? 0 : 1;
        matrix[i][j] = Math.min(
          matrix[i - 1][j] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j - 1] + cost
        );
      }
    }
    return matrix[len1][len2];
  };

  const calculateSimilarity = (text1: string, text2: string): number => {
    const norm1 = normalizeText(text1);
    const norm2 = normalizeText(text2);
    
    if (norm1 === norm2) return 100;
    
    const maxLen = Math.max(norm1.length, norm2.length);
    const distance = levenshteinDistance(norm1, norm2);
    return Math.max(0, (1 - distance / maxLen) * 100);
  };

  const findSimilarMaterial = (name: string): { material: any; similarity: number; matchType: string } | null => {
    if (!existingMaterials || existingMaterials.length === 0) return null;

    const normalizedName = normalizeText(name);
    
    // Busca exata
    const exactMatch = existingMaterials.find(m => normalizeText(m.name) === normalizedName);
    if (exactMatch) return { material: exactMatch, similarity: 100, matchType: 'Exato' };

    // Busca parcial
    const partialMatch = existingMaterials.find(m => {
      const normalizedMat = normalizeText(m.name);
      return normalizedName.includes(normalizedMat) || normalizedMat.includes(normalizedName);
    });
    if (partialMatch) return { material: partialMatch, similarity: 85, matchType: 'Parcial' };

    // Busca por similaridade
    let bestMatch: { material: any; similarity: number } | null = null;
    existingMaterials.forEach(m => {
      const similarity = calculateSimilarity(name, m.name);
      if (similarity >= 60 && (!bestMatch || similarity > bestMatch.similarity)) {
        bestMatch = { material: m, similarity };
      }
    });

    if (bestMatch) {
      return { material: bestMatch.material, similarity: bestMatch.similarity, matchType: 'Similaridade' };
    }

    return null;
  };

  const importMutation = useMutation({
    mutationFn: async (materials: ExtractedMaterial[]) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      // Filtra apenas os materiais novos (não existentes e aprovados ou sem match)
      const materialsToInsert = materials
        .filter(m => m.isNew !== false && !m.existingMaterial)
        .map(material => ({
          name: material.name,
          description: material.description || null,
          unit: material.unit,
          current_price: material.current_price || 0,
          current_stock: material.quantity || null,
          category: material.category || null,
          supplier: material.supplier || null,
          created_by_user_id: user.id,
        }));

      if (materialsToInsert.length > 0) {
        const { error } = await supabase
          .from('materials')
          .insert(materialsToInsert);

        if (error) throw error;
      }

      return materialsToInsert.length;
    },
    onSuccess: (count) => {
      queryClient.invalidateQueries({ queryKey: ['materials-prices'] });
      queryClient.invalidateQueries({ queryKey: ['materials'] });
      toast({
        title: "Sucesso",
        description: `${count} ${count === 1 ? 'material adicionado' : 'materiais adicionados'} com sucesso!`,
      });
      handleClose();
    },
    onError: (error) => {
      toast({
        title: "Erro ao importar materiais",
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
      let useAIProcessing = false;

      if (file.type === 'application/pdf') {
        const arrayBuffer = await file.arrayBuffer();
        const base64 = btoa(
          new Uint8Array(arrayBuffer).reduce(
            (data, byte) => data + String.fromCharCode(byte),
            ''
          )
        );

        toast({
          title: "Extraindo dados do PDF...",
          description: "Aguarde enquanto processamos o arquivo"
        });

        const { data: pdfData, error: pdfError } = await supabase.functions.invoke(
          'extract-pdf-data',
          { body: { pdfBase64: base64 } }
        );

        if (pdfError) throw new Error(`Erro ao processar PDF: ${pdfError.message}`);
        if (!pdfData?.items || pdfData.items.length === 0) throw new Error('Nenhum dado encontrado no PDF');

        // Converte itens do PDF para um formato tipo planilha (mantendo o PREÇO quando existir)
        jsonData = pdfData.items.map((item: any) => ({
          Descrição: item.description || item.name || '',
          Quantidade: item.quantity || 1,
          Unidade: item.unit || 'UN',
          Preço: item.price ?? item.unit_price ?? item.valor ?? item.preco ?? 0,
        }));

        // Para PDF, usamos os dados extraídos (incluindo preço) e seguimos o fluxo padrão
        useAIProcessing = false;
      } else {
        const data = await file.arrayBuffer();
        const workbook = XLSX.read(data);
        const worksheet = workbook.Sheets[workbook.SheetNames[0]];
        jsonData = XLSX.utils.sheet_to_json(worksheet);
        useAIProcessing = true;
      }

      if (!jsonData || jsonData.length === 0) {
        throw new Error("A planilha está vazia ou não pôde ser lida");
      }

      // If we have cataloged materials, use AI processing to find prices
      if (useAIProcessing && existingMaterials && existingMaterials.length > 0) {
        toast({
          title: "Processando com IA...",
          description: "Identificando materiais e buscando preços no catálogo"
        });

        const { data: aiProcessedData, error: aiError } = await supabase.functions.invoke('process-spreadsheet', {
          body: {
            spreadsheetData: jsonData,
            customKeywords: [],
            catalogedMaterials: existingMaterials || []
          }
        });

        if (!aiError && aiProcessedData?.materials && aiProcessedData.materials.length > 0) {
          // Use AI-processed materials with prices
          const aiMaterials: ExtractedMaterial[] = aiProcessedData.materials.map((m: any) => {
            const hasPrice = (m.material_price && m.material_price > 0) || (m.labor_price && m.labor_price > 0) || (m.price && m.price > 0);
            return {
              name: m.name,
              description: m.name,
              unit: m.unit || 'UN',
              quantity: m.quantity || 1,
              current_price: m.price || m.material_price || 0,
              material_price: m.material_price || 0,
              labor_price: m.labor_price || 0,
              category: m.brand ? `Marca: ${m.brand}` : undefined,
              supplier: undefined,
              isNew: true,
              matchType: hasPrice ? `Preço encontrado (${Math.round(m.confidence || 0)}%)` : 'Novo material',
              similarity: m.confidence || 0,
            };
          });

          const withPrices = aiMaterials.filter(m => (m.current_price || 0) > 0).length;
          
          setExtractedMaterials(aiMaterials);
          setShowReview(true);
          
          toast({
            title: "Processamento concluído!",
            description: `${aiMaterials.length} materiais identificados, ${withPrices} com preços encontrados`,
          });
          return;
        }
      }

      // Fallback to standard processing if AI fails
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

      const materials: ExtractedMaterial[] = [];
      const pendingApprovals: number[] = [];

      for (let i = 0; i < jsonData.length; i++) {
        const rowData: any = jsonData[i];
        
        const name = findColumnValue(rowData, [
          'nome', 'name', 'descricao', 'description', 'desc', 
          'material', 'servico', 'service', 'item', 'produto'
        ]);
        
        const unit = findColumnValue(rowData, [
          'unidade', 'unit', 'un', 'und', 'medida'
        ]) || 'UN';

        const quantityStr = findColumnValue(rowData, [
          'quantidade', 'qtd', 'qty', 'quantity', 'quant', 'amount'
        ]);
        const quantity = quantityStr ? parseFloat(quantityStr.replace(',', '.')) : undefined;

        const priceStr = findColumnValue(rowData, [
          'preco', 'price', 'valor', 'value', 'custo', 'cost'
        ]);
        const price = priceStr ? parseFloat(priceStr.replace(',', '.')) : undefined;

        const category = findColumnValue(rowData, [
          'categoria', 'category', 'tipo', 'type'
        ]) || undefined;

        const supplier = findColumnValue(rowData, [
          'fornecedor', 'supplier', 'fabricante', 'manufacturer'
        ]) || undefined;

        if (!name || name.length < 2) continue;

        // Busca material similar
        const similar = findSimilarMaterial(name);
        
        if (similar) {
          if (similar.matchType === 'Exato') {
            // Material já existe, não precisa adicionar
            materials.push({
              name,
              description: name,
              unit,
              quantity,
              current_price: price || similar.material.current_price || 0,
              category,
              supplier,
              existingMaterial: similar.material,
              similarity: 100,
              matchType: 'Já existe',
              isNew: false,
            });
          } else {
            // Similar encontrado, precisa de aprovação
            materials.push({
              name,
              description: name,
              unit,
              quantity,
              current_price: price || similar.material.current_price || 0,
              category,
              supplier,
              existingMaterial: similar.material,
              similarity: similar.similarity,
              matchType: similar.matchType,
              needsApproval: true,
              approved: false,
              isNew: true,
            });
            pendingApprovals.push(materials.length - 1);
          }
        } else {
          materials.push({
            name,
            description: name,
            unit,
            quantity,
            current_price: price,
            category,
            supplier,
            isNew: true,
          });
        }
      }

      if (materials.length === 0) {
        throw new Error("Nenhum material válido encontrado na planilha.");
      }

      setExtractedMaterials(materials);
      setShowReview(true);

      // Se há materiais similares pendentes de aprovação, inicia o fluxo de aprovação
      if (pendingApprovals.length > 0) {
        setPendingApprovalIndex(pendingApprovals[0]);
        toast({
          title: "Materiais similares encontrados",
          description: `${pendingApprovals.length} materiais precisam da sua confirmação`,
        });
      }
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

  const handleApproval = (index: number, useExisting: boolean) => {
    setExtractedMaterials(prev => {
      const updated = [...prev];
      updated[index] = {
        ...updated[index],
        needsApproval: false,
        approved: true,
        isNew: !useExisting, // Se usar existente, não é novo
        matchType: useExisting ? 'Usando existente' : 'Cadastrar novo',
      };
      return updated;
    });

    // Move para próximo pendente
    const nextPending = extractedMaterials.findIndex(
      (m, i) => i > index && m.needsApproval
    );
    if (nextPending >= 0) {
      setPendingApprovalIndex(nextPending);
    } else {
      setPendingApprovalIndex(null);
    }
  };

  const handleSkipApproval = (index: number) => {
    setExtractedMaterials(prev => {
      const updated = [...prev];
      updated[index] = {
        ...updated[index],
        needsApproval: false,
        isNew: true,
        matchType: 'Cadastrar novo',
      };
      return updated;
    });

    const nextPending = extractedMaterials.findIndex(
      (m, i) => i > index && m.needsApproval
    );
    if (nextPending >= 0) {
      setPendingApprovalIndex(nextPending);
    } else {
      setPendingApprovalIndex(null);
    }
  };

  const handleImport = async () => {
    await importMutation.mutateAsync(extractedMaterials);
  };

  const handleClose = () => {
    setFile(null);
    setExtractedMaterials([]);
    setShowReview(false);
    setPendingApprovalIndex(null);
    onOpenChange(false);
  };

  const removeItem = (index: number) => {
    setExtractedMaterials(prev => prev.filter((_, i) => i !== index));
  };

  const currentPending = pendingApprovalIndex !== null ? extractedMaterials[pendingApprovalIndex] : null;
  const newMaterialsCount = extractedMaterials.filter(m => m.isNew && !m.needsApproval).length;
  const missingPriceCount = extractedMaterials.filter(
    (m) => m.isNew && !m.needsApproval && (!m.current_price || m.current_price <= 0)
  ).length;
  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {pendingApprovalIndex !== null ? "Confirmar Material Similar" : 
             showReview ? "Revisão dos Materiais" : "Importar Materiais"}
          </DialogTitle>
          {pendingApprovalIndex !== null && currentPending && (
            <DialogDescription>
              Encontramos um material similar. Confirme se deseja usar o existente ou cadastrar novo.
            </DialogDescription>
          )}
        </DialogHeader>

        {pendingApprovalIndex !== null && currentPending ? (
          <div className="space-y-4 py-4">
            <div className="p-4 border rounded-lg bg-muted/50">
              <p className="text-sm text-muted-foreground mb-1">Material na planilha:</p>
              <p className="font-medium">{currentPending.name}</p>
              <div className="flex gap-4 mt-2 text-sm text-muted-foreground">
                {currentPending.unit && <span>Unidade: <strong>{currentPending.unit}</strong></span>}
                {currentPending.quantity && <span>Quantidade: <strong>{currentPending.quantity}</strong></span>}
              </div>
            </div>

            <div className="flex items-center justify-center">
              <span className="text-muted-foreground">↓</span>
            </div>

            <div className="p-4 border rounded-lg border-primary/50 bg-primary/5">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm text-muted-foreground">Material existente encontrado:</p>
                <Badge variant={currentPending.matchType === 'Parcial' ? 'secondary' : 'outline'}>
                  {currentPending.similarity?.toFixed(0)}% similar
                </Badge>
              </div>
              <p className="font-semibold text-lg">{currentPending.existingMaterial?.name}</p>
              
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-3 text-sm">
                <div>
                  <p className="text-muted-foreground">Unidade</p>
                  <p className="font-medium">{currentPending.existingMaterial?.unit || 'UN'}</p>
                </div>
                {currentPending.existingMaterial?.category && (
                  <div>
                    <p className="text-muted-foreground">Categoria</p>
                    <p className="font-medium">{currentPending.existingMaterial.category}</p>
                  </div>
                )}
                {currentPending.existingMaterial?.supplier && (
                  <div>
                    <p className="text-muted-foreground">Fornecedor</p>
                    <p className="font-medium">{currentPending.existingMaterial.supplier}</p>
                  </div>
                )}
              </div>

              {(currentPending.existingMaterial?.material_price || currentPending.existingMaterial?.labor_price) && (
                <div className="flex items-center gap-4 mt-4 pt-3 border-t">
                  <div>
                    <p className="text-xs text-muted-foreground">Material</p>
                    <p className="text-blue-600 font-semibold">
                      R$ {(currentPending.existingMaterial.material_price || 0).toFixed(2)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Mão de Obra</p>
                    <p className="text-orange-600 font-semibold">
                      R$ {(currentPending.existingMaterial.labor_price || 0).toFixed(2)}
                    </p>
                  </div>
                </div>
              )}
            </div>

            <DialogFooter className="flex-col sm:flex-row gap-2">
              <Button variant="outline" onClick={() => handleSkipApproval(pendingApprovalIndex)} className="sm:mr-auto">
                <SkipForward className="h-4 w-4 mr-2" />
                Pular
              </Button>
              <Button variant="secondary" onClick={() => handleApproval(pendingApprovalIndex, false)}>
                <Plus className="h-4 w-4 mr-2" />
                Cadastrar Novo
              </Button>
              <Button onClick={() => handleApproval(pendingApprovalIndex, true)}>
                <Check className="h-4 w-4 mr-2" />
                Usar Existente
              </Button>
            </DialogFooter>
          </div>
        ) : !showReview ? (
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
                A planilha deve conter as seguintes colunas:
                <br />
                <strong>• Nome/Descrição</strong> (obrigatório)
                <br />
                <strong>• Unidade</strong> (obrigatório)
                <br />
                <strong>• Preço</strong> (obrigatório)
                <br />
                <strong>• Quantidade, Categoria, Fornecedor</strong> (opcionais)
                <br />
                <br />
                O sistema irá buscar materiais similares na sua base e pedir confirmação.
              </p>
            </div>

            <div className="flex gap-2">
              <Button 
                onClick={processFile} 
                disabled={!file || isProcessing}
                className="flex-1"
              >
                <Upload className="h-4 w-4 mr-2" />
                {isProcessing ? "Processando..." : "Processar Planilha"}
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
             <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
               <div className="space-y-1">
                 <p className="text-sm font-medium">
                   {newMaterialsCount} novos materiais para adicionar
                 </p>
                 <p className="text-xs text-muted-foreground">
                   {extractedMaterials.filter(m => !m.isNew).length} já existem na base
                 </p>
                 {missingPriceCount > 0 && (
                   <p className="text-xs text-destructive">
                     {missingPriceCount} {missingPriceCount === 1 ? 'item está sem preço' : 'itens estão sem preço'} (obrigatório)
                   </p>
                 )}
               </div>
             </div>

            <div className="border rounded-lg overflow-hidden max-h-[400px] overflow-y-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome/Descrição</TableHead>
                    <TableHead>Unidade</TableHead>
                    <TableHead>Preço</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="w-[50px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {extractedMaterials.map((material, index) => (
                    <TableRow key={index} className={!material.isNew ? 'opacity-50' : ''}>
                      <TableCell className="font-medium">
                        {material.name}
                      </TableCell>
                      <TableCell>{material.unit}</TableCell>
                       <TableCell>
                         {material.isNew ? (
                           <div className="space-y-1">
                             <Input
                               type="number"
                               inputMode="decimal"
                               step="0.01"
                               min={0}
                               value={material.current_price ?? ""}
                               onChange={(e) => {
                                 const next = e.target.value === "" ? undefined : Number(e.target.value);
                                 setExtractedMaterials((prev) => {
                                   const updated = [...prev];
                                   updated[index] = { ...updated[index], current_price: Number.isFinite(next as number) ? next : undefined };
                                   return updated;
                                 });
                               }}
                               placeholder="0,00"
                               className="h-9"
                             />
                             {(!material.current_price || material.current_price <= 0) && (
                               <p className="text-xs text-destructive">Preço obrigatório</p>
                             )}
                           </div>
                         ) : material.current_price ? (
                           `R$ ${material.current_price.toFixed(2)}`
                         ) : (
                           <span className="text-muted-foreground">-</span>
                         )}
                       </TableCell>
                      <TableCell>
                        <Badge variant={
                          material.isNew === false ? 'secondary' :
                          material.matchType === 'Cadastrar novo' ? 'default' :
                          material.matchType === 'Usando existente' ? 'secondary' :
                          'outline'
                        }>
                          {material.matchType || 'Novo'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {material.isNew && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => removeItem(index)}
                            className="h-8 w-8"
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            <div className="flex gap-2">
              <Button 
                variant="outline" 
                onClick={handleClose}
                className="flex-1"
              >
                Cancelar
              </Button>
               <Button 
                 onClick={handleImport}
                 disabled={newMaterialsCount === 0 || missingPriceCount > 0 || importMutation.isPending}
                 className="flex-1"
               >
                 <Save className="h-4 w-4 mr-2" />
                 {importMutation.isPending ? "Adicionando..." : 
                   missingPriceCount > 0 ? "Preencha os preços para continuar" :
                   `Adicionar ${newMaterialsCount} Materiais`
                 }
               </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
