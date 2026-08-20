import { notFound, redirect } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { acessoModulo } from "@/lib/pagina-auth";
import { podeEscrever } from "@/lib/permissoes";
import { carregarFuncoes } from "@/lib/funcoes";
import { FuncionarioForm } from "@/components/cadastros/funcionario-form";

export default async function PaginaEditarFuncionario({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { perfil } = await acessoModulo("cadastrosGerais");
  if (!podeEscrever(perfil, "cadastrosGerais")) redirect("/cadastros/funcionarios");

  const { id } = await params;
  // Funções inativas entram na lista da edição: se a função de alguém já
  // cadastrado foi desativada, escondê-la deixaria o campo em branco e a
  // gravação exigiria trocar a função de quem só teve o salário corrigido.
  const [{ data: funcionario }, { funcoes, diasUteisMes }] = await Promise.all([
    supabase.from("Funcionario").select("*").eq("id", id).maybeSingle(),
    carregarFuncoes({ somenteAtivas: false }),
  ]);
  if (!funcionario) notFound();

  return (
    <div className="flex flex-col gap-1">
      <h2 className="text-lg font-semibold">Funcionário · {funcionario.nome}</h2>
      <p className="text-sm text-muted-foreground mb-4">Edição de cadastro</p>
      <FuncionarioForm
        funcoes={funcoes.map((f) => ({ ...f, nome: f.ativo ? f.nome : `${f.nome} (inativa)` }))}
        diasUteisMes={diasUteisMes}
        funcionario={{
          ...funcionario,
          salarioMensal: funcionario.salarioMensal.toString(),
          encargosPercent: funcionario.encargosPercent.toString(),
        }}
      />
    </div>
  );
}
