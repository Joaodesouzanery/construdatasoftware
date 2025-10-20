import { useNavigate, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";

export const DemoModeToggle = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const searchParams = new URLSearchParams(location.search);
  const isDemoMode = searchParams.get('demo') === 'true';

  const toggleDemoMode = () => {
    const newParams = new URLSearchParams(location.search);
    
    if (isDemoMode) {
      newParams.delete('demo');
      toast.info("Modo de dados reais ativado");
    } else {
      newParams.set('demo', 'true');
      toast.info("Modo de teste ativado - usando dados fictícios");
    }
    
    const newSearch = newParams.toString();
    navigate(`${location.pathname}${newSearch ? '?' + newSearch : ''}`);
  };

  return (
    <Card className="border-2 border-dashed">
      <CardContent className="pt-4 pb-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-start gap-3 flex-1">
            {isDemoMode ? (
              <Eye className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
            ) : (
              <EyeOff className="w-5 h-5 text-muted-foreground flex-shrink-0 mt-0.5" />
            )}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium mb-1">
                {isDemoMode ? "Modo de Teste Ativo" : "Modo de Dados Reais"}
              </p>
              <p className="text-xs text-muted-foreground">
                {isDemoMode 
                  ? "Você está visualizando dados fictícios para testes. Nenhuma alteração será salva."
                  : "Você está trabalhando com dados reais. Todas as alterações serão salvas no banco de dados."
                }
              </p>
            </div>
          </div>
          <Button 
            variant={isDemoMode ? "default" : "outline"}
            size="sm"
            onClick={toggleDemoMode}
            className="w-full sm:w-auto flex-shrink-0"
          >
            {isDemoMode ? (
              <>
                <EyeOff className="w-4 h-4 mr-2" />
                Desativar Teste
              </>
            ) : (
              <>
                <Eye className="w-4 h-4 mr-2" />
                Ativar Teste
              </>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};
