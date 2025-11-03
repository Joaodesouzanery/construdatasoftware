import { Button } from "@/components/ui/button";
import { ArrowLeft, QrCode } from "lucide-react";
import { useNavigate } from "react-router-dom";

const QRCodeMaintenance = () => {
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
              <QrCode className="w-8 h-8" />
            </div>
            <h1 className="text-4xl font-bold text-white">QR Code Manutenção</h1>
            <p className="text-xl text-gray-400 max-w-2xl mx-auto">
              Gere QR Codes para locais e receba solicitações de manutenção
            </p>
          </div>

          <div className="bg-white/5 backdrop-blur-sm rounded-xl border border-white/10 overflow-hidden">
            <img
              src="/placeholder.svg"
              alt="QR Code Manutenção"
              className="w-full h-96 object-cover"
            />
          </div>

          <div className="bg-white/5 backdrop-blur-sm rounded-xl border border-white/10 p-8 space-y-6">
            <h2 className="text-2xl font-semibold text-white">Como Funciona</h2>
            
            <div className="space-y-4 text-gray-300">
              <p>
                <strong className="text-white">Geração de QR Codes:</strong> Crie QR Codes específicos para cada local da obra (salas, áreas comuns, equipamentos, etc.).
              </p>
              
              <p>
                <strong className="text-white">Impressão e Fixação:</strong> Imprima os QR Codes gerados e fixe-os nos locais correspondentes para fácil acesso.
              </p>
              
              <p>
                <strong className="text-white">Solicitação Simples:</strong> Qualquer pessoa pode escanear o QR Code com o celular e abrir um formulário para solicitar manutenção daquele local específico.
              </p>
              
              <p>
                <strong className="text-white">Rastreamento Completo:</strong> Acompanhe todas as solicitações de manutenção, com data, local, descrição do problema e fotos anexadas.
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

export default QRCodeMaintenance;
