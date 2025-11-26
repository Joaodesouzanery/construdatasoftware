import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { PriceManagementTable } from "@/components/budgets/PriceManagementTable";
import { PriceHistoryChart } from "@/components/budgets/PriceHistoryChart";

const Prices = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate('/dashboard')}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-3xl font-bold text-foreground">Preços</h1>
              <p className="text-muted-foreground">Gerencie os preços de materiais e serviços</p>
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <PriceManagementTable />
          <PriceHistoryChart />
        </div>
      </div>
    </div>
  );
};

export default Prices;
