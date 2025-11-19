import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Download, Upload, FileSpreadsheet } from "lucide-react";
import * as XLSX from 'xlsx';

interface PriceSpreadsheetDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const PriceSpreadsheetDialog = ({ open, onOpenChange }: PriceSpreadsheetDialogProps) => {
  const { toast } = useToast();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [processing, setProcessing] = useState(false);
  const [mode, setMode] = useState<'add-prices' | 'export-prices' | null>(null);

  const { data: materials } = useQuery({
    queryKey: ['materials'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('materials')
        .select('*')
        .order('name');
      
      if (error) throw error;
      return data || [];
    }
  });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
    }
  };

  const processAddPrices = async () => {
    if (!selectedFile) return;

    setProcessing(true);
    try {
      const arrayBuffer = await selectedFile.arrayBuffer();
      const workbook = XLSX.read(arrayBuffer);
      const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
      const jsonData = XLSX.utils.sheet_to_json(firstSheet);

      // Add price column and match with existing materials
      const dataWithPrices = jsonData.map((row: any) => {
        const materialName = row['Material'] || row['Nome'] || row['Descrição'];
        const matchedMaterial = materials?.find(m => 
          m.name.toLowerCase() === materialName?.toLowerCase()
        );

        return {
          ...row,
          'Preço Unitário': matchedMaterial?.current_price || 0
        };
      });

      // Create new workbook with prices
      const newWorksheet = XLSX.utils.json_to_sheet(dataWithPrices);
      const newWorkbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(newWorkbook, newWorksheet, 'Orçamento');

      // Download file
      XLSX.writeFile(newWorkbook, 'orcamento_com_precos.xlsx');

      toast({
        title: "Planilha processada!",
        description: "Download iniciado com a coluna de preços adicionada."
      });

      setSelectedFile(null);
      onOpenChange(false);
    } catch (error: any) {
      toast({
        title: "Erro ao processar planilha",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setProcessing(false);
    }
  };

  const processExportPrices = async () => {
    if (!selectedFile) return;

    setProcessing(true);
    try {
      const arrayBuffer = await selectedFile.arrayBuffer();
      const workbook = XLSX.read(arrayBuffer);
      const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
      const jsonData = XLSX.utils.sheet_to_json(firstSheet);

      // Extract only price information
      const pricesData = jsonData.map((row: any) => {
        const materialName = row['Material'] || row['Nome'] || row['Descrição'];
        const matchedMaterial = materials?.find(m => 
          m.name.toLowerCase() === materialName?.toLowerCase()
        );

        return {
          'Material': materialName,
          'Preço Unitário': matchedMaterial?.current_price || 0
        };
      });

      // Create workbook with only prices
      const pricesWorksheet = XLSX.utils.json_to_sheet(pricesData);
      const pricesWorkbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(pricesWorkbook, pricesWorksheet, 'Preços');

      // Download file
      XLSX.writeFile(pricesWorkbook, 'precos_orcamento.xlsx');

      toast({
        title: "Preços exportados!",
        description: "Download iniciado apenas com a coluna de preços."
      });

      setSelectedFile(null);
      onOpenChange(false);
    } catch (error: any) {
      toast({
        title: "Erro ao exportar preços",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setProcessing(false);
    }
  };

  const handleProcess = () => {
    if (mode === 'add-prices') {
      processAddPrices();
    } else if (mode === 'export-prices') {
      processExportPrices();
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Processar Planilha de Orçamento</DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {!mode ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Button
                variant="outline"
                className="h-32 flex flex-col gap-2"
                onClick={() => setMode('add-prices')}
              >
                <FileSpreadsheet className="h-8 w-8" />
                <div className="text-center">
                  <div className="font-semibold">Adicionar Coluna de Preços</div>
                  <div className="text-xs text-muted-foreground">
                    Importa planilha e adiciona coluna com preços
                  </div>
                </div>
              </Button>

              <Button
                variant="outline"
                className="h-32 flex flex-col gap-2"
                onClick={() => setMode('export-prices')}
              >
                <Download className="h-8 w-8" />
                <div className="text-center">
                  <div className="font-semibold">Exportar Apenas Preços</div>
                  <div className="text-xs text-muted-foreground">
                    Importa planilha e exporta somente a coluna de preços
                  </div>
                </div>
              </Button>
            </div>
          ) : (
            <>
              <div className="space-y-4">
                <div>
                  <h3 className="font-semibold mb-2">
                    {mode === 'add-prices' 
                      ? 'Adicionar Preços à Planilha' 
                      : 'Exportar Somente Preços'}
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    {mode === 'add-prices'
                      ? 'Faça upload de uma planilha Excel (.xlsx ou .xls) e o sistema adicionará uma coluna "Preço Unitário" com os preços cadastrados.'
                      : 'Faça upload de uma planilha Excel (.xlsx ou .xls) e o sistema exportará apenas os nomes dos materiais e seus preços.'}
                  </p>
                </div>

                <div className="border-2 border-dashed rounded-lg p-8 text-center">
                  <input
                    type="file"
                    accept=".xlsx,.xls"
                    onChange={handleFileChange}
                    className="hidden"
                    id="spreadsheet-upload"
                  />
                  <label htmlFor="spreadsheet-upload" className="cursor-pointer">
                    <Upload className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                    <div className="text-sm">
                      {selectedFile ? (
                        <span className="font-medium">{selectedFile.name}</span>
                      ) : (
                        <>
                          Clique para selecionar ou arraste um arquivo
                          <br />
                          <span className="text-muted-foreground">
                            Formatos: .xlsx, .xls
                          </span>
                        </>
                      )}
                    </div>
                  </label>
                </div>

                <div className="bg-muted/50 rounded-lg p-4 text-sm">
                  <p className="font-medium mb-2">Instruções:</p>
                  <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                    <li>A planilha deve conter uma coluna com nomes dos materiais (pode ser "Material", "Nome" ou "Descrição")</li>
                    <li>O sistema buscará correspondência com os materiais cadastrados</li>
                    <li>Materiais não encontrados terão preço 0</li>
                  </ul>
                </div>
              </div>

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    setMode(null);
                    setSelectedFile(null);
                  }}
                  className="flex-1"
                >
                  Voltar
                </Button>
                <Button
                  onClick={handleProcess}
                  disabled={!selectedFile || processing}
                  className="flex-1"
                >
                  {processing ? "Processando..." : "Processar"}
                </Button>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
