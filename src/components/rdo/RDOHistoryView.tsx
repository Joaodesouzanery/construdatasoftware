import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Download, Filter } from "lucide-react";
import { toast } from "sonner";
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";

interface RDOHistoryViewProps {
  projectId: string;
}

export const RDOHistoryView = ({ projectId }: RDOHistoryViewProps) => {
  const [rdos, setRdos] = useState<any[]>([]);
  const [services, setServices] = useState<any[]>([]);
  const [selectedService, setSelectedService] = useState<string>("all");
  const [selectedPeriod, setSelectedPeriod] = useState<string>("month");
  const [specificDate, setSpecificDate] = useState<string>("");
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (projectId) {
      loadRDOs();
    }
  }, [projectId, selectedService, selectedPeriod, specificDate]);

  const loadRDOs = async () => {
    setIsLoading(true);
    try {
      const dateFilter = getDateFilter();
      
      let query = supabase
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

      // Se houver data específica, filtrar por ela
      if (specificDate) {
        query = query.eq('report_date', specificDate);
      } else {
        query = query
          .gte('report_date', dateFilter.start)
          .lte('report_date', dateFilter.end);
      }
      
      query = query.order('report_date', { ascending: false });

      const { data, error } = await query;
      
      if (error) throw error;
      
      if (data) {
        setRdos(data);
        
        // Extract unique services
        const uniqueServices = new Set<string>();
        data.forEach(rdo => {
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
      }
    } catch (error: any) {
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
      const date = new Date(rdo.report_date).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
      
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
      return new Date(`2024-${monthA}-${dayA}`).getTime() - new Date(`2024-${monthB}-${dayB}`).getTime();
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

  const handleExport = () => {
    const filtered = getFilteredData();
    let csvContent = "Data,Local,Frente,Serviço,Quantidade,Unidade,Equipamentos,Executado Por\n";

    filtered.forEach(rdo => {
      rdo.executed_services?.forEach((es: any) => {
        csvContent += [
          rdo.report_date,
          rdo.construction_sites?.name || 'N/A',
          rdo.service_fronts?.name || 'N/A',
          es.services_catalog?.name || 'N/A',
          es.quantity,
          es.unit,
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

    toast.success("Histórico exportado com sucesso!");
  };

  if (isLoading) {
    return <div className="text-center py-8">Carregando histórico...</div>;
  }

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

            <div className="flex items-end">
              <Button onClick={handleExport} className="w-full">
                <Download className="w-4 h-4 mr-2" />
                Exportar
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

      {/* RDO List */}
      <Card>
        <CardHeader>
          <CardTitle>Histórico Detalhado</CardTitle>
          <CardDescription>{getFilteredData().length} RDOs encontrados</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {getFilteredData().map(rdo => (
              <Card key={rdo.id} className="bg-muted/50">
                <CardContent className="pt-6">
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <div className="font-semibold">
                        {new Date(rdo.report_date).toLocaleDateString('pt-BR')}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        Local: {rdo.construction_sites?.name} | Frente: {rdo.service_fronts?.name}
                      </div>
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
    </div>
  );
};
