import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, ExternalLink, Users, Clock, DollarSign, FileText, Calendar, UserCheck, BarChart3, Shield } from "lucide-react";
import { useNavigate } from "react-router-dom";

const features = [
  {
    icon: Users,
    title: "Gestão de Colaboradores",
    description: "Cadastro completo de funcionários com dados pessoais, documentos e histórico profissional."
  },
  {
    icon: Clock,
    title: "Controle de Ponto",
    description: "Registro de entrada e saída com geolocalização, banco de horas e relatórios automáticos."
  },
  {
    icon: DollarSign,
    title: "Folha de Pagamento",
    description: "Cálculo automático de salários, benefícios, descontos e encargos trabalhistas."
  },
  {
    icon: Calendar,
    title: "Gestão de Férias",
    description: "Controle de períodos aquisitivos, programação e aprovação de férias."
  },
  {
    icon: FileText,
    title: "Documentos e Contratos",
    description: "Geração automática de contratos, termos e documentos trabalhistas."
  },
  {
    icon: UserCheck,
    title: "Admissão Digital",
    description: "Processo de admissão 100% digital com coleta de documentos online."
  },
  {
    icon: BarChart3,
    title: "Relatórios e Analytics",
    description: "Dashboards com indicadores de RH, turnover, custos e produtividade."
  },
  {
    icon: Shield,
    title: "Compliance Trabalhista",
    description: "Alertas de vencimentos, obrigações legais e conformidade com eSocial."
  }
];

const PersonalRH = () => {
  const navigate = useNavigate();

  const handleAccess = () => {
    window.open("https://personalrh.lovable.app", "_blank");
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5">
      <div className="container px-4 py-8 mx-auto max-w-6xl">
        <Button
          variant="ghost"
          onClick={() => navigate('/dashboard')}
          className="mb-6"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Voltar para Dashboard
        </Button>

        {/* Header */}
        <div className="text-center mb-10">
          <div className="w-20 h-20 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary mx-auto mb-4">
            <Users className="w-10 h-10" />
          </div>
          <h1 className="text-3xl font-bold mb-2">PersonalRH</h1>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
            Sistema completo de gestão de recursos humanos, folha de pagamento e controle de ponto para sua empresa.
          </p>
        </div>

        {/* Features Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
          {features.map((feature, index) => (
            <Card key={index} className="hover:shadow-md transition-shadow border-muted/50">
              <CardHeader className="pb-2">
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary mb-2">
                  <feature.icon className="w-5 h-5" />
                </div>
                <CardTitle className="text-base">{feature.title}</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription className="text-sm">
                  {feature.description}
                </CardDescription>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* CTA Section */}
        <Card className="bg-primary/5 border-primary/20">
          <CardContent className="flex flex-col md:flex-row items-center justify-between gap-6 py-8">
            <div className="text-center md:text-left">
              <h2 className="text-xl font-semibold mb-2">Pronto para revolucionar sua gestão de RH?</h2>
              <p className="text-muted-foreground">
                Acesse o PersonalRH e descubra todas as funcionalidades disponíveis para sua empresa.
              </p>
            </div>
            <Button
              size="lg"
              onClick={handleAccess}
              className="min-w-[200px] text-lg"
            >
              <ExternalLink className="w-5 h-5 mr-2" />
              Acessar PersonalRH
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default PersonalRH;
