import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { AddPurchaseRequestDialog } from "./AddPurchaseRequestDialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

export function PurchaseRequests() {
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const queryClient = useQueryClient();

  const { data: session } = useQuery({
    queryKey: ["session"],
    queryFn: async () => {
      const { data } = await supabase.auth.getSession();
      return data.session;
    },
  });

  const { data: requests, isLoading } = useQuery({
    queryKey: ["purchase_requests"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("purchase_requests")
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

  const getStatusBadge = (status: string) => {
    const variants: Record<string, any> = {
      pendente: "secondary",
      aprovada: "default",
      rejeitada: "destructive",
      em_compra: "outline",
      entregue: "default",
    };

    const labels: Record<string, string> = {
      pendente: "Pendente",
      aprovada: "Aprovada",
      rejeitada: "Rejeitada",
      em_compra: "Em Compra",
      entregue: "Entregue",
    };

    return (
      <Badge variant={variants[status] || "secondary"}>
        {labels[status] || status}
      </Badge>
    );
  };

  const getUrgencyBadge = (urgency: string) => {
    const variants: Record<string, any> = {
      baixa: "outline",
      media: "secondary",
      alta: "default",
      critica: "destructive",
    };

    const labels: Record<string, string> = {
      baixa: "Baixa",
      media: "Média",
      alta: "Alta",
      critica: "Crítica",
    };

    return (
      <Badge variant={variants[urgency] || "outline"}>
        {labels[urgency] || urgency}
      </Badge>
    );
  };

  if (isLoading) {
    return <div className="text-center">Carregando...</div>;
  }

  return (
    <div>
      <div className="mb-4 flex justify-end">
        <Button onClick={() => setIsAddDialogOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Nova Solicitação
        </Button>
      </div>

      <Card>
        <CardContent className="pt-6">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Item</TableHead>
                <TableHead>Quantidade</TableHead>
                <TableHead>Projeto</TableHead>
                <TableHead>Urgência</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Custo Estimado</TableHead>
                <TableHead>Data</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {requests?.map((request) => (
                <TableRow key={request.id}>
                  <TableCell className="font-medium">{request.item_name}</TableCell>
                  <TableCell>
                    {request.quantity} {request.unit}
                  </TableCell>
                  <TableCell>{request.projects?.name || "-"}</TableCell>
                  <TableCell>{getUrgencyBadge(request.urgency)}</TableCell>
                  <TableCell>{getStatusBadge(request.status)}</TableCell>
                  <TableCell>
                    {request.estimated_cost
                      ? `R$ ${Number(request.estimated_cost).toFixed(2)}`
                      : "-"}
                  </TableCell>
                  <TableCell>
                    {new Date(request.created_at).toLocaleDateString("pt-BR")}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          {!requests || requests.length === 0 && (
            <div className="py-12 text-center text-muted-foreground">
              Nenhuma solicitação de compra registrada ainda.
            </div>
          )}
        </CardContent>
      </Card>

      <AddPurchaseRequestDialog
        open={isAddDialogOpen}
        onOpenChange={setIsAddDialogOpen}
      />
    </div>
  );
}
