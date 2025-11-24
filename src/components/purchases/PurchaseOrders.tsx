import { Card, CardContent } from "@/components/ui/card";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";

export function PurchaseOrders() {
  const { data: session } = useQuery({
    queryKey: ["session"],
    queryFn: async () => {
      const { data } = await supabase.auth.getSession();
      return data.session;
    },
  });

  const { data: orders } = useQuery({
    queryKey: ["purchase_orders"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("purchase_orders")
        .select(`
          *,
          projects(name)
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
          <p>Funcionalidade de pedidos de compra em desenvolvimento</p>
          <p className="text-sm mt-2">
            Será possível gerar pedidos, ordens de compra e acompanhar entregas
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
