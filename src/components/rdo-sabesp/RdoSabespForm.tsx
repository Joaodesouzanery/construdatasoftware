import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Upload, MessageSquare, Loader2, FileDown, Save, ArrowRight, ArrowLeft, AlertTriangle, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import {
  SERVICOS_ESGOTO,
  SERVICOS_AGUA,
  CARGOS_PADRAO,
  EQUIPAMENTOS_PADRAO,
} from "@/lib/rdoSabespCatalog";
import { downloadRdoSabespPdf } from "@/lib/rdoSabespPdfGenerator";
import { RdoSabespSheet, getMissingRequired, REQUIRED_LABELS } from "./RdoSabespSheet";

interface Props {
  projectId: string | null;
  initialData?: any;
  onSaved?: () => void;
}

const empty = (projectId: string | null) => ({
  project_id: projectId,
  report_date: new Date().toISOString().slice(0, 10),
  encarregado: "",
  rua_beco: "",
  criadouro: "",
  criadouro_outro: "",
  epi_utilizado: null as boolean | null,
  condicoes_climaticas: { manha: "", tarde: "", noite: "" },
  qualidade: { ordem_servico: false, bandeirola: false, projeto: false, obs: "" },
  paralisacoes: [] as any[],
  paralisacao_outro: "",
  horarios: { diurno: { inicio: "", fim: "" }, noturno: { inicio: "", fim: "" } },
  mao_de_obra: CARGOS_PADRAO.map((c) => ({ cargo: c, terc: 0, contrat: 0 })),
  equipamentos: EQUIPAMENTOS_PADRAO.map((e) => ({ descricao: e, terc: 0, contrat: 0 })),
  servicos_esgoto: SERVICOS_ESGOTO.map((s) => ({ ...s, quantidade: 0 })),
  servicos_agua: SERVICOS_AGUA.map((s) => ({ ...s, quantidade: 0 })),
  observacoes: "",
  responsavel_empreiteira: "",
  responsavel_consorcio: "",
  assinatura_empreiteira_url: null as string | null,
  assinatura_consorcio_url: null as string | null,
  planilha_foto_url: null as string | null,
  whatsapp_text: null as string | null,
});

type Step = "import" | "edit" | "review";

