import { useState } from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { RefreshCw } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { agruparRegistrosPorDia, formatarHoras } from "@/utils/pontoCalculation";
import { PontoExportMenu } from "./PontoExportMenu";
import type { LinhaExportPonto, ResumoExportPonto } from "@/lib/pontoEletronicoExporter";

// Histórico mensal de um funcionário: agrupa registros_ponto em dias
// (agruparRegistrosPorDia) e mostra o resultado já reconciliado em
// banco_horas_mensal (calculado pela edge function calcular-banco-horas).
export const PontoHistoricoFuncionario = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const hoje = new Date();
  const [funcionarioId, setFuncionarioId] = useState<string>("");
  const [competencia, setCompetencia] = useState(format(hoje, "yyyy-MM"));

  const { data: funcionarios = [] } = useQuery({
    queryKey: ["rh-funcionarios-select"],
    queryFn: async () => {
      const { data, error } = await supabase.from("funcionarios").select("id, nome").eq("ativo", true).order("nome");
      if (error) throw error;
      return data || [];
    },
  });

  const [ano, mes] = competencia.split("-").map(Number);
  const inicioMes = `${competencia}-01`;
  const fimMes = format(new Date(ano, mes, 0), "yyyy-MM-dd");

  const { data: registros = [], isLoading } = useQuery({
    queryKey: ["ponto-registros", funcionarioId, competencia],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("registros_ponto")
        .select("id, tipo, momento")
        .eq("funcionario_id", funcionarioId)
        .gte("momento", `${inicioMes}T00:00:00Z`)
        .lte("momento", `${fimMes}T23:59:59Z`)
        .order("momento", { ascending: true });
      if (error) throw error;
      return data || [];
    },
    enabled: Boolean(funcionarioId),
  });

  const { data: bancoHoras } = useQuery({
    queryKey: ["ponto-banco-horas", funcionarioId, competencia],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("banco_horas_mensal")
        .select("*")
        .eq("funcionario_id", funcionarioId)
        .eq("competencia", inicioMes)
        .maybeSingle();
      if (error) throw error;
      return data as any;
    },
    enabled: Boolean(funcionarioId),
  });

  const { data: faltas = [] } = useQuery({
    queryKey: ["ponto-faltas", funcionarioId, competencia],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("faltas_funcionarios")
        .select("data")
        .eq("funcionario_id", funcionarioId)
        .gte("data", inicioMes)
        .lte("data", fimMes);
      if (error) throw error;
      return data || [];
    },
    enabled: Boolean(funcionarioId),
  });

  const recalcularMutation = useMutation({
    mutationFn: async () => {
      const { data: session } = await supabase.auth.getSession();
      if (!session?.session?.access_token) throw new Error("Sessão não encontrada");

      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/calcular-banco-horas`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${session.session.access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ funcionario_id: funcionarioId, competencia }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Erro ao recalcular");
      return result;
    },
    onSuccess: () => {
      toast({ title: "Banco de horas recalculado!" });
      queryClient.invalidateQueries({ queryKey: ["ponto-banco-horas", funcionarioId, competencia] });
      queryClient.invalidateQueries({ queryKey: ["ponto-faltas", funcionarioId, competencia] });
    },
    onError: (error: Error) => {
      toast({ title: "Erro ao recalcular", description: error.message, variant: "destructive" });
    },
  });

  const dias = agruparRegistrosPorDia(registros as any);
  const datasComFalta = new Set((faltas as any[]).map((f) => f.data));
  const funcionarioSelecionado = funcionarios.find((f: any) => f.id === funcionarioId) as any;

  const linhasExport: LinhaExportPonto[] = dias.map((dia) => ({
    data: dia.data,
    horaEntrada: dia.horaEntrada,
    horaSaida: dia.horaSaida,
    horaInicioIntervalo: dia.horaInicioIntervalo,
    horaFimIntervalo: dia.horaFimIntervalo,
    horasTrabalhadas: dia.horasTrabalhadas,
    falta: datasComFalta.has(dia.data),
  }));

  const resumoExport: ResumoExportPonto = {
    funcionarioNome: funcionarioSelecionado?.nome,
    competencia: format(new Date(`${inicioMes}T00:00:00`), "MMMM/yyyy", { locale: ptBR }),
    horasNormaisTotal: Number(bancoHoras?.horas_normais_total ?? 0),
    horasExtras50Total: Number(bancoHoras?.horas_extras_50_total ?? 0),
    horasExtras100Total: Number(bancoHoras?.horas_extras_100_total ?? 0),
    horasNoturnasTotal: Number(bancoHoras?.horas_noturnas_total ?? 0),
    horasFaltasTotal: Number(bancoHoras?.horas_faltas_total ?? 0),
    saldoBancoHoras: Number(bancoHoras?.saldo_banco_horas_acumulado ?? 0),
    calculadoEm: bancoHoras?.calculado_em ? format(new Date(bancoHoras.calculado_em), "dd/MM/yyyy HH:mm") : undefined,
  };

  const diasComFaltaSemRegistro = [...datasComFalta].filter((data) => !dias.some((d) => d.data === data));

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-end justify-between">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="w-64">
            <Label>Funcionário</Label>
            <Select value={funcionarioId} onValueChange={setFuncionarioId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione um funcionário" />
              </SelectTrigger>
              <SelectContent>
                {funcionarios.map((f: any) => (
                  <SelectItem key={f.id} value={f.id}>
                    {f.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Mês</Label>
            <Input type="month" value={competencia} onChange={(e) => setCompetencia(e.target.value)} />
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => recalcularMutation.mutate()} disabled={!funcionarioId || recalcularMutation.isPending}>
            <RefreshCw className={`h-4 w-4 mr-2 ${recalcularMutation.isPending ? "animate-spin" : ""}`} />
            Recalcular mês
          </Button>
          <PontoExportMenu
            titulo={`Ponto - ${funcionarioSelecionado?.nome ?? ""}`}
            resumo={resumoExport}
            linhas={linhasExport}
            filenamePrefix={`ponto-${(funcionarioSelecionado?.nome ?? "funcionario").toLowerCase().replace(/\s+/g, "-")}-${competencia}`}
            disabled={!funcionarioId}
          />
        </div>
      </div>

      {!funcionarioId ? (
        <Card className="p-8 text-center text-muted-foreground text-sm">Selecione um funcionário para ver o histórico</Card>
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <Card className="p-4">
              <p className="text-xs text-muted-foreground">Horas normais</p>
              <p className="text-xl font-bold">{formatarHoras(Number(bancoHoras?.horas_normais_total ?? 0))}</p>
            </Card>
            <Card className="p-4">
              <p className="text-xs text-muted-foreground">Horas extras</p>
              <p className="text-xl font-bold">
                {formatarHoras(Number(bancoHoras?.horas_extras_50_total ?? 0) + Number(bancoHoras?.horas_extras_100_total ?? 0))}
              </p>
            </Card>
            <Card className="p-4">
              <p className="text-xs text-muted-foreground">Faltas</p>
              <p className="text-xl font-bold">{datasComFalta.size}</p>
            </Card>
            <Card className="p-4">
              <p className="text-xs text-muted-foreground">Saldo banco de horas</p>
              <p className="text-xl font-bold">{formatarHoras(Number(bancoHoras?.saldo_banco_horas_acumulado ?? 0))}</p>
            </Card>
          </div>

          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data</TableHead>
                    <TableHead>Entrada</TableHead>
                    <TableHead>Início Int.</TableHead>
                    <TableHead>Fim Int.</TableHead>
                    <TableHead>Saída</TableHead>
                    <TableHead className="text-right">Horas</TableHead>
                    <TableHead>Situação</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-8">
                        Carregando...
                      </TableCell>
                    </TableRow>
                  ) : dias.length === 0 && diasComFaltaSemRegistro.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                        Nenhuma batida neste mês
                      </TableCell>
                    </TableRow>
                  ) : (
                    <>
                      {dias.map((dia) => (
                        <TableRow key={dia.data}>
                          <TableCell>{format(new Date(`${dia.data}T00:00:00`), "dd/MM (EEE)", { locale: ptBR })}</TableCell>
                          <TableCell>{dia.horaEntrada ?? "-"}</TableCell>
                          <TableCell>{dia.horaInicioIntervalo ?? "-"}</TableCell>
                          <TableCell>{dia.horaFimIntervalo ?? "-"}</TableCell>
                          <TableCell>{dia.horaSaida ?? (dia.sessaoAberta ? "em andamento" : "-")}</TableCell>
                          <TableCell className="text-right">{dia.horaSaida ? formatarHoras(dia.horasTrabalhadas) : "-"}</TableCell>
                          <TableCell>
                            {dia.alertas.some((a) => a.tipo === "bloqueio") ? (
                              <Badge variant="destructive">Alerta CLT</Badge>
                            ) : dia.alertas.some((a) => a.tipo === "alerta") ? (
                              <Badge variant="secondary" className="bg-yellow-100 text-yellow-800">
                                Extras
                              </Badge>
                            ) : (
                              <Badge variant="outline">OK</Badge>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                      {diasComFaltaSemRegistro.map((data) => (
                        <TableRow key={`falta-${data}`}>
                          <TableCell>{format(new Date(`${data}T00:00:00`), "dd/MM (EEE)", { locale: ptBR })}</TableCell>
                          <TableCell colSpan={5} className="text-muted-foreground">
                            Falta não justificada
                          </TableCell>
                          <TableCell>
                            <Badge variant="destructive">Falta</Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
};
