import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Building2, ClipboardList, FileText, LogOut, Plus, Settings, Bell, Package, TrendingDown, History, Users, Image, Target, TrendingUp, AlertCircle, Warehouse, Wrench, Droplets, BarChart3, Package2 } from "lucide-react";
import { toast } from "sonner";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const Dashboard = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [projects, setProjects] = useState<any[]>([]);
  const [selectedProject, setSelectedProject] = useState<string>("");
  const [projectStats, setProjectStats] = useState<any>(null);
  const [productionStats, setProductionStats] = useState<any>(null);

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        navigate('/auth');
        return;
      }
      
      setUser(session.user);
      await loadProjects();
      await loadProductionStats();
      setIsLoading(false);
    };

    checkAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (!session) {
        navigate('/auth');
      } else {
        setUser(session.user);
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  useEffect(() => {
    if (selectedProject) {
      loadProjectStats(selectedProject);
    }
  }, [selectedProject]);

  const loadProjects = async () => {
    const { data } = await supabase
      .from('projects')
      .select('*')
      .eq('status', 'active')
      .order('created_at', { ascending: false });
    
    if (data && data.length > 0) {
      setProjects(data);
      setSelectedProject(data[0].id);
    }
  };

  const loadProjectStats = async (projectId: string) => {
    try {
      // Buscar RDOs do projeto
      const { data: rdos, error: rdoError } = await supabase
        .from('daily_reports')
        .select('*')
        .eq('project_id', projectId);

      if (rdoError) throw rdoError;

      // Buscar serviços executados
      const { data: services, error: servicesError } = await supabase
        .from('executed_services')
        .select(`
          *,
          daily_reports!inner (project_id)
        `)
        .eq('daily_reports.project_id', projectId);

      if (servicesError) throw servicesError;

      // Buscar pedidos de material
      const { data: materials, error: materialsError } = await supabase
        .from('material_requests')
        .select('*')
        .eq('project_id', projectId);

      if (materialsError) throw materialsError;

      // Buscar fotos de validação
      const { data: photos, error: photosError } = await supabase
        .from('rdo_validation_photos')
        .select(`
          *,
          daily_reports!inner (project_id)
        `)
        .eq('daily_reports.project_id', projectId);

      if (photosError) throw photosError;

      setProjectStats({
        totalRDOs: rdos?.length || 0,
        totalServices: services?.length || 0,
        totalMaterials: materials?.length || 0,
        totalPhotos: photos?.length || 0,
        pendingMaterials: materials?.filter(m => m.status === 'pendente').length || 0
      });
    } catch (error: any) {
      console.error('Error loading project stats:', error);
    }
  };

  const loadProductionStats = async () => {
    try {
      // Últimos 7 dias
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      const dateFilter = sevenDaysAgo.toISOString().split('T')[0];

      // Buscar metas e produção
      const { data: targets, error: targetsError } = await supabase
        .from('production_targets')
        .select(`
          *,
          services_catalog (name, unit)
        `)
        .gte('target_date', dateFilter);

      if (targetsError) throw targetsError;

      const { data: executed, error: executedError } = await supabase
        .from('executed_services')
        .select(`
          *,
          daily_reports!inner (report_date),
          services_catalog (name)
        `)
        .gte('daily_reports.report_date', dateFilter);

      if (executedError) throw executedError;

      const totalPlanned = targets?.reduce((sum, t) => sum + Number(t.target_quantity), 0) || 0;
      const totalExecuted = executed?.reduce((sum, e) => sum + Number(e.quantity), 0) || 0;
      const completionRate = totalPlanned > 0 ? (totalExecuted / totalPlanned) * 100 : 0;

      setProductionStats({
        totalPlanned,
        totalExecuted,
        completionRate: Math.round(completionRate),
        totalTargets: targets?.length || 0,
        servicesExecuted: executed?.length || 0
      });
    } catch (error: any) {
      console.error('Error loading production stats:', error);
    }
  };

  const handleSignOut = async () => {
    try {
      await supabase.auth.signOut();
      toast.success("Logout realizado com sucesso!");
      navigate('/');
    } catch (error) {
      toast.error("Erro ao fazer logout");
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/5 via-background to-secondary/5">
        <div className="text-center">
          <Building2 className="w-12 h-12 mx-auto text-primary animate-pulse mb-4" />
          <p className="text-muted-foreground">Carregando...</p>
        </div>
      </div>
    );
  }

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-gradient-to-br from-primary/5 via-background to-secondary/5">
        <AppSidebar />
        
        <div className="flex-1 flex flex-col">
          {/* Header */}
          <header className="border-b bg-card/50 backdrop-blur-sm sticky top-0 z-10">
            <div className="container mx-auto px-4 py-4 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <SidebarTrigger />
                <div className="flex items-center gap-2 text-primary">
                  <Building2 className="w-8 h-8" />
                  <span className="text-2xl font-bold">ConstruData</span>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <span className="text-sm text-muted-foreground hidden sm:inline">
                  {user?.user_metadata?.name || user?.email}
                </span>
                <Button variant="ghost" size="icon" onClick={() => navigate('/settings')}>
                  <Settings className="w-5 h-5" />
                </Button>
                <Button variant="ghost" size="icon" onClick={handleSignOut} title="Sair">
                  <LogOut className="w-5 h-5" />
                </Button>
              </div>
            </div>
          </header>

          {/* Main Content */}
          <main className="container mx-auto px-3 sm:px-4 py-4 sm:py-8 flex-1">
        <div className="mb-6 sm:mb-8">
          <h1 className="text-2xl sm:text-3xl font-bold mb-2">Bem-vindo ao ConstruData</h1>
          <p className="text-sm sm:text-base text-muted-foreground">
            Gerencie suas obras com eficiência e precisão
          </p>
        </div>

        <Tabs defaultValue="geral" className="space-y-6">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="geral">Dashboard Geral</TabsTrigger>
            <TabsTrigger value="producao">Dashboard de Produção</TabsTrigger>
            <TabsTrigger value="projeto">Por Projeto</TabsTrigger>
          </TabsList>

          {/* Dashboard Geral */}
          <TabsContent value="geral" className="space-y-6">
        {/* Quick Actions */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
          <Card className="hover:shadow-card transition-all duration-300 border-primary/20 hover:border-primary/50 cursor-pointer group" onClick={() => navigate('/projects')}>
            <CardHeader>
              <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-lg bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center text-primary-foreground mb-3 sm:mb-4 group-hover:scale-110 transition-transform">
                <Building2 className="w-5 h-5 sm:w-6 sm:h-6" />
              </div>
              <CardTitle className="text-base sm:text-lg">Projetos</CardTitle>
              <CardDescription className="text-sm">
                Gerencie seus projetos
              </CardDescription>
            </CardHeader>
          </Card>

          <Card className="hover:shadow-card transition-all duration-300 border-primary/20 hover:border-primary/50 cursor-pointer group" onClick={() => navigate('/rdo-new')}>
            <CardHeader>
              <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-lg bg-gradient-to-br from-accent to-accent/70 flex items-center justify-center text-accent-foreground mb-3 sm:mb-4 group-hover:scale-110 transition-transform">
                <Plus className="w-5 h-5 sm:w-6 sm:h-6" />
              </div>
              <CardTitle className="text-base sm:text-lg">Novo RDO</CardTitle>
              <CardDescription className="text-sm">
                Criar relatório diário
              </CardDescription>
            </CardHeader>
          </Card>

          <Card className="hover:shadow-card transition-all duration-300 border-primary/20 hover:border-primary/50 cursor-pointer group" onClick={() => navigate('/rdo-history')}>
            <CardHeader>
              <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-lg bg-gradient-to-br from-purple-500 to-purple-400 flex items-center justify-center text-white mb-3 sm:mb-4 group-hover:scale-110 transition-transform">
                <History className="w-5 h-5 sm:w-6 sm:h-6" />
              </div>
              <CardTitle className="text-base sm:text-lg">Histórico de RDOs</CardTitle>
              <CardDescription className="text-sm">
                Visualize e analise RDOs
              </CardDescription>
            </CardHeader>
          </Card>

          <Card className="hover:shadow-card transition-all duration-300 border-primary/20 hover:border-primary/50 cursor-pointer group" onClick={() => navigate('/rdo-photos')}>
            <CardHeader>
              <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-lg bg-gradient-to-br from-pink-500 to-pink-400 flex items-center justify-center text-white mb-3 sm:mb-4 group-hover:scale-110 transition-transform">
                <Image className="w-5 h-5 sm:w-6 sm:h-6" />
              </div>
              <CardTitle className="text-base sm:text-lg">Fotos de Validação</CardTitle>
              <CardDescription className="text-sm">
                Consulte fotos dos RDOs
              </CardDescription>
            </CardHeader>
          </Card>

          <Card className="hover:shadow-card transition-all duration-300 border-primary/20 hover:border-primary/50 cursor-pointer group" onClick={() => navigate('/production-control')}>
            <CardHeader>
              <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-lg bg-gradient-to-br from-secondary to-secondary/70 flex items-center justify-center text-secondary-foreground mb-3 sm:mb-4 group-hover:scale-110 transition-transform">
                <ClipboardList className="w-5 h-5 sm:w-6 sm:h-6" />
              </div>
              <CardTitle className="text-base sm:text-lg">Controle de Produção</CardTitle>
              <CardDescription className="text-sm">
                Dashboards e análises
              </CardDescription>
            </CardHeader>
          </Card>

          <Card className="hover:shadow-card transition-all duration-300 border-primary/20 hover:border-primary/50 cursor-pointer group" onClick={() => navigate('/material-requests')}>
            <CardHeader>
              <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-lg bg-gradient-to-br from-blue-500 to-blue-400 flex items-center justify-center text-white mb-3 sm:mb-4 group-hover:scale-110 transition-transform">
                <Package className="w-5 h-5 sm:w-6 sm:h-6" />
              </div>
              <CardTitle className="text-base sm:text-lg">Pedidos de Material</CardTitle>
              <CardDescription className="text-sm">
                Solicite materiais
              </CardDescription>
            </CardHeader>
          </Card>

          <Card className="hover:shadow-card transition-all duration-300 border-primary/20 hover:border-primary/50 cursor-pointer group" onClick={() => navigate('/material-control')}>
            <CardHeader>
              <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-lg bg-gradient-to-br from-green-500 to-green-400 flex items-center justify-center text-white mb-3 sm:mb-4 group-hover:scale-110 transition-transform">
                <TrendingDown className="w-5 h-5 sm:w-6 sm:h-6" />
              </div>
              <CardTitle className="text-base sm:text-lg">Controle de Material</CardTitle>
              <CardDescription className="text-sm">
                Monitore consumo
              </CardDescription>
            </CardHeader>
          </Card>

          <Card className="hover:shadow-card transition-all duration-300 border-primary/20 hover:border-primary/50 cursor-pointer group" onClick={() => navigate('/inventory')}>
            <CardHeader>
              <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-lg bg-gradient-to-br from-amber-500 to-amber-400 flex items-center justify-center text-white mb-3 sm:mb-4 group-hover:scale-110 transition-transform">
                <Warehouse className="w-5 h-5 sm:w-6 sm:h-6" />
              </div>
              <CardTitle className="text-base sm:text-lg">Almoxarifado</CardTitle>
              <CardDescription className="text-sm">
                Gerencie estoque
              </CardDescription>
            </CardHeader>
          </Card>

          <Card className="hover:shadow-card transition-all duration-300 border-primary/20 hover:border-primary/50 cursor-pointer group" onClick={() => navigate('/alerts')}>
            <CardHeader>
              <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-lg bg-gradient-to-br from-destructive to-destructive/70 flex items-center justify-center text-destructive-foreground mb-3 sm:mb-4 group-hover:scale-110 transition-transform">
                <Bell className="w-5 h-5 sm:w-6 sm:h-6" />
              </div>
              <CardTitle className="text-base sm:text-lg">Alertas</CardTitle>
              <CardDescription className="text-sm">
                Configure notificações
              </CardDescription>
            </CardHeader>
          </Card>

          <Card className="hover:shadow-card transition-all duration-300 border-primary/20 hover:border-primary/50 cursor-pointer group" onClick={() => navigate('/employees')}>
            <CardHeader>
              <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-lg bg-gradient-to-br from-orange-500 to-orange-400 flex items-center justify-center text-white mb-3 sm:mb-4 group-hover:scale-110 transition-transform">
                <Users className="w-5 h-5 sm:w-6 sm:h-6" />
              </div>
              <CardTitle className="text-base sm:text-lg">Funcionários</CardTitle>
              <CardDescription className="text-sm">
                Gerencie funcionários
              </CardDescription>
            </CardHeader>
          </Card>
        </div>

        {/* Facility Management Section */}
        <div className="mt-8">
          <h2 className="text-xl font-bold mb-4">Gestão Predial</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
            <Card className="hover:shadow-card transition-all duration-300 border-primary/20 hover:border-primary/50 cursor-pointer group" onClick={() => navigate('/assets-catalog')}>
              <CardHeader>
                <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-lg bg-gradient-to-br from-teal-500 to-teal-400 flex items-center justify-center text-white mb-3 sm:mb-4 group-hover:scale-110 transition-transform">
                  <Package2 className="w-5 h-5 sm:w-6 sm:h-6" />
                </div>
                <CardTitle className="text-base sm:text-lg">Catálogo de Ativos</CardTitle>
                <CardDescription className="text-sm">
                  Gerencie equipamentos
                </CardDescription>
              </CardHeader>
            </Card>

            <Card className="hover:shadow-card transition-all duration-300 border-primary/20 hover:border-primary/50 cursor-pointer group" onClick={() => navigate('/maintenance-tasks')}>
              <CardHeader>
                <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-lg bg-gradient-to-br from-indigo-500 to-indigo-400 flex items-center justify-center text-white mb-3 sm:mb-4 group-hover:scale-110 transition-transform">
                  <Wrench className="w-5 h-5 sm:w-6 sm:h-6" />
                </div>
                <CardTitle className="text-base sm:text-lg">Tarefas de Manutenção</CardTitle>
                <CardDescription className="text-sm">
                  Controle de manutenções
                </CardDescription>
              </CardHeader>
            </Card>

            <Card className="hover:shadow-card transition-all duration-300 border-primary/20 hover:border-primary/50 cursor-pointer group" onClick={() => navigate('/consumption-control')}>
              <CardHeader>
                <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-lg bg-gradient-to-br from-cyan-500 to-cyan-400 flex items-center justify-center text-white mb-3 sm:mb-4 group-hover:scale-110 transition-transform">
                  <Droplets className="w-5 h-5 sm:w-6 sm:h-6" />
                </div>
                <CardTitle className="text-base sm:text-lg">Controle de Consumo</CardTitle>
                <CardDescription className="text-sm">
                  Monitore utilidades
                </CardDescription>
              </CardHeader>
            </Card>

            <Card className="hover:shadow-card transition-all duration-300 border-primary/20 hover:border-primary/50 cursor-pointer group" onClick={() => navigate('/facility-reports')}>
              <CardHeader>
                <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-lg bg-gradient-to-br from-violet-500 to-violet-400 flex items-center justify-center text-white mb-3 sm:mb-4 group-hover:scale-110 transition-transform">
                  <BarChart3 className="w-5 h-5 sm:w-6 sm:h-6" />
                </div>
                <CardTitle className="text-base sm:text-lg">Relatórios Prediais</CardTitle>
                <CardDescription className="text-sm">
                  Análises e gráficos
                </CardDescription>
              </CardHeader>
            </Card>
          </div>
        </div>
          </TabsContent>

          {/* Dashboard de Produção */}
          <TabsContent value="producao" className="space-y-6">
            {productionStats ? (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                  <Card>
                    <CardHeader className="pb-2">
                      <CardDescription>Total Planejado</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold text-primary">
                        {productionStats.totalPlanned.toFixed(2)}
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        {productionStats.totalTargets} metas definidas
                      </p>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="pb-2">
                      <CardDescription>Total Executado</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold text-secondary">
                        {productionStats.totalExecuted.toFixed(2)}
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        {productionStats.servicesExecuted} serviços
                      </p>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="pb-2">
                      <CardDescription>Taxa de Conclusão</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className={`text-2xl font-bold flex items-center gap-2 ${
                        productionStats.completionRate >= 100 ? 'text-green-600' : 
                        productionStats.completionRate >= 80 ? 'text-yellow-600' : 'text-red-600'
                      }`}>
                        {productionStats.completionRate}%
                        <TrendingUp className="w-5 h-5" />
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        Últimos 7 dias
                      </p>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="pb-2">
                      <CardDescription>Status</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="flex items-center gap-2">
                        {productionStats.completionRate >= 90 ? (
                          <>
                            <Target className="w-8 h-8 text-green-600" />
                            <div>
                              <p className="font-semibold text-green-600">Excelente</p>
                              <p className="text-xs text-muted-foreground">Acima da meta</p>
                            </div>
                          </>
                        ) : productionStats.completionRate >= 70 ? (
                          <>
                            <AlertCircle className="w-8 h-8 text-yellow-600" />
                            <div>
                              <p className="font-semibold text-yellow-600">Atenção</p>
                              <p className="text-xs text-muted-foreground">Próximo da meta</p>
                            </div>
                          </>
                        ) : (
                          <>
                            <AlertCircle className="w-8 h-8 text-red-600" />
                            <div>
                              <p className="font-semibold text-red-600">Crítico</p>
                              <p className="text-xs text-muted-foreground">Abaixo da meta</p>
                            </div>
                          </>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </div>

                <Card>
                  <CardHeader>
                    <CardTitle>Acesso Rápido</CardTitle>
                    <CardDescription>Ferramentas de produção</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <Button onClick={() => navigate('/production-control')} className="h-auto py-4 flex-col gap-2">
                        <ClipboardList className="w-6 h-6" />
                        <span>Ver Controle Completo</span>
                      </Button>
                      <Button onClick={() => navigate('/rdo-new')} variant="outline" className="h-auto py-4 flex-col gap-2">
                        <Plus className="w-6 h-6" />
                        <span>Novo RDO</span>
                      </Button>
                      <Button onClick={() => navigate('/rdo-history')} variant="outline" className="h-auto py-4 flex-col gap-2">
                        <History className="w-6 h-6" />
                        <span>Histórico</span>
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </>
            ) : (
              <Card>
                <CardContent className="flex items-center justify-center py-12">
                  <div className="text-center">
                    <ClipboardList className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                    <p className="text-muted-foreground">Carregando dados de produção...</p>
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Dashboard por Projeto */}
          <TabsContent value="projeto" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Selecione um Projeto</CardTitle>
                <CardDescription>Visualize estatísticas específicas de cada projeto</CardDescription>
              </CardHeader>
              <CardContent>
                <Select value={selectedProject} onValueChange={setSelectedProject}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o projeto" />
                  </SelectTrigger>
                  <SelectContent>
                    {projects.map(project => (
                      <SelectItem key={project.id} value={project.id}>
                        {project.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </CardContent>
            </Card>

            {selectedProject && projectStats ? (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                  <Card>
                    <CardHeader className="pb-2">
                      <CardDescription>Total de RDOs</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold text-primary">
                        {projectStats.totalRDOs}
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        Relatórios registrados
                      </p>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="pb-2">
                      <CardDescription>Serviços Executados</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold text-secondary">
                        {projectStats.totalServices}
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        Total de execuções
                      </p>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="pb-2">
                      <CardDescription>Pedidos de Material</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold text-blue-600">
                        {projectStats.totalMaterials}
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        {projectStats.pendingMaterials} pendentes
                      </p>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="pb-2">
                      <CardDescription>Fotos de Validação</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold text-pink-600">
                        {projectStats.totalPhotos}
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        Fotos registradas
                      </p>
                    </CardContent>
                  </Card>
                </div>

                <Card>
                  <CardHeader>
                    <CardTitle>Acesso Rápido ao Projeto</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                      <Button onClick={() => navigate('/rdo-new')} className="h-auto py-4 flex-col gap-2">
                        <Plus className="w-6 h-6" />
                        <span>Novo RDO</span>
                      </Button>
                      <Button onClick={() => navigate('/rdo-history')} variant="outline" className="h-auto py-4 flex-col gap-2">
                        <History className="w-6 h-6" />
                        <span>Ver RDOs</span>
                      </Button>
                      <Button onClick={() => navigate('/rdo-photos')} variant="outline" className="h-auto py-4 flex-col gap-2">
                        <Image className="w-6 h-6" />
                        <span>Ver Fotos</span>
                      </Button>
                      <Button onClick={() => navigate('/material-requests')} variant="outline" className="h-auto py-4 flex-col gap-2">
                        <Package className="w-6 h-6" />
                        <span>Ver Materiais</span>
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </>
            ) : (
              <Card>
                <CardContent className="flex items-center justify-center py-12">
                  <div className="text-center">
                    <Building2 className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                    <p className="text-muted-foreground">Selecione um projeto para ver as estatísticas</p>
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>


        {/* Recent Activity - Compact */}
        <Card className="mt-6">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Atividades Recentes</CardTitle>
            <CardDescription className="text-xs">
              Suas últimas ações no sistema
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-center py-4 text-muted-foreground">
              <FileText className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p className="text-xs">Nenhuma atividade recente</p>
              <p className="text-xs">Comece criando sua primeira obra</p>
            </div>
          </CardContent>
        </Card>
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
};

export default Dashboard;
