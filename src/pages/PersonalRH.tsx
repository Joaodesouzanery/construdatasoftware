import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, ExternalLink, Users } from "lucide-react";
import { useNavigate } from "react-router-dom";

const PersonalRH = () => {
  const navigate = useNavigate();

  const handleAccess = () => {
    window.open("https://personalrh.lovable.app", "_blank");
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5">
      <div className="container px-4 py-12 mx-auto max-w-4xl">
        <Button
          variant="ghost"
          onClick={() => navigate('/dashboard')}
          className="mb-8"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Voltar para Dashboard
        </Button>

        <div className="flex flex-col items-center justify-center space-y-8">
          <Card className="w-full max-w-lg">
            <CardHeader className="text-center">
              <div className="w-20 h-20 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary mx-auto mb-4">
                <Users className="w-10 h-10" />
              </div>
              <CardTitle className="text-2xl">PersonalRH</CardTitle>
              <CardDescription className="text-base">
                Sistema completo de gestão de recursos humanos, folha de pagamento e controle de ponto.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col items-center space-y-4">
              <Button
                size="lg"
                onClick={handleAccess}
                className="w-full max-w-xs text-lg"
              >
                <ExternalLink className="w-5 h-5 mr-2" />
                Acessar
              </Button>
              <p className="text-sm text-muted-foreground text-center">
                Você será redirecionado para o sistema PersonalRH em uma nova aba.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default PersonalRH;
