import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { ArrowLeft, Download, Printer, Target, TrendingUp, TrendingDown } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import jsPDF from "jspdf";
import "jspdf-autotable";

interface ComparisonRow {
  date: string;
  serviceName: string;
  frontName: string;
  planned: number;
  actual: number;
  unit: string;
  variance: number;
  variancePct: number;
}

export default function PlannedVsActual() {
  const navigate = useNavigate();
  const [projects, setProjects] = useState<any[]>([]);
  const [selectedProject, setSelectedProject] = useState("");
  const [data, setData] = useState<ComparisonRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { navigate('/auth'); return; }
      const { data } = await supabase.from('projects').select('id, name').eq('status', 'active').order('name');
      if (data && data.length > 0) {
        setProjects(data);
        setSelectedProject(data[0].id);
      }
      setIsLoading(false);
    };
    init();
  }, []);

  useEffect(() => {
    if (selectedProject) loadComparison();
  }, [selectedProject]);

  const loadComparison = async () => {
    try {
      // Fetch targets for the project
      const { data: targets } = await supabase
        .from('production_targets')
        .select(`*, services_catalog(name, unit), service_fronts(name, project_id)`)
        .order('target_date', { ascending: true });

      if (!targets) { setData([]); return; }

      const projectTargets = targets.filter(t => t.service_fronts?.project_id === selectedProject);
      const rows: ComparisonRow[] = [];

      for (const target of projectTargets) {
        const { data: executed } = await supabase
          .from('executed_services')
          .select('quantity, daily_reports!inner(report_date, service_front_id)')
          .eq('service_id', target.service_id)
          .eq('daily_reports.service_front_id', target.service_front_id)
          .eq('daily_reports.report_date', target.target_date);

        const totalExecuted = executed?.reduce((sum, e) => sum + Number(e.quantity), 0) || 0;
        const planned = Number(target.target_quantity);
        const variance = totalExecuted - planned;
        const variancePct = planned > 0 ? (variance / planned) * 100 : 0;

        rows.push({
          date: target.target_date,
          serviceName: target.services_catalog?.name || 'N/A',
          frontName: target.service_fronts?.name || 'N/A',
          planned,
          actual: totalExecuted,
          unit: target.services_catalog?.unit || 'un',
          variance,
          variancePct,
        });
      }

      setData(rows);
    } catch (error: any) {
      toast.error("Erro ao carregar dados: " + error.message);
    }
  };

  const chartData = (() => {
    const byDate: Record<string, { date: string; planejado: number; realizado: number }> = {};
    data.forEach(r => {
      if (!byDate[r.date]) byDate[r.date] = { date: format(new Date(r.date + 'T12:00:00'), 'dd/MM', { locale: ptBR }), planejado: 0, realizado: 0 };
      byDate[r.date].planejado += r.planned;
      byDate[r.date].realizado += r.actual;
    });
    return Object.values(byDate);
  })();

  const totals = {
    planned: data.reduce((s, r) => s + r.planned, 0),
    actual: data.reduce((s, r) => s + r.actual, 0),
  };
  const totalVariancePct = totals.planned > 0 ? ((totals.actual - totals.planned) / totals.planned) * 100 : 0;

  const handlePrint = () => {
    window.print();
  };

  const handleExportPDF = async () => {
    try {
      const autoTableModule: any = await import("jspdf-autotable");
      const autoTableFn = autoTableModule.default || autoTableModule;
      const doc = new jsPDF({ orientation: 'landscape' });
      const pw = doc.internal.pageSize.getWidth();
      const projectName = projects.find(p => p.id === selectedProject)?.name || '';

      doc.setFontSize(16);
      doc.setFont("helvetica", "bold");
      doc.text("PLANEJADO vs REALIZADO", pw / 2, 16, { align: "center" });

      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      doc.text(`Projeto: ${projectName}`, pw / 2, 24, { align: "center" });
      doc.text(`Gerado em: ${format(new Date(), 'dd/MM/yyyy HH:mm', { locale: ptBR })}`, pw / 2, 30, { align: "center" });

      // Summary
      doc.setFontSize(11);
      doc.text(`Total Planejado: ${totals.planned.toFixed(2)} | Total Realizado: ${totals.actual.toFixed(2)} | Variação: ${totalVariancePct.toFixed(1)}%`, 14, 40);

      const body = data.map(r => [
        format(new Date(r.date + 'T12:00:00'), 'dd/MM/yyyy'),
        r.serviceName,
        r.frontName,
        r.planned.toFixed(2),
        r.actual.toFixed(2),
        r.unit,
        r.variance.toFixed(2),
        `${r.variancePct.toFixed(1)}%`,
      ]);

      autoTableFn(doc, {
        head: [['Data', 'Serviço', 'Frente', 'Planejado', 'Realizado', 'Un', 'Variação', '%']],
        body,
        startY: 46,
        styles: { fontSize: 8 },
        headStyles: { fillColor: [59, 130, 246] },
        bodyStyles: { fontSize: 7 },
      });

      // Footer
      const pageCount = doc.getNumberOfPages();
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(7);
        doc.setFont("helvetica", "italic");
        doc.setTextColor(120);
        doc.text("Gerado automaticamente e sem dor de cabeça pelo ConstruData.", pw / 2, doc.internal.pageSize.getHeight() - 8, { align: "center" });
      }

      doc.save(`planejado-vs-realizado-${projectName.replace(/\s+/g, '_')}.pdf`);
      toast.success("PDF exportado com sucesso!");
    } catch (error: any) {
      toast.error("Erro ao exportar: " + error.message);
    }
  };

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full">
        <AppSidebar />
        <main className="flex-1 p-6 overflow-auto">
          <Button variant="ghost" onClick={() => navigate('/dashboard')} className="mb-4">
            <ArrowLeft className="mr-2 h-4 w-4" /> Voltar
          </Button>

          <div className="flex justify-between items-start mb-6">
            <div>
              <h1 className="text-3xl font-bold mb-2">Planejado vs Realizado</h1>
              <p className="text-muted-foreground">Comparação entre cronograma físico e execução baseada nos RDOs</p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={handlePrint}>
                <Printer className="mr-2 h-4 w-4" /> Imprimir
              </Button>
              <Button onClick={handleExportPDF}>
                <Download className="mr-2 h-4 w-4" /> Exportar PDF
              </Button>
            </div>
          </div>

          {/* Project Selector */}
          <Card className="mb-6">
            <CardContent className="pt-6">
              <Select value={selectedProject} onValueChange={setSelectedProject}>
                <SelectTrigger><SelectValue placeholder="Selecione um projeto" /></SelectTrigger>
                <SelectContent>
                  {projects.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </CardContent>
          </Card>

          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <Card>
              <CardContent className="pt-4 pb-4 text-center">
                <Target className="h-6 w-6 mx-auto text-blue-500 mb-1" />
                <div className="text-2xl font-bold">{totals.planned.toFixed(2)}</div>
                <div className="text-xs text-muted-foreground">Total Planejado</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 pb-4 text-center">
                <TrendingUp className="h-6 w-6 mx-auto text-green-500 mb-1" />
                <div className="text-2xl font-bold">{totals.actual.toFixed(2)}</div>
                <div className="text-xs text-muted-foreground">Total Realizado</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 pb-4 text-center">
                {totalVariancePct >= 0 ? (
                  <TrendingUp className="h-6 w-6 mx-auto text-green-500 mb-1" />
                ) : (
                  <TrendingDown className="h-6 w-6 mx-auto text-red-500 mb-1" />
                )}
                <div className={`text-2xl font-bold ${totalVariancePct >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {totalVariancePct >= 0 ? '+' : ''}{totalVariancePct.toFixed(1)}%
                </div>
                <div className="text-xs text-muted-foreground">Variação Global</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 pb-4 text-center">
                <div className="text-2xl font-bold">{data.length}</div>
                <div className="text-xs text-muted-foreground">Metas Comparadas</div>
              </CardContent>
            </Card>
          </div>

          {/* Chart */}
          {chartData.length > 0 && (
            <Card className="mb-6">
              <CardHeader>
                <CardTitle>Evolução Planejado vs Realizado</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="planejado" fill="hsl(var(--muted-foreground))" name="Planejado" opacity={0.4} />
                    <Bar dataKey="realizado" fill="hsl(var(--primary))" name="Realizado" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}

          {/* Table */}
          <Card>
            <CardHeader>
              <CardTitle>Detalhamento</CardTitle>
            </CardHeader>
            <CardContent>
              {data.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <Target className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>Nenhuma meta encontrada.</p>
                  <p className="text-sm mt-1">Configure metas no Controle de Produção.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left py-2 px-3">Data</th>
                        <th className="text-left py-2 px-3">Serviço</th>
                        <th className="text-left py-2 px-3">Frente</th>
                        <th className="text-right py-2 px-3">Planejado</th>
                        <th className="text-right py-2 px-3">Realizado</th>
                        <th className="text-left py-2 px-3">Un</th>
                        <th className="text-right py-2 px-3">Variação</th>
                        <th className="text-right py-2 px-3">%</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.map((row, idx) => (
                        <tr key={idx} className={`border-b ${row.variancePct < -20 ? 'bg-red-50 dark:bg-red-950/10' : row.variancePct > 0 ? 'bg-green-50 dark:bg-green-950/10' : ''}`}>
                          <td className="py-2 px-3">{format(new Date(row.date + 'T12:00:00'), 'dd/MM/yyyy')}</td>
                          <td className="py-2 px-3">{row.serviceName}</td>
                          <td className="py-2 px-3">{row.frontName}</td>
                          <td className="py-2 px-3 text-right">{row.planned.toFixed(2)}</td>
                          <td className="py-2 px-3 text-right font-medium">{row.actual.toFixed(2)}</td>
                          <td className="py-2 px-3">{row.unit}</td>
                          <td className={`py-2 px-3 text-right font-medium ${row.variance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                            {row.variance >= 0 ? '+' : ''}{row.variance.toFixed(2)}
                          </td>
                          <td className={`py-2 px-3 text-right font-medium ${row.variancePct >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                            {row.variancePct >= 0 ? '+' : ''}{row.variancePct.toFixed(1)}%
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </main>
      </div>
    </SidebarProvider>
  );
}
