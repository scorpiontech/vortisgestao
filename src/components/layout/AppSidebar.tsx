import {
  LayoutDashboard,
  Package,
  DollarSign,
  Receipt,
  LogOut,
  BarChart3,
  Users,
  Truck,
  Vault,
  History,
  ChevronDown,
  Tags,
  Ruler,
  ArrowLeftRight,
  ClipboardList,
  Settings,
  UserCog,
  UsersRound,
  ScrollText,
} from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useUserRole } from "@/hooks/useUserRole";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarFooter,
  useSidebar,
} from "@/components/ui/sidebar";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-mobile";

interface MenuItem {
  title: string;
  url: string;
  icon: React.ElementType;
  masterOnly?: boolean;
  children?: { title: string; url: string; icon: React.ElementType; masterOnly?: boolean }[];
}

const allMenuItems: MenuItem[] = [
  { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard, masterOnly: true },
  { title: "Clientes", url: "/clientes", icon: Users, children: [
    { title: "Histórico Cliente", url: "/historico-cliente", icon: History },
  ]},
  { title: "Estoque", url: "/estoque", icon: Package, children: [
    { title: "Categorias", url: "/categorias", icon: Tags, masterOnly: true },
    { title: "Unidades de Medida", url: "/unidades", icon: Ruler, masterOnly: true },
  ]},
  { title: "Financeiro", url: "/financeiro", icon: DollarSign, children: [
    { title: "Caixa", url: "/caixa", icon: Vault },
    { title: "Contas a Pagar", url: "/contas-pagar", icon: ArrowLeftRight, masterOnly: true },
    { title: "Contas a Receber", url: "/contas-receber", icon: ArrowLeftRight, masterOnly: true },
    { title: "Movimentação", url: "/movimentacao", icon: ArrowLeftRight, masterOnly: true },
    { title: "PDV", url: "/vendas", icon: Receipt },
  ]},
  { title: "Fornecedores", url: "/fornecedores", icon: Truck },
  { title: "Ordens de Serviço", url: "/ordens-servico", icon: ClipboardList, masterOnly: true },
  { title: "Relatórios", url: "/relatorios", icon: BarChart3, masterOnly: true },
  { title: "Configurações", url: "/configuracoes", icon: Settings, masterOnly: true, children: [
    { title: "Cadastro", url: "/cadastro", icon: UserCog },
    { title: "Usuários", url: "/usuarios", icon: UsersRound },
    { title: "Auditoria", url: "/auditoria", icon: ScrollText },
    { title: "Cobranças", url: "/cobrancas", icon: Receipt },
  ]},
];

export function AppSidebar() {
  const { state, setOpenMobile } = useSidebar();
  const collapsed = state === "collapsed";
  const location = useLocation();
  const navigate = useNavigate();
  const { signOut } = useAuth();
  const isMobile = useIsMobile();
  const { isMaster } = useUserRole();

  const menuItems = allMenuItems
    .filter(item => !item.masterOnly || isMaster)
    .map(item => ({
      ...item,
      children: item.children?.filter(c => !c.masterOnly || isMaster),
    }));

  const closeMobile = () => {
    if (isMobile) setOpenMobile(false);
  };

  const handleLogout = async () => {
    await signOut();
    navigate("/");
  };

  const isActive = (item: MenuItem) =>
    location.pathname === item.url ||
    item.children?.some(c => location.pathname === c.url);

  return (
    <Sidebar collapsible="icon">
      <SidebarContent>
        <div className="px-4 py-5">
          {!collapsed ? (
            <div className="flex items-center gap-2">
              <img src="/logo-transparente.png" alt="Vortis Gestão" className="h-8" />
              <div>
                <h1 className="text-sm font-bold text-sidebar-primary-foreground">Vortis</h1>
                <p className="text-[10px] text-sidebar-foreground/60">Gestão</p>
              </div>
            </div>
          ) : (
            <img src="/logo-transparente.png" alt="Vortis Gestão" className="h-8 mx-auto" />
          )}
        </div>

        <SidebarGroup>
          <SidebarGroupLabel className="text-sidebar-foreground/40 text-[10px] uppercase tracking-wider">
            Menu
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {menuItems.map((item) =>
                item.children ? (
                  <Collapsible key={item.title} defaultOpen={isActive(item)}>
                    <SidebarMenuItem>
                      <CollapsibleTrigger asChild>
                        <SidebarMenuButton
                          tooltip={item.title}
                          className={cn(
                            "transition-colors justify-between",
                            isActive(item) && "bg-sidebar-accent text-sidebar-primary font-medium"
                          )}
                        >
                          <span className="flex items-center gap-2">
                            <item.icon className="h-4 w-4" />
                            {!collapsed && <span>{item.title}</span>}
                          </span>
                          {!collapsed && <ChevronDown className="h-3.5 w-3.5 transition-transform group-data-[state=open]:rotate-180" />}
                        </SidebarMenuButton>
                      </CollapsibleTrigger>
                      {!collapsed && (
                        <CollapsibleContent>
                          <div className="ml-4 border-l border-sidebar-border pl-2 mt-1 space-y-0.5">
                            {/* Parent link - only for items that have a distinct page */}
                            {item.url !== "/financeiro" && item.url !== "/configuracoes" && (
                              <SidebarMenuButton
                                asChild
                                isActive={location.pathname === item.url}
                                tooltip={item.title}
                                className="h-8 text-xs"
                              >
                                <NavLink to={item.url} end className="transition-colors" activeClassName="bg-sidebar-accent text-sidebar-primary font-medium" onClick={closeMobile}>
                                  <item.icon className="h-3.5 w-3.5" />
                                  <span>Cadastro</span>
                                </NavLink>
                              </SidebarMenuButton>
                            )}
                            {item.children.map(child => (
                              <SidebarMenuButton
                                key={child.title}
                                asChild
                                isActive={location.pathname === child.url}
                                tooltip={child.title}
                                className="h-8 text-xs"
                              >
                                <NavLink to={child.url} end className="transition-colors" activeClassName="bg-sidebar-accent text-sidebar-primary font-medium" onClick={closeMobile}>
                                  <child.icon className="h-3.5 w-3.5" />
                                  <span>{child.title}</span>
                                </NavLink>
                              </SidebarMenuButton>
                            ))}
                          </div>
                        </CollapsibleContent>
                      )}
                    </SidebarMenuItem>
                  </Collapsible>
                ) : (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton
                      asChild
                      isActive={location.pathname === item.url}
                      tooltip={item.title}
                    >
                      <NavLink
                        to={item.url}
                        end
                        className="transition-colors"
                        activeClassName="bg-sidebar-accent text-sidebar-primary font-medium"
                        onClick={closeMobile}
                      >
                        <item.icon className="h-4 w-4" />
                        {!collapsed && <span>{item.title}</span>}
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                )
              )}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton tooltip="Sair" onClick={handleLogout}>
              <LogOut className="h-4 w-4" />
              {!collapsed && <span>Sair</span>}
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}