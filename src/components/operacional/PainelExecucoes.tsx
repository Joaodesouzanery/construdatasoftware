import { useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { AlertTriangle, CheckCircle2, Clock, ChevronDown, History, Upload, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
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
  upload_webhook_url: string | null;
}

interface RunResumo {
  sheet_name: string | null;
  status: string;
  received_at: string;
  counts: Record<string, number>;
  file_name: string | null;
  file_modified_at: string | null;
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
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [uploadingId, setUploadingId] = useState<string | null>(null);
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  // op_sources é admin-only por RLS - op_sources_lista() (function
  // admin+gestor) é a mesma fonte que a tela Fontes usa, só sem as colunas
  // de segredo.
  const { data: fontes = [], isLoading } = useQuery({
    queryKey: ["op-fontes-painel"],
    queryFn: async () => {
      const { data, error } = await supabase
        .rpc("op_sources_lista")
        .select("id, label, profile, active, last_checked_at, last_file_name, last_file_modified_at, upload_webhook_url")
        .order("label");
      if (error) throw error;
      return (data || []) as FonteComExecucoes[];
    },
  });

  const uploadMutation = useMutation({
    mutationFn: async ({ sourceId, file }: { sourceId: string; file: File }) => {
      const formData = new FormData();
      formData.set("source_id", sourceId);
      formData.set("arquivo", file);
      const { data, error } = await supabase.functions.invoke("op-upload-planilha", { body: formData });
      if (error) throw new Error(data?.error ?? error.message ?? "Erro ao enviar arquivo");
      return data;
    },
    onSuccess: () => {
      toast({ title: "Enviado", description: "Veja o resultado em Caixa de Mudanças." });
      queryClient.invalidateQueries({ queryKey: ["op-runs-painel"] });
    },
    onError: (error: Error) => {
      toast({ title: "Erro ao enviar arquivo", description: error.message, variant: "destructive" });
    },
    onSettled: () => setUploadingId(null),
  });

  const handleArquivoSelecionado = (sourceId: string, file: File | undefined) => {
    if (!file) return;
    if (!file.name.toLowerCase().endsWith(".xlsx")) {
      toast({ title: "Apenas arquivos .xlsx são aceitos", variant: "destructive" });
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast({ title: "Arquivo excede o limite de 10 MB", variant: "destructive" });
      return;
    }
    setUploadingId(sourceId);
    uploadMutation.mutate({ sourceId, file });
  };

  // Uma única busca em op_runs (até 500 linhas, mais recentes primeiro)
  // alimenta tanto o status por aba (dedupe por sheet_name, já existia)
  // quanto o histórico de atualização por fonte (sem dedupe, até 10 por
  // fonte) - sem tabela nova, só duas formas de agrupar o mesmo dado.
  const { data: dadosRuns } = useQuery({
    queryKey: ["op-runs-painel", fontes.map((f) => f.id)],
    queryFn: async () => {
      if (fontes.length === 0) return { statusPorFonte: {}, historicoPorFonte: {} };
      const { data, error } = await supabase
        .from("op_runs")
        .select("source_id, sheet_name, status, received_at, counts, file_name, file_modified_at")
        .in(
          "source_id",
          fontes.map((f) => f.id)
        )
        .order("received_at", { ascending: false })
        .limit(500);
      if (error) throw error;

      const statusPorFonte: Record<string, RunResumo[]> = {};
      const historicoPorFonte: Record<string, RunResumo[]> = {};
      const vistosPorSheet = new Set<string>();

      for (const run of data ?? []) {
        const chaveSheet = `${run.source_id}|${run.sheet_name}`;
        if (!vistosPorSheet.has(chaveSheet)) {
          vistosPorSheet.add(chaveSheet);
          statusPorFonte[run.source_id] = statusPorFonte[run.source_id] ?? [];
          statusPorFonte[run.source_id].push(run as RunResumo);
        }

        historicoPorFonte[run.source_id] = historicoPorFonte[run.source_id] ?? [];
        if (historicoPorFonte[run.source_id].length < 10) {
          historicoPorFonte[run.source_id].push(run as RunResumo);
        }
      }

      return { statusPorFonte, historicoPorFonte };
    },
    enabled: fontes.length > 0,
  });

  const statusPorFonte = dadosRuns?.statusPorFonte ?? {};
  const historicoPorFonte = dadosRuns?.historicoPorFonte ?? {};

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
        const runs = statusPorFonte[fonte.id] ?? [];
        const historico = historicoPorFonte[fonte.id] ?? [];
        const ultimaAtualizacaoArquivo = historico.find((r) => r.file_modified_at)?.file_modified_at ?? null;

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
                  <input
                    ref={(el) => (fileInputRefs.current[fonte.id] = el)}
                    type="file"
                    accept=".xlsx"
                    className="hidden"
                    onChange={(e) => {
                      handleArquivoSelecionado(fonte.id, e.target.files?.[0]);
                      e.target.value = "";
                    }}
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    title={!fonte.upload_webhook_url ? "Upload ainda não configurado para esta fonte" : "Atualizar agora (upload manual)"}
                    disabled={uploadingId === fonte.id || !fonte.upload_webhook_url}
                    onClick={() => fileInputRefs.current[fonte.id]?.click()}
                  >
                    {uploadingId === fonte.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
                    <span className="ml-1.5 hidden sm:inline">Atualizar agora</span>
                  </Button>
                </div>
              </div>

              <div className="flex flex-col gap-1 text-xs text-muted-foreground">
                <div className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  Última verificação: {fonte.last_checked_at ? format(new Date(fonte.last_checked_at), "dd/MM/yyyy HH:mm", { locale: ptBR }) : "nunca"}
                </div>
                <div>
                  Última atualização do arquivo:{" "}
                  {ultimaAtualizacaoArquivo ? format(new Date(ultimaAtualizacaoArquivo), "dd/MM/yyyy HH:mm", { locale: ptBR }) : "sem dado ainda"}
                </div>
                <div>Próximas verificações: 07h, 16h e 20h</div>
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

              {historico.length > 0 && <HistoricoAtualizacoes historico={historico} />}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
};

const HistoricoAtualizacoes = ({ historico }: { historico: RunResumo[] }) => {
  const [aberto, setAberto] = useState(false);

  return (
    <Collapsible open={aberto} onOpenChange={setAberto} className="pt-2 border-t">
      <CollapsibleTrigger asChild>
        <Button variant="ghost" size="sm" className="h-7 px-2 text-xs text-muted-foreground">
          <History className="h-3 w-3 mr-1" />
          Ver últimas atualizações
          <ChevronDown className={`h-3 w-3 ml-1 transition-transform ${aberto ? "rotate-180" : ""}`} />
        </Button>
      </CollapsibleTrigger>
      <CollapsibleContent className="mt-2 space-y-1">
        {historico.map((r, i) => (
          <div key={i} className="flex justify-between text-xs text-muted-foreground">
            <span>{r.file_name ?? "-"}</span>
            <span>{r.file_modified_at ? format(new Date(r.file_modified_at), "dd/MM/yyyy HH:mm", { locale: ptBR }) : "-"}</span>
          </div>
        ))}
      </CollapsibleContent>
    </Collapsible>
  );
};
