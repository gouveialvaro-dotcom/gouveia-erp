import { notFound, redirect } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { acessoModulo } from "@/lib/pagina-auth";
import { podeEscrever } from "@/lib/permissoes";
import { FuncionarioForm } from "@/components/cadastros/funcionario-form";

export default async function PaginaEditarFuncionario({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { perfil } = await acessoModulo("cadastrosGerais");
  if (!podeEscrever(perfil, "cadastrosGerais")) redirect("/cadastros/funcionarios");

  const { id } = await params;
  const { data: funcionario } = await supabase.from("Funcionario").select("*").eq("id", id).maybeSingle();
  if (!funcionario) notFound();

  return (
    <div className="flex flex-col gap-1">
      <h2 className="text-lg font-semibold">Funcionário · {funcionario.nome}</h2>
      <p className="text-sm text-muted-foreground mb-4">Edição de cadastro</p>
      <FuncionarioForm
        funcionario={{
          ...funcionario,
          salarioMensal: funcionario.salarioMensal.toString(),
          encargosPercent: funcionario.encargosPercent.toString(),
        }}
      />
    </div>
  );
}
