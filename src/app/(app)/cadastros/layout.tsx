import { redirect } from "next/navigation";
import { CadastrosSubnav } from "@/components/cadastros/subnav";
import { acessoModulo } from "@/lib/pagina-auth";
import { podeLer } from "@/lib/permissoes";

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
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Cadastros</h1>
        <CadastrosSubnav perfil={perfil} />
      </div>
      {children}
    </div>
  );
}
