import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Download, Filter, Trash2, Pencil, ImageIcon, ImageOff, FileJson, CalendarRange } from "lucide-react";
import { toast } from "sonner";
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import jsPDF from "jspdf";
import "jspdf-autotable";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { EditRDODialog } from "./EditRDODialog";

interface RDOHistoryViewProps {
  projectId: string;
}

export const RDOHistoryView = ({ projectId }: RDOHistoryViewProps) => {
  const [rdos, setRdos] = useState<any[]>([]);
  const [rdoPhotoCounts, setRdoPhotoCounts] = useState<Record<string, number>>({});
  const [services, setServices] = useState<any[]>([]);
  const [selectedService, setSelectedService] = useState<string>("all");
  const [selectedPeriod, setSelectedPeriod] = useState<string>("month");
  const [specificDate, setSpecificDate] = useState<string>("");
  const [dateRangeStart, setDateRangeStart] = useState<string>("");
  const [dateRangeEnd, setDateRangeEnd] = useState<string>("");
  const [isExportingPeriod, setIsExportingPeriod] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [deletingRdo, setDeletingRdo] = useState<any>(null);
  const [exportingRdo, setExportingRdo] = useState<any>(null);
  const [editingRdo, setEditingRdo] = useState<any>(null);
  const [consolidateServices, setConsolidateServices] = useState(false);
  const [selectedRdoIds, setSelectedRdoIds] = useState<Set<string>>(new Set());
  const [isBulkExporting, setIsBulkExporting] = useState(false);
  const queryClient = useQueryClient();

  const deleteMutation = useMutation({
    mutationFn: async (rdo: any) => {
      if (rdo._source === 'rdos') {
        const { error } = await supabase
          .from('rdos')
          .delete()
          .eq('id', rdo.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('daily_reports')
          .delete()
          .eq('id', rdo.id);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      loadRDOs();
      toast.success("RDO deletado com sucesso!");
      setDeletingRdo(null);
    },
    onError: (error: any) => {
      toast.error("Erro ao deletar RDO: " + error.message);
    },
  });

  useEffect(() => {
    if (projectId) {
      loadRDOs();
    }
  }, [projectId, selectedService, selectedPeriod, specificDate, dateRangeStart, dateRangeEnd]);

  const loadRDOs = async () => {
    setIsLoading(true);
    try {
      const dateFilter = getDateFilter();
      
      // Buscar da tabela daily_reports (sistema novo)
      let dailyReportsQuery = supabase
        .from('daily_reports')
        .select(`
          *,
          construction_sites (name),
          service_fronts (name),
          executed_services (
            *,
            services_catalog (name, unit)
          ),
          justifications (reason)
        `)
        .eq('project_id', projectId);

      if (specificDate) {
        dailyReportsQuery = dailyReportsQuery.eq('report_date', specificDate);
      } else if (dateRangeStart && dateRangeEnd) {
        dailyReportsQuery = dailyReportsQuery
          .gte('report_date', dateRangeStart)
          .lte('report_date', dateRangeEnd);
      } else {
        dailyReportsQuery = dailyReportsQuery
          .gte('report_date', dateFilter.start)
          .lte('report_date', dateFilter.end);
      }
      
      dailyReportsQuery = dailyReportsQuery.order('report_date', { ascending: false });

      const { data: dailyReportsData, error: dailyReportsError } = await dailyReportsQuery;
      
      if (dailyReportsError) {
        console.error("Erro ao carregar daily_reports:", dailyReportsError);
      }

      // Buscar da tabela rdos (sistema antigo) relacionada com obras
      const { data: obrasData, error: obrasError } = await supabase
        .from('obras')
        .select('id')
        .eq('user_id', (await supabase.auth.getUser()).data.user?.id);

      let rdosData: any[] = [];
      if (obrasData && obrasData.length > 0) {
        let rdosQuery = supabase
          .from('rdos')
          .select('*')
          .in('obra_id', obrasData.map(o => o.id));

        if (specificDate) {
          rdosQuery = rdosQuery.eq('data', specificDate);
        } else {
          rdosQuery = rdosQuery
            .gte('data', dateFilter.start)
            .lte('data', dateFilter.end);
        }

        const { data: rdos, error: rdosError } = await rdosQuery.order('data', { ascending: false });
        
        if (rdosError) {
          console.error("Erro ao carregar rdos:", rdosError);
        } else if (rdos) {
          rdosData = rdos;
        }
      }

      // Consolidar dados
      const allRdos: any[] = [];
      
      // Adicionar daily_reports
      if (dailyReportsData) {
        allRdos.push(...dailyReportsData);
      }
      
      // Adicionar rdos (converter para formato compatível)
      if (rdosData && rdosData.length > 0) {
        const convertedRdos = rdosData.map(rdo => ({
          id: rdo.id,
          report_date: rdo.data,
          construction_sites: { name: rdo.localizacao_validada || 'Local não especificado' },
          service_fronts: { name: 'Frente não especificada' },
          executed_services: [],
          justifications: [],
          _source: 'rdos'
        }));
        allRdos.push(...convertedRdos);
      }

      console.log("Total de RDOs carregados:", allRdos.length);
      console.log("- Daily Reports:", dailyReportsData?.length || 0);
      console.log("- RDOs antigos:", rdosData.length);
      
      setRdos(allRdos);

      // Load photo counts for daily_reports
      const dailyReportIds = allRdos.filter(r => r._source !== 'rdos').map(r => r.id);
      if (dailyReportIds.length > 0) {
        const { data: photosData } = await supabase
          .from('rdo_validation_photos')
          .select('daily_report_id')
          .in('daily_report_id', dailyReportIds);
        
        const counts: Record<string, number> = {};
        photosData?.forEach((p: any) => {
          counts[p.daily_report_id] = (counts[p.daily_report_id] || 0) + 1;
        });
        setRdoPhotoCounts(counts);
      }
      
      // Extract unique services
      const uniqueServices = new Set<string>();
      allRdos.forEach(rdo => {
        rdo.executed_services?.forEach((es: any) => {
          if (es.services_catalog) {
            uniqueServices.add(JSON.stringify({
              id: es.service_id,
              name: es.services_catalog.name
            }));
          }
        });
      });
      
      setServices(Array.from(uniqueServices).map(s => JSON.parse(s)));
      
      if (allRdos.length === 0) {
        toast.info("Nenhum RDO encontrado para o período selecionado");
      } else {
        toast.success(`${allRdos.length} RDO(s) carregado(s) com sucesso!`);
      }
    } catch (error: any) {
      console.error("Erro detalhado:", error);
      toast.error("Erro ao carregar histórico: " + error.message);
    } finally {
      setIsLoading(false);
    }
  };

  const getDateFilter = () => {
    const end = new Date();
    let start = new Date();

    switch (selectedPeriod) {
      case 'week':
        start.setDate(end.getDate() - 7);
        break;
      case 'month':
        start.setMonth(end.getMonth() - 1);
        break;
      case 'quarter':
        start.setMonth(end.getMonth() - 3);
        break;
      case 'year':
        start.setFullYear(end.getFullYear() - 1);
        break;
      default:
        start.setMonth(end.getMonth() - 1);
    }

    return {
      start: start.toISOString().split('T')[0],
      end: end.toISOString().split('T')[0]
    };
  };

  const getFilteredData = () => {
    let filtered = rdos;

    if (selectedService !== 'all') {
      filtered = filtered.filter(rdo => 
        rdo.executed_services?.some((es: any) => es.service_id === selectedService)
      );
    }

    return filtered;
  };

  const getChartData = () => {
    const filtered = getFilteredData();
    const dataByDate = new Map();

    filtered.forEach(rdo => {
      // Parse date correctly to avoid timezone issues - use midday to avoid edge cases
      const date = new Date(rdo.report_date + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
      
      rdo.executed_services?.forEach((es: any) => {
        if (selectedService === 'all' || es.service_id === selectedService) {
          const existing = dataByDate.get(date) || { date, quantity: 0 };
          existing.quantity += Number(es.quantity);
          dataByDate.set(date, existing);
        }
      });
    });

    return Array.from(dataByDate.values()).sort((a, b) => {
      const [dayA, monthA] = a.date.split('/');
      const [dayB, monthB] = b.date.split('/');
      const year = new Date().getFullYear();
      return new Date(`${year}-${monthA}-${dayA}`).getTime() - new Date(`${year}-${monthB}-${dayB}`).getTime();
    });
  };

  const getServiceDistribution = () => {
    const filtered = getFilteredData();
    const serviceMap = new Map();

    filtered.forEach(rdo => {
      rdo.executed_services?.forEach((es: any) => {
        const serviceName = es.services_catalog?.name || 'Desconhecido';
        const existing = serviceMap.get(serviceName) || { name: serviceName, quantity: 0, count: 0 };
        existing.quantity += Number(es.quantity);
        existing.count += 1;
        serviceMap.set(serviceName, existing);
      });
    });

    return Array.from(serviceMap.values());
  };

  const handleExportCSV = () => {
    const filtered = getFilteredData();
    let csvContent = "Data,Local,Frente,Serviço,Quantidade,Unidade,Equipamentos,Executado Por\n";

    filtered.forEach(rdo => {
      const formattedDate = new Date(rdo.report_date + 'T12:00:00').toLocaleDateString('pt-BR');
      rdo.executed_services?.forEach((es: any) => {
        csvContent += [
          formattedDate,
          rdo.construction_sites?.name || 'N/A',
          rdo.service_fronts?.name || 'N/A',
          es.services_catalog?.name || 'N/A',
          es.quantity,
          es.unit || 'N/A',
          es.equipment_used?.equipment || 'N/A',
          'Sistema'
        ].join(',') + '\n';
      });
    });

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `historico_rdos_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();

    toast.success("Histórico exportado em CSV com sucesso!");
  };

  // Helper: fetch a single RDO with ALL data (services, photos with signed URLs, weather, GPS, etc.)
  const fetchFullRDOForExport = async (rdoId: string) => {
    const { data: completeRDO, error } = await supabase
      .from('daily_reports')
      .select(`
        *,
        project:projects(name),
        construction_site:construction_sites(name, address),
        service_front:service_fronts(name),
        executed_services(
          quantity, unit, equipment_used,
          services_catalog(name),
          employees(name)
        )
      `)
      .eq('id', rdoId)
      .single();

    if (error || !completeRDO) return null;

    const { data: photos } = await supabase
      .from('rdo_validation_photos')
      .select('photo_url, uploaded_at')
      .eq('daily_report_id', rdoId)
      .order('uploaded_at', { ascending: true });

    const photosWithSignedUrls = await Promise.all(
      (photos || []).map(async (photo: any) => {
        const rawPath: string = photo.photo_url || "";
        const path = rawPath.includes('rdo-photos/')
          ? rawPath.split('rdo-photos/')[1]
          : rawPath;
        let signedUrl = rawPath;
        try {
          const { data: signed } = await supabase.storage
            .from('rdo-photos')
            .createSignedUrl(path, 60 * 60);
          if (signed?.signedUrl) signedUrl = signed.signedUrl;
        } catch { /* keep raw */ }
        return { ...photo, photo_url: signedUrl };
      })
    );

    return { ...completeRDO, photos: photosWithSignedUrls };
  };

  // Fetch ALL daily_report IDs for project (no filter, paginated)
  const fetchAllProjectRDOIds = async (): Promise<string[]> => {
    const allIds: string[] = [];
    let offset = 0;
    const batchSize = 1000;
    let hasMore = true;
    while (hasMore) {
      const { data, error } = await supabase
        .from('daily_reports')
        .select('id')
        .eq('project_id', projectId)
        .order('report_date', { ascending: false })
        .range(offset, offset + batchSize - 1);
      if (error) throw error;
      if (data && data.length > 0) {
        allIds.push(...data.map((d: any) => d.id));
        offset += batchSize;
        hasMore = data.length === batchSize;
      } else {
        hasMore = false;
      }
    }
    return allIds;
  };

  const handleExportPDF = async () => {
    try {
      toast.info('Buscando TODOS os RDOs do projeto para gerar PDFs completos...');
      
      const allIds = await fetchAllProjectRDOIds();
      if (allIds.length === 0) {
        toast.error("Nenhum RDO encontrado neste projeto");
        return;
      }

      toast.info(`Gerando ${allIds.length} PDF(s) completo(s)...`);

      const { generateRDOReportPDF } = await import('@/lib/rdoReportGenerator');
      const JSZip = (await import('jszip')).default;
      const zip = new JSZip();

      for (let i = 0; i < allIds.length; i += 5) {
        const batch = allIds.slice(i, i + 5);
        const rdos = await Promise.all(batch.map(id => fetchFullRDOForExport(id)));
        
        for (const rdo of rdos) {
          if (!rdo) continue;
          try {
            const blob = await generateRDOReportPDF(rdo, consolidateServices, true);
            if (blob) {
              const projectName = rdo.project?.name?.replace(/[^a-zA-Z0-9]/g, '_') || 'Projeto';
              const fileName = `RDO-${projectName}-${rdo.report_date}.pdf`;
              zip.file(fileName, blob);
            }
          } catch (e) {
            console.error('Erro ao gerar PDF para RDO:', rdo.id, e);
          }
        }
      }

      const zipBlob = await zip.generateAsync({ type: 'blob' });
      const url = URL.createObjectURL(zipBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `RDOs-Completos-${new Date().toISOString().split('T')[0]}.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast.success(`${allIds.length} PDF(s) completo(s) exportado(s) em ZIP!`);
    } catch (error: any) {
      console.error("Erro ao exportar PDFs:", error);
      toast.error("Erro ao exportar PDFs: " + (error.message || "Erro desconhecido"));
    }
  };

  const handleExportDXF = async (rdo: any) => {
    try {
      const fullRDO = await fetchFullRDOForExport(rdo.id);
      if (!fullRDO) throw new Error('RDO não encontrado');

      const { generateRDODXF, downloadDXF } = await import('@/lib/dxfExporter');
      const dxfContent = generateRDODXF(fullRDO);
      
      const projectName = fullRDO.project?.name?.replace(/[^a-zA-Z0-9]/g, '_') || 'Projeto';
      const fileName = `RDO-${projectName}-${fullRDO.report_date}.dxf`;
      downloadDXF(dxfContent, fileName);

      toast.success('RDO exportado em DXF com sucesso!');
      setExportingRdo(null);
    } catch (error: any) {
      console.error('Erro ao exportar DXF:', error);
      toast.error('Erro ao exportar DXF: ' + (error.message || 'Erro desconhecido'));
    }
  };

  const handleExportHydroNetwork = async (rdo: any) => {
    try {
      toast.info('Preparando exportação para HydroNetwork...');
      const { fetchCompleteRDO, downloadJSON } = await import('@/lib/hydroNetworkExporter');
      const data = await fetchCompleteRDO(rdo.id);
      if (!data) throw new Error('RDO não encontrado');
      
      const exportPayload = {
        format: 'HydroNetwork',
        version: '1.0',
        source: 'ConstruData',
        exported_at: new Date().toISOString(),
        data: [data],
      };
      const fileName = `HydroNetwork-RDO-${data.report_date}.json`;
      downloadJSON(exportPayload, fileName);
      toast.success('RDO exportado para HydroNetwork!');
      setExportingRdo(null);
    } catch (error: any) {
      toast.error('Erro ao exportar: ' + (error.message || 'Erro desconhecido'));
    }
  };

  const handleExportAllHydroNetwork = async () => {
    try {
      toast.info('Buscando TODOS os RDOs do projeto para HydroNetwork...');
      
      const allIds = await fetchAllProjectRDOIds();
      if (allIds.length === 0) {
        toast.error('Nenhum RDO encontrado neste projeto');
        return;
      }

      toast.info(`Exportando ${allIds.length} RDO(s) completo(s) para HydroNetwork...`);
      const { fetchCompleteRDO, downloadJSON } = await import('@/lib/hydroNetworkExporter');
      
      const validResults: any[] = [];
      for (let i = 0; i < allIds.length; i += 10) {
        const batch = allIds.slice(i, i + 10);
        const results = await Promise.all(batch.map(id => fetchCompleteRDO(id)));
        validResults.push(...results.filter(Boolean));
      }

      const exportPayload = {
        format: 'HydroNetwork',
        version: '1.0',
        source: 'ConstruData',
        exported_at: new Date().toISOString(),
        total: validResults.length,
        data: validResults,
      };
      const fileName = `HydroNetwork-TODOS-RDOs-${new Date().toISOString().split('T')[0]}.json`;
      downloadJSON(exportPayload, fileName);
      toast.success(`${validResults.length} RDO(s) exportado(s) para HydroNetwork com todos os dados!`);
    } catch (error: any) {
      toast.error('Erro ao exportar: ' + (error.message || 'Erro desconhecido'));
    }
  };

  const handleExportSingleRDO = async (rdo: any) => {
    try {
      const fullRDO = await fetchFullRDOForExport(rdo.id);
      if (!fullRDO) throw new Error('RDO não encontrado');

      const { generateRDOReportPDF } = await import('@/lib/rdoReportGenerator');
      await generateRDOReportPDF(fullRDO, consolidateServices);
      
      toast.success('RDO exportado em PDF com sucesso!');
      setExportingRdo(null);
      setConsolidateServices(false);
    } catch (error: any) {
      console.error('Erro ao exportar RDO em PDF:', error);
      toast.error('Erro ao exportar RDO em PDF: ' + (error.message || 'Erro desconhecido'));
    }
  };

  const toggleRdoSelection = (id: string) => {
    setSelectedRdoIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    const filtered = getFilteredData().filter(r => r._source !== 'rdos');
    if (selectedRdoIds.size === filtered.length) {
      setSelectedRdoIds(new Set());
    } else {
      setSelectedRdoIds(new Set(filtered.map(r => r.id)));
    }
  };

  const handleBulkExportPDF = async () => {
    if (selectedRdoIds.size === 0) { toast.error('Selecione pelo menos um RDO'); return; }
    setIsBulkExporting(true);
    try {
      const ids = Array.from(selectedRdoIds);
      toast.info(`Gerando ${ids.length} PDF(s) completo(s)...`);
      const { generateRDOReportPDF } = await import('@/lib/rdoReportGenerator');
      const JSZip = (await import('jszip')).default;
      const zip = new JSZip();

      for (let i = 0; i < ids.length; i += 5) {
        const batch = ids.slice(i, i + 5);
        const rdos = await Promise.all(batch.map(id => fetchFullRDOForExport(id)));
        for (const rdo of rdos) {
          if (!rdo) continue;
          try {
            const blob = await generateRDOReportPDF(rdo, consolidateServices, true);
            if (blob) {
              const projectName = rdo.project?.name?.replace(/[^a-zA-Z0-9]/g, '_') || 'Projeto';
              zip.file(`RDO-${projectName}-${rdo.report_date}.pdf`, blob);
            }
          } catch (e) { console.error('Erro PDF:', e); }
        }
      }

      const zipBlob = await zip.generateAsync({ type: 'blob' });
      const url = URL.createObjectURL(zipBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `RDOs-Selecionados-${new Date().toISOString().split('T')[0]}.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success(`${ids.length} PDF(s) exportado(s) em ZIP!`);
    } catch (error: any) {
      toast.error('Erro ao exportar PDFs: ' + (error.message || 'Erro'));
    } finally { setIsBulkExporting(false); }
  };

  const handleBulkExportHydroNetwork = async () => {
    if (selectedRdoIds.size === 0) { toast.error('Selecione pelo menos um RDO'); return; }
    setIsBulkExporting(true);
    try {
      const ids = Array.from(selectedRdoIds);
      toast.info(`Exportando ${ids.length} RDO(s) para HydroNetwork...`);
      const { fetchCompleteRDO, downloadJSON } = await import('@/lib/hydroNetworkExporter');

      const validResults: any[] = [];
      for (let i = 0; i < ids.length; i += 10) {
        const batch = ids.slice(i, i + 10);
        const results = await Promise.all(batch.map(id => fetchCompleteRDO(id)));
        validResults.push(...results.filter(Boolean));
      }

      const exportPayload = {
        format: 'HydroNetwork',
        version: '1.0',
        source: 'ConstruData',
        exported_at: new Date().toISOString(),
        total: validResults.length,
        data: validResults,
      };
      downloadJSON(exportPayload, `HydroNetwork-Selecionados-${new Date().toISOString().split('T')[0]}.json`);
      toast.success(`${validResults.length} RDO(s) exportado(s) para HydroNetwork!`);
    } catch (error: any) {
      toast.error('Erro: ' + (error.message || 'Erro'));
    } finally { setIsBulkExporting(false); }
  };

  const chartData = getChartData();
  const serviceData = getServiceDistribution();

  return (
    <div className="space-y-6">
      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Data Específica</label>
              <div className="flex gap-2">
                <input
                  type="date"
                  value={specificDate}
                  onChange={(e) => {
                    setSpecificDate(e.target.value);
                    if (e.target.value) setSelectedPeriod("");
                  }}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                />
                {specificDate && (
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => setSpecificDate("")}
                  >
                    Limpar
                  </Button>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Período</label>
              <Select 
                value={selectedPeriod} 
                onValueChange={(value) => {
                  setSelectedPeriod(value);
                  if (value) setSpecificDate("");
                }}
                disabled={!!specificDate}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o período" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="week">Última Semana</SelectItem>
                  <SelectItem value="month">Último Mês</SelectItem>
                  <SelectItem value="quarter">Último Trimestre</SelectItem>
                  <SelectItem value="year">Último Ano</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Serviço</label>
              <Select value={selectedService} onValueChange={setSelectedService}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os Serviços</SelectItem>
                  {services.map(service => (
                    <SelectItem key={service.id} value={service.id}>
                      {service.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-end gap-2 flex-wrap">
              <Button onClick={handleExportCSV} variant="outline" className="flex-1">
                <Download className="w-4 h-4 mr-2" />
                CSV
              </Button>
              <Button onClick={handleExportPDF} className="flex-1">
                <Download className="w-4 h-4 mr-2" />
                PDF
              </Button>
              <Button onClick={handleExportAllHydroNetwork} variant="outline" className="flex-1 text-xs">
                <FileJson className="w-4 h-4 mr-2" />
                HydroNetwork
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardHeader>
            <CardDescription>Total de RDOs</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{getFilteredData().length}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardDescription>Serviços Executados</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{serviceData.length}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardDescription>Total Produzido</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">
              {serviceData.reduce((sum, s) => sum + s.quantity, 0).toFixed(2)}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <Card>
        <CardHeader>
          <CardTitle>Evolução da Produção</CardTitle>
          <CardDescription>Quantidade executada ao longo do tempo</CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Line 
                type="monotone" 
                dataKey="quantity" 
                stroke="hsl(var(--primary))" 
                strokeWidth={2}
                name="Quantidade"
              />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Distribuição por Serviço</CardTitle>
          <CardDescription>Total executado de cada serviço</CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={serviceData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Bar dataKey="quantity" fill="hsl(var(--primary))" name="Quantidade" />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Bulk action bar */}
      {selectedRdoIds.size > 0 && (
        <Card className="border-primary">
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <span className="text-sm font-medium">
                {selectedRdoIds.size} RDO(s) selecionado(s)
              </span>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => setSelectedRdoIds(new Set())} disabled={isBulkExporting}>
                  Limpar seleção
                </Button>
                <Button variant="outline" size="sm" onClick={handleBulkExportHydroNetwork} disabled={isBulkExporting}>
                  <FileJson className="w-4 h-4 mr-2" />
                  HydroNetwork (JSON)
                </Button>
                <Button size="sm" onClick={handleBulkExportPDF} disabled={isBulkExporting}>
                  <Download className="w-4 h-4 mr-2" />
                  PDF (ZIP)
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* RDO List */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Histórico Detalhado</CardTitle>
              <CardDescription>{getFilteredData().length} RDOs encontrados</CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Checkbox
                id="select-all"
                checked={getFilteredData().filter(r => r._source !== 'rdos').length > 0 && selectedRdoIds.size === getFilteredData().filter(r => r._source !== 'rdos').length}
                onCheckedChange={toggleSelectAll}
              />
              <Label htmlFor="select-all" className="text-sm">Selecionar todos</Label>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {getFilteredData().map(rdo => (
              <Card key={rdo.id} className={`bg-muted/50 ${selectedRdoIds.has(rdo.id) ? 'ring-2 ring-primary' : ''}`}>
                <CardContent className="pt-6">
                  <div className="flex justify-between items-start mb-4">
                    <div className="flex items-start gap-3">
                      {rdo._source !== 'rdos' && (
                        <Checkbox
                          checked={selectedRdoIds.has(rdo.id)}
                          onCheckedChange={() => toggleRdoSelection(rdo.id)}
                          className="mt-1"
                        />
                      )}
                      <div>
                      <div className="font-semibold text-lg">
                        {new Date(rdo.report_date + 'T12:00:00').toLocaleDateString('pt-BR', { 
                          weekday: 'short',
                          day: '2-digit', 
                          month: 'short', 
                          year: 'numeric' 
                        })}
                      </div>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <span>Local: {rdo.construction_sites?.name} | Frente: {rdo.service_fronts?.name}</span>
                        {rdo._source !== 'rdos' && (
                          rdoPhotoCounts[rdo.id] > 0 ? (
                            <Badge variant="outline" className="text-green-600 border-green-300 gap-1">
                              <ImageIcon className="h-3 w-3" />
                              {rdoPhotoCounts[rdo.id]} foto{rdoPhotoCounts[rdo.id] > 1 ? 's' : ''}
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-muted-foreground gap-1">
                              <ImageOff className="h-3 w-3" />
                              Sem fotos
                            </Badge>
                          )
                        )}
                      </div>
                    </div>
                    </div>
                    <div className="flex gap-2">
                      {/* Botão Editar - apenas para daily_reports (não para rdos antigos) */}
                      {rdo._source !== 'rdos' && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setEditingRdo(rdo)}
                        >
                          <Pencil className="w-4 h-4" />
                        </Button>
                      )}
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setExportingRdo(rdo)}
                      >
                        <Download className="w-4 h-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => setDeletingRdo(rdo)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    {rdo.executed_services?.map((es: any, idx: number) => (
                      <div key={idx} className="flex justify-between text-sm border-l-2 border-primary pl-3">
                        <span>{es.services_catalog?.name}</span>
                        <span className="font-semibold">{es.quantity} {es.unit}</span>
                      </div>
                    ))}
                  </div>

                  {rdo.justifications && rdo.justifications.length > 0 && (
                    <div className="mt-4 p-3 bg-destructive/10 rounded-md">
                      <div className="text-sm font-medium text-destructive mb-1">Justificativas:</div>
                      {rdo.justifications.map((just: any, idx: number) => (
                        <div key={idx} className="text-sm text-muted-foreground">
                          • {just.reason}
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}

            {getFilteredData().length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                Nenhum RDO encontrado para os filtros selecionados
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <AlertDialog open={!!deletingRdo} onOpenChange={() => setDeletingRdo(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir este RDO? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deletingRdo && deleteMutation.mutate(deletingRdo)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Export Dialog */}
      <Dialog open={!!exportingRdo} onOpenChange={(open) => {
        if (!open) {
          setExportingRdo(null);
          setConsolidateServices(false);
        }
      }}>
        <DialogContent className="sm:max-w-[450px]">
          <DialogHeader>
            <DialogTitle>Exportar RDO</DialogTitle>
            <DialogDescription>Escolha o formato e as opções de exportação</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex items-center space-x-2">
              <Checkbox 
                id="consolidate-history" 
                checked={consolidateServices}
                onCheckedChange={(checked) => setConsolidateServices(checked === true)}
              />
              <Label 
                htmlFor="consolidate-history" 
                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
              >
                Consolidar serviços iguais
              </Label>
            </div>
            <p className="text-xs text-muted-foreground">
              Ao ativar esta opção, serviços com o mesmo nome e unidade serão somados e exibidos como um único item no PDF.
            </p>
            <div className="flex gap-2 justify-end flex-wrap">
              <Button type="button" variant="outline" onClick={() => {
                setExportingRdo(null);
                setConsolidateServices(false);
              }}>
                Cancelar
              </Button>
              <Button type="button" variant="outline" onClick={() => exportingRdo && handleExportHydroNetwork(exportingRdo)}>
                <FileJson className="w-4 h-4 mr-2" />
                HydroNetwork
              </Button>
              <Button type="button" variant="outline" onClick={() => exportingRdo && handleExportDXF(exportingRdo)}>
                <Download className="w-4 h-4 mr-2" />
                DXF (CAD)
              </Button>
              <Button type="button" onClick={() => exportingRdo && handleExportSingleRDO(exportingRdo)}>
                <Download className="w-4 h-4 mr-2" />
                PDF
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit RDO Dialog */}
      <EditRDODialog
        rdo={editingRdo}
        open={!!editingRdo}
        onOpenChange={(open) => !open && setEditingRdo(null)}
        onSuccess={loadRDOs}
      />
    </div>
  );
};
