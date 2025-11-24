import { useState } from "react";
import { AppSidebar } from "@/components/AppSidebar";
import { SidebarProvider } from "@/components/ui/sidebar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PurchaseRequests } from "@/components/purchases/PurchaseRequests";
import { SupplierQuotes } from "@/components/purchases/SupplierQuotes";
import { PurchaseOrders } from "@/components/purchases/PurchaseOrders";

export default function PurchaseManagement() {
  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full">
        <AppSidebar />
        <main className="flex-1 p-6">
          <div className="mb-6">
            <h1 className="text-3xl font-bold">Controle de Compras</h1>
            <p className="text-muted-foreground">
              Gerencie solicitações, cotações e pedidos de compra
            </p>
          </div>

          <Tabs defaultValue="requests" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="requests">Solicitações</TabsTrigger>
              <TabsTrigger value="quotes">Cotações</TabsTrigger>
              <TabsTrigger value="orders">Pedidos de Compra</TabsTrigger>
            </TabsList>

            <TabsContent value="requests" className="mt-6">
              <PurchaseRequests />
            </TabsContent>

            <TabsContent value="quotes" className="mt-6">
              <SupplierQuotes />
            </TabsContent>

            <TabsContent value="orders" className="mt-6">
              <PurchaseOrders />
            </TabsContent>
          </Tabs>
        </main>
      </div>
    </SidebarProvider>
  );
}
