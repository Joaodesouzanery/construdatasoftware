import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Logo } from "@/components/shared/Logo";
import { PontoWidget } from "@/components/ponto/PontoWidget";
import { agruparRegistrosPorDia, formatarHoras } from "@/utils/pontoCalculation";
import { LogOut } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

// Tela única do funcionário restrito - sem SidebarProvider/AppSidebar, no
// mesmo espírito de src/pages/MaintenanceRequest.tsx: o funcionário não deve
// ver mais nada do sistema além de bater o próprio ponto e consultar seu
// histórico recente.
const MeuPonto = () => {
  const navigate = useNavigate();
  const [userId, setUserId] = useState<string | null>(null);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        navigate("/auth");
        return;
      }
      setUserId(session.user.id);
      setChecking(false);
    };

    checkAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) {
        navigate("/auth");
      } else {
        setUserId(session.user.id);
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  const { data: funcionario, isLoading: funcionarioLoading } = useQuery({
    queryKey: ["ponto-meu-funcionario", userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("funcionarios")
        .select("id, nome, cargo")
        .eq("auth_user_id", userId)
        .maybeSingle();
      if (error) throw error;
      return data as { id: string; nome: string; cargo: string | null } | null;
    },
    enabled: Boolean(userId),
  });

  const trintaDiasAtras = new Date();
  trintaDiasAtras.setDate(trintaDiasAtras.getDate() - 30);

  const { data: historico = [] } = useQuery({
    queryKey: ["ponto-meu-historico", funcionario?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("registros_ponto")
        .select("id, tipo, momento")
        .eq("funcionario_id", funcionario!.id)
        .gte("momento", trintaDiasAtras.toISOString())
        .order("momento", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
    enabled: Boolean(funcionario?.id),
  });

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate("/auth");
  };

  if (checking || funcionarioLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!funcionario) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="max-w-md w-full p-6 text-center space-y-4">
          <p className="text-sm text-muted-foreground">
            Este login não está vinculado a nenhum cadastro de funcionário. Peça ao seu gestor para verificar seu acesso.
          </p>
          <Button variant="outline" onClick={handleSignOut}>
            <LogOut className="h-4 w-4 mr-2" />
            Sair
          </Button>
        </Card>
      </div>
    );
  }

  const dias = agruparRegistrosPorDia(historico).reverse();

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-md mx-auto px-4 py-6 space-y-6">
        <div className="flex items-center justify-between">
          <Logo size="sm" />
          <Button variant="ghost" size="icon" onClick={handleSignOut}>
            <LogOut className="h-4 w-4" />
          </Button>
        </div>

        <div className="text-center">
          <h1 className="text-lg font-semibold">{funcionario.nome}</h1>
          {funcionario.cargo && <p className="text-sm text-muted-foreground">{funcionario.cargo}</p>}
        </div>

        <PontoWidget funcionarioId={funcionario.id} />

        <div className="space-y-2">
          <h2 className="text-sm font-semibold text-muted-foreground">Meu Histórico (últimos 30 dias)</h2>
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data</TableHead>
                    <TableHead>Entrada</TableHead>
                    <TableHead>Saída</TableHead>
                    <TableHead className="text-right">Horas</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {dias.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center py-8 text-muted-foreground text-sm">
                        Nenhuma batida registrada ainda
                      </TableCell>
                    </TableRow>
                  ) : (
                    dias.map((dia) => (
                      <TableRow key={dia.data}>
                        <TableCell className="text-sm">{format(new Date(`${dia.data}T00:00:00`), "dd/MM", { locale: ptBR })}</TableCell>
                        <TableCell className="text-sm">{dia.horaEntrada ?? "-"}</TableCell>
                        <TableCell className="text-sm">{dia.horaSaida ?? (dia.sessaoAberta ? "em andamento" : "-")}</TableCell>
                        <TableCell className="text-right text-sm">{dia.horaSaida ? formatarHoras(dia.horasTrabalhadas) : "-"}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default MeuPonto;
