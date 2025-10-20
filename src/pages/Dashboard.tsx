import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Building2, ClipboardList, FileText, LogOut, Plus, Settings, Bell, Package, TrendingDown, History, Users } from "lucide-react";
import { toast } from "sonner";

const Dashboard = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        navigate('/auth');
        return;
      }
      
      setUser(session.user);
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
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-secondary/5">
      {/* Header */}
      <header className="border-b bg-card/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2 text-primary">
            <Building2 className="w-8 h-8" />
            <span className="text-2xl font-bold">ConstruData</span>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm text-muted-foreground hidden sm:inline">
              {user?.user_metadata?.name || user?.email}
            </span>
            <Button variant="ghost" size="icon">
              <Settings className="w-5 h-5" />
            </Button>
            <Button variant="ghost" size="icon" onClick={handleSignOut} title="Sair">
              <LogOut className="w-5 h-5" />
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-3 sm:px-4 py-4 sm:py-8">
        <div className="mb-6 sm:mb-8">
          <h1 className="text-2xl sm:text-3xl font-bold mb-2">Bem-vindo ao ConstruData</h1>
          <p className="text-sm sm:text-base text-muted-foreground">
            Gerencie suas obras com eficiência e precisão
          </p>
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 mb-6 sm:mb-8">
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


        {/* Recent Activity */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base sm:text-lg">Atividades Recentes</CardTitle>
            <CardDescription className="text-sm">
              Suas últimas ações no sistema
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-center py-8 sm:py-12 text-muted-foreground">
              <FileText className="w-10 h-10 sm:w-12 sm:h-12 mx-auto mb-3 sm:mb-4 opacity-50" />
              <p className="text-sm sm:text-base">Nenhuma atividade recente</p>
              <p className="text-xs sm:text-sm">Comece criando sua primeira obra</p>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default Dashboard;
