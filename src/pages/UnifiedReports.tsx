import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { ArrowLeft, Download, FileText, ClipboardList, ImageIcon, ImageOff, Calendar, MapPin, Users } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import jsPDF from "jspdf";
import "jspdf-autotable";

export default function UnifiedReports() {
  const navigate = useNavigate();
  const [projects, setProjects] = useState<any[]>([]);
  const [selectedProject, setSelectedProject] = useState<string>("all");
  const [rdos, setRdos] = useState<any[]>([]);
  const [connectionReports, setConnectionReports] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedPeriod, setSelectedPeriod] = useState("month");

  useEffect(() => {
    checkAuth();
  }, []);

  useEffect(() => {
    loadData();
  }, [selectedProject, selectedPeriod]);

  const checkAuth = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { navigate('/auth'); return; }
    await loadProjects();
    setIsLoading(false);
  };

  const loadProjects = async () => {
    const { data } = await supabase.from('projects').select('id, name').order('name');
    if (data) setProjects(data);
  };

  const getDateFilter = () => {
    const end = new Date();
    const start = new Date();
    switch (selectedPeriod) {
      case 'week': start.setDate(end.getDate() - 7); break;
      case 'month': start.setMonth(end.getMonth() - 1); break;
      case 'quarter': start.setMonth(end.getMonth() - 3); break;
      case 'year': start.setFullYear(end.getFullYear() - 1); break;
    }
    return { start: start.toISOString().split('T')[0], end: end.toISOString().split('T')[0] };
  };

  const loadData = async () => {
    const dateFilter = getDateFilter();

    // Load RDOs
    let rdoQuery = supabase
      .from('daily_reports')
      .select(`*, construction_sites(name), service_fronts(name), projects(name), executed_services(quantity, unit, services_catalog(name))`)
      .gte('report_date', dateFilter.start)
      .lte('report_date', dateFilter.end)
      .order('report_date', { ascending: false });

    if (selectedProject !== 'all') {
      rdoQuery = rdoQuery.eq('project_id', selectedProject);
    }

    const { data: rdoData } = await rdoQuery;
    setRdos(rdoData || []);

    // Load Connection Reports
    let crQuery = supabase
      .from('connection_reports')
      .select('*')
      .gte('report_date', dateFilter.start)
      .lte('report_date', dateFilter.end)
      .order('report_date', { ascending: false });

    if (selectedProject !== 'all') {
      crQuery = crQuery.eq('project_id', selectedProject);
    }

    const { data: crData } = await crQuery;
    setConnectionReports(crData || []);
  };

  // Merge and sort all reports by date
  const getAllReports = () => {
    const all: any[] = [];
    rdos.forEach(r => all.push({ ...r, _type: 'rdo', _date: r.report_date }));
    connectionReports.forEach(r => all.push({ ...r, _type: 'connection', _date: r.report_date }));
    all.sort((a, b) => new Date(b._date).getTime() - new Date(a._date).getTime());
    return all;
  };

  const handleExportUnifiedPDF = async () => {
    try {
      const autoTableModule: any = await import("jspdf-autotable");
      const autoTableFn = autoTableModule.default || autoTableModule;
      const doc = new jsPDF();
      const pw = doc.internal.pageSize.getWidth();

      doc.setFontSize(16);
      doc.setFont("helvetica", "bold");
      doc.text("RELATÓRIO UNIFICADO - RDO + LIGAÇÕES", pw / 2, 20, { align: "center" });

      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      doc.text(`Período: ${getDateFilter().start} a ${getDateFilter().end}`, pw / 2, 28, { align: "center" });
      doc.text(`Total: ${rdos.length} RDOs | ${connectionReports.length} Ligações`, pw / 2, 34, { align: "center" });

      // RDO Table
      doc.setFontSize(12);
      doc.setFont("helvetica", "bold");
      doc.text("RDOs - Relatórios Diários de Obra", 14, 46);

      const rdoBody = rdos.map(r => [
        format(new Date(r.report_date + 'T12:00:00'), 'dd/MM/yyyy'),
        r.projects?.name || '-',
        r.construction_sites?.name || '-',
        r.service_fronts?.name || '-',
        r.executed_services?.length || 0,
      ]);

      autoTableFn(doc, {
        head: [['Data', 'Projeto', 'Local', 'Frente', 'Serviços']],
        body: rdoBody,
        startY: 50,
        styles: { fontSize: 8 },
        headStyles: { fillColor: [59, 130, 246] },
      });

      // Connection Reports Table
      const finalY = (doc as any).lastAutoTable?.finalY || 100;
      doc.setFontSize(12);
      doc.setFont("helvetica", "bold");
      
      if (finalY > 240) {
        doc.addPage();
        doc.text("Relatórios de Ligações", 14, 20);
      } else {
        doc.text("Relatórios de Ligações", 14, finalY + 12);
      }

      const crBody = connectionReports.map(r => [
        format(new Date(r.report_date + 'T12:00:00'), 'dd/MM/yyyy'),
        r.team_name,
        r.client_name,
        r.os_number,
        r.service_type,
      ]);

      autoTableFn(doc, {
        head: [['Data', 'Equipe', 'Cliente', 'OS', 'Serviço']],
        body: crBody,
        startY: finalY > 240 ? 24 : finalY + 16,
        styles: { fontSize: 8 },
        headStyles: { fillColor: [249, 115, 22] },
      });

      // Footer
      const pageCount = doc.getNumberOfPages();
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(7);
        doc.setFont("helvetica", "italic");
        doc.setTextColor(120);
        doc.text(
          "Gerado automaticamente e sem dor de cabeça pelo ConstruData.",
          pw / 2,
          doc.internal.pageSize.getHeight() - 8,
          { align: "center" }
        );
      }

      doc.save(`relatorio-unificado-${new Date().toISOString().split('T')[0]}.pdf`);
      toast.success("Relatório unificado exportado com sucesso!");
    } catch (error: any) {
      toast.error("Erro ao exportar: " + error.message);
    }
  };

  const allReports = getAllReports();

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
              <h1 className="text-3xl font-bold mb-2">Relatórios Unificados</h1>
              <p className="text-muted-foreground">RDO + Relatório de Ligações em uma única visão</p>
            </div>
            <Button onClick={handleExportUnifiedPDF}>
              <Download className="mr-2 h-4 w-4" /> Exportar PDF Unificado
            </Button>
          </div>

          {/* Filters */}
          <Card className="mb-6">
            <CardContent className="pt-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Projeto</label>
                  <Select value={selectedProject} onValueChange={setSelectedProject}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos os Projetos</SelectItem>
                      {projects.map(p => (
                        <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Período</label>
                  <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="week">Última Semana</SelectItem>
                      <SelectItem value="month">Último Mês</SelectItem>
                      <SelectItem value="quarter">Último Trimestre</SelectItem>
                      <SelectItem value="year">Último Ano</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-end">
                  <div className="grid grid-cols-2 gap-2 w-full">
                    <Card className="p-3 text-center border-blue-200 bg-blue-50 dark:bg-blue-950/20">
                      <div className="text-2xl font-bold text-blue-600">{rdos.length}</div>
                      <div className="text-xs text-muted-foreground">RDOs</div>
                    </Card>
                    <Card className="p-3 text-center border-orange-200 bg-orange-50 dark:bg-orange-950/20">
                      <div className="text-2xl font-bold text-orange-600">{connectionReports.length}</div>
                      <div className="text-xs text-muted-foreground">Ligações</div>
                    </Card>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Tabs View */}
          <Tabs defaultValue="timeline" className="space-y-4">
            <TabsList>
              <TabsTrigger value="timeline">Linha do Tempo</TabsTrigger>
              <TabsTrigger value="rdos">RDOs ({rdos.length})</TabsTrigger>
              <TabsTrigger value="connections">Ligações ({connectionReports.length})</TabsTrigger>
            </TabsList>

            <TabsContent value="timeline" className="space-y-3">
              {allReports.length === 0 ? (
                <Card><CardContent className="py-12 text-center text-muted-foreground">Nenhum relatório encontrado</CardContent></Card>
              ) : (
                allReports.map((report, idx) => (
                  <Card key={`${report._type}-${report.id}`} className={`border-l-4 ${report._type === 'rdo' ? 'border-l-blue-500' : 'border-l-orange-500'}`}>
                    <CardContent className="pt-4 pb-4">
                      <div className="flex items-start justify-between">
                        <div className="flex items-start gap-3">
                          <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${report._type === 'rdo' ? 'bg-blue-100 text-blue-600 dark:bg-blue-900/30' : 'bg-orange-100 text-orange-600 dark:bg-orange-900/30'}`}>
                            {report._type === 'rdo' ? <ClipboardList className="h-5 w-5" /> : <FileText className="h-5 w-5" />}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <Badge variant={report._type === 'rdo' ? 'default' : 'secondary'} className={report._type === 'rdo' ? 'bg-blue-500' : 'bg-orange-500'}>
                                {report._type === 'rdo' ? 'RDO' : 'Ligação'}
                              </Badge>
                              <span className="text-sm font-medium">
                                {format(new Date(report._date + 'T12:00:00'), "dd/MM/yyyy", { locale: ptBR })}
                              </span>
                            </div>
                            {report._type === 'rdo' ? (
                              <div className="mt-1 text-sm text-muted-foreground">
                                <span>{report.projects?.name || '-'}</span>
                                <span className="mx-1">•</span>
                                <span>{report.construction_sites?.name}</span>
                                <span className="mx-1">•</span>
                                <span>{report.service_fronts?.name}</span>
                                {report.executed_services?.length > 0 && (
                                  <span className="ml-2 text-xs">({report.executed_services.length} serviço{report.executed_services.length > 1 ? 's' : ''})</span>
                                )}
                              </div>
                            ) : (
                              <div className="mt-1 text-sm text-muted-foreground">
                                <span>Equipe: {report.team_name}</span>
                                <span className="mx-1">•</span>
                                <span>OS: {report.os_number}</span>
                                <span className="mx-1">•</span>
                                <span>{report.client_name}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </TabsContent>

            <TabsContent value="rdos" className="space-y-3">
              {rdos.map(rdo => (
                <Card key={rdo.id}>
                  <CardContent className="pt-4 pb-4">
                    <div className="flex justify-between items-start">
                      <div>
                        <div className="font-semibold">
                          {format(new Date(rdo.report_date + 'T12:00:00'), "dd/MM/yyyy - EEEE", { locale: ptBR })}
                        </div>
                        <div className="text-sm text-muted-foreground mt-1">
                          {rdo.construction_sites?.name} | {rdo.service_fronts?.name}
                        </div>
                        <div className="mt-2 space-y-1">
                          {rdo.executed_services?.map((es: any, idx: number) => (
                            <div key={idx} className="text-sm border-l-2 border-blue-400 pl-2">
                              {es.services_catalog?.name} - {es.quantity} {es.unit}
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </TabsContent>

            <TabsContent value="connections" className="space-y-3">
              {connectionReports.map(cr => (
                <Card key={cr.id}>
                  <CardContent className="pt-4 pb-4">
                    <div className="flex justify-between items-start">
                      <div>
                        <div className="font-semibold">
                          {format(new Date(cr.report_date + 'T12:00:00'), "dd/MM/yyyy", { locale: ptBR })} - OS: {cr.os_number}
                        </div>
                        <div className="text-sm text-muted-foreground mt-1">
                          <Users className="inline h-3 w-3 mr-1" />{cr.team_name}
                          <span className="mx-2">•</span>
                          <MapPin className="inline h-3 w-3 mr-1" />{cr.address}
                        </div>
                        <div className="text-sm mt-1">
                          Cliente: {cr.client_name} | Serviço: {cr.service_type}
                        </div>
                      </div>
                      {cr.photos_urls?.length > 0 && (
                        <Badge variant="outline" className="text-green-600 border-green-300">
                          <ImageIcon className="h-3 w-3 mr-1" />{cr.photos_urls.length}
                        </Badge>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </TabsContent>
          </Tabs>
        </main>
      </div>
    </SidebarProvider>
  );
}
