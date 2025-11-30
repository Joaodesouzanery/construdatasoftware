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
import Dashboard360 from "./pages/Dashboard360";
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
import Checklists from "./pages/Checklists";
import ConsumptionControl from "./pages/ConsumptionControl";
import FacilityReports from "./pages/FacilityReports";
import ConnectionReports from "./pages/ConnectionReports";
import MaintenanceQRCodes from "./pages/MaintenanceQRCodes";
import MaintenanceRequest from "./pages/MaintenanceRequest";
import MaintenanceRequests from "./pages/MaintenanceRequests";
import ProjectManagement from "./pages/features/ProjectManagement";
import ProductionControlFeature from "./pages/features/ProductionControl";
import RDODigital from "./pages/features/RDODigital";
import MaterialRequestsFeature from "./pages/features/MaterialRequests";
import MaterialControlFeature from "./pages/features/MaterialControl";
import TeamManagement from "./pages/features/TeamManagement";
import IntelligentAlerts from "./pages/features/IntelligentAlerts";
import MultimediaRegistry from "./pages/features/MultimediaRegistry";
import QRCodeMaintenance from "./pages/features/QRCodeMaintenance";
import ConnectionReportsFeature from "./pages/features/ConnectionReportsFeature";
import Admin from "./pages/Admin";
import Backup from "./pages/Backup";
import Support from "./pages/Support";
import Materials from "./pages/Materials";
import MaterialsDashboard from "./pages/MaterialsDashboard";
import Budgets from "./pages/Budgets";
import BudgetPricing from "./pages/BudgetPricing";
import Prices from "./pages/Prices";
import Occurrences from "./pages/Occurrences";
import PurchaseManagement from "./pages/PurchaseManagement";
import LaborTracking from "./pages/LaborTracking";
import OperationalDashboard from "./pages/OperationalDashboard";
import SystemTest from "./pages/SystemTest";
import Approvals from "./pages/Approvals";
import UserMetrics from "./pages/UserMetrics";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const AppContent = () => {
  useAlertNotifications();
  useProductionUpdates();
  
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Index />} />
          <Route path="/system-test" element={<SystemTest />} />
          <Route path="/approvals" element={<Approvals />} />
        <Route path="/auth" element={<Auth />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/operational-dashboard" element={<OperationalDashboard />} />
        <Route path="/dashboard-360" element={<Dashboard360 />} />
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
        <Route path="/checklists" element={<Checklists />} />
        <Route path="/consumption-control" element={<ConsumptionControl />} />
        <Route path="/facility-reports" element={<FacilityReports />} />
        <Route path="/connection-reports" element={<ConnectionReports />} />
        <Route path="/occurrences" element={<Occurrences />} />
        <Route path="/purchase-management" element={<PurchaseManagement />} />
        <Route path="/labor-tracking" element={<LaborTracking />} />
        <Route path="/maintenance-qr-codes" element={<MaintenanceQRCodes />} />
        <Route path="/maintenance-request/:qrCodeId" element={<MaintenanceRequest />} />
        <Route path="/maintenance-requests" element={<MaintenanceRequests />} />
          <Route path="/materials" element={<Materials />} />
          <Route path="/materials/dashboard" element={<MaterialsDashboard />} />
          <Route path="/budgets" element={<Budgets />} />
          <Route path="/budget-pricing" element={<BudgetPricing />} />
          <Route path="/prices" element={<Prices />} />
        
        {/* Feature pages */}
        <Route path="/features/project-management" element={<ProjectManagement />} />
        <Route path="/features/production-control" element={<ProductionControlFeature />} />
        <Route path="/features/rdo-digital" element={<RDODigital />} />
        <Route path="/features/material-requests" element={<MaterialRequestsFeature />} />
        <Route path="/features/material-control" element={<MaterialControlFeature />} />
        <Route path="/features/team-management" element={<TeamManagement />} />
        <Route path="/features/intelligent-alerts" element={<IntelligentAlerts />} />
        <Route path="/features/multimedia-registry" element={<MultimediaRegistry />} />
        <Route path="/features/qrcode-maintenance" element={<QRCodeMaintenance />} />
        <Route path="/features/connection-reports" element={<ConnectionReportsFeature />} />
        
        {/* Admin and System routes */}
        <Route path="/admin" element={<Admin />} />
        <Route path="/admin/metrics" element={<UserMetrics />} />
        <Route path="/backup" element={<Backup />} />
        <Route path="/support" element={<Support />} />
        
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
