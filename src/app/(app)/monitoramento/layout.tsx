import { redirect } from "next/navigation";
import { acessoModulo } from "@/lib/pagina-auth";
import { podeLer } from "@/lib/permissoes";
import { MonitoramentoSubnav } from "@/components/monitoramento/subnav";
import { TituloPagina } from "@/components/titulo-pagina";

export default async function MonitoramentoLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { perfil } = await acessoModulo("monitoramento");

  // Obra e logística não entram. A verificação é aqui e em cada Server Action —
  // esconder o item na sidebar nunca é a garantia.
  if (!podeLer(perfil, "monitoramento")) redirect("/");

  return (
    <div className="flex flex-col gap-6">
      {/* Quem publica o título é o layout, e não cada página: em módulo com aba
          duas publicações na mesma rota disputariam o slot da Topbar. */}
      <TituloPagina titulo="Monitoramento de usinas" />
      <MonitoramentoSubnav perfil={perfil} />
      {children}
    </div>
  );
}
