import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { useAlertNotifications } from "@/hooks/useAlertNotifications";
import { useProductionUpdates } from "@/hooks/useProductionUpdates";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import Dashboard from "./pages/Dashboard";
import Projects from "./pages/Projects";
import Production from "./pages/Production";
import ProductionControl from "./pages/ProductionControl";
import MaterialRequests from "./pages/MaterialRequests";
import MaterialControl from "./pages/MaterialControl";
import Inventory from "./pages/Inventory";
import RDO from "./pages/RDO";
import RDONew from "./pages/RDONew";
import RDOHistory from "./pages/RDOHistory";
import RDOPhotos from "./pages/RDOPhotos";
import Alerts from "./pages/Alerts";
import Employees from "./pages/Employees";
import Settings from "./pages/Settings";
import AssetsCatalog from "./pages/AssetsCatalog";
import MaintenanceTasks from "./pages/MaintenanceTasks";
import ConsumptionControl from "./pages/ConsumptionControl";
import FacilityReports from "./pages/FacilityReports";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const AppContent = () => {
  useAlertNotifications();
  useProductionUpdates();
  
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Index />} />
        <Route path="/auth" element={<Auth />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/projects" element={<Projects />} />
        <Route path="/production" element={<Production />} />
        <Route path="/production-control" element={<ProductionControl />} />
        <Route path="/material-requests" element={<MaterialRequests />} />
        <Route path="/material-control" element={<MaterialControl />} />
        <Route path="/inventory" element={<Inventory />} />
        <Route path="/rdo" element={<RDO />} />
        <Route path="/rdo-new" element={<RDONew />} />
        <Route path="/rdo-history" element={<RDOHistory />} />
        <Route path="/rdo-photos" element={<RDOPhotos />} />
        <Route path="/alerts" element={<Alerts />} />
        <Route path="/employees" element={<Employees />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="/assets-catalog" element={<AssetsCatalog />} />
        <Route path="/maintenance-tasks" element={<MaintenanceTasks />} />
        <Route path="/consumption-control" element={<ConsumptionControl />} />
        <Route path="/facility-reports" element={<FacilityReports />} />
        {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
        <Route path="*" element={<NotFound />} />
      </Routes>
    </BrowserRouter>
  );
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <AppContent />
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
