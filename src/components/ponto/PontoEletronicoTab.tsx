import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { LayoutDashboard, History, MapPin } from "lucide-react";
import { PontoDashboard } from "./PontoDashboard";
import { PontoHistoricoFuncionario } from "./PontoHistoricoFuncionario";
import { LocaisPonto } from "./LocaisPonto";

// Container de sub-abas do Ponto Eletrônico dentro do hub RHConstruData -
// mesmo padrão de sub-abas já usado em FeriodosFaltas.tsx.
export const PontoEletronicoTab = () => {
  const [subTab, setSubTab] = useState("visao-geral");

  return (
    <Tabs value={subTab} onValueChange={setSubTab} className="space-y-4">
      <div className="overflow-x-auto -mx-3 sm:mx-0 px-3 sm:px-0">
        <TabsList className="inline-flex h-auto gap-1 bg-muted/50 p-1 min-w-max">
          <TabsTrigger value="visao-geral" className="flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm">
            <LayoutDashboard className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
            <span>Visão Geral</span>
          </TabsTrigger>
          <TabsTrigger value="historico" className="flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm">
            <History className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
            <span>Histórico</span>
          </TabsTrigger>
          <TabsTrigger value="locais" className="flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm">
            <MapPin className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
            <span>Locais de Ponto</span>
          </TabsTrigger>
        </TabsList>
      </div>

      <TabsContent value="visao-geral" className="mt-0">
        <PontoDashboard />
      </TabsContent>

      <TabsContent value="historico" className="mt-0">
        <PontoHistoricoFuncionario />
      </TabsContent>

      <TabsContent value="locais" className="mt-0">
        <LocaisPonto />
      </TabsContent>
    </Tabs>
  );
};
