import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { SidebarProvider } from '@/components/ui/sidebar';
import { AppSidebar } from '@/components/AppSidebar';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Plus, LayoutDashboard, Settings, Star, Trash2 } from 'lucide-react';
import { useCustomDashboard } from '@/hooks/useCustomDashboard';
import { useDashboardData } from '@/hooks/useDashboardData';
import { DashboardFilters } from '@/components/custom-dashboard/DashboardFilters';
import { KPIWidget } from '@/components/custom-dashboard/widgets/KPIWidget';
import { ProductionChartWidget } from '@/components/custom-dashboard/widgets/ProductionChartWidget';
import { ProductionTableWidget } from '@/components/custom-dashboard/widgets/ProductionTableWidget';
import { TeamPerformanceWidget } from '@/components/custom-dashboard/widgets/TeamPerformanceWidget';

export default function CustomDashboard() {
  const navigate = useNavigate();
  const [newDashboardName, setNewDashboardName] = useState('');
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);

  const {
    dashboards,
    currentDashboard,
    setCurrentDashboard,
    globalFilters,
    loading: dashboardLoading,
    createDashboard,
    deleteDashboard,
    updateGlobalFilters,
    setAsDefault
  } = useCustomDashboard();

  const {
    productionData,
    kpiData,
    teamData,
    loading: dataLoading,
    refreshData,
    dateRange
  } = useDashboardData(globalFilters, globalFilters.projectIds);

  const handleCreateDashboard = async () => {
    if (!newDashboardName.trim()) return;
    await createDashboard(newDashboardName);
    setNewDashboardName('');
    setIsCreateDialogOpen(false);
  };

  const loading = dashboardLoading || dataLoading;

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full">
        <AppSidebar />
        <main className="flex-1 p-6 overflow-auto">
          {/* Header */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
            <div>
              <h1 className="text-2xl font-bold flex items-center gap-2">
                <LayoutDashboard className="h-6 w-6 text-primary" />
                Dashboard Personalizado
              </h1>
              <p className="text-muted-foreground">
                Monte seu próprio painel de controle
              </p>
            </div>

            <div className="flex items-center gap-2">
              {/* Dashboard Selector */}
              {dashboards.length > 0 && (
                <Select
                  value={currentDashboard?.id || ''}
                  onValueChange={(id) => {
                    const dashboard = dashboards.find(d => d.id === id);
                    if (dashboard) setCurrentDashboard(dashboard);
                  }}
                >
                  <SelectTrigger className="w-[200px]">
                    <SelectValue placeholder="Selecione um dashboard" />
                  </SelectTrigger>
                  <SelectContent>
                    {dashboards.map(d => (
                      <SelectItem key={d.id} value={d.id}>
                        <div className="flex items-center gap-2">
                          {d.is_default && <Star className="h-3 w-3 text-yellow-500" />}
                          {d.name}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}

              {/* Create Dashboard Button */}
              <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
                <DialogTrigger asChild>
                  <Button>
                    <Plus className="h-4 w-4 mr-2" />
                    Novo Dashboard
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Criar Novo Dashboard</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4 pt-4">
                    <div className="space-y-2">
                      <Label>Nome do Dashboard</Label>
                      <Input
                        value={newDashboardName}
                        onChange={(e) => setNewDashboardName(e.target.value)}
                        placeholder="Ex: Produção Semanal"
                      />
                    </div>
                    <Button onClick={handleCreateDashboard} className="w-full">
                      Criar Dashboard
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>

              {currentDashboard && (
                <>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => setAsDefault(currentDashboard.id)}
                    title="Definir como padrão"
                  >
                    <Star className={currentDashboard.is_default ? "h-4 w-4 text-yellow-500 fill-yellow-500" : "h-4 w-4"} />
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => deleteDashboard(currentDashboard.id)}
                    title="Excluir dashboard"
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </>
              )}
            </div>
          </div>

          {/* Filters */}
          <DashboardFilters
            filters={globalFilters}
            onFiltersChange={updateGlobalFilters}
            onRefresh={refreshData}
            loading={loading}
          />

          {/* Dashboard Content */}
          {!currentDashboard && dashboards.length === 0 ? (
            <Card className="p-12 text-center">
              <LayoutDashboard className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
              <h2 className="text-xl font-semibold mb-2">Crie seu primeiro dashboard</h2>
              <p className="text-muted-foreground mb-4">
                Personalize sua visão de dados com widgets interativos
              </p>
              <Button onClick={() => setIsCreateDialogOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Criar Dashboard
              </Button>
            </Card>
          ) : (
            <Tabs defaultValue="overview" className="space-y-6">
              <TabsList>
                <TabsTrigger value="overview">Visão Geral</TabsTrigger>
                <TabsTrigger value="production">Produção</TabsTrigger>
                <TabsTrigger value="team">Equipes</TabsTrigger>
              </TabsList>

              <TabsContent value="overview" className="space-y-6">
                {/* KPI Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  <KPIWidget
                    title="Produção Total"
                    value={kpiData?.total_production || 0}
                    subtitle="No período selecionado"
                    icon="production"
                    targetValue={kpiData?.total_planned}
                  />
                  <KPIWidget
                    title="Taxa de Conclusão"
                    value={kpiData?.completion_rate || 0}
                    format="percent"
                    icon="completion"
                    trend={kpiData?.completion_rate && kpiData.completion_rate >= 80 ? 'up' : 'down'}
                  />
                  <KPIWidget
                    title="Colaboradores Ativos"
                    value={kpiData?.active_employees || 0}
                    icon="employees"
                  />
                  <KPIWidget
                    title="Projetos Ativos"
                    value={kpiData?.active_projects || 0}
                    icon="projects"
                  />
                </div>

                {/* Charts */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <div className="h-[400px]">
                    <ProductionChartWidget
                      title="Evolução da Produção"
                      data={productionData}
                      chartType="bar"
                    />
                  </div>
                  <div className="h-[400px]">
                    <TeamPerformanceWidget
                      title="Desempenho das Equipes"
                      data={teamData}
                      viewMode="chart"
                    />
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="production" className="space-y-6">
                <div className="h-[500px]">
                  <ProductionTableWidget
                    title="Quadro de Produção (Dias x Serviços)"
                    data={productionData}
                    groupBy="service"
                    dateRange={dateRange}
                  />
                </div>
                <div className="h-[400px]">
                  <ProductionChartWidget
                    title="Comparativo Planejado x Realizado"
                    data={productionData}
                    chartType="area"
                  />
                </div>
              </TabsContent>

              <TabsContent value="team" className="space-y-6">
                <div className="h-[500px]">
                  <TeamPerformanceWidget
                    title="Desempenho Individual"
                    data={teamData}
                    viewMode="table"
                  />
                </div>
                <div className="h-[500px]">
                  <ProductionTableWidget
                    title="Produção por Equipe"
                    data={productionData}
                    groupBy="employee"
                    dateRange={dateRange}
                  />
                </div>
              </TabsContent>
            </Tabs>
          )}
        </main>
      </div>
    </SidebarProvider>
  );
}
