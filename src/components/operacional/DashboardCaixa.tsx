import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { DollarSign, TrendingDown, Wallet, CheckCircle2, XCircle } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

const formatarMoeda = (valor: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(valor);

interface RegistroCaixa {
  id: string;
  natural_key: string;
  data: Record<string, any>;
}

interface RegistroHoraExtra {
  id: string;
  natural_key: string;
  data: { cargo: string | null; valor: number; pago: boolean };
}

// Dashboard do perfil "caixa" - lê só op_records/op_exceptions já
// interpretados (nenhum cálculo de negócio acontece aqui, só agregação para
// exibição; a verdade dos valores vem do interpretador, Fase 2).
export const DashboardCaixa = () => {
  const [fonteId, setFonteId] = useState<string>("");

  const { data: fontes = [] } = useQuery({
    queryKey: ["op-fontes-caixa"],
    queryFn: async () => {
      const { data, error } = await supabase.from("op_sources").select("id, label").eq("profile", "caixa").order("label");
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: registros = [], isLoading } = useQuery({
    queryKey: ["op-caixa-despesa", fonteId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("op_records")
        .select("id, natural_key, data")
        .eq("source_id", fonteId)
        .eq("sheet_key", "caixa.despesa")
        .eq("status", "ativo");
      if (error) throw error;
      return (data ?? []) as RegistroCaixa[];
    },
    enabled: Boolean(fonteId),
  });

  const { data: registrosHE = [] } = useQuery({
    queryKey: ["op-caixa-hora-extra", fonteId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("op_records")
        .select("id, natural_key, data")
        .eq("source_id", fonteId)
        .eq("sheet_key", "caixa.hora_extra")
        .eq("status", "ativo");
      if (error) throw error;
      return (data ?? []) as RegistroHoraExtra[];
    },
    enabled: Boolean(fonteId),
  });

  const { data: registrosAusencia = [] } = useQuery({
    queryKey: ["op-caixa-ausencia", fonteId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("op_records")
        .select("id, natural_key, data")
        .eq("source_id", fonteId)
        .eq("sheet_key", "caixa.ausencia_ponto")
        .eq("status", "ativo");
      if (error) throw error;
      return (data ?? []) as { id: string; natural_key: string; data: { total: number } }[];
    },
    enabled: Boolean(fonteId),
  });

  const { data: totalNaoConfere } = useQuery({
    queryKey: ["op-caixa-total-exception", fonteId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("op_exceptions")
        .select("id")
        .eq("source_id", fonteId)
        .eq("sheet_name", "DESPESAS")
        .eq("type", "total_nao_confere")
        .eq("status", "aberta")
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return Boolean(data);
    },
    enabled: Boolean(fonteId),
  });

  // "HORAS EXTRAS <MÊS>" muda de nome todo mês - filtra pelo prefixo fixo em
  // vez do nome exato, já que o sheet_name salvo é o nome literal da aba.
  const { data: heNaoConfere } = useQuery({
    queryKey: ["op-caixa-he-exception", fonteId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("op_exceptions")
        .select("id")
        .eq("source_id", fonteId)
        .ilike("sheet_name", "HORAS EXTRAS%")
        .eq("type", "total_nao_confere")
        .eq("status", "aberta")
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return Boolean(data);
    },
    enabled: Boolean(fonteId),
  });

  const { data: ausenciaNaoConfere } = useQuery({
    queryKey: ["op-caixa-ausencia-exception", fonteId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("op_exceptions")
        .select("id")
        .eq("source_id", fonteId)
        .ilike("sheet_name", "AUS%")
        .eq("type", "formula_divergente")
        .eq("status", "aberta")
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return Boolean(data);
    },
    enabled: Boolean(fonteId),
  });

  const receitas = useMemo(() => registros.filter((r) => r.data.tipo === "receita"), [registros]);
  const despesas = useMemo(() => registros.filter((r) => r.data.tipo === "despesa"), [registros]);

  const totalEntradas = receitas.reduce((soma, r) => soma + Number(r.data.valor || 0), 0);
  const totalDespesas = despesas.reduce((soma, r) => soma + Number(r.data.valor || 0), 0);
  const saldo = totalEntradas - totalDespesas;
  const totalHE = registrosHE.reduce((soma, r) => soma + Number(r.data.valor || 0), 0);
  const totalAusencia = registrosAusencia.reduce((soma, r) => soma + Number(r.data.total || 0), 0);

  const porClassificacao = useMemo(() => {
    const mapa = new Map<string, number>();
    for (const d of despesas) {
      const chave = d.data.classificacao || "Sem classificação";
      mapa.set(chave, (mapa.get(chave) ?? 0) + Number(d.data.valor || 0));
    }
    return Array.from(mapa.entries()).sort((a, b) => b[1] - a[1]);
  }, [despesas]);

  const porSolicitante = useMemo(() => {
    const mapa = new Map<string, number>();
    for (const d of despesas) {
      const solicitantes: string[] = d.data.solicitantes ?? [];
      const valorPorSolicitante = solicitantes.length > 0 ? Number(d.data.valor || 0) / solicitantes.length : 0;
      for (const s of solicitantes) {
        mapa.set(s, (mapa.get(s) ?? 0) + valorPorSolicitante);
      }
    }
    return Array.from(mapa.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10);
  }, [despesas]);

  const porMes = useMemo(() => {
    const mapa = new Map<string, number>();
    for (const d of despesas) {
      const mes = String(d.data.data_inicio ?? "").slice(0, 7);
      mapa.set(mes, (mapa.get(mes) ?? 0) + Number(d.data.valor || 0));
    }
    return Array.from(mapa.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [despesas]);

  const hePorCargo = useMemo(() => {
    const mapa = new Map<string, { paga: number; pendente: number }>();
    for (const he of registrosHE) {
      const cargo = he.data.cargo || "Sem cargo";
      const atual = mapa.get(cargo) ?? { paga: 0, pendente: 0 };
      if (he.data.pago) atual.paga += Number(he.data.valor || 0);
      else atual.pendente += Number(he.data.valor || 0);
      mapa.set(cargo, atual);
    }
    return Array.from(mapa.entries());
  }, [registrosHE]);

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="w-64">
        <Label>Fonte</Label>
        <Select value={fonteId} onValueChange={setFonteId}>
          <SelectTrigger>
            <SelectValue placeholder="Selecione uma fonte de Caixa" />
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
      ) : isLoading ? (
        <Card className="p-8 text-center text-muted-foreground text-sm">Carregando...</Card>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4">
            <Card className="p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-muted-foreground">Entradas</span>
                <DollarSign className="h-4 w-4 text-green-600" />
              </div>
              <div className="text-2xl font-bold">{formatarMoeda(totalEntradas)}</div>
            </Card>
            <Card className="p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-muted-foreground">Despesas</span>
                <TrendingDown className="h-4 w-4 text-red-600" />
              </div>
              <div className="text-2xl font-bold">{formatarMoeda(totalDespesas)}</div>
            </Card>
            <Card className="p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-muted-foreground">Saldo</span>
                <Wallet className="h-4 w-4 text-muted-foreground" />
              </div>
              <div className="text-2xl font-bold">{formatarMoeda(saldo)}</div>
              <Badge variant={totalNaoConfere ? "destructive" : "outline"} className="mt-1 gap-1 text-[10px]">
                {totalNaoConfere ? <XCircle className="h-3 w-3" /> : <CheckCircle2 className="h-3 w-3" />}
                {totalNaoConfere ? "não confere com a planilha" : "confere com a planilha"}
              </Badge>
            </Card>
            <Card className="p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-muted-foreground">Total HE</span>
                <DollarSign className="h-4 w-4 text-muted-foreground" />
              </div>
              <div className="text-2xl font-bold">{formatarMoeda(totalHE)}</div>
              <Badge variant={heNaoConfere ? "destructive" : "outline"} className="mt-1 gap-1 text-[10px]">
                {heNaoConfere ? <XCircle className="h-3 w-3" /> : <CheckCircle2 className="h-3 w-3" />}
                {heNaoConfere ? "não confere com a planilha" : "confere com a planilha"}
              </Badge>
            </Card>
            <Card className="p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-muted-foreground">Total Ausência</span>
                <DollarSign className="h-4 w-4 text-muted-foreground" />
              </div>
              <div className="text-2xl font-bold">{formatarMoeda(totalAusencia)}</div>
              <Badge variant={ausenciaNaoConfere ? "destructive" : "outline"} className="mt-1 gap-1 text-[10px]">
                {ausenciaNaoConfere ? <XCircle className="h-3 w-3" /> : <CheckCircle2 className="h-3 w-3" />}
                {ausenciaNaoConfere ? "não confere com a planilha" : "confere com a planilha"}
              </Badge>
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card className="p-4">
              <h3 className="text-sm font-semibold mb-3">Despesas por classificação</h3>
              <div className="space-y-2">
                {porClassificacao.map(([classificacao, valor]) => (
                  <div key={classificacao} className="flex justify-between text-sm">
                    <span className="text-muted-foreground">{classificacao}</span>
                    <span className="font-medium">{formatarMoeda(valor)}</span>
                  </div>
                ))}
              </div>
            </Card>

            <Card className="p-4">
              <h3 className="text-sm font-semibold mb-3">Por solicitante (top 10)</h3>
              <div className="space-y-2">
                {porSolicitante.map(([solicitante, valor]) => (
                  <div key={solicitante} className="flex justify-between text-sm">
                    <span className="text-muted-foreground">{solicitante}</span>
                    <span className="font-medium">{formatarMoeda(valor)}</span>
                  </div>
                ))}
              </div>
            </Card>

            <Card className="p-4">
              <h3 className="text-sm font-semibold mb-3">Despesas por mês</h3>
              <div className="space-y-2">
                {porMes.map(([mes, valor]) => (
                  <div key={mes} className="flex justify-between text-sm">
                    <span className="text-muted-foreground">
                      {mes ? format(new Date(`${mes}-01T00:00:00`), "MMM/yyyy", { locale: ptBR }) : "sem data"}
                    </span>
                    <span className="font-medium">{formatarMoeda(valor)}</span>
                  </div>
                ))}
              </div>
            </Card>

            <Card className="p-4">
              <h3 className="text-sm font-semibold mb-3">Horas extras: paga × pendente por cargo</h3>
              <div className="space-y-2">
                {hePorCargo.map(([cargo, valores]) => (
                  <div key={cargo} className="text-sm">
                    <p className="text-muted-foreground">{cargo}</p>
                    <div className="flex justify-between">
                      <span className="text-green-600">Paga: {formatarMoeda(valores.paga)}</span>
                      <span className="text-amber-600">Pendente: {formatarMoeda(valores.pendente)}</span>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          </div>

          <Card className="p-0">
            <div className="p-3 border-b">
              <h3 className="text-sm font-semibold">Despesas (espelho da planilha)</h3>
            </div>
            <Table>
              <TableHeader className="sticky top-0 bg-background">
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Descrição</TableHead>
                  <TableHead>Valor</TableHead>
                  <TableHead>Classificação</TableHead>
                  <TableHead>Solicitante</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {despesas.map((d, i) => (
                  <TableRow key={d.id} className={i % 2 === 1 ? "bg-muted/30" : ""}>
                    <TableCell>{d.data.data_inicio}</TableCell>
                    <TableCell>{d.data.descricao}</TableCell>
                    <TableCell>{formatarMoeda(Number(d.data.valor || 0))}</TableCell>
                    <TableCell>{d.data.classificacao || "-"}</TableCell>
                    <TableCell>{(d.data.solicitantes ?? []).join(", ") || "-"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </>
      )}
    </div>
  );
};
