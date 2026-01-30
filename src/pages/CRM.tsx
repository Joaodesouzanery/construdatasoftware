import { useState } from "react";
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CRMDashboard } from "@/components/crm/CRMDashboard";
import { CRMContacts } from "@/components/crm/CRMContacts";
import { CRMAccounts } from "@/components/crm/CRMAccounts";
import { CRMPipeline } from "@/components/crm/CRMPipeline";
import { CRMActivities } from "@/components/crm/CRMActivities";
import { CRMCalendar } from "@/components/crm/CRMCalendar";
import { CRMReports } from "@/components/crm/CRMReports";
import { 
  LayoutDashboard, 
  Users, 
  Building2, 
  Target, 
  CheckSquare, 
  Calendar,
  BarChart3
} from "lucide-react";

const CRM = () => {
  const [activeTab, setActiveTab] = useState("dashboard");

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-background">
        <AppSidebar />
        <SidebarInset className="flex-1">
          <div className="p-4 md:p-6 space-y-6">
            <div className="flex flex-col gap-2">
              <h1 className="text-2xl md:text-3xl font-bold text-foreground">
                CRM ConstruData
              </h1>
              <p className="text-muted-foreground">
                Gestão completa de relacionamento com clientes
              </p>
            </div>

            <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
              <TabsList className="flex flex-wrap h-auto gap-1 bg-muted/50 p-1">
                <TabsTrigger value="dashboard" className="flex items-center gap-2">
                  <LayoutDashboard className="h-4 w-4" />
                  <span className="hidden sm:inline">Dashboard</span>
                </TabsTrigger>
                <TabsTrigger value="contacts" className="flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  <span className="hidden sm:inline">Contatos</span>
                </TabsTrigger>
                <TabsTrigger value="accounts" className="flex items-center gap-2">
                  <Building2 className="h-4 w-4" />
                  <span className="hidden sm:inline">Empresas</span>
                </TabsTrigger>
                <TabsTrigger value="pipeline" className="flex items-center gap-2">
                  <Target className="h-4 w-4" />
                  <span className="hidden sm:inline">Pipeline</span>
                </TabsTrigger>
                <TabsTrigger value="activities" className="flex items-center gap-2">
                  <CheckSquare className="h-4 w-4" />
                  <span className="hidden sm:inline">Atividades</span>
                </TabsTrigger>
                <TabsTrigger value="calendar" className="flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  <span className="hidden sm:inline">Agenda</span>
                </TabsTrigger>
                <TabsTrigger value="reports" className="flex items-center gap-2">
                  <BarChart3 className="h-4 w-4" />
                  <span className="hidden sm:inline">Relatórios</span>
                </TabsTrigger>
              </TabsList>

              <TabsContent value="dashboard" className="mt-0">
                <CRMDashboard />
              </TabsContent>
              
              <TabsContent value="contacts" className="mt-0">
                <CRMContacts />
              </TabsContent>
              
              <TabsContent value="accounts" className="mt-0">
                <CRMAccounts />
              </TabsContent>
              
              <TabsContent value="pipeline" className="mt-0">
                <CRMPipeline />
              </TabsContent>
              
              <TabsContent value="activities" className="mt-0">
                <CRMActivities />
              </TabsContent>
              
              <TabsContent value="calendar" className="mt-0">
                <CRMCalendar />
              </TabsContent>
              
              <TabsContent value="reports" className="mt-0">
                <CRMReports />
              </TabsContent>
            </Tabs>
          </div>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
};

export default CRM;
