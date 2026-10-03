import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { useToast } from "@/hooks/use-toast";
import { ALERT_RULES, PERFIL_LABEL, type Severidade } from "@/utils/operacionalAlertRules";

interface RegraForm {
  enabled: boolean;
  severity: Severidade;
  params: Record<string, number>;
}

interface ConfiguracaoAlertasProps {
  open: boolean;
  onClose: () => void;
}

// Tela de edição dos limiares/severidade de cada regra de alerta
// (op_alert_rules). Salva tudo de uma vez (upsert em lote) - sem linha
// cadastrada ainda, a regra roda com o default do catálogo; depois de salvar
// aqui, vale a partir da PRÓXIMA avaliação (o avaliador lê a tabela a cada
// chamada, sem cache).
export const ConfiguracaoAlertas = ({ open, onClose }: ConfiguracaoAlertasProps) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [form, setForm] = useState<Record<string, RegraForm>>({});

  const { data: regrasCadastradas } = useQuery({
    queryKey: ["op-alert-rules"],
    queryFn: async () => {
      const { data, error } = await supabase.from("op_alert_rules").select("code, enabled, severity, params");
      if (error) throw error;
      return data ?? [];
    },
    enabled: open,
  });

  useEffect(() => {
    if (!open) return;
    const porCodigo = new Map((regrasCadastradas ?? []).map((r: any) => [r.code, r]));
    const inicial: Record<string, RegraForm> = {};
    for (const regra of ALERT_RULES) {
      const cadastrada = porCodigo.get(regra.code) as any;
      const paramsDefault = Object.fromEntries(regra.params.map((p) => [p.key, p.default]));
      inicial[regra.code] = {
        enabled: cadastrada?.enabled ?? true,
        severity: cadastrada?.severity ?? regra.severidadePadrao,
        params: { ...paramsDefault, ...(cadastrada?.params ?? {}) },
      };
    }
    setForm(inicial);
  }, [open, regrasCadastradas]);

  const salvarMutation = useMutation({
    mutationFn: async () => {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw new Error("Não autenticado");

      const linhas = ALERT_RULES.map((regra) => ({
        organization_id: userData.user!.id,
        code: regra.code,
        label: regra.label,
        enabled: form[regra.code]?.enabled ?? true,
        severity: form[regra.code]?.severity ?? regra.severidadePadrao,
        params: form[regra.code]?.params ?? {},
      }));

      const { error } = await supabase.from("op_alert_rules").upsert(linhas, { onConflict: "organization_id,code" });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["op-alert-rules"] });
      toast({ title: "Regras salvas", description: "Valem a partir da próxima avaliação de alertas." });
      onClose();
    },
    onError: (error: Error) => {
      toast({ title: "Erro ao salvar regras", description: error.message, variant: "destructive" });
    },
  });

  const atualizarRegra = (code: string, patch: Partial<RegraForm>) => {
    setForm((prev) => ({ ...prev, [code]: { ...prev[code], ...patch } }));
  };

  const atualizarParam = (code: string, paramKey: string, valor: number) => {
    setForm((prev) => ({ ...prev, [code]: { ...prev[code], params: { ...prev[code].params, [paramKey]: valor } } }));
  };

  const perfis = ["caixa", "operacional_sabesp", "gestao_empresa", "geral"] as const;

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Configurar regras de alerta</SheetTitle>
          <SheetDescription>Ajuste severidade e limiares - a mudança vale a partir da próxima avaliação, sem precisar publicar nada de novo.</SheetDescription>
        </SheetHeader>

        <Accordion type="multiple" defaultValue={[...perfis]} className="mt-4">
          {perfis.map((perfil) => {
            const regrasDoPerfil = ALERT_RULES.filter((r) => r.perfil === perfil);
            if (regrasDoPerfil.length === 0) return null;

            return (
              <AccordionItem key={perfil} value={perfil}>
                <AccordionTrigger>{PERFIL_LABEL[perfil]}</AccordionTrigger>
                <AccordionContent className="space-y-4">
                  {regrasDoPerfil.map((regra) => {
                    const valor = form[regra.code];
                    if (!valor) return null;

                    return (
                      <div key={regra.code} className="border rounded-md p-3 space-y-2">
                        <div className="flex items-center justify-between gap-2">
                          <Label className="text-sm font-medium">{regra.label}</Label>
                          <Switch checked={valor.enabled} onCheckedChange={(checked) => atualizarRegra(regra.code, { enabled: checked })} />
                        </div>

                        <div className="flex flex-wrap items-end gap-3">
                          <div className="w-40">
                            <Label className="text-xs text-muted-foreground">Severidade</Label>
                            <Select value={valor.severity} onValueChange={(v) => atualizarRegra(regra.code, { severity: v as Severidade })}>
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="bloqueante">Bloqueante</SelectItem>
                                <SelectItem value="confirmacao">Confirmação</SelectItem>
                                <SelectItem value="aviso">Aviso</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>

                          {regra.params.map((param) => (
                            <div key={param.key} className="w-36">
                              <Label className="text-xs text-muted-foreground">
                                {param.label} {param.sufixo ? `(${param.sufixo})` : ""}
                              </Label>
                              <Input
                                type="number"
                                value={valor.params[param.key] ?? param.default}
                                onChange={(e) => atualizarParam(regra.code, param.key, Number(e.target.value))}
                              />
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </AccordionContent>
              </AccordionItem>
            );
          })}
        </Accordion>

        <SheetFooter className="mt-4">
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={() => salvarMutation.mutate()} disabled={salvarMutation.isPending}>
            {salvarMutation.isPending ? "Salvando..." : "Salvar"}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
};
