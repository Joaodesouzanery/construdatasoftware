import { Button } from "@/components/ui/button";
import { ArrowLeft, Bell } from "lucide-react";
import { useNavigate } from "react-router-dom";
import intelligentAlertsImg from "@/assets/features/intelligent-alerts.jpg";

const IntelligentAlerts = () => {
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
              <Bell className="w-8 h-8" />
            </div>
            <h1 className="text-4xl font-bold text-white">Alertas Inteligentes</h1>
            <p className="text-xl text-gray-400 max-w-2xl mx-auto">
              Notificações com justificativas obrigatórias para desvios
            </p>
          </div>

          <div className="bg-white/5 backdrop-blur-sm rounded-xl border border-white/10 overflow-hidden">
            <img
              src={intelligentAlertsImg}
              alt="Alertas Inteligentes"
              className="w-full h-96 object-cover"
            />
          </div>

          <div className="bg-white/5 backdrop-blur-sm rounded-xl border border-white/10 p-8 space-y-6">
            <h2 className="text-2xl font-semibold text-white">Como Funciona</h2>
            
            <div className="space-y-4 text-gray-300">
              <p>
                <strong className="text-white">Detecção Automática:</strong> Sistema monitora produção e identifica automaticamente quando há desvios das metas estabelecidas.
              </p>
              
              <p>
                <strong className="text-white">Justificativas Obrigatórias:</strong> Para cada alerta gerado, é obrigatório registrar uma justificativa detalhada do que aconteceu.
              </p>
              
              <p>
                <strong className="text-white">Histórico Completo:</strong> Mantenha registro de todos os alertas e justificativas para análise posterior e auditoria.
              </p>
              
              <p>
                <strong className="text-white">Notificações em Tempo Real:</strong> Receba notificações imediatas quando alertas são criados, garantindo ação rápida.
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

export default IntelligentAlerts;
