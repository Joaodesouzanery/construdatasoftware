import { Button } from "@/components/ui/button";
import { ArrowRight, Building2, ClipboardList, Camera, Eye, BarChart3, Package, Users, Bell, TrendingUp, Shield, Clock } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const Hero = () => {
  const navigate = useNavigate();

  const features = [
    {
      icon: <Building2 className="w-6 h-6" />,
      title: "Gestão de Projetos",
      description: "Controle obras com status 'Em andamento' sem data final definida",
      link: "/projects"
    },
    {
      icon: <BarChart3 className="w-6 h-6" />,
      title: "Controle de Produção",
      description: "Acompanhe metas diárias, semanais e mensais com análise em tempo real",
      link: "/production-control"
    },
    {
      icon: <ClipboardList className="w-6 h-6" />,
      title: "RDO Digital",
      description: "Relatórios Diários de Obra com fotos, clima e validação por GPS",
      link: "/rdo"
    },
    {
      icon: <Package className="w-6 h-6" />,
      title: "Pedidos de Material",
      description: "Solicite materiais com rastreamento de solicitante e status",
      link: "/material-requests"
    },
    {
      icon: <TrendingUp className="w-6 h-6" />,
      title: "Controle de Material",
      description: "Compare requisições vs consumo real por frente de serviço",
      link: "/material-control"
    },
    {
      icon: <Users className="w-6 h-6" />,
      title: "Gestão de Equipe",
      description: "Cadastre funcionários, empresas e controle acessos",
      link: "/employees"
    },
    {
      icon: <Bell className="w-6 h-6" />,
      title: "Alertas Inteligentes",
      description: "Notificações com justificativas obrigatórias para desvios",
      link: "/alerts"
    },
    {
      icon: <Camera className="w-6 h-6" />,
      title: "Registro Multimídia",
      description: "Anexe fotos, vídeos e áudios com validação georreferenciada",
      link: "/rdo/new"
    }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-secondary/5">
      {/* Hero Section */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-grid-pattern opacity-[0.02]" />
        
        <div className="container relative z-10 px-4 py-20 mx-auto">
          <div className="max-w-4xl mx-auto text-center space-y-8 animate-fade-in">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary border border-primary/20">
              <Building2 className="w-4 h-4" />
              <span className="text-sm font-medium">Gestão de Obras Inteligente</span>
            </div>
            
            <h1 className="text-5xl md:text-7xl font-bold tracking-tight">
              <span className="bg-gradient-to-r from-primary via-primary to-secondary bg-clip-text text-transparent">
                ConstruData
              </span>
            </h1>
            
            <p className="text-xl md:text-2xl text-muted-foreground max-w-2xl mx-auto leading-relaxed">
              Plataforma completa para gestão de obras com Controle de Produção, RDO e Alertas Inteligentes
            </p>
            
            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center pt-4">
              <Button 
                size="lg" 
                onClick={() => navigate('/auth')}
                className="w-full sm:w-auto bg-gradient-to-r from-primary to-primary/90 hover:shadow-lg hover:shadow-primary/50 transition-all duration-300 group"
              >
                Começar Agora
                <ArrowRight className="ml-2 w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </Button>
              <Button 
                size="lg" 
                variant="outline"
                onClick={() => navigate('/dashboard')}
                className="w-full sm:w-auto border-primary/30 hover:bg-primary/10 hover:border-primary/50 transition-all"
              >
                <Eye className="mr-2 w-5 h-5" />
                Ver Dashboard
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section className="container px-4 py-16 mx-auto">
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">Funcionalidades Completas</h2>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
            Todas as ferramentas necessárias para gerenciar suas obras com eficiência
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-7xl mx-auto">
          {features.map((feature, index) => (
            <Card 
              key={index}
              className="group cursor-pointer hover:shadow-lg hover:border-primary/50 transition-all duration-300"
              onClick={() => navigate(feature.link)}
            >
              <CardHeader>
                <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center text-primary-foreground mb-4 group-hover:scale-110 transition-transform">
                  {feature.icon}
                </div>
                <CardTitle className="text-lg">{feature.title}</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription className="text-sm">{feature.description}</CardDescription>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* Benefits Section */}
      <section className="container px-4 py-16 mx-auto">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">Por que ConstruData?</h2>
            <p className="text-muted-foreground text-lg">
              Recursos que fazem a diferença no dia a dia da sua obra
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <BenefitCard
              icon={<Clock className="w-8 h-8" />}
              title="Controle em Tempo Real"
              description="Acompanhe produção diária, semanal e mensal com gráficos e análises instantâneas"
            />
            <BenefitCard
              icon={<Shield className="w-8 h-8" />}
              title="Justificativas Obrigatórias"
              description="Sistema de alertas com justificativas para todos os desvios de meta e problemas"
            />
            <BenefitCard
              icon={<TrendingUp className="w-8 h-8" />}
              title="Análise Comparativa"
              description="Compare pedidos vs consumo real de materiais por frente de serviço"
            />
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="container px-4 py-20 mx-auto">
        <div className="max-w-4xl mx-auto text-center bg-gradient-to-r from-primary/10 to-secondary/10 rounded-2xl p-12 border border-primary/20">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">
            Pronto para transformar sua gestão de obras?
          </h2>
          <p className="text-muted-foreground text-lg mb-8 max-w-2xl mx-auto">
            Comece agora e tenha controle total sobre projetos, produção, materiais e equipe
          </p>
          <Button 
            size="lg"
            onClick={() => navigate('/auth')}
            className="bg-gradient-to-r from-primary to-primary/90 hover:shadow-lg hover:shadow-primary/50 transition-all duration-300"
          >
            Criar Conta Grátis
            <ArrowRight className="ml-2 w-5 h-5" />
          </Button>
        </div>
      </section>
    </div>
  );
};

const BenefitCard = ({ icon, title, description }: { icon: React.ReactNode; title: string; description: string }) => (
  <div className="text-center space-y-4">
    <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center text-primary-foreground mx-auto">
      {icon}
    </div>
    <h3 className="text-xl font-semibold">{title}</h3>
    <p className="text-muted-foreground">{description}</p>
  </div>
);

export default Hero;
