import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";
import { Download, FileText, FileSpreadsheet, FileJson, FileCode } from "lucide-react";
import {
  exportPontoPDF,
  exportPontoExcel,
  exportPontoMarkdown,
  exportPontoJSON,
  type LinhaExportPonto,
  type ResumoExportPonto,
} from "@/lib/pontoEletronicoExporter";

interface PontoExportMenuProps {
  titulo: string;
  resumo: ResumoExportPonto;
  linhas: LinhaExportPonto[];
  filenamePrefix: string;
  disabled?: boolean;
}

export const PontoExportMenu = ({ titulo, resumo, linhas, filenamePrefix, disabled }: PontoExportMenuProps) => {
  const { toast } = useToast();

  const handleExport = async (formato: "pdf" | "excel" | "markdown" | "json") => {
    try {
      switch (formato) {
        case "pdf":
          await exportPontoPDF(titulo, resumo, linhas, `${filenamePrefix}.pdf`);
          break;
        case "excel":
          await exportPontoExcel(titulo, resumo, linhas, `${filenamePrefix}.xlsx`);
          break;
        case "markdown":
          await exportPontoMarkdown(titulo, resumo, linhas, `${filenamePrefix}.md`);
          break;
        case "json":
          await exportPontoJSON(titulo, resumo, linhas, `${filenamePrefix}.json`);
          break;
      }
    } catch (error) {
      toast({
        title: "Erro ao exportar",
        description: error instanceof Error ? error.message : "Tente novamente",
        variant: "destructive",
      });
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" disabled={disabled || linhas.length === 0}>
          <Download className="h-4 w-4 mr-2" />
          Exportar
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => handleExport("pdf")}>
          <FileText className="h-4 w-4 mr-2" />
          Exportar PDF
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => handleExport("excel")}>
          <FileSpreadsheet className="h-4 w-4 mr-2" />
          Exportar Excel
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => handleExport("markdown")}>
          <FileCode className="h-4 w-4 mr-2" />
          Exportar Markdown
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => handleExport("json")}>
          <FileJson className="h-4 w-4 mr-2" />
          Exportar JSON
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
