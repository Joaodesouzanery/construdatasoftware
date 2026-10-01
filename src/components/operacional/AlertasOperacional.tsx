import { useState } from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { AlertCircle, AlertTriangle, Info, RefreshCw, Settings } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ConfiguracaoAlertas } from "./ConfiguracaoAlertas";

interface Alerta {
  id: string;
  source_id: string;
  rule_code: string;
  severity: "bloqueante" | "confirmacao" | "aviso";
  message: string;
  subject_key: string;
  opened_at: string;
  source?: { label: string } | null;
}

const SEVERITY_ICON = { bloqueante: AlertCircle, confirmacao: AlertTriangle, aviso: Info };
const SEVERITY_BADGE: Record<string, "destructive" | "secondary" | "outline"> = { bloqueante: "destructive", confirmacao: "secondary", aviso: "outline" };

// Tela "Alertas": lista os op_alerts abertos (fecham sozinhos quando a
// condição deixa de ser verdadeira - não há botão de "resolver" manual aqui,
// de propósito, já que resolver é consequência de corrigir o dado na
// planilha, não de clicar em algo nesta tela).
export const AlertasOperacional = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [filtroSeveridade, setFiltroSeveridade] = useState<string>("todos");
  const [filtroFonte, setFiltroFonte] = useState<string>("todos");
  const [configuracaoAberta, setConfiguracaoAberta] = useState(false);

  const { data: fontes = [] } = useQuery({
    queryKey: ["op-fontes-alertas"],
    queryFn: async () => {
      const { data, error } = await supabase.from("op_sources").select("id, label").order("label");
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: alertas = [], isLoading } = useQuery({
    queryKey: ["op-alertas"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("op_alerts")
        .select("id, source_id, rule_code, severity, message, subject_key, opened_at, source:op_sources(label)")
        .is("closed_at", null)
        .order("opened_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as Alerta[];
    },
  });

  const verificarAgoraMutation = useMutation({
    mutationFn: async () => {
      const { data: session } = await supabase.auth.getSession();
      if (!session?.session?.access_token) throw new Error("Sessão não encontrada");

      let response: Response;
      try {
        response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/op-evaluate-alerts`, {
          method: "POST",
          headers: { Authorization: `Bearer ${session.session.access_token}`, "Content-Type": "application/json" },
        });
      } catch {
        // fetch() rejeitou antes de qualquer resposta - rede/CORS/função não
        // publicada, não um erro de negócio. Mensagem diferente de propósito,
        // para não confundir com uma regra de alerta que falhou.
        throw new Error("Não foi possível conectar à function op-evaluate-alerts. Verifique se ela está publicada no projeto Supabase.");
      }

      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Erro ao verificar alertas");
      return result;
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["op-alertas"] });
      queryClient.invalidateQueries({ queryKey: ["op-alertas-contador"] });
      toast({ title: "Verificação concluída", description: `${result.fontes_avaliadas} fonte(s) avaliada(s), ${result.alerts_opened} alerta(s) nova(s)` });
    },
    onError: (error: Error) => {
      toast({ title: "Erro ao verificar alertas", description: error.message, variant: "destructive" });
    },
  });

  const alertasFiltrados = alertas.filter((a) => {
    if (filtroSeveridade !== "todos" && a.severity !== filtroSeveridade) return false;
    if (filtroFonte !== "todos" && a.source_id !== filtroFonte) return false;
    return true;
  });

  const contagem = { bloqueante: 0, confirmacao: 0, aviso: 0 };
  for (const a of alertas) contagem[a.severity]++;

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-end justify-between">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="w-48">
            <Label>Severidade</Label>
            <Select value={filtroSeveridade} onValueChange={setFiltroSeveridade}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todas ({alertas.length})</SelectItem>
                <SelectItem value="bloqueante">Bloqueante ({contagem.bloqueante})</SelectItem>
                <SelectItem value="confirmacao">Confirmação ({contagem.confirmacao})</SelectItem>
                <SelectItem value="aviso">Aviso ({contagem.aviso})</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="w-56">
            <Label>Fonte</Label>
            <Select value={filtroFonte} onValueChange={setFiltroFonte}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todas as fontes</SelectItem>
                {fontes.map((f) => (
                  <SelectItem key={f.id} value={f.id}>
                    {f.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setConfiguracaoAberta(true)}>
            <Settings className="h-4 w-4 mr-2" />
            Configurar regras
          </Button>
          <Button onClick={() => verificarAgoraMutation.mutate()} disabled={verificarAgoraMutation.isPending}>
            <RefreshCw className={`h-4 w-4 mr-2 ${verificarAgoraMutation.isPending ? "animate-spin" : ""}`} />
            Verificar agora
          </Button>
        </div>
      </div>

      <ConfiguracaoAlertas open={configuracaoAberta} onClose={() => setConfiguracaoAberta(false)} />

      <Card className="p-0">
        <CardContent className="p-0">
          {isLoading ? (
            <p className="text-center text-muted-foreground text-sm py-12">Carregando...</p>
          ) : alertasFiltrados.length === 0 ? (
            <p className="text-center text-muted-foreground text-sm py-12">Nenhum alerta aberto</p>
          ) : (
            <div className="divide-y">
              {alertasFiltrados.map((a) => {
                const Icone = SEVERITY_ICON[a.severity];
                return (
                  <div key={a.id} className="p-4 flex items-start gap-3">
                    <Icone className={`h-4 w-4 mt-0.5 shrink-0 ${a.severity === "bloqueante" ? "text-destructive" : a.severity === "confirmacao" ? "text-amber-600" : "text-muted-foreground"}`} />
                    <div className="flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge variant={SEVERITY_BADGE[a.severity]}>{a.rule_code}</Badge>
                        <span className="text-xs text-muted-foreground">{a.source?.label ?? "-"}</span>
                      </div>
                      <p className="text-sm mt-1">{a.message}</p>
                    </div>
                    <span className="text-xs text-muted-foreground shrink-0">{format(new Date(a.opened_at), "dd/MM HH:mm", { locale: ptBR })}</span>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
