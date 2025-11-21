import { useState, useEffect } from "react";
import { Building2, ClipboardList, FileText, Plus, Settings, Bell, Package, TrendingDown, History, Users, Home, Image, Warehouse, Wrench, Archive, ClipboardCheck, Gauge, FileBarChart, QrCode, ClipboardX, Shield, DollarSign, Box } from "lucide-react";
import { NavLink, useLocation } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

const menuItems = [
  { title: "Dashboard", url: "/dashboard", icon: Home },
  { title: "Projetos", url: "/projects", icon: Building2 },
  { title: "Novo RDO", url: "/rdo-new", icon: Plus },
  { title: "Histórico RDO", url: "/rdo-history", icon: History },
  { title: "Fotos de Validação", url: "/rdo-photos", icon: Image },
  { title: "Controle de Produção", url: "/production-control", icon: ClipboardList },
  { title: "Almoxarifado", url: "/inventory", icon: Warehouse },
  { title: "Pedidos de Material", url: "/material-requests", icon: Package },
  { title: "Controle de Material", url: "/material-control", icon: TrendingDown },
  { title: "Alertas", url: "/alerts", icon: Bell },
  { title: "Funcionários", url: "/employees", icon: Users },
  { title: "Checklists", url: "/checklists", icon: ClipboardCheck },
  { title: "Relatório de Ligações", url: "/connection-reports", icon: FileText },
];

const facilityItems = [
  { title: "Catálogo de Ativos", url: "/assets-catalog", icon: Archive },
  { title: "Tarefas de Manutenção", url: "/maintenance-tasks", icon: Wrench },
  { title: "Controle de Consumo", url: "/consumption-control", icon: Gauge },
  { title: "Relatórios", url: "/facility-reports", icon: FileBarChart },
  { title: "QR Code Manutenção", url: "/maintenance-qr-codes", icon: QrCode },
  { title: "Solicitações Manutenção", url: "/maintenance-requests", icon: ClipboardX },
];

const budgetItems = [
  { title: "Materiais", url: "/materials", icon: Box },
  { title: "Orçamentos", url: "/budgets", icon: DollarSign },
];

const settingsItems = [
  { title: "Backup", url: "/backup", icon: Archive },
  { title: "Configurações", url: "/settings", icon: Settings },
];

const adminItems = [
  { title: "Painel Admin", url: "/admin", icon: Shield },
];

export function AppSidebar() {
  const { open } = useSidebar();
  const location = useLocation();
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    checkIfAdmin();
  }, []);

  const checkIfAdmin = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      
      const { data } = await supabase
        .from("user_roles")
        .select("*")
        .eq("user_id", user.id)
        .eq("role", "admin")
        .single();
      
      setIsAdmin(!!data);
    } catch (error) {
      console.error("Error checking admin status:", error);
    }
  };

  const getNavCls = ({ isActive }: { isActive: boolean }) =>
    isActive 
      ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium" 
      : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground";

  return (
    <Sidebar collapsible="icon">
      <SidebarContent>
        <Collapsible defaultOpen className="group/collapsible">
          <SidebarGroup>
            <SidebarGroupLabel className="text-sm font-medium">Menu Principal</SidebarGroupLabel>
            <CollapsibleContent>
              <SidebarGroupContent>
                <SidebarMenu>
                  {menuItems.map((item) => (
                    <SidebarMenuItem key={item.title}>
                      <SidebarMenuButton asChild>
                        <NavLink to={item.url} end className={getNavCls}>
                          <item.icon className="h-4 w-4" />
                          <span>{item.title}</span>
                        </NavLink>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </CollapsibleContent>
          </SidebarGroup>
        </Collapsible>

        <Collapsible defaultOpen className="group/collapsible">
          <SidebarGroup>
            <SidebarGroupLabel className="text-sm font-medium">Gestão Predial</SidebarGroupLabel>
            <CollapsibleContent>
              <SidebarGroupContent>
                <SidebarMenu>
                  {facilityItems.map((item) => (
                    <SidebarMenuItem key={item.title}>
                      <SidebarMenuButton asChild>
                        <NavLink to={item.url} end className={getNavCls}>
                          <item.icon className="h-4 w-4" />
                          <span>{item.title}</span>
                        </NavLink>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </CollapsibleContent>
          </SidebarGroup>
        </Collapsible>

        <Collapsible defaultOpen className="group/collapsible">
          <SidebarGroup>
            <SidebarGroupLabel className="text-sm font-medium">Orçamento</SidebarGroupLabel>
            <CollapsibleContent>
              <SidebarGroupContent>
                <SidebarMenu>
                  {budgetItems.map((item) => (
                    <SidebarMenuItem key={item.title}>
                      <SidebarMenuButton asChild>
                        <NavLink to={item.url} end className={getNavCls}>
                          <item.icon className="h-4 w-4" />
                          <span>{item.title}</span>
                        </NavLink>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </CollapsibleContent>
          </SidebarGroup>
        </Collapsible>

        {isAdmin && (
          <Collapsible defaultOpen className="group/collapsible">
            <SidebarGroup>
              <SidebarGroupLabel className="text-sm font-medium">Administração</SidebarGroupLabel>
              <CollapsibleContent>
                <SidebarGroupContent>
                  <SidebarMenu>
                    {adminItems.map((item) => (
                      <SidebarMenuItem key={item.title}>
                        <SidebarMenuButton asChild>
                          <NavLink to={item.url} end className={getNavCls}>
                            <item.icon className="h-4 w-4" />
                            <span>{item.title}</span>
                          </NavLink>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    ))}
                  </SidebarMenu>
                </SidebarGroupContent>
              </CollapsibleContent>
            </SidebarGroup>
          </Collapsible>
        )}

        <Collapsible defaultOpen className="group/collapsible">
          <SidebarGroup>
            <SidebarGroupLabel className="text-sm font-medium">Sistema</SidebarGroupLabel>
            <CollapsibleContent>
              <SidebarGroupContent>
                <SidebarMenu>
                  {settingsItems.map((item) => (
                    <SidebarMenuItem key={item.title}>
                      <SidebarMenuButton asChild>
                        <NavLink to={item.url} end className={getNavCls}>
                          <item.icon className="h-4 w-4" />
                          <span>{item.title}</span>
                        </NavLink>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </CollapsibleContent>
          </SidebarGroup>
        </Collapsible>
      </SidebarContent>
    </Sidebar>
  );
}
