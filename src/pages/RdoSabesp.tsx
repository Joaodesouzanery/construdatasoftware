import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Building2, FileDown, Pencil, Trash2, Package, Loader2, Plus } from "lucide-react";
import { toast } from "sonner";
import { RdoSabespForm } from "@/components/rdo-sabesp/RdoSabespForm";
import { downloadRdoSabespPdf, downloadRdoSabespBatchZip } from "@/lib/rdoSabespPdfGenerator";
import { Checkbox } from "@/components/ui/checkbox";

export default function RdoSabesp() {
  const navigate = useNavigate();
  const [projects, setProjects] = useState<any[]>([]);
  const [projectId, setProjectId] = useState<string>("");
  const [list, setList] = useState<any[]>([]);
  const [editing, setEditing] = useState<any | null>(null);
  const [showNew, setShowNew] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkLoading, setBulkLoading] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { navigate("/auth"); return; }
      const { data } = await supabase.from("projects").select("*").order("created_at", { ascending: false });
      if (data?.length) { setProjects(data); setProjectId(data[0].id); }
      setLoading(false);
    })();
  }, [navigate]);

  const load = async () => {
    if (!projectId) return;
    const { data, error } = await supabase.from("rdo_sabesp" as any).select("*").eq("project_id", projectId).order("report_date", { ascending: false });
    if (error) { toast.error(error.message); return; }
    setList(data || []);
  };
  useEffect(() => { load(); }, [projectId]);

  const remove = async (id: string) => {
    if (!confirm("Excluir este RDO Sabesp?")) return;
    const { error } = await supabase.from("rdo_sabesp" as any).delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("Excluído");
    load();
  };

  const toggleAll = () => {
    if (selected.size === list.length) setSelected(new Set());
    else setSelected(new Set(list.map((r) => r.id)));
  };

  const exportSelected = async () => {
    if (!selected.size) return toast.error("Selecione ao menos um RDO");
    setBulkLoading(true);
    try {
      const items = list.filter((r) => selected.has(r.id));
      await downloadRdoSabespBatchZip(items);
      toast.success("ZIP gerado");
    } catch (e: any) { toast.error(e.message); }
    finally { setBulkLoading(false); }
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="w-6 h-6 animate-spin" /></div>;

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-secondary/5">
      <header className="border-b bg-card/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate("/dashboard")}><ArrowLeft className="w-5 h-5" /></Button>
            <div className="flex items-center gap-2 text-primary">
              <Building2 className="w-7 h-7" />
              <span className="text-xl font-bold">RDO Sabesp</span>
              <Badge variant="secondary">Sabesp</Badge>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6 space-y-4">
        {projects.length === 0 ? (
          <Card><CardContent className="pt-6 text-center"><p>Crie um projeto primeiro.</p><Button className="mt-3" onClick={() => navigate("/projects")}>Criar Projeto</Button></CardContent></Card>
        ) : (
          <>
            <Card>
              <CardHeader><CardTitle>Projeto</CardTitle><CardDescription>Selecione o projeto para ver e criar RDOs Sabesp</CardDescription></CardHeader>
              <CardContent>
                <Select value={projectId} onValueChange={setProjectId}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{projects.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
                </Select>
              </CardContent>
            </Card>

            <Tabs value={showNew || editing ? "novo" : "lista"} onValueChange={(v) => { if (v === "lista") { setShowNew(false); setEditing(null); } else { setShowNew(true); } }}>
              <TabsList>
                <TabsTrigger value="lista">Histórico ({list.length})</TabsTrigger>
                <TabsTrigger value="novo"><Plus className="w-4 h-4 mr-1" /> {editing ? "Editando" : "Novo RDO Sabesp"}</TabsTrigger>
              </TabsList>

              <TabsContent value="lista" className="space-y-3">
                <div className="flex gap-2 justify-end">
                  <Button variant="outline" onClick={toggleAll}>{selected.size === list.length && list.length ? "Desmarcar todos" : "Selecionar todos"}</Button>
                  <Button onClick={exportSelected} disabled={bulkLoading || !selected.size}>
                    {bulkLoading ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Package className="w-4 h-4 mr-1" />}
                    Exportar selecionados (ZIP)
                  </Button>
                </div>
                <Card>
                  <CardContent className="p-0">
                    {list.length === 0 ? (
                      <p className="p-6 text-center text-muted-foreground text-sm">Nenhum RDO Sabesp ainda. Clique em "Novo RDO Sabesp".</p>
                    ) : list.map((r) => (
                      <div key={r.id} className="flex items-center gap-3 px-4 py-3 border-b last:border-b-0">
                        <Checkbox checked={selected.has(r.id)} onCheckedChange={(v) => { const s = new Set(selected); if (v) s.add(r.id); else s.delete(r.id); setSelected(s); }} />
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{new Date(r.report_date + "T00:00:00").toLocaleDateString("pt-BR")}</span>
                            <Badge variant="secondary">Sabesp</Badge>
                            {r.encarregado && <span className="text-xs text-muted-foreground">• {r.encarregado}</span>}
                          </div>
                          <p className="text-xs text-muted-foreground">{r.rua_beco || "—"}</p>
                        </div>
                        <Button size="sm" variant="ghost" onClick={() => downloadRdoSabespPdf(r)}><FileDown className="w-4 h-4" /></Button>
                        <Button size="sm" variant="ghost" onClick={() => { setEditing(r); setShowNew(false); }}><Pencil className="w-4 h-4" /></Button>
                        <Button size="sm" variant="ghost" onClick={() => remove(r.id)}><Trash2 className="w-4 h-4 text-destructive" /></Button>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="novo">
                <RdoSabespForm projectId={projectId} initialData={editing || undefined} onSaved={() => { setShowNew(false); setEditing(null); load(); }} />
              </TabsContent>
            </Tabs>
          </>
        )}
      </main>
    </div>
  );
}