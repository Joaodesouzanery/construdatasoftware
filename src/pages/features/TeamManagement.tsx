import { Button } from "@/components/ui/button";
import { ArrowLeft, Users } from "lucide-react";
import { useNavigate } from "react-router-dom";
import teamManagementImg from "@/assets/features/team-management.jpg";

const TeamManagement = () => {
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
              <Users className="w-8 h-8" />
            </div>
            <h1 className="text-4xl font-bold text-white">Gestão de Equipe</h1>
            <p className="text-xl text-gray-400 max-w-2xl mx-auto">
              Cadastre funcionários, empresas e controle acessos
            </p>
          </div>

          <div className="bg-white/5 backdrop-blur-sm rounded-xl border border-white/10 overflow-hidden">
            <img
              src={teamManagementImg}
              alt="Gestão de Equipe"
              className="w-full h-96 object-cover"
            />
          </div>

          <div className="bg-white/5 backdrop-blur-sm rounded-xl border border-white/10 p-8 space-y-6">
            <h2 className="text-2xl font-semibold text-white">Como Funciona</h2>
            
            <div className="space-y-4 text-gray-300">
              <p>
                <strong className="text-white">Cadastro de Funcionários:</strong> Registre todos os colaboradores com informações como nome, cargo, empresa e contato.
              </p>
              
              <p>
                <strong className="text-white">Gestão de Empresas:</strong> Organize funcionários por empresas terceirizadas ou equipe própria, facilitando o controle.
              </p>
              
              <p>
                <strong className="text-white">Controle de Acesso:</strong> Defina permissões e níveis de acesso para cada membro da equipe no sistema.
              </p>
              
              <p>
                <strong className="text-white">Importação em Lote:</strong> Importe planilhas com dados de múltiplos funcionários de uma só vez, economizando tempo.
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

export default TeamManagement;
