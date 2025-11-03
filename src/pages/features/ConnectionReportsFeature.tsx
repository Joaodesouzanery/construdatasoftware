import { Button } from "@/components/ui/button";
import { ArrowLeft, FileText } from "lucide-react";
import { useNavigate } from "react-router-dom";
import connectionReportsImg from "@/assets/features/connection-reports.jpg";

const ConnectionReportsFeature = () => {
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
              <FileText className="w-8 h-8" />
            </div>
            <h1 className="text-4xl font-bold text-white">Relatório de Ligações</h1>
            <p className="text-xl text-gray-400 max-w-2xl mx-auto">
              Crie relatórios completos de ligações com fotos e exportação em PDF
            </p>
          </div>

          <div className="bg-white/5 backdrop-blur-sm rounded-xl border border-white/10 overflow-hidden">
            <img
              src={connectionReportsImg}
              alt="Relatório de Ligações"
              className="w-full h-96 object-cover"
            />
          </div>

          <div className="bg-white/5 backdrop-blur-sm rounded-xl border border-white/10 p-8 space-y-6">
            <h2 className="text-2xl font-semibold text-white">Como Funciona</h2>
            
            <div className="space-y-4 text-gray-300">
              <p>
                <strong className="text-white">Preenchimento Completo:</strong> Preencha informações como equipe, data, endereço, cliente, hidrômetro, OS e tipo de serviço em um único formulário.
              </p>
              
              <p>
                <strong className="text-white">Anexo de Fotos:</strong> Adicione múltiplas fotos ao relatório, que serão incluídas automaticamente na exportação em PDF.
              </p>
              
              <p>
                <strong className="text-white">Logo Personalizada:</strong> Inclua opcionalmente a logo da sua empresa no cabeçalho do relatório para maior profissionalismo.
              </p>
              
              <p>
                <strong className="text-white">Exportação Profissional:</strong> Exporte relatórios formatados em PDF prontos para impressão ou compartilhamento digital.
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

export default ConnectionReportsFeature;
