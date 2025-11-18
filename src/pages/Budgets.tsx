import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Search, ArrowLeft, DollarSign } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { BudgetsTable } from "@/components/budgets/BudgetsTable";
import { CreateBudgetDialog } from "@/components/budgets/CreateBudgetDialog";
import { PriceManagementTable } from "@/components/budgets/PriceManagementTable";

const Budgets = () => {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState("");
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [editingBudget, setEditingBudget] = useState<any>(null);

  const { data: budgets, isLoading } = useQuery({
    queryKey: ['budgets'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('budgets')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data || [];
    }
  });

  const filteredBudgets = budgets?.filter(budget => {
    const matchesSearch = !searchTerm || 
      budget.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      budget.client_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      budget.budget_number?.toLowerCase().includes(searchTerm.toLowerCase());

    return matchesSearch;
  }) || [];

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate('/dashboard')}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-3xl font-bold text-foreground">Orçamentos</h1>
              <p className="text-muted-foreground">Gerencie seus orçamentos e propostas</p>
            </div>
          </div>
          <Button onClick={() => setIsCreateDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Novo Orçamento
          </Button>
        </div>

        <Tabs defaultValue="budgets" className="w-full">
          <TabsList className="grid w-full max-w-md grid-cols-2">
            <TabsTrigger value="budgets">Orçamentos</TabsTrigger>
            <TabsTrigger value="prices">
              <DollarSign className="h-4 w-4 mr-2" />
              Preços
            </TabsTrigger>
          </TabsList>

          <TabsContent value="budgets" className="space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar orçamentos..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>

            <BudgetsTable
              budgets={filteredBudgets}
              isLoading={isLoading}
              onEdit={setEditingBudget}
            />
          </TabsContent>

          <TabsContent value="prices">
            <PriceManagementTable />
          </TabsContent>
        </Tabs>

        <CreateBudgetDialog
          open={isCreateDialogOpen || !!editingBudget}
          onOpenChange={(open) => {
            setIsCreateDialogOpen(open);
            if (!open) setEditingBudget(null);
          }}
          budget={editingBudget}
        />
      </div>
    </div>
  );
};

export default Budgets;
