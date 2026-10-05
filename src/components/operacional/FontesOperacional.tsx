import { useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { Plus, Pencil, Trash2, Database, KeyRound, Copy, AlertTriangle, Pause, Play, Upload, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface FonteOperacional {
  id: string;
  profile: "caixa" | "operacional_sabesp" | "gestao_empresa";
  label: string;
  drive_file_id: string;
  active: boolean;
  last_checked_at: string | null;
  upload_webhook_url: string | null;
  // Nunca o valor em si (op_sources_lista não traz a coluna de segredo) -
  // só se já tem um configurado ou não.
  tem_upload_webhook_secret: boolean;
}

const PERFIL_LABEL: Record<string, string> = {
  caixa: "Controle de Caixa",
  operacional_sabesp: "Operacional Sabesp",
  gestao_empresa: "Gestão da Empresa",
};

// Gera um token aleatório e devolve ele + o hash SHA-256 (hex) a ser guardado.
// O token em si NUNCA é persistido - só o hash, exatamente como o backend
// (op-ingest-sheet) espera comparar.
async function gerarTokenEHash(): Promise<{ token: string; hash: string }> {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  const token = Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("");
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token));
  const hash = Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, "0")).join("");
  return { token, hash };
}

// Mesma sujeira de colagem manual que afeta o token também afeta o ID do
// Drive (espaço, tab ou caractere invisível na ponta faz o 403 de
// op-ingest-sheet nunca ir embora mesmo com o ID "certo") - limpa antes de
// gravar, igual ao normalizarDriveFileId do lado do backend (ingestAuth.ts).
function normalizarDriveFileId(raw: string): string {
  let t = raw.replace(/[\s ​-‍﻿]/g, "");
  const matchCaminho = t.match(/\/d\/([a-zA-Z0-9_-]+)/);
  if (matchCaminho) return matchCaminho[1];
  const matchQuery = t.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  if (matchQuery) return matchQuery[1];
  return t;
}

