import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Building2, ClipboardList, FileText, LogOut, Plus, Settings, Eye, Bell, Package, TrendingDown, History, Users } from "lucide-react";
import { toast } from "sonner";
import { demoUser } from "@/lib/demo-data";

const Dashboard = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const isDemoMode = searchParams.get('demo') === 'true';
  const [user, setUser] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const checkAuth = async () => {
      if (isDemoMode) {
        setUser(demoUser);
        setIsLoading(false);
        return;
      }

      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        navigate('/auth');
        return;
      }
      
      setUser(session.user);
      setIsLoading(false);
    };

    checkAuth();

    if (!isDemoMode) {
      const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
        if (!session) {
          navigate('/auth');
        } else {
          setUser(session.user);
        }
      });

      return () => subscription.unsubscribe();
    }
  }, [navigate, isDemoMode]);

  const handleSignOut = async () => {
    if (isDemoMode) {
      navigate('/');
      return;
    }
    
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
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-secondary/5">
      {/* Header */}
      <header className="border-b bg-card/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2 text-primary">
            <Building2 className="w-8 h-8" />
            <span className="text-2xl font-bold">ConstruData</span>
            {isDemoMode && (
              <span className="text-xs bg-primary/10 text-primary px-2 py-1 rounded-full flex items-center gap-1">
                <Eye className="w-3 h-3" />
                Modo Demo
              </span>
            )}
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm text-muted-foreground hidden sm:inline">
              {user?.user_metadata?.name || user?.email}
            </span>
            {!isDemoMode && (
              <Button variant="ghost" size="icon">
                <Settings className="w-5 h-5" />
              </Button>
            )}
            <Button variant="ghost" size="icon" onClick={handleSignOut} title={isDemoMode ? "Sair do Demo" : "Sair"}>
              <LogOut className="w-5 h-5" />
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        {isDemoMode && (
          <Card className="mb-8 border-primary/50 bg-primary/5">
            <CardContent className="pt-6">
              <div className="flex items-start gap-4">
                <Eye className="w-6 h-6 text-primary flex-shrink-0 mt-1" />
                <div className="flex-1">
                  <h3 className="font-semibold text-lg mb-2">Modo Demonstração</h3>
                  <p className="text-muted-foreground mb-4">
                    Você está navegando no modo demo com dados de exemplo. Para ter acesso completo a todas as funcionalidades, 
                    incluindo criação de obras, salvamento de dados e relatórios personalizados, faça login ou crie sua conta.
                  </p>
                  <Button onClick={() => navigate('/auth')} className="gap-2">
                    Fazer Login / Criar Conta
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Bem-vindo ao ConstruData</h1>
          <p className="text-muted-foreground">
            {isDemoMode ? "Explore as funcionalidades da plataforma" : "Gerencie suas obras com eficiência e precisão"}
          </p>
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
          <Card className="hover:shadow-card transition-all duration-300 border-primary/20 hover:border-primary/50 cursor-pointer group" onClick={() => !isDemoMode && navigate('/projects')}>
            <CardHeader>
              <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center text-primary-foreground mb-4 group-hover:scale-110 transition-transform">
                <Building2 className="w-6 h-6" />
              </div>
              <CardTitle>Projetos</CardTitle>
              <CardDescription>
                {isDemoMode ? "Recurso disponível após login" : "Gerencie seus projetos"}
              </CardDescription>
            </CardHeader>
          </Card>

          <Card className="hover:shadow-card transition-all duration-300 border-primary/20 hover:border-primary/50 cursor-pointer group" onClick={() => navigate(isDemoMode ? '/rdo?demo=true' : '/rdo-new')}>
            <CardHeader>
              <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-accent to-accent/70 flex items-center justify-center text-accent-foreground mb-4 group-hover:scale-110 transition-transform">
                <Plus className="w-6 h-6" />
              </div>
              <CardTitle>Novo RDO</CardTitle>
              <CardDescription>
                {isDemoMode ? "Veja exemplo de RDO" : "Criar relatório diário"}
              </CardDescription>
            </CardHeader>
          </Card>

          <Card className="hover:shadow-card transition-all duration-300 border-primary/20 hover:border-primary/50 cursor-pointer group" onClick={() => navigate(isDemoMode ? '/rdo-history?demo=true' : '/rdo-history')}>
            <CardHeader>
              <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-purple-500 to-purple-400 flex items-center justify-center text-white mb-4 group-hover:scale-110 transition-transform">
                <History className="w-6 h-6" />
              </div>
              <CardTitle>Histórico de RDOs</CardTitle>
              <CardDescription>
                {isDemoMode ? "Recurso disponível após login" : "Visualize e analise RDOs"}
              </CardDescription>
            </CardHeader>
          </Card>

          <Card className="hover:shadow-card transition-all duration-300 border-primary/20 hover:border-primary/50 cursor-pointer group" onClick={() => navigate(isDemoMode ? '/production-control?demo=true' : '/production-control')}>
            <CardHeader>
              <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-secondary to-secondary/70 flex items-center justify-center text-secondary-foreground mb-4 group-hover:scale-110 transition-transform">
                <ClipboardList className="w-6 h-6" />
              </div>
              <CardTitle>Controle de Produção</CardTitle>
              <CardDescription>
                {isDemoMode ? "Veja dashboards de exemplo" : "Dashboards e análises"}
              </CardDescription>
            </CardHeader>
          </Card>

          <Card className="hover:shadow-card transition-all duration-300 border-primary/20 hover:border-primary/50 cursor-pointer group" onClick={() => navigate(isDemoMode ? '/material-requests?demo=true' : '/material-requests')}>
            <CardHeader>
              <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-blue-500 to-blue-400 flex items-center justify-center text-white mb-4 group-hover:scale-110 transition-transform">
                <Package className="w-6 h-6" />
              </div>
              <CardTitle>Pedidos de Material</CardTitle>
              <CardDescription>
                {isDemoMode ? "Veja exemplo de pedidos" : "Solicite materiais"}
              </CardDescription>
            </CardHeader>
          </Card>

          <Card className="hover:shadow-card transition-all duration-300 border-primary/20 hover:border-primary/50 cursor-pointer group" onClick={() => navigate(isDemoMode ? '/material-control?demo=true' : '/material-control')}>
            <CardHeader>
              <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-green-500 to-green-400 flex items-center justify-center text-white mb-4 group-hover:scale-110 transition-transform">
                <TrendingDown className="w-6 h-6" />
              </div>
              <CardTitle>Controle de Material</CardTitle>
              <CardDescription>
                {isDemoMode ? "Veja exemplo de controle" : "Monitore consumo"}
              </CardDescription>
            </CardHeader>
          </Card>

          <Card className="hover:shadow-card transition-all duration-300 border-primary/20 hover:border-primary/50 cursor-pointer group" onClick={() => navigate(isDemoMode ? '/alerts?demo=true' : '/alerts')}>
            <CardHeader>
              <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-destructive to-destructive/70 flex items-center justify-center text-destructive-foreground mb-4 group-hover:scale-110 transition-transform">
                <Bell className="w-6 h-6" />
              </div>
              <CardTitle>Alertas</CardTitle>
              <CardDescription>
                Configure notificações
              </CardDescription>
            </CardHeader>
          </Card>

          <Card className="hover:shadow-card transition-all duration-300 border-primary/20 hover:border-primary/50 cursor-pointer group" onClick={() => navigate(isDemoMode ? '/employees?demo=true' : '/employees')}>
            <CardHeader>
              <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-orange-500 to-orange-400 flex items-center justify-center text-white mb-4 group-hover:scale-110 transition-transform">
                <Users className="w-6 h-6" />
              </div>
              <CardTitle>Funcionários</CardTitle>
              <CardDescription>
                {isDemoMode ? "Veja exemplo de gestão" : "Gerencie funcionários"}
              </CardDescription>
            </CardHeader>
          </Card>
        </div>


        {/* Recent Activity */}
        <Card>
          <CardHeader>
            <CardTitle>Atividades Recentes</CardTitle>
            <CardDescription>
              Suas últimas ações no sistema
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-center py-12 text-muted-foreground">
              <FileText className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>Nenhuma atividade recente</p>
              <p className="text-sm">Comece criando sua primeira obra</p>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default Dashboard;
