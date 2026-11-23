import { redirect } from "next/navigation";
import { CadastrosSubnav } from "@/components/cadastros/subnav";
import { cadastrosAtuais } from "@/lib/modulos-visiveis";
import { TituloPagina } from "@/components/titulo-pagina";

export default async function CadastrosLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Cada tipo de cadastro tem acesso próprio: o perfil decide o básico e o
  // administrador ajusta por pessoa (Administração → Módulos). Sem nenhum
  // tipo visível, a pessoa não entra.
  const visiveis = await cadastrosAtuais();
  if (visiveis.length === 0) redirect("/");

  return (
    <div className="flex flex-col gap-6">
      <TituloPagina titulo="Cadastros" />
      <CadastrosSubnav abas={visiveis.flatMap((c) => c.abas)} />
      {children}
    </div>
  );
}
