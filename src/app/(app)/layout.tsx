import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { Topbar } from "@/components/topbar";
import { podeLer, type Perfil } from "@/lib/permissoes";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }

  const perfil = session.user.perfil as Perfil;

  return (
    <SidebarProvider>
      <AppSidebar perfil={perfil} />
      <SidebarInset>
        <Topbar
          nome={session.user.name ?? session.user.email ?? ""}
          perfil={perfil}
          // O sino só existe para quem enxerga o módulo; entre esses, quem
          // recebe de fato é derivado do chamado — o responsável e, conforme o
          // aviso, os administradores ativos.
          mostrarNotificacoes={podeLer(perfil, "posVenda")}
        />
        {/* min-w-0 pelo mesmo motivo do SidebarInset, e padding menor no
            estreito: com p-6 fixo, metade da largura do celular ia em margem. */}
        <main className="min-w-0 flex-1 p-4 sm:p-6">{children}</main>
      </SidebarInset>
    </SidebarProvider>
  );
}
