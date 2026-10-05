import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ArrowRight, Plus, Minus, RotateCcw, AlertCircle } from "lucide-react";

type TipoMudanca = "novo" | "alterado" | "ausente" | "reapareceu";
type Severidade = "bloqueante" | "confirmacao" | "aviso";

interface ItemFeed {
  kind: "change" | "exception";
  id: string;
  source_id: string;
  source_label: string;
  run_id: string;
  created_at: string;
  change_type?: TipoMudanca;
  sheet_key?: string;
  natural_key?: string;
  before?: Record<string, unknown> | null;
  after?: Record<string, unknown> | null;
  fields_changed?: string[] | null;
  severity?: Severidade;
  sheet_name?: string;
  row_number?: number;
  type?: string;
  message?: string;
  status?: string;
}

const TIPO_ICON: Record<TipoMudanca, typeof Plus> = {
  novo: Plus,
  alterado: ArrowRight,
  ausente: Minus,
  reapareceu: RotateCcw,
};

const TIPO_LABEL: Record<TipoMudanca, string> = {
  novo: "Novo",
  alterado: "Alterado",
  ausente: "Ausente",
  reapareceu: "Reapareceu",
};

const SEVERIDADE_BADGE: Record<Severidade, "destructive" | "secondary" | "outline"> = {
  bloqueante: "destructive",
  confirmacao: "secondary",
  aviso: "outline",
};