export function RdoSabespForm({ projectId, initialData, onSaved }: Props) {
  const [data, setData] = useState<any>(() => initialData || empty(projectId));
  const [step, setStep] = useState<Step>(initialData ? "edit" : "import");
  const [saving, setSaving] = useState(false);
  const [parsing, setParsing] = useState(false);
  const [whatsappText, setWhatsappText] = useState("");

  const set = (path: string, val: any) => {
    setData((d: any) => {
      const copy = JSON.parse(JSON.stringify(d));
      const parts = path.split(".");
      let cur = copy;
      for (let i = 0; i < parts.length - 1; i++) {
        if (cur[parts[i]] === undefined || cur[parts[i]] === null) cur[parts[i]] = {};
        cur = cur[parts[i]];
      }
      cur[parts[parts.length - 1]] = val;
      return copy;
    });
  };

  const mergeExtracted = (extracted: any) => {
    setData((d: any) => {
      const merged = { ...d };
      for (const k of Object.keys(extracted || {})) {
        const v = extracted[k];
        if (v === "" || v === null || v === undefined) continue;
        if (k === "servicos_esgoto" || k === "servicos_agua") {
          const list = [...d[k]];
          for (const s of v) {
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
          for (const item of v) {
            const key = k === "mao_de_obra" ? "cargo" : "descricao";
            const idx = list.findIndex((x: any) => x[key]?.toUpperCase() === item[key]?.toUpperCase());
            if (idx >= 0) list[idx] = { ...list[idx], terc: Number(item.terc) || 0, contrat: Number(item.contrat) || 0 };
            else list.push(item);
          }
          merged[k] = list;
        } else {
          merged[k] = v;
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

      const folder = projectId || "no-project";
      const path = `${folder}/${Date.now()}_${file.name}`;
      const { error: upErr } = await supabase.storage.from("rdo-sabesp-photos").upload(path, file);
      if (upErr) console.warn("upload warn:", upErr);
      else {
        const { data: signed } = await supabase.storage.from("rdo-sabesp-photos").createSignedUrl(path, 60 * 60 * 24 * 365);
        set("planilha_foto_url", signed?.signedUrl || null);
      }

      const { data: aiData, error: aiErr } = await supabase.functions.invoke("parse-rdo-sabesp", {
        body: { mode: "image", image_base64: base64 },
      });
      if (aiErr) throw aiErr;
      if (aiData?.error) throw new Error(aiData.error);
      const extracted = aiData?.data || {};
      // Se a IA identificou assinatura, usar a foto original como referência visual
      if (extracted.assinatura_empreiteira_presente) {
        extracted.assinatura_empreiteira_url = base64;
      }
      if (extracted.assinatura_consorcio_presente) {
        extracted.assinatura_consorcio_url = base64;
      }
      delete extracted.assinatura_empreiteira_presente;
      delete extracted.assinatura_consorcio_presente;
      mergeExtracted(extracted);
      toast.success("Foto processada! Confira os dados.");
      setStep("edit");
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
      toast.success("Texto interpretado! Confira os dados.");
      setStep("edit");
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

  const missing = getMissingRequired(data);
  const missingLabels = Array.from(missing).map((k) => REQUIRED_LABELS[k] || k);
  const uniqueMissingLabels = Array.from(new Set(missingLabels));

  return (
    <div className="space-y-4">
      {/* Stepper */}
      <div className="flex items-center justify-center gap-2 text-xs">
        {[
          { k: "import", label: "1. Importar (opcional)" },
          { k: "edit", label: "2. Preencher" },
          { k: "review", label: "3. Pré-visualização" },
        ].map((s, i, arr) => (
          <div key={s.k} className="flex items-center gap-2">
            <button
              onClick={() => setStep(s.k as Step)}
              className={`px-3 py-1.5 rounded-full font-medium ${step === s.k ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/70"}`}
            >
              {s.label}
            </button>
            {i < arr.length - 1 && <ArrowRight className="w-3 h-3 text-muted-foreground" />}
          </div>
        ))}
      </div>

      {step === "import" && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Preenchimento automático (opcional)</CardTitle>
            <p className="text-xs text-muted-foreground">
              Envie uma foto da planilha preenchida ou cole um texto do WhatsApp. A IA preenche os campos para você revisar.
              Você também pode pular esta etapa e preencher manualmente.
            </p>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="foto">
              <TabsList>
                <TabsTrigger value="foto"><Upload className="w-4 h-4 mr-1" /> Foto da planilha</TabsTrigger>
                <TabsTrigger value="texto"><MessageSquare className="w-4 h-4 mr-1" /> Texto WhatsApp</TabsTrigger>
              </TabsList>
              <TabsContent value="foto" className="space-y-2 pt-3">
                <Input type="file" accept="image/*" disabled={parsing} onChange={(e) => e.target.files?.[0] && handlePhoto(e.target.files[0])} />
                {parsing && <p className="text-xs text-muted-foreground flex items-center gap-2"><Loader2 className="w-3 h-3 animate-spin" /> Lendo planilha com IA...</p>}
              </TabsContent>
              <TabsContent value="texto" className="space-y-2 pt-3">
                <Textarea rows={6} placeholder="Cole aqui a mensagem do WhatsApp com os dados do RDO..." value={whatsappText} onChange={(e) => setWhatsappText(e.target.value)} />
                <Button size="sm" onClick={handleWhatsapp} disabled={parsing || !whatsappText.trim()}>
                  {parsing ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <MessageSquare className="w-4 h-4 mr-1" />}
                  Interpretar texto
                </Button>
              </TabsContent>
            </Tabs>

            <div className="flex justify-end mt-4">
              <Button variant="outline" onClick={() => setStep("edit")}>
                Pular e preencher manualmente <ArrowRight className="w-4 h-4 ml-1" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {step === "edit" && (
        <>
          <RdoSabespSheet data={data} set={set} />
          <div className="flex gap-2 justify-between sticky bottom-0 bg-background py-3 border-t">
            <Button variant="outline" onClick={() => setStep("import")}>
              <ArrowLeft className="w-4 h-4 mr-1" /> Voltar
            </Button>
            <Button onClick={() => setStep("review")}>
              Pré-visualização e revisão <ArrowRight className="w-4 h-4 ml-1" />
            </Button>
          </div>
        </>
      )}

      {step === "review" && (
        <>
          {uniqueMissingLabels.length > 0 ? (
            <div className="border-l-4 border-destructive bg-destructive/10 p-3 rounded">
              <div className="flex items-center gap-2 font-semibold text-destructive">
                <AlertTriangle className="w-4 h-4" />
                {uniqueMissingLabels.length} campo(s) obrigatório(s) faltando
              </div>
              <ul className="text-xs mt-1 ml-6 list-disc text-destructive">
                {uniqueMissingLabels.map((l) => <li key={l}>{l}</li>)}
              </ul>
              <p className="text-xs mt-2 text-muted-foreground">
                Os campos faltantes estão destacados em vermelho na planilha abaixo. Volte para "Preencher" para corrigir.
              </p>
            </div>
          ) : (
            <div className="border-l-4 border-green-500 bg-green-500/10 p-3 rounded flex items-center gap-2 text-green-700">
              <CheckCircle2 className="w-4 h-4" />
              <span className="font-semibold">Tudo preenchido!</span> Você pode salvar e/ou gerar o PDF.
            </div>
          )}

          <RdoSabespSheet data={data} readOnly missing={missing} />

          <div className="flex gap-2 justify-between sticky bottom-0 bg-background py-3 border-t flex-wrap">
            <Button variant="outline" onClick={() => setStep("edit")}>
              <ArrowLeft className="w-4 h-4 mr-1" /> Voltar e editar
            </Button>
            <div className="flex gap-2 flex-wrap">
              <Button
                variant="outline"
                onClick={() => {
                  if (uniqueMissingLabels.length > 0) {
                    toast.error(`Preencha os ${uniqueMissingLabels.length} campo(s) obrigatório(s) antes de gerar o PDF.`);
                    return;
                  }
                  downloadRdoSabespPdf(data);
                }}
                disabled={uniqueMissingLabels.length > 0}
                title={uniqueMissingLabels.length > 0 ? "Complete os campos obrigatórios" : ""}
              >
                <FileDown className="w-4 h-4 mr-1" /> Gerar PDF
              </Button>
              <Button onClick={save} disabled={saving}>
                {saving ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Save className="w-4 h-4 mr-1" />}
                {initialData?.id ? "Atualizar RDO" : "Salvar RDO Sabesp"}
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}