import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Trash2, Plus, Upload, MessageSquare, Loader2, FileDown } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import {
  SERVICOS_ESGOTO,
  SERVICOS_AGUA,
  CARGOS_PADRAO,
  EQUIPAMENTOS_PADRAO,
  CRIADOUROS,
  MOTIVOS_PARALISACAO,
} from "@/lib/rdoSabespCatalog";
import { downloadRdoSabespPdf } from "@/lib/rdoSabespPdfGenerator";
import logoSabesp from "@/assets/logo-sabesp.png";
import logoCslnr from "@/assets/logo-cslnr.jpg";

interface Props {
  projectId: string;
  initialData?: any;
  onSaved?: () => void;
}

const empty = (projectId: string) => ({
  project_id: projectId,
  report_date: new Date().toISOString().slice(0, 10),
  encarregado: "",
  rua_beco: "",
  criadouro: "",
  criadouro_outro: "",
  epi_utilizado: true,
  condicoes_climaticas: { manha: "", tarde: "", noite: "" },
  qualidade: { ordem_servico: false, bandeirola: false, projeto: false, obs: "" },
  paralisacoes: [] as any[],
  horarios: { diurno: { inicio: "", fim: "" }, noturno: { inicio: "", fim: "" } },
  mao_de_obra: CARGOS_PADRAO.map((c) => ({ cargo: c, terc: 0, contrat: 0 })),
  equipamentos: EQUIPAMENTOS_PADRAO.map((e) => ({ descricao: e, terc: 0, contrat: 0 })),
  servicos_esgoto: SERVICOS_ESGOTO.map((s) => ({ ...s, quantidade: 0 })),
  servicos_agua: SERVICOS_AGUA.map((s) => ({ ...s, quantidade: 0 })),
  observacoes: "",
  responsavel_empreiteira: "",
  responsavel_consorcio: "",
  planilha_foto_url: null as string | null,
  whatsapp_text: null as string | null,
});

