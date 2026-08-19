"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Users,
  Calculator,
  Kanban,
  LifeBuoy,
  HardHat,
  LayoutDashboard,
  ShieldCheck,
  Zap,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { podeLer, type Modulo, type Perfil } from "@/lib/permissoes";

type ItemNav = {
  titulo: string;
  href: string;
  icone: React.ElementType;
  modulos: Modulo[];
};

const ITENS: ItemNav[] = [
  { titulo: "Cadastros", href: "/cadastros", icone: Users, modulos: ["clientes", "cadastrosGerais"] },
  { titulo: "Orçamentos", href: "/orcamentos", icone: Calculator, modulos: ["orcamentos"] },
  { titulo: "CRM / Propostas", href: "/crm", icone: Kanban, modulos: ["crm"] },
  { titulo: "Pós-venda", href: "/pos-venda", icone: LifeBuoy, modulos: ["posVenda"] },
  { titulo: "Obras", href: "/obras", icone: HardHat, modulos: ["obras"] },
  { titulo: "Dashboards", href: "/dashboards", icone: LayoutDashboard, modulos: ["dashboards"] },
  { titulo: "Administração", href: "/administracao", icone: ShieldCheck, modulos: ["administracao"] },
];

export function AppSidebar({ perfil }: { perfil: Perfil }) {
  const pathname = usePathname();

  const itensVisiveis = ITENS.filter((item) =>
    item.modulos.some((modulo) => podeLer(perfil, modulo))
  );

  return (
    <Sidebar>
      <SidebarHeader>
        <div className="flex items-center gap-2 px-2 py-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-sidebar-primary text-sidebar-primary-foreground">
            <Zap className="h-4 w-4" />
          </div>
          <div className="flex flex-col leading-tight">
            <span className="text-sm font-semibold text-sidebar-foreground">
              Gouveia Engenharia
            </span>
            <span className="text-xs text-sidebar-foreground/60">
              Gestão Interna
            </span>
          </div>
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Módulos</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {itensVisiveis.map((item) => {
                const ativo = pathname?.startsWith(item.href);
                return (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton render={<Link href={item.href} />} isActive={ativo}>
                      <item.icone />
                      <span>{item.titulo}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        <span className="px-2 py-1 text-xs text-sidebar-foreground/50">
          v0.1 · Fase 1 (MVP)
        </span>
      </SidebarFooter>
    </Sidebar>
  );
}
