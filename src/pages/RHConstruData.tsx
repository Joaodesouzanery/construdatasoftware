import { useState } from "react";
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { RHDashboard } from "@/components/rh/RHDashboard";
import { EscalasCLT } from "@/components/rh/EscalasCLT";
import { Funcionarios } from "@/components/rh/Funcionarios";
import { Unidades } from "@/components/rh/Unidades";
import { DashboardPrimeCost } from "@/components/rh/DashboardPrimeCost";
import { FeriodosFaltas } from "@/components/rh/FeriodosFaltas";
import { 
  LayoutDashboard, 
  Calendar, 
  Users, 
  Building2, 
  PieChart,
  CalendarOff
} from "lucide-react";

const RHConstruData = () => {
  const [activeTab, setActiveTab] = useState("dashboard");

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-background">
        <AppSidebar />
        <SidebarInset className="flex-1">
          <div className="p-4 md:p-6 space-y-6">
            <div className="flex flex-col gap-2">
              <h1 className="text-2xl md:text-3xl font-bold text-foreground">
                RH ConstruData
              </h1>
              <p className="text-muted-foreground">
                Gestão de recursos humanos, escalas CLT e controle de custos
              </p>
            </div>

            <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
              <TabsList className="flex flex-wrap h-auto gap-1 bg-muted/50 p-1">
                <TabsTrigger value="dashboard" className="flex items-center gap-2">
                  <LayoutDashboard className="h-4 w-4" />
                  <span className="hidden sm:inline">Dashboard</span>
                </TabsTrigger>
                <TabsTrigger value="escalas" className="flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  <span className="hidden sm:inline">Escalas CLT</span>
                </TabsTrigger>
                <TabsTrigger value="funcionarios" className="flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  <span className="hidden sm:inline">Funcionários</span>
                </TabsTrigger>
                <TabsTrigger value="unidades" className="flex items-center gap-2">
                  <Building2 className="h-4 w-4" />
                  <span className="hidden sm:inline">Unidades</span>
                </TabsTrigger>
                <TabsTrigger value="feriados" className="flex items-center gap-2">
                  <CalendarOff className="h-4 w-4" />
                  <span className="hidden sm:inline">Feriados/Faltas</span>
                </TabsTrigger>
                <TabsTrigger value="prime-cost" className="flex items-center gap-2">
                  <PieChart className="h-4 w-4" />
                  <span className="hidden sm:inline">Prime Cost</span>
                </TabsTrigger>
              </TabsList>

              <TabsContent value="dashboard" className="mt-0">
                <RHDashboard />
              </TabsContent>
              
              <TabsContent value="escalas" className="mt-0">
                <EscalasCLT />
              </TabsContent>
              
              <TabsContent value="funcionarios" className="mt-0">
                <Funcionarios />
              </TabsContent>
              
              <TabsContent value="unidades" className="mt-0">
                <Unidades />
              </TabsContent>
              
              <TabsContent value="feriados" className="mt-0">
                <FeriodosFaltas />
              </TabsContent>
              
              <TabsContent value="prime-cost" className="mt-0">
                <DashboardPrimeCost />
              </TabsContent>
            </Tabs>
          </div>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
};

export default RHConstruData;
