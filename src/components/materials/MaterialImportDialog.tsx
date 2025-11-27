import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Upload, Save, X, CheckCircle, AlertCircle } from "lucide-react";
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

interface MaterialImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface ExtractedMaterial {
  name: string;
  description?: string;
  unit: string;
  current_price?: number;
  category?: string;
  supplier?: string;
}

export const MaterialImportDialog = ({ open, onOpenChange }: MaterialImportDialogProps) => {
  const [file, setFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [extractedMaterials, setExtractedMaterials] = useState<ExtractedMaterial[]>([]);
  const [showReview, setShowReview] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Função para normalizar texto
  const normalizeText = (text: string): string => {
    return text
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/\s+/g, " ")
      .trim();
  };

  const importMutation = useMutation({
    mutationFn: async (materials: ExtractedMaterial[]) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      const materialsToInsert = materials.map(material => ({
        name: material.name,
        description: material.description || null,
        unit: material.unit,
        current_price: material.current_price || 0,
        category: material.category || null,
        supplier: material.supplier || null,
        created_by_user_id: user.id,
      }));

      const { error } = await supabase
        .from('materials')
        .insert(materialsToInsert);

      if (error) throw error;

      return materials.length;
    },
    onSuccess: (count) => {
      queryClient.invalidateQueries({ queryKey: ['materials-prices'] });
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

      const materials: ExtractedMaterial[] = [];
      const skippedRows: string[] = [];

      for (let i = 0; i < jsonData.length; i++) {
        const rowData: any = jsonData[i];
        
        // Busca nome/descrição com múltiplas variações
        const name = findColumnValue(rowData, [
          'nome', 'name', 'descricao', 'description', 'desc', 
          'material', 'servico', 'service', 'item', 'produto'
        ]);
        
        // Busca unidade
        const unit = findColumnValue(rowData, [
          'unidade', 'unit', 'un', 'und', 'medida'
        ]) || 'UN';

        // Busca preço (opcional)
        const priceStr = findColumnValue(rowData, [
          'preco', 'price', 'valor', 'value', 'custo', 'cost'
        ]);
        const price = priceStr ? parseFloat(priceStr.replace(',', '.')) : undefined;

        // Busca categoria (opcional)
        const category = findColumnValue(rowData, [
          'categoria', 'category', 'tipo', 'type'
        ]) || undefined;

        // Busca fornecedor (opcional)
        const supplier = findColumnValue(rowData, [
          'fornecedor', 'supplier', 'fabricante', 'manufacturer'
        ]) || undefined;

        // Validação
        if (!name || name.length < 2) {
          skippedRows.push(`Linha ${i + 2}: Nome/Descrição inválida ou vazia`);
          continue;
        }

        materials.push({
          name,
          description: name, // Usa o nome como descrição também
          unit,
          current_price: price,
          category,
          supplier,
        });
      }

      if (materials.length === 0) {
        let errorMsg = "Nenhum material válido encontrado na planilha.";
        if (skippedRows.length > 0) {
          errorMsg += "\n\nLinhas ignoradas:\n" + skippedRows.slice(0, 5).join('\n');
          if (skippedRows.length > 5) {
            errorMsg += `\n... e mais ${skippedRows.length - 5} linhas`;
          }
        }
        errorMsg += "\n\nVerifique se a planilha contém pelo menos a coluna: Nome/Descrição e Unidade";
        throw new Error(errorMsg);
      }

      // Feedback sobre linhas ignoradas
      if (skippedRows.length > 0) {
        console.warn(`${skippedRows.length} linhas foram ignoradas:`, skippedRows);
        toast({
          title: "Atenção",
          description: `${materials.length} materiais processados. ${skippedRows.length} linhas foram ignoradas por dados inválidos.`,
          variant: "default",
        });
      }

      setExtractedMaterials(materials);
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

  const handleImport = async () => {
    await importMutation.mutateAsync(extractedMaterials);
  };

  const handleClose = () => {
    setFile(null);
    setExtractedMaterials([]);
    setShowReview(false);
    onOpenChange(false);
  };

  const removeItem = (index: number) => {
    setExtractedMaterials(prev => prev.filter((_, i) => i !== index));
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {showReview ? "Revisão dos Materiais" : "Importar Materiais"}
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
                A planilha deve conter as seguintes colunas:
                <br />
                <strong>• Nome/Descrição</strong> (obrigatório)
                <br />
                <strong>• Unidade</strong> (obrigatório)
                <br />
                <strong>• Preço, Categoria, Fornecedor</strong> (opcionais)
                <br />
                <br />
                {file?.type === 'application/pdf' && (
                  <span className="text-primary font-medium">
                    ℹ️ PDFs serão processados usando IA para extrair os dados automaticamente.
                  </span>
                )}
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
                  {extractedMaterials.length} {extractedMaterials.length === 1 ? 'material encontrado' : 'materiais encontrados'}
                </p>
                <p className="text-xs text-muted-foreground">
                  Revise os dados antes de adicionar
                </p>
              </div>
            </div>

            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome/Descrição</TableHead>
                    <TableHead>Unidade</TableHead>
                    <TableHead>Preço</TableHead>
                    <TableHead>Categoria</TableHead>
                    <TableHead>Fornecedor</TableHead>
                    <TableHead className="w-[50px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {extractedMaterials.map((material, index) => (
                    <TableRow key={index}>
                      <TableCell className="font-medium">
                        {material.name}
                      </TableCell>
                      <TableCell>{material.unit}</TableCell>
                      <TableCell>
                        {material.current_price ? (
                          `R$ ${material.current_price.toFixed(2)}`
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {material.category || <span className="text-muted-foreground">-</span>}
                      </TableCell>
                      <TableCell>
                        {material.supplier || <span className="text-muted-foreground">-</span>}
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => removeItem(index)}
                          className="h-8 w-8"
                        >
                          <X className="h-4 w-4" />
                        </Button>
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
                disabled={extractedMaterials.length === 0 || importMutation.isPending}
                className="flex-1"
              >
                <Save className="h-4 w-4 mr-2" />
                {importMutation.isPending ? "Adicionando..." : "Adicionar Materiais"}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
