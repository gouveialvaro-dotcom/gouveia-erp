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
  MessageCircle,
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
  SidebarTrigger,
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
  {
    titulo: "WhatsApp",
    href: "/pos-venda/whatsapp",
    icone: MessageCircle,
    modulos: ["posVenda"],
  },
  { titulo: "Obras", href: "/obras", icone: HardHat, modulos: ["obras"] },
  { titulo: "Dashboards", href: "/dashboards", icone: LayoutDashboard, modulos: ["dashboards"] },
  { titulo: "Administração", href: "/administracao", icone: ShieldCheck, modulos: ["administracao"] },
];

export function AppSidebar({ perfil }: { perfil: Perfil }) {
  const pathname = usePathname();

  const itensVisiveis = ITENS.filter((item) =>
    item.modulos.some((modulo) => podeLer(perfil, modulo))
  );

  // Só o item mais específico acende. Sem isso "/pos-venda/whatsapp" marcaria
  // também "Pós-venda", já que uma rota é prefixo da outra.
  const itemAtivo = itensVisiveis
    .filter((item) => pathname === item.href || pathname?.startsWith(`${item.href}/`))
    .sort((a, b) => b.href.length - a.href.length)[0];

  return (
    // "icon" em vez do padrão "offcanvas": com o botão de recolher dentro da
    // própria sidebar, o modo offcanvas a esconderia por inteiro e levaria o
    // botão junto, sem deixar como reabrir.
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <div className="flex items-center gap-2 px-2 py-2 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0">
          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-sidebar-primary text-sidebar-primary-foreground group-data-[collapsible=icon]:hidden">
            <Zap className="h-4 w-4" />
          </div>
          <div className="flex flex-col leading-tight group-data-[collapsible=icon]:hidden">
            <span className="text-sm font-semibold text-sidebar-foreground">
              Gouveia Engenharia
            </span>
            <span className="text-xs text-sidebar-foreground/60">
              Gestão Interna
            </span>
          </div>
          <SidebarTrigger
            className="ml-auto text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground group-data-[collapsible=icon]:ml-0"
            title="Recolher menu"
          />
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Módulos</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {itensVisiveis.map((item) => {
                const ativo = item.href === itemAtivo?.href;
                return (
                  <SidebarMenuItem key={item.href}>
                    {/* tooltip só aparece com a sidebar recolhida, quando o
                        rótulo do item fica oculto */}
                    <SidebarMenuButton
                      render={<Link href={item.href} />}
                      isActive={ativo}
                      tooltip={item.titulo}
                    >
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
        <span className="px-2 py-1 text-xs text-sidebar-foreground/50 group-data-[collapsible=icon]:hidden">
          v0.1 · Fase 1 (MVP)
        </span>
      </SidebarFooter>
    </Sidebar>
  );
}
