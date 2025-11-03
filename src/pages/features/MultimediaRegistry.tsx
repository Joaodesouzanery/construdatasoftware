import { Button } from "@/components/ui/button";
import { ArrowLeft, Camera } from "lucide-react";
import { useNavigate } from "react-router-dom";
import multimediaRegistryImg from "@/assets/features/multimedia-registry.jpg";

const MultimediaRegistry = () => {
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
              <Camera className="w-8 h-8" />
            </div>
            <h1 className="text-4xl font-bold text-white">Registro Multimídia</h1>
            <p className="text-xl text-gray-400 max-w-2xl mx-auto">
              Anexe fotos, vídeos e áudios com validação georreferenciada
            </p>
          </div>

          <div className="bg-white/5 backdrop-blur-sm rounded-xl border border-white/10 overflow-hidden">
            <img
              src={multimediaRegistryImg}
              alt="Registro Multimídia"
              className="w-full h-96 object-cover"
            />
          </div>

          <div className="bg-white/5 backdrop-blur-sm rounded-xl border border-white/10 p-8 space-y-6">
            <h2 className="text-2xl font-semibold text-white">Como Funciona</h2>
            
            <div className="space-y-4 text-gray-300">
              <p>
                <strong className="text-white">Captura Direta:</strong> Tire fotos, grave vídeos e áudios diretamente no sistema, sem precisar usar outros aplicativos.
              </p>
              
              <p>
                <strong className="text-white">Validação GPS:</strong> Todos os arquivos multimídia são automaticamente validados com coordenadas GPS do local onde foram capturados.
              </p>
              
              <p>
                <strong className="text-white">Organização Automática:</strong> Arquivos são organizados automaticamente por projeto, data e tipo, facilitando consultas futuras.
              </p>
              
              <p>
                <strong className="text-white">Histórico Visual:</strong> Crie um histórico visual completo da evolução da obra, essencial para relatórios e prestação de contas.
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

export default MultimediaRegistry;
