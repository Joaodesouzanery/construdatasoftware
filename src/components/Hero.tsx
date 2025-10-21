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
    <div className="min-h-screen bg-background dark:bg-background">
      {/* Navbar */}
      <nav className="sticky top-0 z-50 bg-card/95 backdrop-blur-sm border-b border-border/50">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-2">
              <Building2 className="w-8 h-8 text-primary" />
              <span className="text-xl font-bold text-primary">ConstruData</span>
            </div>
            <Button 
              onClick={() => navigate('/auth')}
              className="bg-primary hover:bg-primary/90"
            >
              Fazer Orçamento
            </Button>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative overflow-hidden py-20 md:py-32">
        {/* Background gradient effects */}
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute top-0 left-1/4 w-96 h-96 bg-primary/20 rounded-full blur-[120px]" />
          <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-accent/20 rounded-full blur-[120px]" />
        </div>
        
        <div className="container relative z-10 px-4 mx-auto">
          <div className="max-w-5xl mx-auto text-center space-y-8 animate-fade-in">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary border border-primary/20 text-sm font-medium uppercase tracking-wide">
              <span className="text-primary">GESTÃO DE OBRAS DE PONTA A PONTA</span>
            </div>
            
            <h1 className="text-4xl md:text-6xl lg:text-7xl font-bold tracking-tight leading-tight">
              <span className="bg-gradient-to-r from-accent via-primary to-secondary bg-clip-text text-transparent">
                Garanta o mesmo nível de controle
              </span>
              <br />
              <span className="text-foreground">
                das Empresas líderes do mercado
              </span>
            </h1>
            
            <p className="text-lg md:text-xl text-muted-foreground max-w-3xl mx-auto leading-relaxed">
              Controle projetos, produção e equipes com tecnologia de ponta e monitoramento contínuo para garantir o sucesso total da sua obra.
            </p>
            
            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center pt-6">
              <Button 
                size="lg" 
                onClick={() => navigate('/dashboard')}
                variant="outline"
                className="w-full sm:w-auto border-white/80 hover:bg-primary/10 hover:border-white transition-all text-base"
              >
                Ver mais
              </Button>
              <Button 
                size="lg" 
                onClick={() => navigate('/auth')}
                className="w-full sm:w-auto bg-card text-card-foreground hover:bg-card/90 shadow-lg hover:shadow-xl transition-all duration-300 group text-base font-semibold"
              >
                Contratar Agora
                <ArrowRight className="ml-2 w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section className="container px-4 py-20 mx-auto">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-5xl font-bold mb-4">Funcionalidades Completas</h2>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
            Todas as ferramentas necessárias para gerenciar suas obras com eficiência
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-7xl mx-auto">
          {features.map((feature, index) => (
            <Card 
              key={index}
              className="group cursor-pointer hover:shadow-xl hover:shadow-primary/10 hover:border-primary/50 transition-all duration-300 bg-card"
              onClick={() => navigate(feature.link)}
            >
              <CardHeader>
                <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center text-primary-foreground mb-4 group-hover:scale-110 transition-transform shadow-lg shadow-primary/20">
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

      {/* Security Trust Section */}
      <section className="container px-4 py-20 mx-auto">
        <div className="max-w-6xl mx-auto bg-card rounded-3xl p-8 md:p-12 shadow-2xl border border-border/50">
          <div className="text-center mb-12">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary border border-primary/20 mb-6 text-sm font-semibold uppercase tracking-wide">
              <Shield className="w-4 h-4 text-primary" />
              <span className="text-primary">Segurança Empresarial</span>
            </div>
            <h2 className="text-3xl md:text-5xl font-bold mb-4 text-primary">Seus Dados Protegidos</h2>
            <p className="text-primary text-lg max-w-3xl mx-auto">
              Segurança de nível empresarial para proteger informações confidenciais da sua empresa
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
            <SecurityFeature
              icon="🔐"
              title="Autenticação Segura"
              description="Login protegido com validação de senha e proteção contra vazamentos"
            />
            <SecurityFeature
              icon="🛡️"
              title="Isolamento de Dados"
              description="Cada empresa acessa apenas seus próprios dados de projetos e equipes"
            />
            <SecurityFeature
              icon="🔒"
              title="APIs Protegidas"
              description="Todas as funções de backend requerem autenticação e verificam permissões"
            />
            <SecurityFeature
              icon="👥"
              title="Controle de Acesso"
              description="Dados de funcionários e locais visíveis apenas para proprietários do projeto"
            />
          </div>

          <div className="p-6 bg-primary/5 rounded-xl border border-primary/20">
            <div className="flex flex-col md:flex-row items-start md:items-center gap-4">
              <div className="flex-shrink-0">
                <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                  <Shield className="w-6 h-6 text-primary" />
                </div>
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-lg mb-2 text-primary">Proteção de Dados Confidenciais</h3>
                <p className="text-sm text-primary/80">
                  Informações sensíveis como dados de funcionários, localização de obras, métricas de produção e custos de materiais 
                  são protegidas por políticas de segurança em nível de linha (RLS). Concorrentes não podem acessar seus dados, 
                  mesmo criando uma conta gratuita.
                </p>
              </div>
            </div>
          </div>

          <div className="mt-8 text-center">
            <p className="text-sm text-muted-foreground">
              ✓ Criptografia end-to-end &nbsp;•&nbsp; ✓ Políticas de segurança em nível de linha &nbsp;•&nbsp; ✓ Autenticação JWT
            </p>
          </div>
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
        <div className="max-w-4xl mx-auto text-center bg-card rounded-3xl p-12 md:p-16 shadow-2xl border border-border/50 relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-accent/5" />
          <div className="relative z-10">
            <h2 className="text-3xl md:text-5xl font-bold mb-6 text-primary">
              Pronto para transformar sua gestão de obras?
            </h2>
            <p className="text-muted-foreground text-lg mb-10 max-w-2xl mx-auto">
              Comece agora e tenha controle total sobre projetos, produção, materiais e equipe
            </p>
            <Button 
              size="lg"
              onClick={() => navigate('/auth')}
              className="bg-card text-card-foreground hover:bg-card/90 shadow-lg hover:shadow-xl transition-all duration-300 text-base font-semibold px-8"
            >
              Criar Conta Grátis
              <ArrowRight className="ml-2 w-5 h-5" />
            </Button>
          </div>
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

const SecurityFeature = ({ icon, title, description }: { icon: string; title: string; description: string }) => (
  <div className="bg-background/50 p-6 rounded-xl border border-border hover:border-primary/50 transition-all duration-300 hover:shadow-lg hover:shadow-primary/5">
    <div className="text-4xl mb-3">{icon}</div>
    <h3 className="font-semibold mb-2 text-sm text-white">{title}</h3>
    <p className="text-xs text-white leading-relaxed">{description}</p>
  </div>
);

export default Hero;
