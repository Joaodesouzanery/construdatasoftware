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
import { AlertasOperacional } from "@/components/operacional/AlertasOperacional";
import { EspelhoPlanilha } from "@/components/operacional/EspelhoPlanilha";
import { Activity, Inbox, Database, FlaskConical, Wallet, ClipboardList, Briefcase, BellRing, Table2, ShieldOff } from "lucide-react";
import { useOpPapel } from "@/hooks/useOpPapel";

// Hub do módulo Operacional - mesmo padrão de RHConstruData.tsx (um grupo de
// abas, cada uma um componente autossuficiente). Fase 1: Fontes, Painel de
// execuções, Caixa de mudanças e Simulador. Dashboards por perfil (Caixa,
// Operacional, Gestão Executiva) entram nas Fases 2-5.
//
// Fontes e Simulador são admin-only (token/segredo/teste de ingestão) -
// escondidos de quem só tem papel "gestor". Isso é só UX: a segurança real
// é a RLS (op_papel()), então nem adianta forçar a URL/aba por fora.
const Operacional = () => {
  const [activeTab, setActiveTab] = useState("painel");
  const { papel, isLoading: carregandoPapel } = useOpPapel();
  const isAdmin = papel === "admin";

  if (carregandoPapel) {
    return null;
  }

  if (!papel) {
    return (
      <SidebarProvider>
        <div className="min-h-screen flex w-full bg-background">
          <AppSidebar />
          <SidebarInset className="flex-1 flex items-center justify-center p-6">
            <div className="text-center space-y-2 max-w-sm">
              <ShieldOff className="h-10 w-10 mx-auto text-muted-foreground" />
              <h1 className="text-lg font-semibold">Sem acesso ao módulo Operacional</h1>
              <p className="text-sm text-muted-foreground">
                Fale com um administrador para liberar seu acesso.
              </p>
            </div>
          </SidebarInset>
        </div>
      </SidebarProvider>
    );
  }

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
                  <TabsTrigger value="planilha" className="flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm">
                    <Table2 className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                    <span>Planilha</span>
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
                  <TabsTrigger value="alertas" className="flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm">
                    <BellRing className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                    <span>Alertas</span>
                  </TabsTrigger>
                  <TabsTrigger value="mudancas" className="flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm">
                    <Inbox className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                    <span>Caixa de Mudanças</span>
                  </TabsTrigger>
                  {isAdmin && (
                    <TabsTrigger value="fontes" className="flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm">
                      <Database className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                      <span>Fontes</span>
                    </TabsTrigger>
                  )}
                  {isAdmin && (
                    <TabsTrigger value="simulador" className="flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm">
                      <FlaskConical className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                      <span>Simulador</span>
                    </TabsTrigger>
                  )}
                </TabsList>
              </div>

              <TabsContent value="painel" className="mt-0">
                <PainelExecucoes />
              </TabsContent>

              <TabsContent value="planilha" className="mt-0">
                <EspelhoPlanilha />
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

              <TabsContent value="alertas" className="mt-0">
                <AlertasOperacional />
              </TabsContent>

              <TabsContent value="mudancas" className="mt-0">
                <CaixaDeMudancas />
              </TabsContent>

              {isAdmin && (
                <TabsContent value="fontes" className="mt-0">
                  <FontesOperacional />
                </TabsContent>
              )}

              {isAdmin && (
                <TabsContent value="simulador" className="mt-0">
                  <SimuladorIngestao />
                </TabsContent>
              )}
            </Tabs>
          </div>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
};

export default Operacional;
