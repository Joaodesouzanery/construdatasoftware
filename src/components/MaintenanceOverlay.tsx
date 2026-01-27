import { Shield, Mail, Phone } from "lucide-react";

const MaintenanceOverlay = () => {
  // Para remover o overlay, basta mudar esta variável para false ou deletar este componente
  const isMaintenanceMode = true;

  if (!isMaintenanceMode) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/90 backdrop-blur-sm">
      <div className="max-w-lg mx-4 text-center">
        <div className="mb-6 flex justify-center">
          <div className="rounded-full bg-orange-500/20 p-6">
            <Shield className="h-16 w-16 text-orange-500 animate-pulse" />
          </div>
        </div>
        
        <h1 className="text-2xl md:text-3xl font-bold text-white mb-4">
          Acesso Suspenso por Manutenção
        </h1>
        
        <p className="text-lg text-gray-300 mb-6 leading-relaxed">
          Estamos otimizando nosso sistema de segurança da plataforma. 
          Logo mais, voltaremos.
        </p>
        
        <div className="bg-white/10 rounded-lg p-6 mb-6">
          <p className="text-gray-200 mb-4">
            Entre em contato com o suporte para qualquer dúvida:
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <a 
              href="mailto:suporte@construdata.com" 
              className="inline-flex items-center gap-2 text-orange-400 hover:text-orange-300 transition-colors"
            >
              <Mail className="h-5 w-5" />
              suporte@construdata.com
            </a>
          </div>
        </div>
        
        <p className="text-sm text-gray-500">
          Agradecemos a compreensão.
        </p>
      </div>
    </div>
  );
};

export default MaintenanceOverlay;
