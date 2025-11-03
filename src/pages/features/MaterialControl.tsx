import { Button } from "@/components/ui/button";
import { ArrowLeft, TrendingUp } from "lucide-react";
import { useNavigate } from "react-router-dom";
import materialControlImg from "@/assets/features/material-control.jpg";

const MaterialControlFeature = () => {
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
              <TrendingUp className="w-8 h-8" />
            </div>
            <h1 className="text-4xl font-bold text-white">Controle de Material</h1>
            <p className="text-xl text-gray-400 max-w-2xl mx-auto">
              Compare requisições vs consumo real por frente de serviço
            </p>
          </div>

          <div className="bg-white/5 backdrop-blur-sm rounded-xl border border-white/10 overflow-hidden">
            <img
              src={materialControlImg}
              alt="Controle de Material"
              className="w-full h-96 object-cover"
            />
          </div>

          <div className="bg-white/5 backdrop-blur-sm rounded-xl border border-white/10 p-8 space-y-6">
            <h2 className="text-2xl font-semibold text-white">Como Funciona</h2>
            
            <div className="space-y-4 text-gray-300">
              <p>
                <strong className="text-white">Análise Comparativa:</strong> Compare quantidades solicitadas versus consumo real de materiais em cada frente de serviço.
              </p>
              
              <p>
                <strong className="text-white">Dashboard Interativo:</strong> Visualize dados através de gráficos que mostram desvios entre planejado e executado.
              </p>
              
              <p>
                <strong className="text-white">Identificação de Desperdícios:</strong> Detecte rapidamente frentes com consumo acima do esperado e investigue as causas.
              </p>
              
              <p>
                <strong className="text-white">Relatórios Detalhados:</strong> Gere relatórios de consumo por material, período e frente de serviço para melhor gestão de recursos.
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

export default MaterialControlFeature;
