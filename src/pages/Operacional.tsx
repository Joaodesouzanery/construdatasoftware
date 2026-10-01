import { useState } from "react";
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FontesOperacional } from "@/components/operacional/FontesOperacional";
import { PainelExecucoes } from "@/components/operacional/PainelExecucoes";
import { CaixaDeMudancas } from "@/components/operacional/CaixaDeMudancas";
import { SimuladorIngestao } from "@/components/operacional/SimuladorIngestao";
import { DashboardCaixa } from "@/components/operacional/DashboardCaixa";
import { DashboardOperacionalSabesp } from "@/components/operacional/DashboardOperacionalSabesp";
import { DashboardGestaoExecutiva } from "@/components/operacional/DashboardGestaoExecutiva";
import { MasterCheckBadge } from "@/components/operacional/MasterCheckBadge";
import { Activity, Inbox, Database, FlaskConical, Wallet, ClipboardList, Briefcase } from "lucide-react";

// Hub do módulo Operacional - mesmo padrão de RHConstruData.tsx (um grupo de
// abas, cada uma um componente autossuficiente). Fase 1: Fontes, Painel de
// execuções, Caixa de mudanças e Simulador. Dashboards por perfil (Caixa,
// Operacional, Gestão Executiva) entram nas Fases 2-5.
const Operacional = () => {
  const [activeTab, setActiveTab] = useState("painel");

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-background">
        <AppSidebar />
        <SidebarInset className="flex-1">
          <div className="p-3 sm:p-4 md:p-6 space-y-4 sm:space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
              <div className="flex flex-col gap-1 sm:gap-2">
                <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-foreground">Operacional</h1>
                <p className="text-sm sm:text-base text-muted-foreground">
                  Recepção das planilhas da WCR via n8n - espelho somente leitura, histórico e exceções
                </p>
              </div>
              <MasterCheckBadge />
            </div>

            <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4 sm:space-y-6">
              <div className="overflow-x-auto -mx-3 sm:mx-0 px-3 sm:px-0">
                <TabsList className="inline-flex h-auto gap-1 bg-muted/50 p-1 min-w-max">
                  <TabsTrigger value="painel" className="flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm">
                    <Activity className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                    <span>Painel de Execuções</span>
                  </TabsTrigger>
                  <TabsTrigger value="caixa" className="flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm">
                    <Wallet className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                    <span>Caixa</span>
                  </TabsTrigger>
                  <TabsTrigger value="sabesp" className="flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm">
                    <ClipboardList className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                    <span>Operacional Sabesp</span>
                  </TabsTrigger>
                  <TabsTrigger value="gestao" className="flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm">
                    <Briefcase className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                    <span>Gestão Executiva</span>
                  </TabsTrigger>
                  <TabsTrigger value="mudancas" className="flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm">
                    <Inbox className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                    <span>Caixa de Mudanças</span>
                  </TabsTrigger>
                  <TabsTrigger value="fontes" className="flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm">
                    <Database className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                    <span>Fontes</span>
                  </TabsTrigger>
                  <TabsTrigger value="simulador" className="flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm">
                    <FlaskConical className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                    <span>Simulador</span>
                  </TabsTrigger>
                </TabsList>
              </div>

              <TabsContent value="painel" className="mt-0">
                <PainelExecucoes />
              </TabsContent>

              <TabsContent value="caixa" className="mt-0">
                <DashboardCaixa />
              </TabsContent>

              <TabsContent value="sabesp" className="mt-0">
                <DashboardOperacionalSabesp />
              </TabsContent>

              <TabsContent value="gestao" className="mt-0">
                <DashboardGestaoExecutiva />
              </TabsContent>

              <TabsContent value="mudancas" className="mt-0">
                <CaixaDeMudancas />
              </TabsContent>

              <TabsContent value="fontes" className="mt-0">
                <FontesOperacional />
              </TabsContent>

              <TabsContent value="simulador" className="mt-0">
                <SimuladorIngestao />
              </TabsContent>
            </Tabs>
          </div>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
};

export default Operacional;
