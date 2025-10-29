import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AddReadingDialog } from "@/components/consumption/AddReadingDialog";
import { ConsumptionChart } from "@/components/consumption/ConsumptionChart";
import { ReadingsTable } from "@/components/consumption/ReadingsTable";
import { ConsumptionStats } from "@/components/consumption/ConsumptionStats";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { format, subDays } from "date-fns";
import { ptBR } from "date-fns/locale";

export default function ConsumptionControl() {
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState(new Date());

  const { data: projects } = useQuery({
    queryKey: ["projects"],
    queryFn: async () => {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw new Error("Not authenticated");

      const { data, error } = await supabase
        .from("projects")
        .select("*")
        .eq("created_by_user_id", userData.user.id)
        .eq("status", "active")
        .order("name");

      if (error) throw error;
      return data;
    },
  });

  const { data: readings, refetch } = useQuery({
    queryKey: ["consumption-readings", selectedDate],
    queryFn: async () => {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw new Error("Not authenticated");

      const startDate = format(subDays(selectedDate, 30), "yyyy-MM-dd");
      const endDate = format(selectedDate, "yyyy-MM-dd");

      const { data, error } = await supabase
        .from("consumption_readings")
        .select(`
          *,
          projects (name)
        `)
        .gte("reading_date", startDate)
        .lte("reading_date", endDate)
        .order("reading_date", { ascending: false })
        .order("reading_time", { ascending: false });

      if (error) throw error;
      return data;
    },
  });

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full">
        <AppSidebar />
        <main className="flex-1">
          <div className="container mx-auto p-6 space-y-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <SidebarTrigger />
                <div>
                  <h1 className="text-3xl font-bold">Controle de Consumo</h1>
                  <p className="text-muted-foreground">
                    Registre leituras e acompanhe o consumo diário
                  </p>
                </div>
              </div>
              <Button onClick={() => setIsAddDialogOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Nova Leitura
              </Button>
            </div>

            <ConsumptionStats readings={readings || []} />

            <Tabs defaultValue="charts" className="space-y-4">
              <TabsList>
                <TabsTrigger value="charts">Gráficos</TabsTrigger>
                <TabsTrigger value="readings">Leituras</TabsTrigger>
              </TabsList>

              <TabsContent value="charts" className="space-y-4">
                <ConsumptionChart readings={readings || []} />
              </TabsContent>

              <TabsContent value="readings">
                <ReadingsTable readings={readings || []} onUpdate={refetch} />
              </TabsContent>
            </Tabs>

            <AddReadingDialog
              open={isAddDialogOpen}
              onOpenChange={setIsAddDialogOpen}
              projects={projects || []}
              onSuccess={refetch}
            />
          </div>
        </main>
      </div>
    </SidebarProvider>
  );
}
