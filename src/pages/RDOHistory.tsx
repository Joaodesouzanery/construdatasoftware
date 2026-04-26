import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Building2, LogOut, ArrowLeft, History } from "lucide-react";
import { toast } from "sonner";
import { RDOHistoryView } from "@/components/rdo/RDOHistoryView";
import { PageTutorialButton } from "@/components/shared/PageTutorialButton";

const SABESP_UNLINKED_PROJECT_VALUE = "__sabesp_sem_projeto__";

const RDOHistory = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState<any>(null);
  const [projects, setProjects] = useState<any[]>([]);
  const [selectedProject, setSelectedProject] = useState<string>(SABESP_UNLINKED_PROJECT_VALUE);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();

      if (!session) {
        navigate("/auth");
        return;
      }

      setUser(session.user);
      await loadProjects();
      setIsLoading(false);
    };

    void checkAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) {
        navigate("/auth");
      } else {
        setUser(session.user);
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  const loadProjects = async () => {
    try {
      const { data, error } = await supabase
        .from("projects")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;

      setProjects(data || []);
      setSelectedProject(data && data.length > 0 ? data[0].id : SABESP_UNLINKED_PROJECT_VALUE);
    } catch (error: any) {
      toast.error("Erro ao carregar projetos: " + error.message);
    }
  };

  const handleSignOut = async () => {
    try {
      await supabase.auth.signOut();
      toast.success("Logout realizado com sucesso!");
      navigate("/");
    } catch {
      toast.error("Erro ao fazer logout");
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/5 via-background to-secondary/5">
        <div className="text-center">
          <Building2 className="w-12 h-12 mx-auto text-primary animate-pulse mb-4" />
          <p className="text-muted-foreground">Carregando...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-secondary/5">
      <header className="border-b bg-card/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate("/dashboard")}>
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div className="flex items-center gap-2 text-primary">
              <History className="w-8 h-8" />
              <span className="text-2xl font-bold">Historico de RDOs</span>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <PageTutorialButton pageKey="rdo-history" />
            <span className="text-sm text-muted-foreground hidden sm:inline">
              {user?.user_metadata?.name || user?.email}
            </span>
            <Button variant="ghost" size="icon" onClick={handleSignOut}>
              <LogOut className="w-5 h-5" />
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Selecione o Escopo</CardTitle>
              <CardDescription>
                Escolha um projeto específico ou visualize os RDOs Sabesp sem vínculo a projeto.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <Select value={selectedProject} onValueChange={setSelectedProject}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione um projeto" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={SABESP_UNLINKED_PROJECT_VALUE}>RDO Sabesp sem projeto</SelectItem>
                  {projects.map((project) => (
                    <SelectItem key={project.id} value={project.id}>
                      {project.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {projects.length === 0 && (
                <div className="rounded-md border border-dashed p-3 text-sm text-muted-foreground">
                  Nenhum projeto foi encontrado, mas você ainda pode consultar e exportar os RDOs Sabesp sem projeto.
                </div>
              )}
            </CardContent>
          </Card>

          {selectedProject && <RDOHistoryView projectId={selectedProject} />}
        </div>
      </main>
    </div>
  );
};

export default RDOHistory;
