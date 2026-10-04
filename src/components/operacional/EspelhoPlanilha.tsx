import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronDown, History, GitCompare, Search } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { formatarCelula } from "@/utils/operacionalFormatacao";

const PERFIL_LABEL: Record<string, string> = {
  caixa: "Controle de Caixa",
  operacional_sabesp: "Operacional Sabesp",
  gestao_empresa: "Gestão da Empresa",
};

interface FonteResumo {
  id: string;
  label: string;
  profile: string;
}

interface SnapshotResumo {
  id: string;
  sheet_name: string;
  rows: unknown[][];
  formatted_rows: unknown[][] | null;
  received_at: string;
  run_id: string;
}

function colunaParaLetra(indice: number): string {
  let n = indice;
  let letra = "";
  do {
    letra = String.fromCharCode(65 + (n % 26)) + letra;
    n = Math.floor(n / 26) - 1;
  } while (n >= 0);
  return letra;
}

// Mostra o texto exato do Excel quando o payload trouxe `formatted_rows`;
// senão aplica a heurística de formatação; célula vazia nunca vira "0" ou
// qualquer valor inventado (Regra de Ouro 2).
function textoCelula(snapshot: SnapshotResumo, linha: number, coluna: number, cabecalho?: unknown[]): string {
  const bruto = snapshot.rows[linha]?.[coluna];
  const formatado = snapshot.formatted_rows?.[linha]?.[coluna];
  if (formatado !== undefined && formatado !== null && String(formatado).trim() !== "") {
    return String(formatado);
  }
  return formatarCelula(bruto, cabecalho ? String(cabecalho[coluna] ?? "") : undefined);
}

