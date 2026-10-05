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
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

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

// Tabela genérica para os sheet_keys das abas G2 (LISTA) - as colunas vêm do
// próprio `data` de cada registro (campos variam por aba), sempre mostrando
// de onde o número veio (coluna "Linha"). Célula sem dado nunca é "0" ou
// vazio sem explicação (Regra de Ouro 2).
function TabelaGenerica({ registros, mensagemVazio = "sem dado importado ainda" }: { registros: Registro[]; mensagemVazio?: string }) {
  const colunas = useMemo(() => {
    const vistas = new Set<string>();
    const ordem: string[] = [];
    for (const r of registros) {
      for (const chave of Object.keys(r.data)) {
        if (!vistas.has(chave)) {
          vistas.add(chave);
          ordem.push(chave);
        }
      }
    }
    return ordem;
  }, [registros]);

  if (registros.length === 0) {
    return <Card className="p-6 text-center text-sm text-muted-foreground">{mensagemVazio}</Card>;
  }

  return (
    <Card className="p-0 overflow-auto max-h-96">
      <Table>
        <TableHeader>
          <TableRow>
            {colunas.map((c) => (
              <TableHead key={c} className="whitespace-nowrap">
                {c.replace(/_/g, " ")}
              </TableHead>
            ))}
            <TableHead>Linha</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {registros.map((r) => (
            <TableRow key={r.id}>
              {colunas.map((c) => (
                <TableCell key={c} className="whitespace-nowrap">
                  {r.data[c] === undefined || r.data[c] === null || r.data[c] === "" ? "sem dado" : String(r.data[c])}
                </TableCell>
              ))}
              <TableCell className="text-muted-foreground text-xs">{r.source_row ?? "-"}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Card>
  );
}

// Gráfico de linha para os sheet_keys das abas G2 (SÉRIE MENSAL) -
// parametrizado pela linha (seção + rótulo) escolhida pelo usuário, já que
// uma aba de série mensal tem muitas linhas (contas/obras) para plotar.
function GraficoSerieMensal({ registros }: { registros: Registro[] }) {
  const opcoes = useMemo(() => {
    const vistas = new Map<string, string>();
    for (const r of registros) {
      const chave = `${r.data.secao ?? ""}|${r.data.rotulo ?? ""}`;
      if (!vistas.has(chave)) {
        vistas.set(chave, r.data.secao ? `${r.data.secao} · ${r.data.rotulo}` : String(r.data.rotulo ?? ""));
      }
    }
    return Array.from(vistas.entries());
  }, [registros]);

  const [escolhida, setEscolhida] = useState("");
  const chaveAtiva = escolhida || opcoes[0]?.[0] || "";

  const dados = useMemo(() => {
    return registros
      .filter((r) => `${r.data.secao ?? ""}|${r.data.rotulo ?? ""}` === chaveAtiva)
      .sort((a, b) => String(a.data.mes).localeCompare(String(b.data.mes)))
      .map((r) => ({ mes: r.data.mes, valor: Number(r.data.valor) }));
  }, [registros, chaveAtiva]);

  if (registros.length === 0) {
    return <Card className="p-6 text-center text-sm text-muted-foreground">sem dado importado ainda</Card>;
  }

  return (
    <div className="space-y-2">
      <Select value={chaveAtiva} onValueChange={setEscolhida}>
        <SelectTrigger className="w-72">
          <SelectValue placeholder="Escolha a linha" />
        </SelectTrigger>
        <SelectContent>
          {opcoes.map(([chave, rotulo]) => (
            <SelectItem key={chave} value={chave}>
              {rotulo}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Card className="p-4 h-64">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={dados}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="mes" fontSize={11} />
            <YAxis fontSize={11} />
            <Tooltip formatter={(valor: number) => formatarMoeda(valor)} />
            <Line type="monotone" dataKey="valor" stroke="#2563eb" strokeWidth={2} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </Card>
    </div>
  );
}

// Bloco com várias abas do mapa de configuração (gestaoEmpresaGenericas.ts)
// agrupadas sob um mesmo título de seção do dashboard - cada aba mostrada
// em sua própria sub-tabela/gráfico, nunca misturadas (campos diferentes
// por aba).
function BlocoAbas({ fonteId, abas }: { fonteId: string; abas: { titulo: string; sheetKey: string; tipo: "lista" | "serie_mensal" }[] }) {
  return (
    <div className="space-y-4">
      {abas.map((aba) => (
        <BlocoAba key={aba.sheetKey} fonteId={fonteId} {...aba} />
      ))}
    </div>
  );
}

function BlocoAba({ fonteId, titulo, sheetKey, tipo }: { fonteId: string; titulo: string; sheetKey: string; tipo: "lista" | "serie_mensal" }) {
  const { data: registros = [] } = useRegistrosGestao(sheetKey, fonteId);
  return (
    <div className="space-y-2">
      <p className="text-sm font-medium text-muted-foreground">{titulo}</p>
      {tipo === "lista" ? <TabelaGenerica registros={registros} /> : <GraficoSerieMensal registros={registros} />}
    </div>
  );
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
      const { data, error } = await supabase.rpc("op_sources_lista").select("id, label").eq("profile", "gestao_empresa").order("label");
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

          {/* Blocos G3 - as abas sem bloco fixo dedicado, agrupadas por tema
              (dado via op_records, pelos sheet_key do mapa G2) */}
          <section className="space-y-3">
            <h2 className="text-lg font-semibold">Contratos e Obras</h2>
            <BlocoAbas
              fonteId={fonteId}
              abas={[
                { titulo: "03. Contratos", sheetKey: "gestao_empresa.contratos", tipo: "lista" },
                { titulo: "03A. Obras e Contas", sheetKey: "gestao_empresa.obras_e_contas", tipo: "lista" },
                { titulo: "04. Itens de Contrato", sheetKey: "gestao_empresa.itens_de_contrato", tipo: "lista" },
                { titulo: "04A. Aditivo", sheetKey: "gestao_empresa.aditivo", tipo: "lista" },
              ]}
            />
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold">Medição e Faturamento</h2>
            <BlocoAbas
              fonteId={fonteId}
              abas={[
                { titulo: "05. Quantitativos de Campo", sheetKey: "gestao_empresa.quantitativos_de_campo", tipo: "lista" },
                { titulo: "06. Medição (BM)", sheetKey: "gestao_empresa.medicao_bm", tipo: "lista" },
                { titulo: "07. Faturamento e Recebimento", sheetKey: "gestao_empresa.faturamento_e_recebimento", tipo: "lista" },
              ]}
            />
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold">Custos</h2>
            <BlocoAbas
              fonteId={fonteId}
              abas={[
                { titulo: "08. Custos (previsto x pago, por conta)", sheetKey: "gestao_empresa.custos", tipo: "serie_mensal" },
                { titulo: "08B. Todas as Obras", sheetKey: "gestao_empresa.todas_as_obras", tipo: "lista" },
                { titulo: "X2. Plano de Contas", sheetKey: "gestao_empresa.plano_de_contas", tipo: "lista" },
              ]}
            />
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold">Resultado (DRE)</h2>
            <BlocoAbas fonteId={fonteId} abas={[{ titulo: "09. DRE mensal", sheetKey: "gestao_empresa.dre", tipo: "serie_mensal" }]} />
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold">Caixa</h2>
            <BlocoAbas fonteId={fonteId} abas={[{ titulo: "10. Caixa", sheetKey: "gestao_empresa.caixa", tipo: "serie_mensal" }]} />
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold">EVM</h2>
            <BlocoAbas fonteId={fonteId} abas={[{ titulo: "12. EVM e Curva S", sheetKey: "gestao_empresa.evm_e_curva_s", tipo: "lista" }]} />
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold">Cenários</h2>
            <BlocoAbas
              fonteId={fonteId}
              abas={[
                { titulo: "01A. Cenários", sheetKey: "gestao_empresa.cenarios", tipo: "lista" },
                { titulo: "X3. Motor Cenários", sheetKey: "gestao_empresa.motor_cenarios", tipo: "lista" },
              ]}
            />
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold">Changelog</h2>
            <BlocoAbas fonteId={fonteId} abas={[{ titulo: "15. Changelog", sheetKey: "gestao_empresa.changelog", tipo: "lista" }]} />
          </section>
        </>
      )}
    </div>
  );
};
