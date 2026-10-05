import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";

export type OpPapel = "admin" | "gestor" | null;

// Lê o papel do usuário logado no módulo Operacional (op_acessos, via a
// function op_papel() no banco). null = sem linha/inativo = SEM ACESSO.
// Isso é só para esconder/mostrar UI - a segurança de verdade é a RLS
// (RPC SECURITY DEFINER lida pelas próprias policies), então mesmo se esta
// query falhar ou for manipulada no navegador, o banco nega sozinho.
export function useOpPapel() {
  const { data, isLoading } = useQuery({
    queryKey: ["op-papel"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("op_papel");
      if (error) throw error;
      return (data ?? null) as OpPapel;
    },
    staleTime: 5 * 60 * 1000,
  });

  return { papel: data ?? null, isLoading };
}