// "Caixa de entrada de mudanças": 3 painéis - filtros com contagem, lista
// combinada de op_changes + op_exceptions, e detalhe com abas Detalhe/Origem/
// Histórico. Nas Fases 2-4 (quando existirem interpretadores reais) esta tela
// passa a ter conteúdo de verdade - a estrutura já fica pronta na Fase 1.
export const CaixaDeMudancas = () => {
  const [filtroTipo, setFiltroTipo] = useState<TipoMudanca | "todos">("todos");
  const [filtroSeveridade, setFiltroSeveridade] = useState<Severidade | "todos">("todos");
  const [selecionado, setSelecionado] = useState<ItemFeed | null>(null);

  // op_sources é admin-only por RLS - o nome da fonte vem de op_sources_lista
  // (function admin+gestor) e é mesclado aqui no cliente, em vez do join
  // embutido ...source:op_sources(label) que o PostgREST faria (esse join
  // respeitaria a RLS de op_sources e voltaria nulo para quem não é admin).
  const { data: fontesPorId = {} } = useQuery({
    queryKey: ["op-fontes-por-id"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("op_sources_lista").select("id, label");
      if (error) throw error;
      const mapa: Record<string, string> = {};
      for (const f of data ?? []) mapa[f.id] = f.label;
      return mapa;
    },
  });

  const { data: changes = [] } = useQuery({
    queryKey: ["op-changes-feed"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("op_changes")
        .select("id, source_id, run_id, sheet_key, natural_key, change_type, before, after, fields_changed, created_at")
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return (data ?? []).map((c: any) => ({
        kind: "change" as const,
        id: c.id,
        source_id: c.source_id,
        source_label: "-",
        run_id: c.run_id,
        created_at: c.created_at,
        change_type: c.change_type,
        sheet_key: c.sheet_key,
        natural_key: c.natural_key,
        before: c.before,
        after: c.after,
        fields_changed: c.fields_changed,
      })) as ItemFeed[];
    },
  });

  const { data: exceptions = [] } = useQuery({
    queryKey: ["op-exceptions-feed"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("op_exceptions")
        .select("id, source_id, run_id, sheet_name, row_number, severity, type, message, status, created_at")
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return (data ?? []).map((e: any) => ({
        kind: "exception" as const,
        id: e.id,
        source_id: e.source_id,
        source_label: "-",
        run_id: e.run_id,
        created_at: e.created_at,
        severity: e.severity,
        sheet_name: e.sheet_name,
        row_number: e.row_number,
        type: e.type,
        message: e.message,
        status: e.status,
      })) as ItemFeed[];
    },
  });

  const { data: origemChange } = useQuery({
    queryKey: ["op-origem-change", selecionado?.kind === "change" ? selecionado.source_id : null, selecionado?.kind === "change" ? selecionado.run_id : null],
    queryFn: async () => {
      if (!selecionado || selecionado.kind !== "change") return null;
      const { data } = await supabase
        .from("op_runs")
        .select("sheet_name, file_name, file_modified_at, received_at")
        .eq("source_id", selecionado.source_id)
        .eq("run_id", selecionado.run_id)
        .limit(1)
        .maybeSingle();
      return data;
    },
    enabled: Boolean(selecionado && selecionado.kind === "change"),
  });

  const { data: historicoChange = [] } = useQuery({
    queryKey: ["op-historico-change", selecionado?.kind === "change" ? selecionado.source_id : null, selecionado?.kind === "change" ? selecionado.sheet_key : null, selecionado?.kind === "change" ? selecionado.natural_key : null],
    queryFn: async () => {
      if (!selecionado || selecionado.kind !== "change") return [];
      const { data } = await supabase
        .from("op_changes")
        .select("id, change_type, created_at")
        .eq("source_id", selecionado.source_id)
        .eq("sheet_key", selecionado.sheet_key)
        .eq("natural_key", selecionado.natural_key)
        .order("created_at", { ascending: false });
      return data ?? [];
    },
    enabled: Boolean(selecionado && selecionado.kind === "change"),
  });

  const feed = useMemo(() => {
    const combinado = [...changes, ...exceptions]
      .map((item) => ({ ...item, source_label: fontesPorId[item.source_id] ?? "-" }))
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    return combinado.filter((item) => {
      if (filtroTipo !== "todos" && item.kind === "change" && item.change_type !== filtroTipo) return false;
      if (filtroTipo !== "todos" && item.kind === "exception") return false;
      if (filtroSeveridade !== "todos" && item.kind === "exception" && item.severity !== filtroSeveridade) return false;
      if (filtroSeveridade !== "todos" && item.kind === "change") return false;
      return true;
    });
  }, [changes, exceptions, fontesPorId, filtroTipo, filtroSeveridade]);

  const contagemTipo = useMemo(() => {
    const c: Record<string, number> = { novo: 0, alterado: 0, ausente: 0, reapareceu: 0 };
    for (const item of changes) if (item.change_type) c[item.change_type] = (c[item.change_type] ?? 0) + 1;
    return c;
  }, [changes]);

  const contagemSeveridade = useMemo(() => {
    const c: Record<string, number> = { bloqueante: 0, confirmacao: 0, aviso: 0 };
    for (const item of exceptions) if (item.severity) c[item.severity] = (c[item.severity] ?? 0) + 1;
    return c;
  }, [exceptions]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[220px_1fr_360px] gap-4">
      {/* Filtros */}
      <Card className="p-3 space-y-4">
        <div>
          <p className="text-xs font-semibold text-muted-foreground mb-2">TIPO DE MUDANÇA</p>
          <div className="space-y-1">
            <FiltroBotao label="Todos" ativo={filtroTipo === "todos"} onClick={() => setFiltroTipo("todos")} contagem={changes.length} />
            {(Object.keys(TIPO_LABEL) as TipoMudanca[]).map((tipo) => (
              <FiltroBotao key={tipo} label={TIPO_LABEL[tipo]} ativo={filtroTipo === tipo} onClick={() => setFiltroTipo(tipo)} contagem={contagemTipo[tipo] ?? 0} />
            ))}
          </div>
        </div>
        <div>
          <p className="text-xs font-semibold text-muted-foreground mb-2">SEVERIDADE (EXCEÇÕES)</p>
          <div className="space-y-1">
            <FiltroBotao label="Todas" ativo={filtroSeveridade === "todos"} onClick={() => setFiltroSeveridade("todos")} contagem={exceptions.length} />
            {(["bloqueante", "confirmacao", "aviso"] as Severidade[]).map((sev) => (
              <FiltroBotao key={sev} label={sev} ativo={filtroSeveridade === sev} onClick={() => setFiltroSeveridade(sev)} contagem={contagemSeveridade[sev] ?? 0} />
            ))}
          </div>
        </div>
      </Card>

      {/* Lista */}
      <Card className="p-0">
        <ScrollArea className="h-[600px]">
          <div className="divide-y">
            {feed.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-12">Nenhuma mudança ou exceção ainda</p>
            ) : (
              feed.map((item) => (
                <button
                  key={`${item.kind}-${item.id}`}
                  onClick={() => setSelecionado(item)}
                  className={`w-full text-left p-3 hover:bg-muted/50 transition-colors ${selecionado?.id === item.id ? "bg-muted" : ""}`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-medium truncate">
                      {item.kind === "change" ? `${item.sheet_key} · ${item.natural_key}` : `${item.sheet_name} · linha ${item.row_number}`}
                    </span>
                    {item.kind === "change" && item.change_type && (
                      <Badge variant="outline" className="shrink-0">
                        {TIPO_LABEL[item.change_type]}
                      </Badge>
                    )}
                    {item.kind === "exception" && item.severity && (
                      <Badge variant={SEVERIDADE_BADGE[item.severity]} className="shrink-0">
                        {item.severity}
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {item.source_label} · {format(new Date(item.created_at), "dd/MM HH:mm", { locale: ptBR })}
                  </p>
                  {item.kind === "exception" && <p className="text-xs mt-1">{item.message}</p>}
                </button>
              ))
            )}
          </div>
        </ScrollArea>
      </Card>

      {/* Detalhe */}
      <Card className="p-3">
        {!selecionado ? (
          <p className="text-sm text-muted-foreground text-center py-12">Selecione um item na lista</p>
        ) : (
          <Tabs defaultValue="detalhe">
            <TabsList className="w-full">
              <TabsTrigger value="detalhe" className="flex-1">
                Detalhe
              </TabsTrigger>
              <TabsTrigger value="origem" className="flex-1">
                Origem
              </TabsTrigger>
              <TabsTrigger value="historico" className="flex-1">
                Histórico
              </TabsTrigger>
            </TabsList>

            <TabsContent value="detalhe" className="space-y-3 mt-3">
              {selecionado.kind === "change" ? (
                <CampoACampo before={selecionado.before} after={selecionado.after} camposAlterados={selecionado.fields_changed} />
              ) : (
                <div className="space-y-2 text-sm">
                  <div className="flex items-start gap-2">
                    <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                    <p>{selecionado.message}</p>
                  </div>
                  <p className="text-xs text-muted-foreground">Tipo: {selecionado.type}</p>
                  <p className="text-xs text-muted-foreground">Status: {selecionado.status}</p>
                </div>
              )}
            </TabsContent>

            <TabsContent value="origem" className="space-y-2 mt-3 text-sm">
              {selecionado.kind === "change" ? (
                <>
                  <LinhaOrigem label="Aba (sheet_key)" valor={selecionado.sheet_key} />
                  <LinhaOrigem label="Execução (run_id)" valor={selecionado.run_id} />
                  <LinhaOrigem label="Aba original" valor={origemChange?.sheet_name} />
                  <LinhaOrigem label="Arquivo" valor={origemChange?.file_name} />
                  <LinhaOrigem
                    label="Arquivo modificado em"
                    valor={origemChange?.file_modified_at ? format(new Date(origemChange.file_modified_at), "dd/MM/yyyy HH:mm", { locale: ptBR }) : undefined}
                  />
                </>
              ) : (
                <>
                  <LinhaOrigem label="Aba" valor={selecionado.sheet_name} />
                  <LinhaOrigem label="Linha" valor={selecionado.row_number?.toString()} />
                  <LinhaOrigem label="Execução (run_id)" valor={selecionado.run_id} />
                </>
              )}
            </TabsContent>

            <TabsContent value="historico" className="space-y-2 mt-3">
              {selecionado.kind === "change" ? (
                historicoChange.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Sem histórico anterior</p>
                ) : (
                  historicoChange.map((h: any) => (
                    <div key={h.id} className="flex justify-between text-sm py-1 border-b last:border-0">
                      <span>{TIPO_LABEL[h.change_type as TipoMudanca] ?? h.change_type}</span>
                      <span className="text-muted-foreground">{format(new Date(h.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}</span>
                    </div>
                  ))
                )
              ) : (
                <p className="text-sm text-muted-foreground">Histórico de exceções chega nas próximas fases</p>
              )}
            </TabsContent>
          </Tabs>
        )}
      </Card>
    </div>
  );
};

const FiltroBotao = ({ label, ativo, onClick, contagem }: { label: string; ativo: boolean; onClick: () => void; contagem: number }) => (
  <Button variant={ativo ? "secondary" : "ghost"} size="sm" className="w-full justify-between" onClick={onClick}>
    <span className="capitalize">{label}</span>
    <Badge variant="outline" className="ml-2">
      {contagem}
    </Badge>
  </Button>
);

const LinhaOrigem = ({ label, valor }: { label: string; valor?: string | null }) => (
  <div className="flex justify-between gap-2 py-1 border-b last:border-0">
    <span className="text-muted-foreground">{label}</span>
    <span className="font-medium text-right">{valor || "-"}</span>
  </div>
);

const CampoACampo = ({
  before,
  after,
  camposAlterados,
}: {
  before?: Record<string, unknown> | null;
  after?: Record<string, unknown> | null;
  camposAlterados?: string[] | null;
}) => {
  const campos = new Set([...Object.keys(before ?? {}), ...Object.keys(after ?? {})]);

  return (
    <div className="space-y-2 text-sm">
      {Array.from(campos).map((campo) => {
        const mudou = camposAlterados?.includes(campo);
        return (
          <div key={campo} className={`flex flex-col gap-0.5 p-2 rounded ${mudou ? "bg-yellow-50" : ""}`}>
            <span className="text-xs font-medium text-muted-foreground">{campo}</span>
            <div className="flex items-center gap-2">
              <span className={mudou ? "line-through text-muted-foreground" : ""}>{String(before?.[campo] ?? "-")}</span>
              {mudou && (
                <>
                  <ArrowRight className="h-3 w-3 shrink-0" />
                  <span className="font-medium">{String(after?.[campo] ?? "-")}</span>
                </>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};
