import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  Users, DollarSign, Clock, AlertTriangle, 
  TrendingUp, Calendar, Building2, CheckCircle 
} from "lucide-react";
import { formatarMoeda } from "@/utils/cltValidation";
import { format, startOfMonth, endOfMonth } from "date-fns";
import { ptBR } from "date-fns/locale";

export const RHDashboard = () => {
  const hoje = new Date();
  const inicioMes = startOfMonth(hoje).toISOString().split('T')[0];
  const fimMes = endOfMonth(hoje).toISOString().split('T')[0];

  const { data: funcionarios = [] } = useQuery({
    queryKey: ["rh-funcionarios-count"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("funcionarios")
        .select("id, ativo, salario_base")
        .eq("ativo", true);
      if (error) throw error;
      return data || [];
    },
  });

  const { data: escalas = [] } = useQuery({
    queryKey: ["rh-escalas-mes", inicioMes, fimMes],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("escalas_clt")
        .select("*")
        .gte("data", inicioMes)
        .lte("data", fimMes);
      if (error) throw error;
      return data || [];
    },
  });

  const { data: faltas = [] } = useQuery({
    queryKey: ["rh-faltas-mes", inicioMes, fimMes],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("faltas_funcionarios")
        .select("*")
        .gte("data", inicioMes)
        .lte("data", fimMes);
      if (error) throw error;
      return data || [];
    },
  });

  const { data: validacoes = [] } = useQuery({
    queryKey: ["rh-validacoes-pendentes"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("validacoes_clt")
        .select("*")
        .eq("resolvido", false);
      if (error) throw error;
      return data || [];
    },
  });

  // Cálculos
  const totalFuncionarios = funcionarios.length;
  const totalHorasTrabalhadas = escalas.reduce((acc, e) => acc + Number(e.horas_normais || 0) + Number(e.horas_extras || 0), 0);
  const totalHorasExtras = escalas.reduce((acc, e) => acc + Number(e.horas_extras || 0), 0);
  const custoTotalMes = escalas.reduce((acc, e) => acc + Number(e.custo_total || 0), 0);
  const totalFaltas = faltas.length;
  const alertasBloqueio = validacoes.filter(v => v.nivel === 'bloqueio').length;
  const alertasAlerta = validacoes.filter(v => v.nivel === 'alerta').length;

  return (
    <div className="space-y-6">
      {/* Cards de resumo */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Funcionários Ativos</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalFuncionarios}</div>
            <p className="text-xs text-muted-foreground">colaboradores registrados</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Custo Mão de Obra</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatarMoeda(custoTotalMes)}</div>
            <p className="text-xs text-muted-foreground">
              {format(hoje, "MMMM/yyyy", { locale: ptBR })}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Horas Trabalhadas</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalHorasTrabalhadas.toFixed(0)}h</div>
            <p className="text-xs text-muted-foreground">
              {totalHorasExtras.toFixed(0)}h extras
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Alertas CLT</CardTitle>
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              {alertasBloqueio > 0 && (
                <Badge variant="destructive">{alertasBloqueio} bloqueios</Badge>
              )}
              {alertasAlerta > 0 && (
                <Badge variant="secondary" className="bg-yellow-100 text-yellow-800">
                  {alertasAlerta} alertas
                </Badge>
              )}
              {alertasBloqueio === 0 && alertasAlerta === 0 && (
                <Badge variant="outline" className="text-green-600">
                  <CheckCircle className="h-3 w-3 mr-1" />
                  Tudo OK
                </Badge>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Resumo do mês */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Escalas do Mês
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Total de escalas</span>
                <span className="font-medium">{escalas.length}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Folgas programadas</span>
                <span className="font-medium">{escalas.filter(e => e.is_folga).length}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Domingos/Feriados</span>
                <span className="font-medium">
                  {escalas.filter(e => e.is_domingo || e.is_feriado).length}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Faltas registradas</span>
                <span className="font-medium text-red-600">{totalFaltas}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Indicadores CLT
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Média horas/funcionário</span>
                <span className="font-medium">
                  {totalFuncionarios > 0 
                    ? (totalHorasTrabalhadas / totalFuncionarios).toFixed(1) 
                    : 0}h
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">% Horas extras</span>
                <span className="font-medium">
                  {totalHorasTrabalhadas > 0 
                    ? ((totalHorasExtras / totalHorasTrabalhadas) * 100).toFixed(1) 
                    : 0}%
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Custo médio/funcionário</span>
                <span className="font-medium">
                  {formatarMoeda(totalFuncionarios > 0 ? custoTotalMes / totalFuncionarios : 0)}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Taxa de absenteísmo</span>
                <span className="font-medium">
                  {escalas.length > 0 
                    ? ((totalFaltas / escalas.length) * 100).toFixed(1) 
                    : 0}%
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Alertas pendentes */}
      {validacoes.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-amber-600">
              <AlertTriangle className="h-5 w-5" />
              Pendências CLT
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {validacoes.slice(0, 5).map((v) => (
                <div 
                  key={v.id} 
                  className={`p-3 rounded-lg border ${
                    v.nivel === 'bloqueio' 
                      ? 'bg-red-50 border-red-200' 
                      : 'bg-yellow-50 border-yellow-200'
                  }`}
                >
                  <p className="text-sm font-medium">{v.mensagem}</p>
                  <p className="text-xs text-muted-foreground mt-1">{v.tipo_validacao}</p>
                </div>
              ))}
              {validacoes.length > 5 && (
                <p className="text-sm text-muted-foreground text-center">
                  +{validacoes.length - 5} outras pendências
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};