export const EspelhoPlanilha = () => {
  const [fonteId, setFonteId] = useState<string>("");
  const [sheetName, setSheetName] = useState<string>("");
  const [busca, setBusca] = useState("");
  const [comparar, setComparar] = useState(false);
  const [historicoAberto, setHistoricoAberto] = useState(false);
  const [snapshotEscolhidoId, setSnapshotEscolhidoId] = useState<string | null>(null);

  const { data: fontes = [] } = useQuery({
    queryKey: ["op-espelho-fontes"],
    queryFn: async () => {
      const { data, error } = await supabase.from("op_sources").select("id, label, profile").order("label");
      if (error) throw error;
      return (data || []) as FonteResumo[];
    },
  });

  // Lista de abas da fonte - derivada do snapshot mais recente de cada aba
  // (sem tabela nova: a planilha "é" o conjunto de abas que já mandou algo).
  const { data: abasDaFonte = [] } = useQuery({
    queryKey: ["op-espelho-abas", fonteId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("op_snapshots")
        .select("sheet_name, received_at")
        .eq("source_id", fonteId)
        .order("received_at", { ascending: false })
        .limit(2000);
      if (error) throw error;
      const vistos = new Set<string>();
      const nomes: string[] = [];
      for (const row of data ?? []) {
        if (!vistos.has(row.sheet_name)) {
          vistos.add(row.sheet_name);
          nomes.push(row.sheet_name);
        }
      }
      return nomes.sort((a, b) => a.localeCompare(b));
    },
    enabled: Boolean(fonteId),
  });

  // Abas que mudaram na última leva de leitura (mesmo run_id mais recente
  // desta fonte) - deriva de op_runs já gravado, sem tabela nova.
  const { data: abasQueMudaram = [] } = useQuery({
    queryKey: ["op-espelho-abas-mudaram", fonteId],
    queryFn: async () => {
      const { data: ultimoRun } = await supabase
        .from("op_runs")
        .select("run_id, received_at")
        .eq("source_id", fonteId)
        .order("received_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (!ultimoRun) return [];
      const { data, error } = await supabase
        .from("op_runs")
        .select("sheet_name, status")
        .eq("source_id", fonteId)
        .eq("run_id", ultimoRun.run_id)
        .not("status", "in", "(inalterada,batimento)")
        .not("sheet_name", "is", null);
      if (error) throw error;
      return (data ?? []).map((r) => r.sheet_name as string);
    },
    enabled: Boolean(fonteId),
  });

  const { data: historico = [] } = useQuery({
    queryKey: ["op-espelho-historico", fonteId, sheetName],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("op_snapshots")
        .select("id, sheet_name, rows, formatted_rows, received_at, run_id")
        .eq("source_id", fonteId)
        .eq("sheet_name", sheetName)
        .order("received_at", { ascending: false })
        .limit(10);
      if (error) throw error;
      return (data ?? []) as SnapshotResumo[];
    },
    enabled: Boolean(fonteId) && Boolean(sheetName),
  });

  const snapshotAtual = useMemo(() => {
    if (snapshotEscolhidoId) return historico.find((h) => h.id === snapshotEscolhidoId) ?? historico[0] ?? null;
    return historico[0] ?? null;
  }, [historico, snapshotEscolhidoId]);

  const indiceAtual = snapshotAtual ? historico.findIndex((h) => h.id === snapshotAtual.id) : -1;
  const snapshotAnterior = comparar && indiceAtual >= 0 ? historico[indiceAtual + 1] ?? null : null;

  const cabecalho = snapshotAtual?.rows[0];
  const numColunas = Math.max(
    ...(snapshotAtual?.rows.map((l) => l.length) ?? [0]),
    ...(snapshotAnterior?.rows.map((l) => l.length) ?? [0])
  );
  const numLinhas = Math.max(snapshotAtual?.rows.length ?? 0, snapshotAnterior?.rows.length ?? 0);

  const linhasFiltradas = useMemo(() => {
    if (!snapshotAtual) return [];
    const indices = Array.from({ length: numLinhas }, (_, i) => i);
    if (!busca.trim()) return indices;
    const termo = busca.trim().toLowerCase();
    return indices.filter((i) =>
      Array.from({ length: numColunas }, (_, j) => textoCelula(snapshotAtual, i, j, cabecalho))
        .join(" ")
        .toLowerCase()
        .includes(termo)
    );
  }, [snapshotAtual, numLinhas, numColunas, busca, cabecalho]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3">
        <div className="w-64">
          <Select
            value={fonteId}
            onValueChange={(v) => {
              setFonteId(v);
              setSheetName("");
              setSnapshotEscolhidoId(null);
            }}
          >
            <SelectTrigger>
              <SelectValue placeholder="Escolha a fonte" />
            </SelectTrigger>
            <SelectContent>
              {fontes.map((f) => (
                <SelectItem key={f.id} value={f.id}>
                  {f.label} ({PERFIL_LABEL[f.profile] ?? f.profile})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="w-64">
          <Select
            value={sheetName}
            onValueChange={(v) => {
              setSheetName(v);
              setSnapshotEscolhidoId(null);
            }}
            disabled={!fonteId}
          >
            <SelectTrigger>
              <SelectValue placeholder="Escolha a aba" />
            </SelectTrigger>
            <SelectContent>
              {abasDaFonte.map((nome) => (
                <SelectItem key={nome} value={nome}>
                  {nome}
                  {abasQueMudaram.includes(nome) ? " •" : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="relative w-64">
          <Search className="h-4 w-4 absolute left-2.5 top-2.5 text-muted-foreground" />
          <Input className="pl-8" placeholder="Buscar nesta aba" value={busca} onChange={(e) => setBusca(e.target.value)} />
        </div>
        <Button
          variant={comparar ? "default" : "outline"}
          onClick={() => setComparar((v) => !v)}
          disabled={!snapshotAtual || indiceAtual < 0 || !historico[indiceAtual + 1]}
        >
          <GitCompare className="h-4 w-4 mr-2" />
          Comparar com a leitura anterior
        </Button>
      </div>

      {fonteId && abasQueMudaram.length > 0 && (
        <Card className="border-amber-400">
          <CardContent className="p-3 text-sm">
            <span className="font-medium">Abas que mudaram na última leitura ({abasQueMudaram.length}):</span>{" "}
            {abasQueMudaram.map((nome) => (
              <Badge key={nome} variant="outline" className="mr-1">
                {nome}
              </Badge>
            ))}
          </CardContent>
        </Card>
      )}

      {!fonteId || !sheetName ? (
        <Card className="p-8 text-center text-muted-foreground text-sm">Escolha uma fonte e uma aba para ver a planilha.</Card>
      ) : !snapshotAtual ? (
        <Card className="p-8 text-center text-muted-foreground text-sm">Sem leitura ainda para esta aba.</Card>
      ) : (
        <>
          <div className="text-xs text-muted-foreground">
            Leitura de {format(new Date(snapshotAtual.received_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
            {comparar && snapshotAnterior && (
              <> - comparando com {format(new Date(snapshotAnterior.received_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}</>
            )}
          </div>

          <Card>
            <CardContent className="p-0 overflow-auto max-h-[70vh]">
              <table className="text-xs border-collapse w-full">
                <thead className="sticky top-0 bg-muted z-10">
                  <tr>
                    <th className="border px-2 py-1 bg-muted sticky left-0 z-20">#</th>
                    {Array.from({ length: numColunas }, (_, j) => (
                      <th key={j} className="border px-2 py-1 font-mono whitespace-nowrap">
                        {colunaParaLetra(j)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {linhasFiltradas.map((i) => {
                    const linhaNova = comparar && snapshotAnterior && i >= snapshotAnterior.rows.length;
                    const linhaRemovida = comparar && snapshotAnterior && i >= snapshotAtual.rows.length;
                    return (
                      <tr key={i} className={linhaNova ? "bg-green-50" : linhaRemovida ? "bg-red-50 opacity-60" : ""}>
                        <td className="border px-2 py-1 text-muted-foreground sticky left-0 bg-background">{i + 1}</td>
                        {Array.from({ length: numColunas }, (_, j) => {
                          const atual = textoCelula(snapshotAtual, i, j, cabecalho);
                          const anterior = snapshotAnterior ? textoCelula(snapshotAnterior, i, j, cabecalho) : null;
                          const mudou = comparar && snapshotAnterior && !linhaNova && !linhaRemovida && anterior !== atual;
                          return (
                            <td
                              key={j}
                              className={`border px-2 py-1 whitespace-nowrap ${mudou ? "bg-yellow-100 font-medium" : ""}`}
                              title={mudou ? `antes: ${anterior || "(vazio)"} → depois: ${atual || "(vazio)"}` : undefined}
                            >
                              {atual}
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </CardContent>
          </Card>

          <Collapsible open={historicoAberto} onOpenChange={setHistoricoAberto}>
            <CollapsibleTrigger asChild>
              <Button variant="ghost" size="sm" className="text-xs text-muted-foreground">
                <History className="h-3 w-3 mr-1" />
                Histórico de leituras desta aba
                <ChevronDown className={`h-3 w-3 ml-1 transition-transform ${historicoAberto ? "rotate-180" : ""}`} />
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="space-y-1 mt-2">
              {historico.map((h) => (
                <button
                  key={h.id}
                  onClick={() => setSnapshotEscolhidoId(h.id)}
                  className={`block w-full text-left text-xs px-2 py-1 rounded hover:bg-muted ${
                    snapshotAtual?.id === h.id ? "bg-muted font-medium" : ""
                  }`}
                >
                  {format(new Date(h.received_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                </button>
              ))}
            </CollapsibleContent>
          </Collapsible>
        </>
      )}
    </div>
  );
};
