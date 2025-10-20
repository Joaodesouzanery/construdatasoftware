import { Button } from "@/components/ui/button";
import { ArrowRight, Building2, ClipboardList, Camera, Eye } from "lucide-react";
import { useNavigate } from "react-router-dom";

const Hero = () => {
  const navigate = useNavigate();

  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden bg-gradient-to-br from-primary/5 via-background to-secondary/5">
      <div className="absolute inset-0 bg-grid-pattern opacity-[0.02]" />
      
      <div className="container relative z-10 px-3 sm:px-4 py-12 sm:py-20 mx-auto">
        <div className="max-w-4xl mx-auto text-center space-y-6 sm:space-y-8 animate-fade-in">
          <div className="inline-flex items-center gap-2 px-3 sm:px-4 py-2 rounded-full bg-primary/10 text-primary border border-primary/20">
            <Building2 className="w-4 h-4" />
            <span className="text-xs sm:text-sm font-medium">Gestão de Obras Inteligente</span>
          </div>
          
          <h1 className="text-4xl sm:text-5xl md:text-7xl font-bold tracking-tight px-4">
            <span className="bg-gradient-to-r from-primary via-primary to-secondary bg-clip-text text-transparent">
              ConstruData
            </span>
          </h1>
          
          <p className="text-base sm:text-xl md:text-2xl text-muted-foreground max-w-2xl mx-auto leading-relaxed px-4">
            Plataforma robusta para gestão de obras com foco em Controle de Produção e RDO
          </p>
          
          <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center items-center pt-4 px-4">
            <Button 
              size="lg" 
              onClick={() => navigate('/auth')}
              className="w-full sm:w-auto bg-gradient-to-r from-primary to-primary/90 hover:shadow-lg hover:shadow-primary/50 transition-all duration-300 group"
            >
              Começar Agora
              <ArrowRight className="ml-2 w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </Button>
            <Button 
              size="lg" 
              variant="outline"
              onClick={() => navigate('/dashboard?demo=true')}
              className="w-full sm:w-auto border-primary/30 hover:bg-primary/10 hover:border-primary/50 transition-all"
            >
              <Eye className="mr-2 w-5 h-5" />
              Testar com Dados Fictícios
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6 pt-12 sm:pt-16 px-4">
            <FeatureCard
              icon={<ClipboardList className="w-6 h-6" />}
              title="Formulários Customizáveis"
              description="Crie formulários flexíveis com lógica condicional para cada tipo de obra"
            />
            <FeatureCard
              icon={<Camera className="w-6 h-6" />}
              title="Registro Multimídia"
              description="Anexe fotos, vídeos e áudios diretamente no campo"
            />
            <FeatureCard
              icon={<Building2 className="w-6 h-6" />}
              title="Geolocalização"
              description="Valide a presença da equipe com GPS automático"
            />
          </div>
        </div>
      </div>
    </section>
  );
};

const FeatureCard = ({ icon, title, description }: { icon: React.ReactNode; title: string; description: string }) => (
  <div className="group p-4 sm:p-6 rounded-xl bg-card border border-border hover:border-primary/50 hover:shadow-card transition-all duration-300 cursor-pointer">
    <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-lg bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center text-primary-foreground mb-3 sm:mb-4 group-hover:scale-110 transition-transform">
      {icon}
    </div>
    <h3 className="text-base sm:text-lg font-semibold mb-2">{title}</h3>
    <p className="text-sm text-muted-foreground">{description}</p>
  </div>
);

export default Hero;