export const FontesOperacional = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingFonte, setEditingFonte] = useState<FonteOperacional | null>(null);
  const [tokenGerado, setTokenGerado] = useState<string | null>(null);
  const [uploadingId, setUploadingId] = useState<string | null>(null);
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  const [formData, setFormData] = useState({
    profile: "caixa" as FonteOperacional["profile"],
    label: "",
    drive_file_id: "",
    upload_webhook_url: "",
    upload_webhook_secret: "",
  });

  const { data: fontes = [], isLoading } = useQuery({
    queryKey: ["op-fontes"],
    queryFn: async () => {
      // RPC (não a tabela direto) - sem as colunas de segredo (token_hash,
      // upload_webhook_secret), o navegador nunca lê o valor real, nem o
      // admin (só escreve). Function que devolve SETOF aceita .order() como
      // se fosse uma tabela.
      const { data, error } = await supabase.rpc("op_sources_lista").order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as FonteOperacional[];
    },
  });

  // Última execução (origem) de cada fonte - uma única busca em op_runs
  // (como em PainelExecucoes), sem tabela nova, só pra mostrar "Drive
  // automático" ou "Upload de <usuário>" por fonte.
  const { data: ultimaOrigemPorFonte = {} } = useQuery({
    queryKey: ["op-fontes-ultima-origem", fontes.map((f) => f.id)],
    queryFn: async () => {
      if (fontes.length === 0) return {};
      const { data, error } = await supabase
        .from("op_runs")
        .select("source_id, origin, uploaded_by_email, received_at")
        .in("source_id", fontes.map((f) => f.id))
        .order("received_at", { ascending: false })
        .limit(500);
      if (error) throw error;

      const porFonte: Record<string, { origin: string; uploaded_by_email: string | null; received_at: string }> = {};
      for (const run of data ?? []) {
        if (!porFonte[run.source_id]) porFonte[run.source_id] = run;
      }
      return porFonte;
    },
    enabled: fontes.length > 0,
  });

  const uploadMutation = useMutation({
    mutationFn: async ({ sourceId, file }: { sourceId: string; file: File }) => {
      const formData = new FormData();
      formData.set("source_id", sourceId);
      formData.set("arquivo", file);
      const { data, error } = await supabase.functions.invoke("op-upload-planilha", { body: formData });
      if (error) throw new Error(data?.error ?? error.message ?? "Erro ao enviar arquivo");
      return data;
    },
    onSuccess: () => {
      toast({ title: "Enviado", description: "Veja o resultado em Caixa de Mudanças." });
      queryClient.invalidateQueries({ queryKey: ["op-fontes-ultima-origem"] });
    },
    onError: (error: Error) => {
      toast({ title: "Erro ao enviar arquivo", description: error.message, variant: "destructive" });
    },
    onSettled: () => {
      setUploadingId(null);
    },
  });

  const handleArquivoSelecionado = (sourceId: string, file: File | undefined) => {
    if (!file) return;
    if (!file.name.toLowerCase().endsWith(".xlsx")) {
      toast({ title: "Apenas arquivos .xlsx são aceitos", variant: "destructive" });
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast({ title: "Arquivo excede o limite de 10 MB", variant: "destructive" });
      return;
    }
    setUploadingId(sourceId);
    uploadMutation.mutate({ sourceId, file });
  };

  const createMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw new Error("Não autenticado");

      const { token, hash } = await gerarTokenEHash();

      const { error } = await supabase.from("op_sources").insert({
        organization_id: userData.user.id,
        profile: data.profile,
        label: data.label,
        drive_file_id: normalizarDriveFileId(data.drive_file_id),
        token_hash: hash,
        upload_webhook_url: data.upload_webhook_url.trim() || null,
        upload_webhook_secret: data.upload_webhook_secret.trim() || null,
      });
      if (error) throw error;

      return token;
    },
    onSuccess: (token) => {
      queryClient.invalidateQueries({ queryKey: ["op-fontes"] });
      setTokenGerado(token);
      resetForm();
    },
    onError: (error: Error) => {
      toast({ title: "Erro ao cadastrar fonte", description: error.message, variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: typeof formData }) => {
      // O campo do secret nunca vem pré-preenchido com o valor atual (só
      // escreve) - em branco significa "manter o que já está salvo", por
      // isso a coluna só entra no update quando o campo foi preenchido.
      const payload: Record<string, unknown> = {
        profile: data.profile,
        label: data.label,
        drive_file_id: normalizarDriveFileId(data.drive_file_id),
        upload_webhook_url: data.upload_webhook_url.trim() || null,
      };
      if (data.upload_webhook_secret.trim()) {
        payload.upload_webhook_secret = data.upload_webhook_secret.trim();
      }
      const { error } = await supabase.from("op_sources").update(payload).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["op-fontes"] });
      toast({ title: "Fonte atualizada!" });
      resetForm();
    },
    onError: (error: Error) => {
      toast({ title: "Erro ao atualizar", description: error.message, variant: "destructive" });
    },
  });

  const regenerarTokenMutation = useMutation({
    mutationFn: async (id: string) => {
      const { token, hash } = await gerarTokenEHash();
      const { error } = await supabase.from("op_sources").update({ token_hash: hash }).eq("id", id);
      if (error) throw error;
      return token;
    },
    onSuccess: (token) => {
      setTokenGerado(token);
    },
    onError: (error: Error) => {
      toast({ title: "Erro ao gerar novo token", description: error.message, variant: "destructive" });
    },
  });

  const toggleAtivoMutation = useMutation({
    mutationFn: async ({ id, active }: { id: string; active: boolean }) => {
      const { error } = await supabase.from("op_sources").update({ active }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["op-fontes"] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("op_sources").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["op-fontes"] });
      toast({ title: "Fonte removida" });
    },
  });

  const resetForm = () => {
    setFormData({ profile: "caixa", label: "", drive_file_id: "", upload_webhook_url: "", upload_webhook_secret: "" });
    setEditingFonte(null);
    setIsDialogOpen(false);
  };

  const handleSubmit = () => {
    if (!formData.label.trim() || !formData.drive_file_id.trim()) {
      toast({ title: "Nome e ID do arquivo são obrigatórios", variant: "destructive" });
      return;
    }
    if (editingFonte) {
      updateMutation.mutate({ id: editingFonte.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const openEdit = (fonte: FonteOperacional) => {
    setEditingFonte(fonte);
    setFormData({
      profile: fonte.profile,
      label: fonte.label,
      drive_file_id: fonte.drive_file_id,
      upload_webhook_url: fonte.upload_webhook_url ?? "",
      // Nunca pré-preenchido - o valor real não é lido pelo navegador.
      upload_webhook_secret: "",
    });
    setIsDialogOpen(true);
  };

  const copiarToken = () => {
    if (tokenGerado) {
      navigator.clipboard.writeText(tokenGerado);
      toast({ title: "Token copiado" });
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button
          onClick={() => {
            resetForm();
            setIsDialogOpen(true);
          }}
        >
          <Plus className="h-4 w-4 mr-2" />
          Nova Fonte
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Perfil</TableHead>
                <TableHead>ID do arquivo (Drive)</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Última origem</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8">
                    Carregando...
                  </TableCell>
                </TableRow>
              ) : fontes.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                    Nenhuma fonte cadastrada
                  </TableCell>
                </TableRow>
              ) : (
                fontes.map((fonte) => {
                  const ultimaOrigem = ultimaOrigemPorFonte[fonte.id];
                  return (
                  <TableRow key={fonte.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                          <Database className="h-4 w-4 text-primary" />
                        </div>
                        <span className="font-medium">{fonte.label}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{PERFIL_LABEL[fonte.profile]}</Badge>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">{fonte.drive_file_id}</TableCell>
                    <TableCell>
                      <Badge variant={fonte.active ? "outline" : "secondary"} className={fonte.active ? "text-green-600" : ""}>
                        {fonte.active ? "Ativa" : "Inativa"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {!ultimaOrigem ? (
                        "sem leitura ainda"
                      ) : ultimaOrigem.origin === "upload" ? (
                        <>
                          Upload de {ultimaOrigem.uploaded_by_email ?? "usuário"} em{" "}
                          {format(new Date(ultimaOrigem.received_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                        </>
                      ) : (
                        "Drive automático"
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <input
                          ref={(el) => (fileInputRefs.current[fonte.id] = el)}
                          type="file"
                          accept=".xlsx"
                          className="hidden"
                          onChange={(e) => {
                            handleArquivoSelecionado(fonte.id, e.target.files?.[0]);
                            e.target.value = "";
                          }}
                        />
                        <Button
                          variant="ghost"
                          size="icon"
                          title={
                            !fonte.upload_webhook_url
                              ? "Upload ainda não configurado para esta fonte"
                              : "Atualizar agora (upload manual)"
                          }
                          disabled={uploadingId === fonte.id || !fonte.upload_webhook_url}
                          onClick={() => fileInputRefs.current[fonte.id]?.click()}
                        >
                          {uploadingId === fonte.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          title="Gerar novo token"
                          onClick={() => regenerarTokenMutation.mutate(fonte.id)}
                        >
                          <KeyRound className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          title={fonte.active ? "Desativar" : "Ativar"}
                          onClick={() => toggleAtivoMutation.mutate({ id: fonte.id, active: !fonte.active })}
                        >
                          {fonte.active ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => openEdit(fonte)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => deleteMutation.mutate(fonte.id)}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingFonte ? "Editar Fonte" : "Nova Fonte"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Nome *</Label>
              <Input value={formData.label} onChange={(e) => setFormData({ ...formData, label: e.target.value })} placeholder="Controle de Caixa Atual" />
            </div>
            <div>
              <Label>Perfil *</Label>
              <Select value={formData.profile} onValueChange={(v) => setFormData({ ...formData, profile: v as FonteOperacional["profile"] })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="caixa">Controle de Caixa</SelectItem>
                  <SelectItem value="operacional_sabesp">Operacional Sabesp</SelectItem>
                  <SelectItem value="gestao_empresa">Gestão da Empresa</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>ID do arquivo no Google Drive *</Label>
              <Input
                value={formData.drive_file_id}
                onChange={(e) => setFormData({ ...formData, drive_file_id: e.target.value })}
                placeholder="1AbC..."
              />
            </div>
            {!editingFonte && (
              <p className="text-xs text-muted-foreground">
                Ao cadastrar, um token de acesso é gerado e mostrado uma única vez - guarde-o para configurar no n8n.
              </p>
            )}
            <div className="pt-2 border-t space-y-4">
              <p className="text-xs text-muted-foreground">
                Opcional - só necessário para usar o botão "Atualizar agora" (upload manual) nesta fonte.
              </p>
              <div>
                <Label>URL do webhook de upload (n8n)</Label>
                <Input
                  value={formData.upload_webhook_url}
                  onChange={(e) => setFormData({ ...formData, upload_webhook_url: e.target.value })}
                  placeholder="https://..."
                />
              </div>
              <div>
                <Label>
                  {editingFonte ? "Definir/trocar secret do webhook" : "Secret do webhook"}
                  {editingFonte && (
                    <Badge variant="outline" className="ml-2 text-[10px]">
                      {editingFonte.tem_upload_webhook_secret ? "configurado: sim" : "configurado: não"}
                    </Badge>
                  )}
                </Label>
                <Input
                  type="password"
                  value={formData.upload_webhook_secret}
                  onChange={(e) => setFormData({ ...formData, upload_webhook_secret: e.target.value })}
                  placeholder={editingFonte ? "Deixe em branco para manter o atual" : "Enviado no header x-upload-secret"}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Por segurança, o valor já salvo nunca é mostrado aqui - só é possível trocar.
                </p>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={resetForm}>
              Cancelar
            </Button>
            <Button onClick={handleSubmit}>{editingFonte ? "Salvar" : "Cadastrar"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(tokenGerado)} onOpenChange={(open) => !open && setTokenGerado(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Token de acesso</DialogTitle>
          </DialogHeader>
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Mostrado uma única vez</AlertTitle>
            <AlertDescription>
              Copie agora e configure no n8n (header <code>x-ingest-token</code>). Depois de fechar esta janela, não será possível
              recuperá-lo - só gerar um novo.
            </AlertDescription>
          </Alert>
          <div className="flex items-center gap-2 bg-muted p-3 rounded-md font-mono text-xs break-all">
            {tokenGerado}
            <Button variant="ghost" size="icon" onClick={copiarToken} className="shrink-0">
              <Copy className="h-4 w-4" />
            </Button>
          </div>
          <DialogFooter>
            <Button onClick={() => setTokenGerado(null)}>Fechar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
