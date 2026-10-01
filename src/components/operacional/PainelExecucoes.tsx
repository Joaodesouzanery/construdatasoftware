import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, CheckCircle2, Clock } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface FonteComExecucoes {
  id: string;
  label: string;
  profile: string;
  active: boolean;
  last_checked_at: string | null;
  last_file_name: string | null;
  last_file_modified_at: string | null;
}

interface RunResumo {
  sheet_name: string | null;
  status: string;
  received_at: string;
  counts: Record<string, number>;
}

const STATUS_LABEL: Record<string, string> = {
  processada: "Processada",
  inalterada: "Inalterada",
  rejeitada: "Rejeitada",
  nao_interpretada: "Não interpretada",
  batimento: "Batimento",
};

const DOZE_HORAS_MS = 12 * 60 * 60 * 1000;

export const PainelExecucoes = () => {
  const { data: fontes = [], isLoading } = useQuery({
    queryKey: ["op-fontes-painel"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("op_sources")
        .select("id, label, profile, active, last_checked_at, last_file_name, last_file_modified_at")
        .order("label");
      if (error) throw error;
      return (data || []) as FonteComExecucoes[];
    },
  });

  const { data: runsPorFonte = {} } = useQuery({
    queryKey: ["op-runs-painel", fontes.map((f) => f.id)],
    queryFn: async () => {
      if (fontes.length === 0) return {};
      const { data, error } = await supabase
        .from("op_runs")
        .select("source_id, sheet_name, status, received_at, counts")
        .in("source_id", fontes.map((f) => f.id))
        .order("received_at", { ascending: false })
        .limit(500);
      if (error) throw error;

      const porFonte: Record<string, RunResumo[]> = {};
      const vistos = new Set<string>();
      for (const run of data ?? []) {
        const chave = `${run.source_id}|${run.sheet_name}`;
        if (vistos.has(chave)) continue;
        vistos.add(chave);
        porFonte[run.source_id] = porFonte[run.source_id] ?? [];
        porFonte[run.source_id].push(run as RunResumo);
      }
      return porFonte;
    },
    enabled: fontes.length > 0,
  });

  if (isLoading) {
    return <Card className="p-8 text-center text-muted-foreground text-sm">Carregando...</Card>;
  }

  if (fontes.length === 0) {
    return (
      <Card className="p-6 text-center space-y-2 border-dashed">
        <AlertTriangle className="h-8 w-8 mx-auto text-muted-foreground" />
        <p className="text-sm font-medium">Nenhuma fonte cadastrada</p>
        <p className="text-sm text-muted-foreground">Cadastre uma fonte na aba "Fontes" para a automação do n8n começar a enviar dados.</p>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {fontes.map((fonte) => {
        const atrasada = fonte.last_checked_at ? Date.now() - new Date(fonte.last_checked_at).getTime() > DOZE_HORAS_MS : true;
        const runs = runsPorFonte[fonte.id] ?? [];

        return (
          <Card key={fonte.id} className={atrasada && fonte.active ? "border-destructive" : ""}>
            <CardContent className="p-4 space-y-3">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div>
                  <p className="font-medium">{fonte.label}</p>
                  <p className="text-xs text-muted-foreground">{fonte.last_file_name ?? "sem leitura ainda"}</p>
                </div>
                <div className="flex items-center gap-2">
                  {!fonte.active && <Badge variant="secondary">Inativa</Badge>}
                  {fonte.active && atrasada && (
                    <Badge variant="destructive" className="gap-1">
                      <AlertTriangle className="h-3 w-3" />
                      Automação parada
                    </Badge>
                  )}
                  {fonte.active && !atrasada && (
                    <Badge variant="outline" className="text-green-600 gap-1">
                      <CheckCircle2 className="h-3 w-3" />
                      OK
                    </Badge>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <Clock className="h-3 w-3" />
                Última verificação:{" "}
                {fonte.last_checked_at ? format(new Date(fonte.last_checked_at), "dd/MM/yyyy HH:mm", { locale: ptBR }) : "nunca"}
                {fonte.last_file_modified_at && (
                  <span>· arquivo modificado em {format(new Date(fonte.last_file_modified_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}</span>
                )}
              </div>

              {runs.length > 0 && (
                <div className="flex flex-wrap gap-2 pt-2 border-t">
                  {runs.map((run) => (
                    <Badge key={run.sheet_name ?? "batimento"} variant="outline" className="text-xs">
                      {run.sheet_name ?? "(batimento)"}: {STATUS_LABEL[run.status] ?? run.status}
                    </Badge>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
};
