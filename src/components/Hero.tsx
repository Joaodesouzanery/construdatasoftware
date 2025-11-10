import { Button } from "@/components/ui/button";
import { ArrowRight, Building2, ClipboardList, Camera, BarChart3, Package, Users, Bell, TrendingUp, Shield, Clock, QrCode } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const Hero = () => {
  const navigate = useNavigate();

  const features = [
    {
      icon: <Building2 className="w-6 h-6" />,
      title: "Gestão de Projetos",
      description: "Controle obras com status 'Em andamento' sem data final definida",
      link: "/features/project-management"
    },
    {
      icon: <BarChart3 className="w-6 h-6" />,
      title: "Controle de Produção",
      description: "Acompanhe metas diárias, semanais e mensais com análise em tempo real",
      link: "/features/production-control"
    },
    {
      icon: <ClipboardList className="w-6 h-6" />,
      title: "RDO Digital",
      description: "Relatórios Diários de Obra com fotos, clima e validação por GPS",
      link: "/features/rdo-digital"
    },
    {
      icon: <Package className="w-6 h-6" />,
      title: "Pedidos de Material",
      description: "Solicite materiais com rastreamento de solicitante e status",
      link: "/features/material-requests"
    },
    {
      icon: <TrendingUp className="w-6 h-6" />,
      title: "Controle de Material",
      description: "Compare requisições vs consumo real por frente de serviço",
      link: "/features/material-control"
    },
    {
      icon: <Users className="w-6 h-6" />,
      title: "Gestão de Equipe",
      description: "Cadastre funcionários, empresas e controle acessos",
      link: "/features/team-management"
    },
    {
      icon: <Bell className="w-6 h-6" />,
      title: "Alertas Inteligentes",
      description: "Notificações com justificativas obrigatórias para desvios",
      link: "/features/intelligent-alerts"
    },
    {
      icon: <Camera className="w-6 h-6" />,
      title: "Registro Multimídia",
      description: "Anexe fotos, vídeos e áudios com validação georreferenciada",
      link: "/features/multimedia-registry"
    },
    {
      icon: <QrCode className="w-6 h-6" />,
      title: "QR Code Manutenção",
      description: "Gere QR Codes para locais e receba solicitações de manutenção",
      link: "/features/qrcode-maintenance"
    },
    {
      icon: <ClipboardList className="w-6 h-6" />,
      title: "Relatório de Ligações",
      description: "Crie relatórios completos de ligações com fotos e exportação em PDF",
      link: "/features/connection-reports"
    }
  ];

  return (
    <div className="min-h-screen bg-[#0a1628] relative overflow-hidden">
      {/* Background decorative elements */}
      <div className="absolute top-20 left-10 w-96 h-96 bg-blue-600/20 rounded-full blur-3xl" />
      <div className="absolute bottom-20 right-10 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl" />
      
      {/* Hero Section */}
      <section className="relative overflow-hidden">
        <div className="container relative z-10 px-4 py-20 mx-auto">
          <div className="max-w-4xl mx-auto text-center space-y-8 animate-fade-in">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-blue-500/10 text-blue-300 border border-blue-500/20 backdrop-blur-sm">
              <Building2 className="w-4 h-4" />
              <span className="text-sm font-medium">Gestão de Obras Inteligente</span>
            </div>
            
            <h1 className="text-5xl md:text-7xl font-bold tracking-tight">
              <span className="text-blue-400">
                ConstruData
              </span>
            </h1>
            
            <p className="text-xl md:text-2xl text-gray-300 max-w-2xl mx-auto leading-relaxed">
              Transforme a gestão da sua obra com controle em tempo real, decisões baseadas em dados e economia comprovada
            </p>
            
            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center pt-4">
              <Button 
                size="lg" 
                onClick={() => navigate('/auth')}
                className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-600/50 hover:shadow-blue-600/70 transition-all duration-300 group border-0"
              >
                Começar Agora
                <ArrowRight className="ml-2 w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Problem & Solution Section */}
      <section className="container px-4 py-16 mx-auto">
        <div className="max-w-6xl mx-auto space-y-12">
          {/* Problem Statement */}
          <div className="text-center space-y-6 max-w-4xl mx-auto">
            <h2 className="text-3xl md:text-5xl font-bold text-white leading-tight">
              Cansado dos Softwares de Engenharia que Atrasam Seu Sucesso?
            </h2>
            <p className="text-lg text-gray-300 leading-relaxed">
              Engenheiros e gestores de projeto em todo o mundo enfrentam a mesma frustração: ferramentas caras, lentas e complexas que parecem trabalhar contra a produtividade. Você não está sozinho. As reclamações são claras, e nós ouvimos cada uma delas.
            </p>
            <p className="text-xl font-semibold text-blue-400">
              Nós entendemos a dor.
            </p>
            <p className="text-lg text-gray-300 leading-relaxed">
              O mercado de software de engenharia está saturado de soluções que impõem barreiras em vez de criar pontes. Acreditamos que a tecnologia deve ser uma aliada, não um obstáculo. É por isso que desenvolvemos uma solução que ataca diretamente os 5 maiores problemas que impedem sua equipe de alcançar a excelência.
            </p>
          </div>

          {/* Comparison Table */}
          <div className="space-y-8">
            <div className="text-center">
              <h3 className="text-2xl md:text-3xl font-bold text-white mb-2">
                O Problema vs. Nossa Solução
              </h3>
              <p className="text-gray-400 text-base md:text-lg">
                Transformando Frustração em Vantagem Competitiva
              </p>
            </div>

            {/* Mobile: Card Stack / Desktop: Table */}
            <div className="space-y-4 md:space-y-0">
              {/* Headers - Hidden on mobile, shown as table on desktop */}
              <div className="hidden md:grid md:grid-cols-2 gap-4 mb-4">
                <div className="bg-red-950/50 p-4 md:p-6 rounded-2xl border border-red-500/20">
                  <h4 className="text-lg md:text-xl font-bold text-red-400 flex items-center gap-2">
                    <span className="text-xl md:text-2xl">❌</span>
                    A Frustração Atual
                  </h4>
                  <p className="text-xs md:text-sm text-gray-400 mt-1">O que a Engenharia Reclama</p>
                </div>
                <div className="bg-green-950/50 p-4 md:p-6 rounded-2xl border border-green-500/20">
                  <h4 className="text-lg md:text-xl font-bold text-green-400 flex items-center gap-2">
                    <span className="text-xl md:text-2xl">✅</span>
                    Nossa Solução
                  </h4>
                  <p className="text-xs md:text-sm text-gray-400 mt-1">O que Entregamos</p>
                </div>
              </div>

              {/* Comparison Items */}
              {[
                {
                  number: "1",
                  problem: "Custo de Licença Exorbitante",
                  problemDesc: "Licenças anuais que consomem orçamentos e tornam o crescimento insustentável.",
                  solution: "Custo-Benefício Inteligente",
                  solutionDesc: "Oferecemos um modelo de precificação justo e transparente, eliminando o peso financeiro das licenças tradicionais. Invista no seu projeto, não em softwares inchados."
                },
                {
                  number: "2",
                  problem: "Desempenho Lento e Bugs Crônicos",
                  problemDesc: "Softwares que travam, demoram a processar e exigem hardware de ponta, roubando horas preciosas de trabalho.",
                  solution: "Velocidade e Estabilidade Incomparáveis",
                  solutionDesc: "Nossa plataforma é construída para ser leve e eficiente, garantindo processamento rápido e um ambiente de trabalho livre de bugs. Mais tempo projetando, menos tempo esperando."
                },
                {
                  number: "3",
                  problem: "Usabilidade Complexa e Curva de Aprendizado Desnecessária",
                  problemDesc: "Interfaces confusas e funcionalidades escondidas que exigem treinamento exaustivo e afastam novos talentos.",
                  solution: "Intuitividade e Foco no Engenheiro",
                  solutionDesc: "Desenvolvemos uma interface limpa e lógica, pensada por engenheiros para engenheiros. Reduza a curva de aprendizado e coloque sua equipe para produzir em tempo recorde."
                },
                {
                  number: "4",
                  problem: "Falta de Inovação e Resposta ao Feedback da Comunidade",
                  problemDesc: "Softwares que não evoluem e ignoram as necessidades reais dos usuários, mantendo o status quo.",
                  solution: "Evolução Contínua e Parceria",
                  solutionDesc: "Nossa solução é desenvolvida em colaboração com a comunidade de engenharia. Implementamos atualizações rápidas e significativas, garantindo que você tenha sempre a ferramenta mais moderna e alinhada com as práticas de mercado."
                },
                {
                  number: "5",
                  problem: "Risco de Erro devido ao uso superficial de ferramentas complexas",
                  problemDesc: "A complexidade do software leva a erros de modelagem e simulação, comprometendo a segurança e o resultado final do projeto.",
                  solution: "Validação Integrada e Confiabilidade",
                  solutionDesc: "Incorporamos mecanismos de validação e guias de boas práticas que garantem a correta aplicação dos princípios de engenharia. Transforme a complexidade em precisão e elimine o risco de erros caros."
                }
              ].map((item) => (
                <div key={item.number} className="space-y-3 md:space-y-0">
                  {/* Mobile: Stacked Cards */}
                  <div className="md:hidden space-y-3">
                    {/* Problem Card */}
                    <div className="bg-red-950/30 backdrop-blur-sm p-4 rounded-xl border border-red-500/20">
                      <div className="flex items-start gap-2 mb-2">
                        <span className="text-lg">❌</span>
                        <div className="flex-1">
                          <h5 className="font-semibold text-red-400 text-sm mb-1">
                            {item.number}. {item.problem}
                          </h5>
                          <p className="text-xs text-gray-300 leading-relaxed">
                            {item.problemDesc}
                          </p>
                        </div>
                      </div>
                    </div>
                    
                    {/* Solution Card */}
                    <div className="bg-green-950/30 backdrop-blur-sm p-4 rounded-xl border border-green-500/20">
                      <div className="flex items-start gap-2 mb-2">
                        <span className="text-lg">✅</span>
                        <div className="flex-1">
                          <h5 className="font-semibold text-green-400 text-sm mb-1">
                            {item.solution}
                          </h5>
                          <p className="text-xs text-gray-300 leading-relaxed">
                            {item.solutionDesc}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Desktop: Side by Side */}
                  <div className="hidden md:grid md:grid-cols-2 gap-4">
                    <div className="bg-red-950/20 backdrop-blur-sm p-4 md:p-6 rounded-xl border border-red-500/10 hover:bg-red-950/30 transition-colors">
                      <h5 className="font-semibold text-red-400 mb-2 text-sm md:text-base">
                        {item.number}. {item.problem}
                      </h5>
                      <p className="text-xs md:text-sm text-gray-300 leading-relaxed">
                        {item.problemDesc}
                      </p>
                    </div>
                    <div className="bg-green-950/20 backdrop-blur-sm p-4 md:p-6 rounded-xl border border-green-500/10 hover:bg-green-950/30 transition-colors">
                      <h5 className="font-semibold text-green-400 mb-2 text-sm md:text-base">
                        {item.solution}
                      </h5>
                      <p className="text-xs md:text-sm text-gray-300 leading-relaxed">
                        {item.solutionDesc}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Final CTA */}
          <div className="text-center space-y-6 max-w-4xl mx-auto pt-8">
            <h3 className="text-2xl md:text-4xl font-bold text-white">
              Pare de Lutar Contra Suas Ferramentas. Comece a Projetar o Futuro.
            </h3>
            <p className="text-lg text-gray-300 leading-relaxed">
              Sua equipe merece um software que a capacite, não que a limite. Se você está cansado de pagar caro por frustração e lentidão, é hora de conhecer a solução que foi criada para resolver os problemas reais da engenharia moderna.
            </p>
            <Button 
              size="lg"
              onClick={() => navigate('/auth')}
              className="bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-600/50 hover:shadow-blue-600/70 transition-all duration-300 border-0"
            >
              Fale Conosco e Transforme Seu Fluxo de Trabalho
              <ArrowRight className="ml-2 w-5 h-5" />
            </Button>
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section className="container px-4 py-16 mx-auto">
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-bold mb-4 text-white">Funcionalidades Completas</h2>
          <p className="text-gray-400 text-lg max-w-2xl mx-auto">
            Todas as ferramentas necessárias para gerenciar suas obras com eficiência
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-7xl mx-auto">
          {features.map((feature, index) => (
            <Card 
              key={index}
              className="group cursor-pointer bg-white hover:shadow-xl hover:shadow-blue-500/10 border-0 transition-all duration-300"
              onClick={() => navigate(feature.link)}
            >
              <CardHeader>
                <div className="w-12 h-12 rounded-lg bg-blue-600 flex items-center justify-center text-white mb-4 group-hover:scale-110 transition-transform">
                  {feature.icon}
                </div>
                <CardTitle className="text-lg text-gray-900">{feature.title}</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription className="text-sm text-gray-600">{feature.description}</CardDescription>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* Security Trust Section */}
      <section className="container px-4 py-16 mx-auto bg-white/5 backdrop-blur-sm rounded-3xl border border-white/10">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-green-500/10 text-green-400 border border-green-500/20 backdrop-blur-sm mb-4">
              <Shield className="w-4 h-4" />
              <span className="text-sm font-semibold">Segurança Empresarial</span>
            </div>
            <h2 className="text-3xl md:text-4xl font-bold mb-4 text-white">Seus Dados Protegidos</h2>
            <p className="text-gray-400 text-lg max-w-3xl mx-auto">
              Segurança de nível empresarial para proteger informações confidenciais da sua empresa
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
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

          <div className="mt-12 p-6 bg-white/5 backdrop-blur-sm rounded-xl border border-white/10">
            <div className="flex flex-col md:flex-row items-start md:items-center gap-4">
              <div className="flex-shrink-0">
                <div className="w-12 h-12 rounded-full bg-green-500/10 flex items-center justify-center">
                  <Shield className="w-6 h-6 text-green-400" />
                </div>
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-lg mb-2 text-white">Proteção de Dados Confidenciais</h3>
                <p className="text-sm text-gray-400">
                  Informações sensíveis como dados de funcionários, localização de obras, métricas de produção e custos de materiais 
                  são protegidas por políticas de segurança em nível de linha (RLS). Concorrentes não podem acessar seus dados, 
                  mesmo criando uma conta gratuita.
                </p>
              </div>
            </div>
          </div>

          <div className="mt-6 text-center">
            <p className="text-sm text-gray-500">
              ✓ Criptografia end-to-end &nbsp;•&nbsp; ✓ Políticas de segurança em nível de linha &nbsp;•&nbsp; ✓ Autenticação JWT
            </p>
          </div>
        </div>
      </section>

      {/* Benefits Section */}
      <section className="container px-4 py-16 mx-auto">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold mb-4 text-white">Por que ConstruData?</h2>
            <p className="text-gray-400 text-lg">
              Recursos que fazem a diferença no dia a dia da sua obra
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
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
            <BenefitCard
              icon={<Camera className="w-8 h-8" />}
              title="Validação Georreferenciada"
              description="Todas as fotos, vídeos e áudios são validados por GPS, garantindo autenticidade dos registros"
            />
            <BenefitCard
              icon={<QrCode className="w-8 h-8" />}
              title="QR Code para Manutenção"
              description="Gere QR Codes para equipamentos e locais, facilitando solicitações de manutenção na obra"
            />
            <BenefitCard
              icon={<Users className="w-8 h-8" />}
              title="Gestão Centralizada de Equipes"
              description="Controle de funcionários, empresas terceirizadas e permissões de acesso em um só lugar"
            />
            <BenefitCard
              icon={<Package className="w-8 h-8" />}
              title="Rastreamento de Materiais"
              description="Controle completo desde a solicitação até o consumo, com histórico e responsáveis identificados"
            />
            <BenefitCard
              icon={<BarChart3 className="w-8 h-8" />}
              title="Relatórios Consolidados"
              description="Exporte relatórios completos em PDF com dados de produção, materiais e equipe"
            />
            <BenefitCard
              icon={<Bell className="w-8 h-8" />}
              title="Notificações Inteligentes"
              description="Receba alertas automáticos sobre desvios, pendências e eventos importantes da obra"
            />
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="container px-4 py-20 mx-auto">
        <div className="max-w-4xl mx-auto text-center bg-white/5 backdrop-blur-sm rounded-2xl p-12 border border-white/10">
          <h2 className="text-3xl md:text-4xl font-bold mb-4 text-white">
            Pronto para transformar sua gestão de obras?
          </h2>
          <p className="text-gray-400 text-lg mb-8 max-w-2xl mx-auto">
            Comece agora e tenha controle total sobre projetos, produção, materiais e equipe
          </p>
          <Button 
            size="lg"
            onClick={() => navigate('/auth')}
            className="bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-600/50 hover:shadow-blue-600/70 transition-all duration-300 border-0"
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
    <div className="w-16 h-16 rounded-2xl bg-blue-600 flex items-center justify-center text-white mx-auto">
      {icon}
    </div>
    <h3 className="text-xl font-semibold text-white">{title}</h3>
    <p className="text-gray-400">{description}</p>
  </div>
);

const SecurityFeature = ({ icon, title, description }: { icon: string; title: string; description: string }) => (
  <div className="bg-white/5 backdrop-blur-sm p-6 rounded-xl border border-white/10 hover:border-white/20 transition-colors">
    <div className="text-4xl mb-3">{icon}</div>
    <h3 className="font-semibold mb-2 text-sm text-white">{title}</h3>
    <p className="text-xs text-gray-400 leading-relaxed">{description}</p>
  </div>
);

export default Hero;