export function RdoSabespForm({ projectId, initialData, onSaved }: Props) {
  const [data, setData] = useState<any>(() => initialData || empty(projectId));
  const [saving, setSaving] = useState(false);
  const [parsing, setParsing] = useState(false);
  const [whatsappText, setWhatsappText] = useState("");

  const set = (path: string, val: any) => {
    setData((d: any) => {
      const copy = JSON.parse(JSON.stringify(d));
      const parts = path.split(".");
      let cur = copy;
      for (let i = 0; i < parts.length - 1; i++) cur = cur[parts[i]];
      cur[parts[parts.length - 1]] = val;
      return copy;
    });
  };

  const mergeExtracted = (extracted: any) => {
    setData((d: any) => {
      const merged = { ...d };
      for (const k of Object.keys(extracted || {})) {
        if (extracted[k] !== "" && extracted[k] !== null && extracted[k] !== undefined) {
          // Para arrays de serviços, fazer match por descrição/código
          if (k === "servicos_esgoto" || k === "servicos_agua") {
            const list = [...d[k]];
            for (const s of extracted[k]) {
              const idx = list.findIndex(
                (x: any) =>
                  (s.codigo && x.codigo === s.codigo) ||
                  (s.descricao && x.descricao?.toLowerCase().includes(s.descricao.toLowerCase().slice(0, 15))),
              );
              if (idx >= 0) list[idx] = { ...list[idx], quantidade: Number(s.quantidade) || 0 };
            }
            merged[k] = list;
          } else if (k === "mao_de_obra" || k === "equipamentos") {
            const list = [...d[k]];
            for (const item of extracted[k]) {
              const key = k === "mao_de_obra" ? "cargo" : "descricao";
              const idx = list.findIndex((x: any) => x[key]?.toUpperCase() === item[key]?.toUpperCase());
              if (idx >= 0) list[idx] = { ...list[idx], terc: Number(item.terc) || 0, contrat: Number(item.contrat) || 0 };
              else list.push(item);
            }
            merged[k] = list;
          } else {
            merged[k] = extracted[k];
          }
        }
      }
      return merged;
    });
  };

  const handlePhoto = async (file: File) => {
    setParsing(true);
    try {
      const reader = new FileReader();
      const base64 = await new Promise<string>((resolve, reject) => {
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      const path = `${projectId}/${Date.now()}_${file.name}`;
      const { error: upErr } = await supabase.storage.from("rdo-sabesp-photos").upload(path, file);
      if (upErr) throw upErr;
      const { data: signed } = await supabase.storage.from("rdo-sabesp-photos").createSignedUrl(path, 60 * 60 * 24 * 365);
      set("planilha_foto_url", signed?.signedUrl || null);

      const { data: aiData, error: aiErr } = await supabase.functions.invoke("parse-rdo-sabesp", {
        body: { mode: "image", image_base64: base64 },
      });
      if (aiErr) throw aiErr;
      if (aiData?.error) throw new Error(aiData.error);
      mergeExtracted(aiData?.data || {});
      toast.success("Foto processada e campos preenchidos!");
    } catch (e: any) {
      toast.error("Erro ao processar foto: " + (e.message || e));
    } finally {
      setParsing(false);
    }
  };

  const handleWhatsapp = async () => {
    if (!whatsappText.trim()) return;
    setParsing(true);
    try {
      set("whatsapp_text", whatsappText);
      const { data: aiData, error: aiErr } = await supabase.functions.invoke("parse-rdo-sabesp", {
        body: { mode: "text", text: whatsappText },
      });
      if (aiErr) throw aiErr;
      if (aiData?.error) throw new Error(aiData.error);
      mergeExtracted(aiData?.data || {});
      toast.success("Texto interpretado e campos preenchidos!");
    } catch (e: any) {
      toast.error("Erro ao interpretar texto: " + (e.message || e));
    } finally {
      setParsing(false);
    }
  };

  const save = async () => {
    setSaving(true);
    try {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) throw new Error("Usuário não autenticado");
      const payload = { ...data, project_id: projectId, created_by_user_id: u.user.id };
      let res;
      if (initialData?.id) {
        const { id, created_at, updated_at, created_by_user_id, ...rest } = payload;
        res = await supabase.from("rdo_sabesp" as any).update(rest).eq("id", initialData.id);
      } else {
        res = await supabase.from("rdo_sabesp" as any).insert(payload);
      }
      if (res.error) throw res.error;
      toast.success(initialData?.id ? "RDO atualizado!" : "RDO Sabesp salvo!");
      onSaved?.();
    } catch (e: any) {
      toast.error("Erro ao salvar: " + (e.message || e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Cabeçalho com logos */}
      <Card>
        <CardContent className="p-4 flex items-center justify-between">
          <img src={logoSabesp} alt="Sabesp" className="h-12 object-contain" />
          <div className="text-center">
            <h2 className="font-bold text-lg">RELATÓRIO DIÁRIO DE OBRA (RDO)</h2>
            <p className="text-xs text-muted-foreground">SABESP - Consórcio Se Liga Na Rede</p>
          </div>
          <img src={logoCslnr} alt="CSLNR" className="h-14 object-contain" />
        </CardContent>
      </Card>

      {/* Importação inteligente */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Preenchimento automático (opcional)</CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="foto">
            <TabsList>
              <TabsTrigger value="foto"><Upload className="w-4 h-4 mr-1" /> Foto da planilha</TabsTrigger>
              <TabsTrigger value="texto"><MessageSquare className="w-4 h-4 mr-1" /> Texto WhatsApp</TabsTrigger>
            </TabsList>
            <TabsContent value="foto" className="space-y-2">
              <Input type="file" accept="image/*" disabled={parsing} onChange={(e) => e.target.files?.[0] && handlePhoto(e.target.files[0])} />
              {parsing && <p className="text-xs text-muted-foreground flex items-center gap-2"><Loader2 className="w-3 h-3 animate-spin" /> Lendo planilha com IA...</p>}
            </TabsContent>
            <TabsContent value="texto" className="space-y-2">
              <Textarea rows={5} placeholder="Cole aqui a mensagem do WhatsApp com os dados do RDO..." value={whatsappText} onChange={(e) => setWhatsappText(e.target.value)} />
              <Button size="sm" onClick={handleWhatsapp} disabled={parsing || !whatsappText.trim()}>
                {parsing ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <MessageSquare className="w-4 h-4 mr-1" />}
                Interpretar texto
              </Button>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Identificação */}
      <Card>
        <CardHeader><CardTitle className="text-sm">Identificação</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div><Label>Data</Label><Input type="date" value={data.report_date} onChange={(e) => set("report_date", e.target.value)} /></div>
          <div><Label>Encarregado</Label><Input value={data.encarregado || ""} onChange={(e) => set("encarregado", e.target.value)} /></div>
          <div><Label>Rua / Beco</Label><Input value={data.rua_beco || ""} onChange={(e) => set("rua_beco", e.target.value)} /></div>
          <div>
            <Label>Criadouro</Label>
            <Select value={data.criadouro || ""} onValueChange={(v) => set("criadouro", v)}>
              <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
              <SelectContent>{CRIADOUROS.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          {data.criadouro === "outro" && (
            <div><Label>Especificar</Label><Input value={data.criadouro_outro || ""} onChange={(e) => set("criadouro_outro", e.target.value)} /></div>
          )}
          <div className="flex items-center gap-2 pt-6">
            <Checkbox checked={!!data.epi_utilizado} onCheckedChange={(v) => set("epi_utilizado", !!v)} />
            <Label>Todos utilizando EPIs</Label>
          </div>
        </CardContent>
      </Card>

      {/* Condições / Qualidade / Horários */}
      <Card>
        <CardHeader><CardTitle className="text-sm">Condições, Qualidade e Horários</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="space-y-2">
            <Label>Condições climáticas</Label>
            {(["manha", "tarde", "noite"] as const).map((p) => (
              <div key={p} className="flex items-center gap-2">
                <span className="capitalize w-16 text-xs">{p}</span>
                <Select value={data.condicoes_climaticas?.[p] || ""} onValueChange={(v) => set(`condicoes_climaticas.${p}`, v)}>
                  <SelectTrigger className="h-8"><SelectValue placeholder="—" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="bom">Bom</SelectItem>
                    <SelectItem value="chuva">Chuva</SelectItem>
                    <SelectItem value="improdutivo">Improdutivo</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            ))}
          </div>
          <div className="space-y-2">
            <Label>Qualidade</Label>
            {[
              { key: "ordem_servico", label: "Ordem de Serviço" },
              { key: "bandeirola", label: "Bandeirola" },
              { key: "projeto", label: "Projeto" },
            ].map((q) => (
              <div key={q.key} className="flex items-center gap-2">
                <Checkbox checked={!!data.qualidade?.[q.key]} onCheckedChange={(v) => set(`qualidade.${q.key}`, !!v)} />
                <Label className="text-xs">{q.label}</Label>
              </div>
            ))}
            <Textarea rows={2} placeholder="Obs. qualidade" value={data.qualidade?.obs || ""} onChange={(e) => set("qualidade.obs", e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Horários</Label>
            <div className="text-xs">Diurno</div>
            <div className="flex gap-2">
              <Input type="time" value={data.horarios?.diurno?.inicio || ""} onChange={(e) => set("horarios.diurno.inicio", e.target.value)} />
              <Input type="time" value={data.horarios?.diurno?.fim || ""} onChange={(e) => set("horarios.diurno.fim", e.target.value)} />
            </div>
            <div className="text-xs">Noturno</div>
            <div className="flex gap-2">
              <Input type="time" value={data.horarios?.noturno?.inicio || ""} onChange={(e) => set("horarios.noturno.inicio", e.target.value)} />
              <Input type="time" value={data.horarios?.noturno?.fim || ""} onChange={(e) => set("horarios.noturno.fim", e.target.value)} />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Paralisações */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-sm">Paralisações</CardTitle>
          <Button size="sm" variant="outline" onClick={() => set("paralisacoes", [...(data.paralisacoes || []), { motivo: "", descricao: "" }])}>
            <Plus className="w-4 h-4" />
          </Button>
        </CardHeader>
        <CardContent className="space-y-2">
          {(data.paralisacoes || []).map((p: any, i: number) => (
            <div key={i} className="flex gap-2 items-center">
              <Select value={p.motivo} onValueChange={(v) => { const arr = [...data.paralisacoes]; arr[i].motivo = v; set("paralisacoes", arr); }}>
                <SelectTrigger className="w-56"><SelectValue placeholder="Motivo" /></SelectTrigger>
                <SelectContent>{MOTIVOS_PARALISACAO.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
              </Select>
              <Input placeholder="Descrição" value={p.descricao} onChange={(e) => { const arr = [...data.paralisacoes]; arr[i].descricao = e.target.value; set("paralisacoes", arr); }} />
              <Button variant="ghost" size="icon" onClick={() => set("paralisacoes", data.paralisacoes.filter((_: any, j: number) => j !== i))}>
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Mão de obra */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-sm">Mão de Obra</CardTitle>
          <Button size="sm" variant="outline" onClick={() => set("mao_de_obra", [...data.mao_de_obra, { cargo: "", terc: 0, contrat: 0 }])}>
            <Plus className="w-4 h-4" /> Cargo customizado
          </Button>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-12 gap-2 text-xs font-bold mb-1">
            <div className="col-span-7">CARGO</div>
            <div className="col-span-2 text-center">TERC.</div>
            <div className="col-span-2 text-center">CONTRAT.</div>
          </div>
          {data.mao_de_obra.map((m: any, i: number) => (
            <div key={i} className="grid grid-cols-12 gap-2 mb-1 items-center">
              <Input className="col-span-7 h-8" value={m.cargo} onChange={(e) => { const arr = [...data.mao_de_obra]; arr[i].cargo = e.target.value; set("mao_de_obra", arr); }} />
              <Input className="col-span-2 h-8 text-center" type="number" min={0} value={m.terc} onChange={(e) => { const arr = [...data.mao_de_obra]; arr[i].terc = Number(e.target.value); set("mao_de_obra", arr); }} />
              <Input className="col-span-2 h-8 text-center" type="number" min={0} value={m.contrat} onChange={(e) => { const arr = [...data.mao_de_obra]; arr[i].contrat = Number(e.target.value); set("mao_de_obra", arr); }} />
              <Button className="col-span-1" variant="ghost" size="icon" onClick={() => set("mao_de_obra", data.mao_de_obra.filter((_: any, j: number) => j !== i))}>
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Equipamentos */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-sm">Equipamentos / Veículos</CardTitle>
          <Button size="sm" variant="outline" onClick={() => set("equipamentos", [...data.equipamentos, { descricao: "", terc: 0, contrat: 0 }])}>
            <Plus className="w-4 h-4" /> Equipamento
          </Button>
        </CardHeader>
        <CardContent>
          {data.equipamentos.map((e: any, i: number) => (
            <div key={i} className="grid grid-cols-12 gap-2 mb-1 items-center">
              <Input className="col-span-7 h-8" value={e.descricao} onChange={(ev) => { const arr = [...data.equipamentos]; arr[i].descricao = ev.target.value; set("equipamentos", arr); }} />
              <Input className="col-span-2 h-8 text-center" type="number" min={0} value={e.terc} onChange={(ev) => { const arr = [...data.equipamentos]; arr[i].terc = Number(ev.target.value); set("equipamentos", arr); }} />
              <Input className="col-span-2 h-8 text-center" type="number" min={0} value={e.contrat} onChange={(ev) => { const arr = [...data.equipamentos]; arr[i].contrat = Number(ev.target.value); set("equipamentos", arr); }} />
              <Button className="col-span-1" variant="ghost" size="icon" onClick={() => set("equipamentos", data.equipamentos.filter((_: any, j: number) => j !== i))}>
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Serviços */}
      {([
        { key: "servicos_esgoto", title: "Serviços Executados - ESGOTO" },
        { key: "servicos_agua", title: "Serviços Executados - ÁGUA" },
      ] as const).map((g) => (
        <Card key={g.key}>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-sm">{g.title}</CardTitle>
            <Button size="sm" variant="outline" onClick={() => set(g.key, [...data[g.key], { codigo: "", descricao: "", unidade: "UN", quantidade: 0 }])}>
              <Plus className="w-4 h-4" /> Customizado
            </Button>
          </CardHeader>
          <CardContent className="max-h-96 overflow-y-auto">
            {data[g.key].map((s: any, i: number) => (
              <div key={i} className="grid grid-cols-12 gap-2 mb-1 items-center">
                <Input className="col-span-2 h-8 text-xs" placeholder="Cód." value={s.codigo} onChange={(e) => { const arr = [...data[g.key]]; arr[i].codigo = e.target.value; set(g.key, arr); }} />
                <Input className="col-span-7 h-8 text-xs" value={s.descricao} onChange={(e) => { const arr = [...data[g.key]]; arr[i].descricao = e.target.value; set(g.key, arr); }} />
                <Input className="col-span-1 h-8 text-xs text-center" value={s.unidade} onChange={(e) => { const arr = [...data[g.key]]; arr[i].unidade = e.target.value; set(g.key, arr); }} />
                <Input className="col-span-2 h-8 text-xs text-center" type="number" min={0} step="0.01" value={s.quantidade} onChange={(e) => { const arr = [...data[g.key]]; arr[i].quantidade = Number(e.target.value); set(g.key, arr); }} />
              </div>
            ))}
          </CardContent>
        </Card>
      ))}

      {/* Observações + responsáveis */}
      <Card>
        <CardHeader><CardTitle className="text-sm">Observações e Responsáveis</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <Textarea rows={3} placeholder="Observações gerais" value={data.observacoes || ""} onChange={(e) => set("observacoes", e.target.value)} />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div><Label>Responsável da Empreiteira</Label><Input value={data.responsavel_empreiteira || ""} onChange={(e) => set("responsavel_empreiteira", e.target.value)} /></div>
            <div><Label>Responsável do Consórcio</Label><Input value={data.responsavel_consorcio || ""} onChange={(e) => set("responsavel_consorcio", e.target.value)} /></div>
          </div>
        </CardContent>
      </Card>

      <div className="flex gap-2 justify-end sticky bottom-0 bg-background py-3 border-t">
        <Button variant="outline" onClick={() => downloadRdoSabespPdf(data)}>
          <FileDown className="w-4 h-4 mr-1" /> Pré-visualizar PDF
        </Button>
        <Button onClick={save} disabled={saving}>
          {saving && <Loader2 className="w-4 h-4 animate-spin mr-1" />}
          {initialData?.id ? "Atualizar RDO" : "Salvar RDO Sabesp"}
        </Button>
      </div>
    </div>
  );
}