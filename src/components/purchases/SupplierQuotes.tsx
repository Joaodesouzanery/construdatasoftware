import { Card, CardContent } from "@/components/ui/card";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";

export function SupplierQuotes() {
  const { data: session } = useQuery({
    queryKey: ["session"],
    queryFn: async () => {
      const { data } = await supabase.auth.getSession();
      return data.session;
    },
  });

  const { data: quotes } = useQuery({
    queryKey: ["supplier_quotes"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("supplier_quotes")
        .select(`
          *,
          purchase_requests(item_name, projects(name))
        `)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data;
    },
    enabled: !!session,
  });

  return (
    <Card>
      <CardContent className="pt-6">
        <div className="text-center py-12 text-muted-foreground">
          <p>Funcionalidade de cotações em desenvolvimento</p>
          <p className="text-sm mt-2">
            Será possível comparar preços entre fornecedores
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
