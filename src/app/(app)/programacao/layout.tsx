import { redirect } from "next/navigation";
import { acessoModulo } from "@/lib/pagina-auth";
import { podeLer } from "@/lib/permissoes";
import { ProgramacaoSubnav } from "@/components/programacao/subnav";
import { TituloPagina } from "@/components/titulo-pagina";

export default async function ProgramacaoLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { perfil } = await acessoModulo("programacao");

  // Engenharia e obra leem tudo; atendimento e comercial não entram. A
  // verificação é aqui e em cada Server Action — esconder o item na sidebar
  // nunca é a garantia.
  if (!podeLer(perfil, "programacao")) redirect("/");

  return (
    <div className="flex flex-col gap-6">
      <TituloPagina titulo="Programação" />
      <ProgramacaoSubnav perfil={perfil} />
      {children}
    </div>
  );
}
