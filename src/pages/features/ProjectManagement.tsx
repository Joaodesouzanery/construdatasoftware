import { Button } from "@/components/ui/button";
import { ArrowLeft, Building2 } from "lucide-react";
import { useNavigate } from "react-router-dom";

const ProjectManagement = () => {
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
              <Building2 className="w-8 h-8" />
            </div>
            <h1 className="text-4xl font-bold text-white">Gestão de Projetos</h1>
            <p className="text-xl text-gray-400 max-w-2xl mx-auto">
              Controle completo de obras com status 'Em andamento' sem data final definida
            </p>
          </div>

          <div className="bg-white/5 backdrop-blur-sm rounded-xl border border-white/10 overflow-hidden">
            <img
              src="/placeholder.svg"
              alt="Gestão de Projetos"
              className="w-full h-96 object-cover"
            />
          </div>

          <div className="bg-white/5 backdrop-blur-sm rounded-xl border border-white/10 p-8 space-y-6">
            <h2 className="text-2xl font-semibold text-white">Como Funciona</h2>
            
            <div className="space-y-4 text-gray-300">
              <p>
                <strong className="text-white">Cadastro de Projetos:</strong> Registre suas obras com informações detalhadas como nome, localização, responsável e status atual.
              </p>
              
              <p>
                <strong className="text-white">Acompanhamento em Tempo Real:</strong> Visualize todos os projetos ativos em um painel único, com filtros por status e localização.
              </p>
              
              <p>
                <strong className="text-white">Gestão de Status:</strong> Mantenha o controle de projetos 'Em andamento', 'Pausados' ou 'Concluídos', sem necessidade de definir datas finais antecipadamente.
              </p>
              
              <p>
                <strong className="text-white">Histórico Completo:</strong> Acesse o histórico de todas as alterações e atividades realizadas em cada projeto.
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

export default ProjectManagement;
