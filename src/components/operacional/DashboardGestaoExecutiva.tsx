import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertTriangle } from "lucide-react";

const formatarMoeda = (valor: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(valor);

interface Registro {
  id: string;
  natural_key: string;
  data: Record<string, any>;
  source_row?: number;
}

// Ordem aproximada de avanço do funil comercial - heurística, já que o
// prompt original não fixa os nomes exatos das etapas; etapas não
// reconhecidas ficam no fim, na ordem em que apareceram.
const ORDEM_ETAPAS = ["FECHADO", "CONTRATO", "NEGOCIACAO", "PROPOSTA", "QUALIFICACAO", "PROSPECCAO", "LEAD"];
const normalizar = (v: unknown) =>
  String(v ?? "")
    .toUpperCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim();

function useRegistrosGestao(sheetKey: string, fonteId: string) {
  return useQuery({
    queryKey: ["op-gestao", sheetKey, fonteId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("op_records")
        .select("id, natural_key, data, source_row")
        .eq("source_id", fonteId)
        .eq("sheet_key", sheetKey)
        .eq("status", "ativo");
      if (error) throw error;
      return (data ?? []) as Registro[];
    },
    enabled: Boolean(fonteId),
  });
}

// Painel "Gestão Executiva" - os 5 blocos fixos do perfil gestao_empresa, na
// ordem definida: Placar da Semana, Resultado por Obra, Funil Comercial,
// Ponte Lucro -> Caixa, Checks de Integridade. Só leitura/agregação - nenhum
// cálculo de negócio novo acontece aqui (a verdade vem dos interpretadores,
// Fase 4).
export const DashboardGestaoExecutiva = () => {
  const [fonteId, setFonteId] = useState<string>("");
  const [obraSelecionada, setObraSelecionada] = useState<string>("");
  const [modoEconomicoFinanceiro, setModoEconomicoFinanceiro] = useState<"economico" | "financeiro">("economico");
  const [filtroResultado, setFiltroResultado] = useState<"todos" | "OK" | "PENDENTE" | "ERRO">("todos");

  const { data: fontes = [] } = useQuery({
    queryKey: ["op-fontes-gestao"],
    queryFn: async () => {
      const { data, error } = await supabase.from("op_sources").select("id, label").eq("profile", "gestao_empresa").order("label");
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: placar = [] } = useRegistrosGestao("gestao_empresa.placar_semanal", fonteId);
  const { data: resultadoObra = [] } = useRegistrosGestao("gestao_empresa.resultado_por_obra", fonteId);
  const { data: funil = [] } = useRegistrosGestao("gestao_empresa.funil_comercial", fonteId);
  const { data: ponte = [] } = useRegistrosGestao("gestao_empresa.ponte_lucro_caixa", fonteId);
  const { data: checks = [] } = useRegistrosGestao("gestao_empresa.checks_integridade", fonteId);

  const { data: exceptionsFunil = [] } = useQuery({
    queryKey: ["op-gestao-funil-exceptions", fonteId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("op_exceptions")
        .select("row_number")
        .eq("source_id", fonteId)
        .eq("type", "funil_ponderado_diverge")
        .eq("status", "aberta");
      if (error) throw error;
      return (data ?? []).map((e) => e.row_number);
    },
    enabled: Boolean(fonteId),
  });

  const notaDeLeitura = placar.find((p) => p.natural_key === "_nota_de_leitura")?.data.origem_texto as string | undefined;
  const indicadores = placar.filter((p) => p.natural_key !== "_nota_de_leitura");

  const obras = resultadoObra.filter((r) => r.data.tipo === "header");
  const obraAtual = obraSelecionada || obras[0]?.natural_key || "";
  const headerObra = obras.find((r) => r.natural_key === obraAtual);
  const linhasMensais = resultadoObra.filter((r) => r.data.tipo === "mensal" && r.natural_key.startsWith(`${obraAtual}|`));

  const funilOrdenado = useMemo(() => {
    return [...funil].sort((a, b) => {
      const ordemA = ORDEM_ETAPAS.indexOf(normalizar(a.data.etapa));
      const ordemB = ORDEM_ETAPAS.indexOf(normalizar(b.data.etapa));
      const posA = ordemA === -1 ? ORDEM_ETAPAS.length : ordemA;
      const posB = ordemB === -1 ? ORDEM_ETAPAS.length : ordemB;
      if (posA !== posB) return posA - posB;
      return Number(b.data.valor_ponderado || 0) - Number(a.data.valor_ponderado || 0);
    });
  }, [funil]);

  const totalPonderado = funil.reduce((soma, f) => soma + Number(f.data.valor_ponderado || 0), 0);

  const ponteAgrupada = useMemo(() => {
    const porMes = new Map<string, Registro[]>();
    for (const p of ponte) {
      const mes = String(p.data.mes);
      porMes.set(mes, [...(porMes.get(mes) ?? []), p]);
    }
    for (const lista of porMes.values()) lista.sort((a, b) => Number(a.data.ordem_linha) - Number(b.data.ordem_linha));
    return Array.from(porMes.entries());
  }, [ponte]);

  const masterCheck = checks.find((c) => c.natural_key === "_master_check");
  const checksFiltrados = checks.filter((c) => c.natural_key !== "_master_check" && (filtroResultado === "todos" || c.data.resultado === filtroResultado));

  if (!fontes.length) {
    return (
      <Card className="p-6 text-center space-y-2 border-dashed">
        <p className="text-sm font-medium">Nenhuma fonte de Gestão da Empresa cadastrada</p>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="w-64">
        <Label>Fonte</Label>
        <Select value={fonteId} onValueChange={setFonteId}>
          <SelectTrigger>
            <SelectValue placeholder="Selecione uma fonte de Gestão da Empresa" />
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
        <Card className="p-8 text-center text-muted-foreground text-sm">Selecione uma fonte para ver o painel</Card>
      ) : (
        <>
          {/* Bloco 1 - Placar da Semana */}
          <section className="space-y-3">
            <h2 className="text-lg font-semibold">Placar da Semana</h2>
            {notaDeLeitura && (
              <Alert className="border-amber-400 bg-amber-50">
                <AlertTriangle className="h-4 w-4 text-amber-700" />
                <AlertTitle className="text-amber-800">Leitura da semana</AlertTitle>
                <AlertDescription className="text-amber-800">{notaDeLeitura}</AlertDescription>
              </Alert>
            )}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              {indicadores.map((ind) => (
                <Card key={ind.id} className="p-4">
                  <p className="text-xs text-muted-foreground">{ind.data.indicador}</p>
                  <p className="text-xl font-bold">
                    {ind.data.valor === null
                      ? "sem dado"
                      : Math.abs(Number(ind.data.valor)) < 2
                        ? `${(Number(ind.data.valor) * 100).toFixed(2)}%`
                        : formatarMoeda(Number(ind.data.valor))}
                  </p>
                </Card>
              ))}
            </div>
          </section>

          {/* Bloco 2 - Resultado por Obra */}
          <section className="space-y-3">
            <h2 className="text-lg font-semibold">Resultado por Obra</h2>
            <div className="flex flex-wrap items-center gap-3">
              <Select value={obraAtual} onValueChange={setObraSelecionada}>
                <SelectTrigger className="w-48">
                  <SelectValue placeholder="Obra" />
                </SelectTrigger>
                <SelectContent>
                  {obras.map((o) => (
                    <SelectItem key={o.natural_key} value={o.natural_key}>
                      {o.data.obra}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="flex gap-1">
                <Button size="sm" variant={modoEconomicoFinanceiro === "economico" ? "secondary" : "ghost"} onClick={() => setModoEconomicoFinanceiro("economico")}>
                  Econômico
                </Button>
                <Button size="sm" variant={modoEconomicoFinanceiro === "financeiro" ? "secondary" : "ghost"} onClick={() => setModoEconomicoFinanceiro("financeiro")}>
                  Financeiro
                </Button>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              ECONÔMICO = pela competência (quando o serviço foi medido/faturado) · FINANCEIRO = pelo caixa (quando o dinheiro entrou/saiu)
            </p>

            {headerObra && (
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                {["carga_tributos", "resultado_real_acumulado", "margem_real", "resultado_previsto_14_meses", "caixa_acumulado_obra", "pior_caixa_acumulado", "nf_em_atraso"].map(
                  (campo) => (
                    <Card key={campo} className="p-3">
                      <p className="text-[10px] text-muted-foreground uppercase">{campo.replace(/_/g, " ")}</p>
                      <p className="text-sm font-semibold">{headerObra.data[campo] ?? "sem dado importado ainda"}</p>
                    </Card>
                  )
                )}
              </div>
            )}

            {modoEconomicoFinanceiro === "financeiro" ? (
              <Card className="p-6 text-center text-sm text-muted-foreground">sem dado importado ainda</Card>
            ) : (
              <Card className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Mês</TableHead>
                      <TableHead>Medição Prevista</TableHead>
                      <TableHead>Medição Real</TableHead>
                      <TableHead>NF Prevista</TableHead>
                      <TableHead>NF Emitida</TableHead>
                      <TableHead>Custo Previsto</TableHead>
                      <TableHead>Custo Lançado</TableHead>
                      <TableHead>Resultado Previsto</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {linhasMensais.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={8} className="text-center text-muted-foreground py-6">
                          sem dado importado ainda
                        </TableCell>
                      </TableRow>
                    ) : (
                      linhasMensais.map((l) => (
                        <TableRow key={l.id}>
                          <TableCell>{l.data.mes}</TableCell>
                          <TableCell>{l.data.medicao_prevista ?? "sem dado"}</TableCell>
                          <TableCell>{l.data.medicao_real ?? "sem dado"}</TableCell>
                          <TableCell>{l.data.nf_prevista ?? "sem dado"}</TableCell>
                          <TableCell>{l.data.nf_emitida ?? "sem dado"}</TableCell>
                          <TableCell>{l.data.custo_previsto ?? "sem dado"}</TableCell>
                          <TableCell>{l.data.custo_lancado ?? "sem dado"}</TableCell>
                          <TableCell>{l.data.resultado_previsto ?? "sem dado"}</TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </Card>
            )}
          </section>

          {/* Bloco 3 - Funil Comercial */}
          <section className="space-y-3">
            <h2 className="text-lg font-semibold">Funil Comercial</h2>
            <Card className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nº</TableHead>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Etapa</TableHead>
                    <TableHead>Valor Estimado</TableHead>
                    <TableHead>Probab.</TableHead>
                    <TableHead>Valor Ponderado</TableHead>
                    <TableHead>Próximo Passo</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {funilOrdenado.map((f) => (
                    <TableRow key={f.id}>
                      <TableCell>{f.data.numero}</TableCell>
                      <TableCell>{f.data.cliente}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          {f.data.etapa}
                          {f.source_row !== undefined && exceptionsFunil.includes(f.source_row) && (
                            <Badge variant="secondary" className="bg-yellow-100 text-yellow-800 gap-1 text-[10px]">
                              <AlertTriangle className="h-3 w-3" />
                              ponderado diverge
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>{f.data.valor_estimado === null ? "sem valor estimado" : formatarMoeda(Number(f.data.valor_estimado))}</TableCell>
                      <TableCell>{f.data.probabilidade === null ? "sem dado" : `${f.data.probabilidade}%`}</TableCell>
                      <TableCell>{f.data.valor_ponderado === null ? "sem dado" : formatarMoeda(Number(f.data.valor_ponderado))}</TableCell>
                      <TableCell>{f.data.proximo_passo}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <div className="p-3 border-t text-right text-sm font-semibold">Total ponderado: {formatarMoeda(totalPonderado)}</div>
            </Card>
          </section>

          {/* Bloco 4 - Ponte Lucro -> Caixa */}
          <section className="space-y-3">
            <h2 className="text-lg font-semibold">Ponte Lucro → Caixa</h2>
            <p className="text-xs text-muted-foreground">
              Mostra como o lucro contábil do mês se transforma (ou não) em caixa disponível - cada linha é um ajuste entre o resultado e o
              dinheiro que de fato entrou ou saiu.
            </p>
            {ponteAgrupada.length === 0 ? (
              <Card className="p-6 text-center text-sm text-muted-foreground">sem dado importado ainda</Card>
            ) : (
              ponteAgrupada.map(([mes, linhas]) => {
                const soma = linhas.reduce((s, l) => s + Number(l.data.valor || 0), 0);
                return (
                  <Card key={mes} className="p-4">
                    <div className="flex justify-between items-center mb-2">
                      <p className="font-medium">{mes}</p>
                      <Badge variant="outline">soma: {formatarMoeda(soma)}</Badge>
                    </div>
                    <div className="space-y-1">
                      {linhas.map((l) => (
                        <div key={l.id} className="flex justify-between text-sm">
                          <span className="text-muted-foreground">{l.data.componente}</span>
                          <span className={Number(l.data.valor) < 0 ? "text-red-600" : "text-green-600"}>{formatarMoeda(Number(l.data.valor))}</span>
                        </div>
                      ))}
                    </div>
                  </Card>
                );
              })
            )}
          </section>

          {/* Bloco 5 - Checks de Integridade */}
          <section className="space-y-3">
            <h2 className="text-lg font-semibold">Checks de Integridade</h2>
            {masterCheck && (
              <Badge
                variant={masterCheck.data.master_check === "ERRO" ? "destructive" : masterCheck.data.master_check === "PENDENTE" ? "secondary" : "outline"}
                className={masterCheck.data.master_check === "PENDENTE" ? "bg-yellow-100 text-yellow-800" : masterCheck.data.master_check === "OK" ? "text-green-600" : ""}
              >
                MASTER CHECK: {masterCheck.data.master_check} {masterCheck.data.resumo_texto ? `· ${masterCheck.data.resumo_texto}` : ""}
              </Badge>
            )}
            <div className="flex gap-1">
              {(["todos", "OK", "PENDENTE", "ERRO"] as const).map((opcao) => (
                <Button key={opcao} size="sm" variant={filtroResultado === opcao ? "secondary" : "ghost"} onClick={() => setFiltroResultado(opcao)}>
                  {opcao}
                </Button>
              ))}
            </div>
            <Card className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nº</TableHead>
                    <TableHead>Conferência</TableHead>
                    <TableHead>Resultado</TableHead>
                    <TableHead>O que fazer</TableHead>
                    <TableHead>Onde</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {checksFiltrados.map((c) => (
                    <TableRow key={c.id}>
                      <TableCell>{c.data.numero}</TableCell>
                      <TableCell>{c.data.conferencia}</TableCell>
                      <TableCell>
                        <Badge variant={c.data.resultado === "ERRO" ? "destructive" : c.data.resultado === "PENDENTE" ? "secondary" : "outline"}>{c.data.resultado}</Badge>
                      </TableCell>
                      <TableCell>{c.data.o_que_fazer}</TableCell>
                      <TableCell>{c.data.onde}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          </section>
        </>
      )}
    </div>
  );
};
