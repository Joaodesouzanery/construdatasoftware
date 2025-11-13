import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Edit } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface BudgetsTableProps {
  budgets: any[];
  isLoading: boolean;
  onEdit: (budget: any) => void;
}

export const BudgetsTable = ({ budgets, isLoading, onEdit }: BudgetsTableProps) => {
  if (isLoading) return <div className="text-center py-8">Carregando...</div>;
  if (budgets.length === 0) return <div className="text-center py-8 text-muted-foreground">Nenhum orçamento encontrado</div>;

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Número</TableHead>
            <TableHead>Nome</TableHead>
            <TableHead>Cliente</TableHead>
            <TableHead className="text-right">Total</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Ações</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {budgets.map((budget) => (
            <TableRow key={budget.id}>
              <TableCell>{budget.budget_number}</TableCell>
              <TableCell className="font-medium">{budget.name}</TableCell>
              <TableCell>{budget.client_name || "-"}</TableCell>
              <TableCell className="text-right">R$ {budget.total_amount?.toFixed(2) || "0.00"}</TableCell>
              <TableCell><Badge>{budget.status}</Badge></TableCell>
              <TableCell className="text-right">
                <Button variant="ghost" size="icon" onClick={() => onEdit(budget)}>
                  <Edit className="h-4 w-4" />
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
};
