import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, AlertTriangle, CheckCircle2 } from "lucide-react";

// Badge fixo do MASTER CHECK, visível no topo do módulo Operacional INTEIRO
// (não só na aba Gestão Executiva) - ERRO em vermelho fixo, PENDENTE em
// amarelo, OK em verde discreto. Olha todas as fontes de gestao_empresa do
// usuário e mostra o pior status entre elas.
export const MasterCheckBadge = () => {
  const { data: pior } = useQuery({
    queryKey: ["op-master-check-global"],
    queryFn: async () => {
      const { data: fontes } = await supabase.from("op_sources").select("id").eq("profile", "gestao_empresa");
      if (!fontes || fontes.length === 0) return null;

      const { data, error } = await supabase
        .from("op_records")
        .select("data")
        .in("source_id", fontes.map((f) => f.id))
        .eq("sheet_key", "gestao_empresa.checks_integridade")
        .eq("natural_key", "_master_check")
        .eq("status", "ativo");
      if (error) throw error;
      if (!data || data.length === 0) return null;

      const valores = data.map((r: any) => String(r.data?.master_check ?? "").toUpperCase());
      if (valores.includes("ERRO")) return "ERRO";
      if (valores.includes("PENDENTE")) return "PENDENTE";
      return "OK";
    },
  });

  if (!pior) return null;

  if (pior === "ERRO") {
    return (
      <Badge variant="destructive" className="gap-1">
        <AlertCircle className="h-3 w-3" />
        MASTER CHECK: ERRO
      </Badge>
    );
  }

  if (pior === "PENDENTE") {
    return (
      <Badge variant="secondary" className="bg-yellow-100 text-yellow-800 gap-1">
        <AlertTriangle className="h-3 w-3" />
        MASTER CHECK: PENDENTE
      </Badge>
    );
  }

  return (
    <Badge variant="outline" className="text-green-600 gap-1">
      <CheckCircle2 className="h-3 w-3" />
      MASTER CHECK: OK
    </Badge>
  );
};
