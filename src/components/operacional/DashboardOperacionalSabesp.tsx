import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { AlertTriangle, Clock, CheckCircle2, FileWarning, Gauge, Receipt } from "lucide-react";

const formatarMoeda = (valor: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(valor);
const DOCUMENTOS_CAMPOS = ["aso", "nr_06", "nr_10", "nr_18", "nr_33", "nr_35", "cnh"];

interface Registro {
  id: string;
  natural_key: string;
  data: Record<string, any>;
}

const diasEntre = (dataStr: string) => {
  const data = new Date(`${dataStr}T00:00:00`);
  if (Number.isNaN(data.getTime())) return null;
  return Math.ceil((data.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
};

// Dashboard do perfil "operacional_sabesp" - lê só op_records já interpretados
// (Fase 3). Alertas automáticos de verdade (fonte_sem_leitura, prazo em
// risco etc. persistidos em op_alerts) ficam para a Fase 6 - aqui é só leitura
// e cálculo de exibição.
export const DashboardOperacionalSabesp = () => {
  const [fonteId, setFonteId] = useState<string>("");

  const { data: fontes = [] } = useQuery({
    queryKey: ["op-fontes-sabesp"],
    queryFn: async () => {
      const { data, error } = await supabase.from("op_sources").select("id, label").eq("profile", "operacional_sabesp").order("label");
      if (error) throw error;
      return data ?? [];
    },
  });

  const useRegistros = (sheetKey: string) =>
    useQuery({
      queryKey: ["op-sabesp", sheetKey, fonteId],
      queryFn: async () => {
        const { data, error } = await supabase
          .from("op_records")
          .select("id, natural_key, data")
          .eq("source_id", fonteId)
          .eq("sheet_key", sheetKey)
          .eq("status", "ativo");
        if (error) throw error;
        return (data ?? []) as Registro[];
      },
      enabled: Boolean(fonteId),
    });

  const { data: chamados = [] } = useRegistros("operacional_sabesp.chamado");
  const { data: ordensServico = [] } = useRegistros("operacional_sabesp.os");
  const { data: medicoes = [] } = useRegistros("operacional_sabesp.medicao_item");
  const { data: programacoes = [] } = useRegistros("operacional_sabesp.programacao");
  const { data: ocorrencias = [] } = useRegistros("operacional_sabesp.ocorrencia");
  const { data: pessoas = [] } = useRegistros("operacional_sabesp.pessoa");

  const chamadosStats = useMemo(() => {
    let abertos = 0;
    let vencidos = 0;
    let emRisco = 0;
    for (const c of chamados) {
      const status = String(c.data.status ?? "").toUpperCase();
      const concluido = status.includes("CONCLU") || status.includes("FECHAD");
      if (!concluido) abertos++;
      const dias = c.data.data_limite ? diasEntre(String(c.data.data_limite)) : null;
      if (dias !== null && !concluido) {
        if (dias < 0) vencidos++;
        else if (dias <= 2) emRisco++;
      }
    }
    return { abertos, vencidos, emRisco };
  }, [chamados]);

  const osSemEvidencia = ordensServico.filter((os) => os.data.sem_evidencia === true).length;

  const medicaoMes = useMemo(() => {
    const apresentado = medicoes.reduce((soma, m) => soma + Number(m.data.valor || 0), 0);
    const aprovado = medicoes.reduce((soma, m) => soma + Number(m.data.valor_aprovado || 0), 0);
    const glosado = medicoes.reduce((soma, m) => soma + Number(m.data.valor_glosado || 0), 0);
    const percentualGlosa = apresentado > 0 ? (glosado / apresentado) * 100 : 0;
    return { apresentado, aprovado, percentualGlosa };
  }, [medicoes]);

  const aderenciaProgramacao = useMemo(() => {
    if (programacoes.length === 0) return 0;
    const executados = programacoes.filter((p) => String(p.data.executou ?? "").toUpperCase().startsWith("S")).length;
    return (executados / programacoes.length) * 100;
  }, [programacoes]);

  const ocorrenciasAbertas = ocorrencias.filter((o) => String(o.data.status ?? "").toUpperCase().includes("ABERT")).length;

  const documentosVencendo = useMemo(() => {
    let contagem = 0;
    for (const p of pessoas) {
      const ativo = String(p.data.ativo ?? "").toUpperCase().startsWith("S");
      if (!ativo) continue;
      for (const campo of DOCUMENTOS_CAMPOS) {
        const valor = p.data[campo];
        if (!valor) continue;
        const dias = diasEntre(String(valor));
        if (dias !== null && dias <= 30) {
          contagem++;
          break;
        }
      }
    }
    return contagem;
  }, [pessoas]);

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="w-64">
        <Label>Fonte</Label>
        <Select value={fonteId} onValueChange={setFonteId}>
          <SelectTrigger>
            <SelectValue placeholder="Selecione uma fonte Operacional Sabesp" />
          </SelectTrigger>
          <SelectContent>
            {fontes.map((f) => (
              <SelectItem key={f.id} value={f.id}>
                {f.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {!fonteId ? (
        <Card className="p-8 text-center text-muted-foreground text-sm">Selecione uma fonte para ver o dashboard</Card>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
          <Card className="p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-muted-foreground">Chamados</span>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </div>
            <div className="text-2xl font-bold">{chamadosStats.abertos}</div>
            <p className="text-xs text-muted-foreground">em aberto</p>
            <div className="flex gap-1 mt-2">
              {chamadosStats.vencidos > 0 && <Badge variant="destructive">{chamadosStats.vencidos} vencidos</Badge>}
              {chamadosStats.emRisco > 0 && (
                <Badge variant="secondary" className="bg-yellow-100 text-yellow-800">
                  {chamadosStats.emRisco} em risco
                </Badge>
              )}
            </div>
          </Card>

          <Card className="p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-muted-foreground">OS sem evidência</span>
              <AlertTriangle className="h-4 w-4 text-destructive" />
            </div>
            <div className="text-2xl font-bold">{osSemEvidencia}</div>
            <p className="text-xs text-muted-foreground">não podem ir para medição</p>
          </Card>

          <Card className="p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-muted-foreground">Aderência da programação</span>
              <Gauge className="h-4 w-4 text-muted-foreground" />
            </div>
            <div className="text-2xl font-bold">{aderenciaProgramacao.toFixed(0)}%</div>
          </Card>

          <Card className="p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-muted-foreground">Medição do mês</span>
              <Receipt className="h-4 w-4 text-muted-foreground" />
            </div>
            <div className="text-lg font-bold">{formatarMoeda(medicaoMes.apresentado)}</div>
            <p className="text-xs text-muted-foreground">
              aprovado {formatarMoeda(medicaoMes.aprovado)} · glosa {medicaoMes.percentualGlosa.toFixed(1)}%
            </p>
          </Card>

          <Card className="p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-muted-foreground">Ocorrências abertas</span>
              <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
            </div>
            <div className="text-2xl font-bold">{ocorrenciasAbertas}</div>
          </Card>

          <Card className="p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-muted-foreground">Documentos vencendo</span>
              <FileWarning className="h-4 w-4 text-amber-600" />
            </div>
            <div className="text-2xl font-bold">{documentosVencendo}</div>
            <p className="text-xs text-muted-foreground">≤30 dias ou vencidos, só ativos</p>
          </Card>
        </div>
      )}
    </div>
  );
};
