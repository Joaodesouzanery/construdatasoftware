import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { FileText, Download } from "lucide-react";
import { generateConnectionReportPDF } from "@/lib/connectionReportGenerator";
import { useToast } from "@/hooks/use-toast";

interface ConnectionReport {
  id: string;
  team_name: string;
  report_date: string;
  address: string;
  address_complement: string | null;
  client_name: string;
  water_meter_number: string;
  os_number: string;
  service_type: string;
  observations: string | null;
  photos_urls: string[];
  created_at: string;
}

interface ConnectionReportsTableProps {
  reports: ConnectionReport[];
}

export function ConnectionReportsTable({ reports }: ConnectionReportsTableProps) {
  const { toast } = useToast();

  const handleExportPDF = async (report: ConnectionReport) => {
    try {
      toast({
        title: "Gerando PDF...",
        description: "Por favor, aguarde enquanto o relatório é gerado.",
      });

      await generateConnectionReportPDF(report);

      toast({
        title: "Sucesso!",
        description: "Relatório exportado com sucesso.",
      });
    } catch (error) {
      console.error("Error generating PDF:", error);
      toast({
        title: "Erro",
        description: "Erro ao gerar o relatório PDF.",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="border rounded-lg">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Data</TableHead>
            <TableHead>Equipe</TableHead>
            <TableHead>Cliente</TableHead>
            <TableHead>Endereço</TableHead>
            <TableHead>Nº OS</TableHead>
            <TableHead>Tipo de Serviço</TableHead>
            <TableHead>Fotos</TableHead>
            <TableHead className="text-right">Ações</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {reports.map((report) => (
            <TableRow key={report.id}>
              <TableCell>
                {format(new Date(report.report_date), "dd/MM/yyyy", {
                  locale: ptBR,
                })}
              </TableCell>
              <TableCell className="font-medium">{report.team_name}</TableCell>
              <TableCell>{report.client_name}</TableCell>
              <TableCell>
                {report.address}
                {report.address_complement && `, ${report.address_complement}`}
              </TableCell>
              <TableCell>{report.os_number}</TableCell>
              <TableCell>{report.service_type}</TableCell>
              <TableCell>
                {report.photos_urls?.length > 0 ? (
                  <span className="text-sm text-muted-foreground">
                    {report.photos_urls.length} foto(s)
                  </span>
                ) : (
                  <span className="text-sm text-muted-foreground">Sem fotos</span>
                )}
              </TableCell>
              <TableCell className="text-right">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleExportPDF(report)}
                >
                  <Download className="mr-2 h-4 w-4" />
                  Exportar PDF
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
