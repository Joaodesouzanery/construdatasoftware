import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ArrowLeft, AlertTriangle, TrendingDown, TrendingUp, Clock, Target, CheckCircle2, XCircle } from "lucide-react";
import { toast } from "sonner";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell } from "recharts";
import { format, differenceInDays } from "date-fns";
import { ptBR } from "date-fns/locale";

interface DelayData {
  serviceId: string;
  serviceName: string;
  frontName: string;
  targetDate: string;
  targetQty: number;
  executedQty: number;
  completionRate: number;
  daysLate: number;
  status: 'on_track' | 'at_risk' | 'delayed' | 'completed';
}

export default function DelayTracking() {
  const navigate = useNavigate();
  const [projects, setProjects] = useState<any[]>([]);
  const [selectedProject, setSelectedProject] = useState<string>("");
  const [delayData, setDelayData] = useState<DelayData[]>([]);
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
    if (selectedProject) loadDelayData();
  }, [selectedProject]);

  const loadDelayData = async () => {
    try {
      // Fetch targets for the project
      const { data: targets } = await supabase
        .from('production_targets')
        .select(`*, services_catalog(name, unit), service_fronts(name, project_id)`)
        .eq('service_fronts.project_id', selectedProject);

      if (!targets || targets.length === 0) {
        setDelayData([]);
        return;
      }

      const filteredTargets = targets.filter(t => t.service_fronts?.project_id === selectedProject);

      // Fetch executed services for each target
      const delays: DelayData[] = [];
      const today = new Date();

      for (const target of filteredTargets) {
        const { data: executed } = await supabase
          .from('executed_services')
          .select('quantity, daily_reports!inner(report_date, service_front_id)')
          .eq('service_id', target.service_id)
          .eq('daily_reports.service_front_id', target.service_front_id);

        const totalExecuted = executed?.reduce((sum, e) => sum + Number(e.quantity), 0) || 0;
        const targetQty = Number(target.target_quantity);
        const completionRate = targetQty > 0 ? (totalExecuted / targetQty) * 100 : 0;
        const targetDate = new Date(target.target_date + 'T12:00:00');
        const daysLate = differenceInDays(today, targetDate);

        let status: DelayData['status'] = 'on_track';
        if (completionRate >= 100) {
          status = 'completed';
        } else if (daysLate > 0 && completionRate < 100) {
          status = 'delayed';
        } else if (completionRate < 80 && daysLate >= -2) {
          status = 'at_risk';
        }

        delays.push({
          serviceId: target.service_id,
          serviceName: target.services_catalog?.name || 'N/A',
          frontName: target.service_fronts?.name || 'N/A',
          targetDate: target.target_date,
          targetQty,
          executedQty: totalExecuted,
          completionRate: Math.min(completionRate, 100),
          daysLate: Math.max(daysLate, 0),
          status,
        });
      }

      // Sort: delayed first, then at_risk, then on_track, then completed
      const order = { delayed: 0, at_risk: 1, on_track: 2, completed: 3 };
      delays.sort((a, b) => order[a.status] - order[b.status]);

      setDelayData(delays);
    } catch (error: any) {
      console.error('Error loading delay data:', error);
      toast.error("Erro ao carregar dados de atraso");
    }
  };

  const getStatusBadge = (status: DelayData['status']) => {
    switch (status) {
      case 'delayed': return <Badge variant="destructive"><XCircle className="h-3 w-3 mr-1" />Atrasado</Badge>;
      case 'at_risk': return <Badge className="bg-amber-500"><AlertTriangle className="h-3 w-3 mr-1" />Em Risco</Badge>;
      case 'on_track': return <Badge className="bg-blue-500"><Clock className="h-3 w-3 mr-1" />No Prazo</Badge>;
      case 'completed': return <Badge className="bg-green-500"><CheckCircle2 className="h-3 w-3 mr-1" />Concluído</Badge>;
    }
  };

  const stats = {
    total: delayData.length,
    delayed: delayData.filter(d => d.status === 'delayed').length,
    atRisk: delayData.filter(d => d.status === 'at_risk').length,
    onTrack: delayData.filter(d => d.status === 'on_track').length,
    completed: delayData.filter(d => d.status === 'completed').length,
    avgCompletion: delayData.length > 0 ? delayData.reduce((s, d) => s + d.completionRate, 0) / delayData.length : 0,
    totalDaysLate: delayData.reduce((s, d) => s + d.daysLate, 0),
  };

  const chartData = delayData.slice(0, 15).map(d => ({
    name: `${d.serviceName.substring(0, 20)}`,
    meta: d.targetQty,
    executado: d.executedQty,
    completionRate: Math.round(d.completionRate),
  }));

  const getBarColor = (entry: any) => {
    if (entry.completionRate >= 100) return 'hsl(142, 76%, 36%)';
    if (entry.completionRate >= 80) return 'hsl(217, 91%, 60%)';
    if (entry.completionRate >= 50) return 'hsl(45, 93%, 47%)';
    return 'hsl(0, 84%, 60%)';
  };

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full">
        <AppSidebar />
        <main className="flex-1 p-6 overflow-auto">
          <Button variant="ghost" onClick={() => navigate('/dashboard')} className="mb-4">
            <ArrowLeft className="mr-2 h-4 w-4" /> Voltar
          </Button>

          <div className="mb-6">
            <h1 className="text-3xl font-bold mb-2">Acompanhamento de Atraso da Obra</h1>
            <p className="text-muted-foreground">Compare metas de produção com o realizado para identificar atrasos</p>
          </div>

          {/* Project selector */}
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
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4 mb-6">
            <Card className="border-blue-200">
              <CardContent className="pt-4 pb-4 text-center">
                <Target className="h-6 w-6 mx-auto text-blue-500 mb-1" />
                <div className="text-2xl font-bold">{stats.total}</div>
                <div className="text-xs text-muted-foreground">Total Metas</div>
              </CardContent>
            </Card>
            <Card className="border-red-200">
              <CardContent className="pt-4 pb-4 text-center">
                <XCircle className="h-6 w-6 mx-auto text-red-500 mb-1" />
                <div className="text-2xl font-bold text-red-600">{stats.delayed}</div>
                <div className="text-xs text-muted-foreground">Atrasados</div>
              </CardContent>
            </Card>
            <Card className="border-amber-200">
              <CardContent className="pt-4 pb-4 text-center">
                <AlertTriangle className="h-6 w-6 mx-auto text-amber-500 mb-1" />
                <div className="text-2xl font-bold text-amber-600">{stats.atRisk}</div>
                <div className="text-xs text-muted-foreground">Em Risco</div>
              </CardContent>
            </Card>
            <Card className="border-blue-200">
              <CardContent className="pt-4 pb-4 text-center">
                <Clock className="h-6 w-6 mx-auto text-blue-500 mb-1" />
                <div className="text-2xl font-bold text-blue-600">{stats.onTrack}</div>
                <div className="text-xs text-muted-foreground">No Prazo</div>
              </CardContent>
            </Card>
            <Card className="border-green-200">
              <CardContent className="pt-4 pb-4 text-center">
                <CheckCircle2 className="h-6 w-6 mx-auto text-green-500 mb-1" />
                <div className="text-2xl font-bold text-green-600">{stats.completed}</div>
                <div className="text-xs text-muted-foreground">Concluídos</div>
              </CardContent>
            </Card>
            <Card className="border-purple-200">
              <CardContent className="pt-4 pb-4 text-center">
                <TrendingUp className="h-6 w-6 mx-auto text-purple-500 mb-1" />
                <div className="text-2xl font-bold text-purple-600">{Math.round(stats.avgCompletion)}%</div>
                <div className="text-xs text-muted-foreground">Média Conclusão</div>
              </CardContent>
            </Card>
          </div>

          {/* Alert Banner */}
          {stats.delayed > 0 && (
            <Card className="mb-6 border-red-300 bg-red-50 dark:bg-red-950/20">
              <CardContent className="pt-4 pb-4">
                <div className="flex items-center gap-3">
                  <AlertTriangle className="h-8 w-8 text-red-500" />
                  <div>
                    <p className="font-semibold text-red-700 dark:text-red-400">
                      ⚠️ {stats.delayed} meta{stats.delayed > 1 ? 's' : ''} em atraso!
                    </p>
                    <p className="text-sm text-red-600 dark:text-red-300">
                      Total de {stats.totalDaysLate} dias acumulados de atraso. Ação imediata recomendada.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Chart */}
          {chartData.length > 0 && (
            <Card className="mb-6">
              <CardHeader>
                <CardTitle>Meta vs Executado</CardTitle>
                <CardDescription>Comparação visual das metas de produção</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={350}>
                  <BarChart data={chartData} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis type="number" />
                    <YAxis dataKey="name" type="category" width={150} tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="meta" fill="hsl(var(--muted-foreground))" name="Meta" opacity={0.3} />
                    <Bar dataKey="executado" name="Executado">
                      {chartData.map((entry, index) => (
                        <Cell key={index} fill={getBarColor(entry)} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}

          {/* Detailed List */}
          <Card>
            <CardHeader>
              <CardTitle>Detalhamento por Meta</CardTitle>
            </CardHeader>
            <CardContent>
              {delayData.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <Target className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>Nenhuma meta de produção encontrada para este projeto.</p>
                  <p className="text-sm mt-1">Configure metas no Controle de Produção para acompanhar atrasos.</p>
                  <Button variant="outline" className="mt-4" onClick={() => navigate('/production-control')}>
                    Ir para Controle de Produção
                  </Button>
                </div>
              ) : (
                <div className="space-y-4">
                  {delayData.map((item, idx) => (
                    <div key={idx} className={`p-4 rounded-lg border ${
                      item.status === 'delayed' ? 'border-red-200 bg-red-50/50 dark:bg-red-950/10' :
                      item.status === 'at_risk' ? 'border-amber-200 bg-amber-50/50 dark:bg-amber-950/10' :
                      item.status === 'completed' ? 'border-green-200 bg-green-50/50 dark:bg-green-950/10' :
                      'border-border'
                    }`}>
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <div className="font-semibold">{item.serviceName}</div>
                          <div className="text-sm text-muted-foreground">Frente: {item.frontName}</div>
                        </div>
                        <div className="flex items-center gap-2">
                          {item.daysLate > 0 && (
                            <Badge variant="outline" className="text-red-600">
                              <TrendingDown className="h-3 w-3 mr-1" />
                              {item.daysLate} dia{item.daysLate > 1 ? 's' : ''} atrasado
                            </Badge>
                          )}
                          {getStatusBadge(item.status)}
                        </div>
                      </div>
                      <div className="flex items-center gap-4 text-sm">
                        <span>Meta: {item.targetQty.toFixed(2)}</span>
                        <span>Executado: {item.executedQty.toFixed(2)}</span>
                        <span>Data: {format(new Date(item.targetDate + 'T12:00:00'), 'dd/MM/yyyy')}</span>
                      </div>
                      <div className="mt-2">
                        <div className="flex items-center justify-between text-xs mb-1">
                          <span>Progresso</span>
                          <span className="font-medium">{Math.round(item.completionRate)}%</span>
                        </div>
                        <Progress value={item.completionRate} className="h-2" />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </main>
      </div>
    </SidebarProvider>
  );
}
