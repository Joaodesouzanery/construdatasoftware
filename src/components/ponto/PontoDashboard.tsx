import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Clock, AlertTriangle, TrendingUp, Users } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { formatarHoras } from "@/utils/pontoCalculation";
import { PontoExportMenu } from "./PontoExportMenu";
import type { LinhaExportPonto, ResumoExportPonto } from "@/lib/pontoEletronicoExporter";

// KPIs agregados do mês, espelhando o estilo de cards de RHDashboard.tsx.
// Lê diretamente de banco_horas_mensal (já reconciliado pela edge function
// calcular-banco-horas) - não recalcula nada no cliente.
export const PontoDashboard = () => {
  const hoje = new Date();
  const [competencia, setCompetencia] = useState(format(hoje, "yyyy-MM"));
  const inicioMes = `${competencia}-01`;

  const { data: registros = [], isLoading } = useQuery({
    queryKey: ["ponto-dashboard-mes", competencia],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("banco_horas_mensal")
        .select("*, funcionario:funcionarios(nome)")
        .eq("competencia", inicioMes);
      if (error) throw error;
      return data || [];
    },
  });

  const totalExtras = (registros as any[]).reduce(
    (soma, r) => soma + Number(r.horas_extras_50_total || 0) + Number(r.horas_extras_100_total || 0),
    0
  );
  const totalFaltas = (registros as any[]).reduce((soma, r) => soma + Number(r.horas_faltas_total || 0), 0);
  const saldoAgregado = (registros as any[]).reduce((soma, r) => soma + Number(r.saldo_banco_horas_acumulado || 0), 0);
  const funcionariosComSaldoNegativo = (registros as any[]).filter((r) => Number(r.saldo_banco_horas_acumulado || 0) < 0).length;

  const linhasExport: LinhaExportPonto[] = (registros as any[]).map((r) => ({
    data: competencia,
    funcionarioNome: r.funcionario?.nome ?? "-",
    horasTrabalhadas: Number(r.horas_normais_total || 0),
    horasExtras: Number(r.horas_extras_50_total || 0) + Number(r.horas_extras_100_total || 0),
  }));

  const resumoExport: ResumoExportPonto = {
    competencia: format(new Date(`${inicioMes}T00:00:00`), "MMMM/yyyy", { locale: ptBR }),
    horasNormaisTotal: (registros as any[]).reduce((soma, r) => soma + Number(r.horas_normais_total || 0), 0),
    horasExtras50Total: (registros as any[]).reduce((soma, r) => soma + Number(r.horas_extras_50_total || 0), 0),
    horasExtras100Total: (registros as any[]).reduce((soma, r) => soma + Number(r.horas_extras_100_total || 0), 0),
    horasNoturnasTotal: (registros as any[]).reduce((soma, r) => soma + Number(r.horas_noturnas_total || 0), 0),
    horasFaltasTotal: totalFaltas,
    saldoBancoHoras: saldoAgregado,
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-end justify-between">
        <div>
          <Label>Mês</Label>
          <Input type="month" value={competencia} onChange={(e) => setCompetencia(e.target.value)} className="w-40" />
        </div>
        <PontoExportMenu
          titulo="Ponto Eletrônico - Todos os funcionários"
          resumo={resumoExport}
          linhas={linhasExport}
          filenamePrefix={`ponto-geral-${competencia}`}
        />
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <Card className="p-3 sm:p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs sm:text-sm font-medium text-muted-foreground">Funcionários calculados</span>
            <Users className="h-4 w-4 text-muted-foreground hidden sm:block" />
          </div>
          <div className="text-xl sm:text-2xl font-bold">{registros.length}</div>
        </Card>

        <Card className="p-3 sm:p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs sm:text-sm font-medium text-muted-foreground">Horas extras</span>
            <Clock className="h-4 w-4 text-muted-foreground hidden sm:block" />
          </div>
          <div className="text-xl sm:text-2xl font-bold">{formatarHoras(totalExtras)}</div>
        </Card>

        <Card className="p-3 sm:p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs sm:text-sm font-medium text-muted-foreground">Horas de falta</span>
            <AlertTriangle className="h-4 w-4 text-muted-foreground hidden sm:block" />
          </div>
          <div className="text-xl sm:text-2xl font-bold">{formatarHoras(totalFaltas)}</div>
        </Card>

        <Card className="p-3 sm:p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs sm:text-sm font-medium text-muted-foreground">Saldo banco de horas</span>
            <TrendingUp className="h-4 w-4 text-muted-foreground hidden sm:block" />
          </div>
          <div className="text-xl sm:text-2xl font-bold">{formatarHoras(saldoAgregado)}</div>
          {funcionariosComSaldoNegativo > 0 && (
            <p className="text-[10px] sm:text-xs text-destructive mt-1">{funcionariosComSaldoNegativo} com saldo negativo</p>
          )}
        </Card>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Funcionário</TableHead>
                <TableHead>Horas normais</TableHead>
                <TableHead>Extras</TableHead>
                <TableHead>Faltas</TableHead>
                <TableHead>Saldo banco de horas</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8">
                    Carregando...
                  </TableCell>
                </TableRow>
              ) : registros.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                    Nenhum cálculo de banco de horas para este mês ainda. Use "Recalcular mês" na aba Histórico.
                  </TableCell>
                </TableRow>
              ) : (
                (registros as any[]).map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-medium">{r.funcionario?.nome ?? "-"}</TableCell>
                    <TableCell>{formatarHoras(Number(r.horas_normais_total || 0))}</TableCell>
                    <TableCell>{formatarHoras(Number(r.horas_extras_50_total || 0) + Number(r.horas_extras_100_total || 0))}</TableCell>
                    <TableCell>{formatarHoras(Number(r.horas_faltas_total || 0))}</TableCell>
                    <TableCell>
                      <Badge variant={Number(r.saldo_banco_horas_acumulado || 0) < 0 ? "destructive" : "outline"}>
                        {formatarHoras(Number(r.saldo_banco_horas_acumulado || 0))}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
};
