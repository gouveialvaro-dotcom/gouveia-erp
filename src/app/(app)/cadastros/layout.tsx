import { redirect } from "next/navigation";
import { CadastrosSubnav } from "@/components/cadastros/subnav";
import { acessoModulo } from "@/lib/pagina-auth";
import { podeLer } from "@/lib/permissoes";
import { TituloPagina } from "@/components/titulo-pagina";

export default async function CadastrosLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { perfil } = await acessoModulo("clientes");

  if (
    !podeLer(perfil, "clientes") &&
    !podeLer(perfil, "cadastrosGerais") &&
    !podeLer(perfil, "veiculos")
  ) {
    redirect("/");
  }

  return (
    <div className="flex flex-col gap-6">
      <TituloPagina titulo="Cadastros" />
      <CadastrosSubnav perfil={perfil} />
      {children}
    </div>
  );
}
