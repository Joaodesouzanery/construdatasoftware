import { Button } from "@/components/ui/button";
import { ArrowLeft, BarChart3 } from "lucide-react";
import { useNavigate } from "react-router-dom";

const ProductionControl = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-[#0a1628]">
      <div className="container px-4 py-12 mx-auto max-w-5xl">
        <Button
          variant="ghost"
          onClick={() => navigate('/')}
          className="mb-8 text-gray-300 hover:text-white"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Voltar para Home
        </Button>

        <div className="space-y-8">
          <div className="text-center space-y-4">
            <div className="w-16 h-16 rounded-2xl bg-blue-600 flex items-center justify-center text-white mx-auto">
              <BarChart3 className="w-8 h-8" />
            </div>
            <h1 className="text-4xl font-bold text-white">Controle de Produção</h1>
            <p className="text-xl text-gray-400 max-w-2xl mx-auto">
              Acompanhe metas diárias, semanais e mensais com análise em tempo real
            </p>
          </div>

          <div className="bg-white/5 backdrop-blur-sm rounded-xl border border-white/10 overflow-hidden">
            <img
              src="/placeholder.svg"
              alt="Controle de Produção"
              className="w-full h-96 object-cover"
            />
          </div>

          <div className="bg-white/5 backdrop-blur-sm rounded-xl border border-white/10 p-8 space-y-6">
            <h2 className="text-2xl font-semibold text-white">Como Funciona</h2>
            
            <div className="space-y-4 text-gray-300">
              <p>
                <strong className="text-white">Definição de Metas:</strong> Configure metas de produção diárias, semanais e mensais para cada frente de serviço.
              </p>
              
              <p>
                <strong className="text-white">Registro de Produção:</strong> Registre a produção realizada em tempo real, com métricas detalhadas por serviço e equipe.
              </p>
              
              <p>
                <strong className="text-white">Análise Comparativa:</strong> Compare produção planejada vs realizada através de gráficos e dashboards interativos.
              </p>
              
              <p>
                <strong className="text-white">Alertas Automáticos:</strong> Receba notificações quando a produção estiver abaixo da meta, com possibilidade de justificar desvios.
              </p>
            </div>
          </div>

          <div className="text-center">
            <Button
              size="lg"
              onClick={() => navigate('/auth')}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              Começar Agora
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProductionControl;
