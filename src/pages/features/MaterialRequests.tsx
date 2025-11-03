import { Button } from "@/components/ui/button";
import { ArrowLeft, Package } from "lucide-react";
import { useNavigate } from "react-router-dom";
import materialRequestsImg from "@/assets/features/material-requests.jpg";

const MaterialRequestsFeature = () => {
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
              <Package className="w-8 h-8" />
            </div>
            <h1 className="text-4xl font-bold text-white">Pedidos de Material</h1>
            <p className="text-xl text-gray-400 max-w-2xl mx-auto">
              Solicite materiais com rastreamento de solicitante e status
            </p>
          </div>

          <div className="bg-white/5 backdrop-blur-sm rounded-xl border border-white/10 overflow-hidden">
            <img
              src={materialRequestsImg}
              alt="Pedidos de Material"
              className="w-full h-96 object-cover"
            />
          </div>

          <div className="bg-white/5 backdrop-blur-sm rounded-xl border border-white/10 p-8 space-y-6">
            <h2 className="text-2xl font-semibold text-white">Como Funciona</h2>
            
            <div className="space-y-4 text-gray-300">
              <p>
                <strong className="text-white">Solicitação Simples:</strong> Crie pedidos de material informando item, quantidade, unidade e frente de serviço onde será utilizado.
              </p>
              
              <p>
                <strong className="text-white">Rastreamento Completo:</strong> Acompanhe o status de cada pedido desde a solicitação até a entrega, com identificação automática do solicitante.
              </p>
              
              <p>
                <strong className="text-white">Controle de Status:</strong> Gerencie pedidos nos status 'Pendente', 'Em Andamento', 'Entregue' ou 'Cancelado'.
              </p>
              
              <p>
                <strong className="text-white">Histórico e Análises:</strong> Consulte histórico completo de pedidos e analise padrões de consumo por projeto e frente.
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

export default MaterialRequestsFeature;
