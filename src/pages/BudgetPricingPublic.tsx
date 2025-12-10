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
import jsPDF from 'jspdf';
import 'jspdf-autotable';
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

interface SinapiItem {
  codigo: string;
  descricao: string;
  unidade: string;
  preco: number;
  tipo: 'sintetico' | 'analitico';
  composicao?: string;
}

interface ProcessedItem {
  description: string;
  quantity: number;
  unit: string;
  unit_price: number;
  total: number;
  matched: boolean;
  sinapi_codigo?: string;
  sinapi_descricao?: string;
  match_type?: string;
  similarity?: number;
}

const BudgetPricingPublic = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [sinapiFile, setSinapiFile] = useState<File | null>(null);
  const [budgetFile, setBudgetFile] = useState<File | null>(null);
  const [isProcessingSinapi, setIsProcessingSinapi] = useState(false);
  const [isProcessingBudget, setIsProcessingBudget] = useState(false);
  const [sinapiItems, setSinapiItems] = useState<SinapiItem[]>([]);
  const [processedItems, setProcessedItems] = useState<ProcessedItem[]>([]);
  const [showReview, setShowReview] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedBudgetId, setSelectedBudgetId] = useState<string>("");

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
      .replace(/[^\w\s]/g, " ")
      .replace(/\d+/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  };

  const tokenize = (text: string): string[] => {
    const STOPWORDS = new Set(['de', 'da', 'do', 'das', 'dos', 'para', 'com', 'em', 'e', 'ou', 'a', 'o', 'os', 'as', 'um', 'uma']);
    const normalized = normalizeText(text);
    return normalized.split(/\s+/).filter(word => word.length > 2 && !STOPWORDS.has(word));
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

  const calculateSimilarity = (desc1: string, desc2: string): number => {
    const tokens1 = tokenize(desc1);
    const tokens2 = tokenize(desc2);

    if (tokens1.length === 0 || tokens2.length === 0) return 0;

    let totalScore = 0;
    let maxScore = tokens1.length;

    tokens1.forEach(token1 => {
      let bestMatch = 0;
      tokens2.forEach(token2 => {
        const maxLen = Math.max(token1.length, token2.length);
        const distance = levenshteinDistance(token1, token2);
        const similarity = 1 - distance / maxLen;
        bestMatch = Math.max(bestMatch, similarity);
      });
      totalScore += bestMatch;
    });

    return maxScore > 0 ? (totalScore / maxScore) * 100 : 0;
  };

  const findMatchingSinapi = (description: string): { item: SinapiItem; similarity: number; matchType: string } | null => {
    if (sinapiItems.length === 0) return null;

    const normalizedDesc = normalizeText(description);
    
    // Busca exata
    const exactMatch = sinapiItems.find(item => 
      normalizeText(item.descricao) === normalizedDesc
    );
    if (exactMatch) return { item: exactMatch, similarity: 100, matchType: 'Exato' };

    // Busca parcial
    const partialMatch = sinapiItems.find(item => {
      const normalizedSinapi = normalizeText(item.descricao);
      return normalizedDesc.includes(normalizedSinapi) || normalizedSinapi.includes(normalizedDesc);
    });
    if (partialMatch) return { item: partialMatch, similarity: 85, matchType: 'Parcial' };

    // Busca por similaridade
    let bestMatch: { item: SinapiItem; similarity: number } | null = null;
    sinapiItems.forEach(item => {
      const similarity = calculateSimilarity(description, item.descricao);
      if (similarity >= 60 && (!bestMatch || similarity > bestMatch.similarity)) {
        bestMatch = { item, similarity };
      }
    });

    if (bestMatch) {
      return { 
        item: bestMatch.item, 
        similarity: bestMatch.similarity, 
        matchType: 'Similaridade' 
      };
    }

    return null;
  };

  const handleSinapiFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setSinapiFile(e.target.files[0]);
    }
  };

  const handleBudgetFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setBudgetFile(e.target.files[0]);
    }
  };

  const processSinapiFile = async () => {
    if (!sinapiFile) {
      toast({ title: "Erro", description: "Selecione a planilha SINAPI", variant: "destructive" });
      return;
    }

    setIsProcessingSinapi(true);
    try {
      const data = await sinapiFile.arrayBuffer();
      const workbook = XLSX.read(data);
      
      const items: SinapiItem[] = [];
      
      workbook.SheetNames.forEach(sheetName => {
        const worksheet = workbook.Sheets[sheetName];
        const jsonData: any[] = XLSX.utils.sheet_to_json(worksheet);
        
        const isSintetico = sheetName.toLowerCase().includes('sint');
        
        jsonData.forEach(row => {
          const codigo = String(row['CODIGO'] || row['Código'] || row['codigo'] || row['COD'] || '').trim();
          const descricao = String(row['DESCRICAO'] || row['Descrição'] || row['descricao'] || row['DESC'] || row['DESCRIÇÃO DO SERVIÇO'] || '').trim();
          const unidade = String(row['UNIDADE'] || row['Unidade'] || row['unidade'] || row['UN'] || row['UND'] || 'UN').trim();
          const precoStr = String(row['PRECO'] || row['Preço'] || row['preco'] || row['VALOR'] || row['Valor'] || row['CUSTO TOTAL'] || row['PREÇO UNITÁRIO'] || '0');
          const preco = parseFloat(precoStr.replace(/[^\d,.-]/g, '').replace(',', '.')) || 0;
          
          if (descricao && descricao.length > 3) {
            items.push({
              codigo,
              descricao,
              unidade,
              preco,
              tipo: isSintetico ? 'sintetico' : 'analitico',
            });
          }
        });
      });

      if (items.length === 0) {
        throw new Error("Nenhum item válido encontrado na planilha SINAPI");
      }

      setSinapiItems(items);
      toast({
        title: "SINAPI Importado",
        description: `${items.length} itens carregados da planilha SINAPI`,
      });

    } catch (error: any) {
      toast({
        title: "Erro ao processar SINAPI",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsProcessingSinapi(false);
    }
  };

  const processBudgetFile = async () => {
    if (!budgetFile) {
      toast({ title: "Erro", description: "Selecione a planilha de orçamento", variant: "destructive" });
      return;
    }

    if (sinapiItems.length === 0) {
      toast({ title: "Erro", description: "Importe a planilha SINAPI primeiro", variant: "destructive" });
      return;
    }

    setIsProcessingBudget(true);
    try {
      const data = await budgetFile.arrayBuffer();
      const workbook = XLSX.read(data);
      const worksheet = workbook.Sheets[workbook.SheetNames[0]];
      const jsonData: any[] = XLSX.utils.sheet_to_json(worksheet);

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
      let foundCount = 0;
      let notFoundCount = 0;

      for (const rowData of jsonData) {
        const description = findColumnValue(rowData, ['descricao', 'description', 'desc', 'item', 'material', 'servico']);
        const quantityStr = findColumnValue(rowData, ['quantidade', 'quantity', 'qtd', 'qtde']);
        const quantity = parseFloat(quantityStr.replace(',', '.')) || 0;
        const unit = findColumnValue(rowData, ['unidade', 'unit', 'un', 'und']) || 'UN';

        if (!description || description.length < 2 || quantity <= 0) continue;

        const match = findMatchingSinapi(description);

        if (match) {
          foundCount++;
          items.push({
            description,
            quantity,
            unit: match.item.unidade || unit,
            unit_price: match.item.preco,
            total: quantity * match.item.preco,
            matched: true,
            sinapi_codigo: match.item.codigo,
            sinapi_descricao: match.item.descricao,
            match_type: match.matchType === 'Exato' ? 'Encontrado (exato)' : 
                       match.matchType === 'Parcial' ? 'Encontrado (parcial)' :
                       `Similaridade (${match.similarity.toFixed(0)}%)`,
            similarity: match.similarity,
          });
        } else {
          notFoundCount++;
          items.push({
            description,
            quantity,
            unit,
            unit_price: 0,
            total: 0,
            matched: false,
            match_type: 'Não encontrado no SINAPI',
          });
        }
      }

      setProcessedItems(items);
      setShowReview(true);
      toast({
        title: "Precificação concluída",
        description: `${foundCount} itens encontrados no SINAPI, ${notFoundCount} não encontrados`,
      });

    } catch (error: any) {
      toast({
        title: "Erro ao processar orçamento",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsProcessingBudget(false);
    }
  };

  const handleExportExcel = () => {
    const exportData = processedItems.map((item, index) => ({
      'Item': index + 1,
      'Descrição': item.description,
      'Código SINAPI': item.sinapi_codigo || '-',
      'Descrição SINAPI': item.sinapi_descricao || '-',
      'Qtde': item.quantity,
      'Unid.': item.unit,
      'Preço Unitário': Number(item.unit_price || 0).toFixed(2),
      'Total': Number(item.total || 0).toFixed(2),
      'Status': item.match_type || 'Não buscado',
    }));

    exportData.push({
      'Item': '',
      'Descrição': 'TOTAL GERAL',
      'Código SINAPI': '',
      'Descrição SINAPI': '',
      'Qtde': '',
      'Unid.': '',
      'Preço Unitário': '',
      'Total': totalValue.toFixed(2),
      'Status': '',
    } as any);

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Orçamento SINAPI');
    
    const fileName = budgetFile?.name.replace(/\.(xlsx|xls)$/i, '') || 'orcamento';
    XLSX.writeFile(wb, `${fileName}_sinapi_precificado_${new Date().getTime()}.xlsx`);

    toast({ title: "Sucesso", description: "Planilha Excel exportada!" });
  };

  const handleExportPDF = () => {
    const doc = new jsPDF();
    
    doc.setFontSize(18);
    doc.text('Orçamento - Precificação SINAPI', 14, 22);
    
    doc.setFontSize(10);
    doc.text(`Data: ${new Date().toLocaleDateString('pt-BR')}`, 14, 30);
    doc.text(`Total de itens: ${processedItems.length}`, 14, 36);
    doc.text(`Total Geral: R$ ${totalValue.toFixed(2)}`, 14, 42);

    const tableData = processedItems.map((item, index) => [
      index + 1,
      item.description.substring(0, 40) + (item.description.length > 40 ? '...' : ''),
      item.sinapi_codigo || '-',
      item.quantity,
      item.unit,
      `R$ ${item.unit_price.toFixed(2)}`,
      `R$ ${item.total.toFixed(2)}`,
    ]);

    (doc as any).autoTable({
      head: [['#', 'Descrição', 'Cód. SINAPI', 'Qtd', 'Un', 'Preço Unit.', 'Total']],
      body: tableData,
      startY: 50,
      styles: { fontSize: 8 },
      headStyles: { fillColor: [41, 128, 185] },
    });

    const fileName = budgetFile?.name.replace(/\.(xlsx|xls)$/i, '') || 'orcamento';
    doc.save(`${fileName}_sinapi_precificado_${new Date().getTime()}.pdf`);

    toast({ title: "Sucesso", description: "PDF exportado!" });
  };

  const filteredSinapiItems = sinapiItems.filter(item =>
    item.descricao.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.codigo.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleReset = () => {
    setBudgetFile(null);
    setProcessedItems([]);
    setShowReview(false);
    setSelectedBudgetId("");
  };

  const matchedCount = processedItems.filter(i => i.matched).length;
  const totalValue = processedItems.reduce((sum, item) => sum + item.total, 0);

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/budgets')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold text-foreground">Precificação Pública (SINAPI)</h1>
            <p className="text-muted-foreground">Importe a planilha SINAPI e precifique seu orçamento automaticamente</p>
          </div>
        </div>

        <Tabs defaultValue="import" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="import">1. Importar SINAPI</TabsTrigger>
            <TabsTrigger value="search">2. Consultar SINAPI</TabsTrigger>
            <TabsTrigger value="pricing">3. Precificar Orçamento</TabsTrigger>
          </TabsList>

          <TabsContent value="import" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Importar Planilha SINAPI</CardTitle>
                <CardDescription>
                  Importe a planilha do SINAPI (sintética e/ou analítica) para usar como base de preços
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="sinapi-file">Arquivo SINAPI (.xlsx, .xls)</Label>
                  <Input
                    id="sinapi-file"
                    type="file"
                    accept=".xlsx,.xls"
                    onChange={handleSinapiFileChange}
                  />
                  <p className="text-sm text-muted-foreground">
                    A planilha deve conter as colunas: <strong>Código, Descrição, Unidade, Preço</strong>
                  </p>
                </div>

                <Button 
                  onClick={processSinapiFile} 
                  disabled={!sinapiFile || isProcessingSinapi}
                  className="w-full"
                >
                  <Upload className="h-4 w-4 mr-2" />
                  {isProcessingSinapi ? "Processando..." : "Importar SINAPI"}
                </Button>

                {sinapiItems.length > 0 && (
                  <div className="p-4 bg-green-50 dark:bg-green-950 rounded-lg">
                    <p className="text-green-700 dark:text-green-300 font-medium">
                      ✓ {sinapiItems.length} itens carregados do SINAPI
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {sinapiItems.filter(i => i.tipo === 'sintetico').length} sintéticos, {' '}
                      {sinapiItems.filter(i => i.tipo === 'analitico').length} analíticos
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="search" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Consultar Base SINAPI</CardTitle>
                <CardDescription>
                  Pesquise serviços e materiais na base SINAPI importada
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {sinapiItems.length === 0 ? (
                  <p className="text-muted-foreground text-center py-8">
                    Importe a planilha SINAPI primeiro
                  </p>
                ) : (
                  <>
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder="Buscar por descrição ou código..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-10"
                      />
                    </div>

                    <div className="border rounded-lg overflow-hidden max-h-[400px] overflow-y-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Código</TableHead>
                            <TableHead>Descrição</TableHead>
                            <TableHead>Unidade</TableHead>
                            <TableHead className="text-right">Preço</TableHead>
                            <TableHead>Tipo</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {filteredSinapiItems.slice(0, 100).map((item, index) => (
                            <TableRow key={index}>
                              <TableCell className="font-mono text-sm">{item.codigo || '-'}</TableCell>
                              <TableCell className="max-w-md" title={item.descricao}>
                                {item.descricao.substring(0, 80)}{item.descricao.length > 80 ? '...' : ''}
                              </TableCell>
                              <TableCell>{item.unidade}</TableCell>
                              <TableCell className="text-right font-medium">
                                R$ {item.preco.toFixed(2)}
                              </TableCell>
                              <TableCell>
                                <Badge variant={item.tipo === 'sintetico' ? 'default' : 'secondary'}>
                                  {item.tipo === 'sintetico' ? 'Sintético' : 'Analítico'}
                                </Badge>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                    {filteredSinapiItems.length > 100 && (
                      <p className="text-sm text-muted-foreground text-center">
                        Mostrando 100 de {filteredSinapiItems.length} resultados. Refine sua busca.
                      </p>
                    )}
                  </>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="pricing" className="space-y-4">
            {!showReview ? (
              <Card>
                <CardHeader>
                  <CardTitle>Precificar Orçamento</CardTitle>
                  <CardDescription>
                    Importe seu orçamento e precifique automaticamente com base no SINAPI
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {sinapiItems.length === 0 && (
                    <div className="p-4 bg-yellow-50 dark:bg-yellow-950 rounded-lg mb-4">
                      <p className="text-yellow-700 dark:text-yellow-300">
                        ⚠️ Importe a planilha SINAPI primeiro na aba "Importar SINAPI"
                      </p>
                    </div>
                  )}

                  <div className="space-y-2">
                    <Label htmlFor="budget-file">Arquivo do Orçamento (.xlsx, .xls)</Label>
                    <Input
                      id="budget-file"
                      type="file"
                      accept=".xlsx,.xls"
                      onChange={handleBudgetFileChange}
                    />
                    <p className="text-sm text-muted-foreground">
                      Colunas necessárias: <strong>Descrição, Quantidade, Unidade</strong>
                    </p>
                  </div>

                  <Button 
                    onClick={processBudgetFile} 
                    disabled={!budgetFile || isProcessingBudget || sinapiItems.length === 0}
                    className="w-full"
                  >
                    <Upload className="h-4 w-4 mr-2" />
                    {isProcessingBudget ? "Processando..." : "Precificar com SINAPI"}
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-6">
                <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
                  <div className="space-y-1">
                    <p className="text-sm font-medium">
                      {matchedCount} de {processedItems.length} itens encontrados no SINAPI
                    </p>
                    <p className="text-2xl font-bold">
                      Total: R$ {totalValue.toFixed(2)}
                    </p>
                  </div>
                  <Badge variant={matchedCount === processedItems.length ? "default" : "secondary"}>
                    {matchedCount === processedItems.length ? "Todos precificados" : "Itens pendentes"}
                  </Badge>
                </div>

                <div className="border rounded-lg overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[60px]">Item</TableHead>
                        <TableHead>Descrição</TableHead>
                        <TableHead>Código SINAPI</TableHead>
                        <TableHead>Qtd</TableHead>
                        <TableHead>Un</TableHead>
                        <TableHead>Preço Unit.</TableHead>
                        <TableHead>Total</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {processedItems.map((item, index) => (
                        <TableRow key={index}>
                          <TableCell className="text-center font-medium">{index + 1}</TableCell>
                          <TableCell className="font-medium max-w-xs" title={item.description}>
                            {item.description}
                          </TableCell>
                          <TableCell className="font-mono text-sm">
                            {item.sinapi_codigo || '-'}
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
                              variant={
                                item.match_type?.includes('exato') ? 'default' :
                                item.match_type?.includes('parcial') ? 'secondary' :
                                item.match_type?.includes('Similaridade') ? 'secondary' :
                                'destructive'
                              }
                            >
                              {item.match_type}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                <div className="flex justify-between items-center pt-4 border-t">
                  <Button variant="outline" onClick={handleReset}>
                    Nova Importação
                  </Button>
                  <div className="flex gap-2">
                    <Button variant="secondary" onClick={handleExportExcel}>
                      <Download className="h-4 w-4 mr-2" />
                      Exportar Excel
                    </Button>
                    <Button variant="secondary" onClick={handleExportPDF}>
                      <Download className="h-4 w-4 mr-2" />
                      Exportar PDF
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default BudgetPricingPublic;
