import { redirect } from "next/navigation";
import { acessoModulo } from "@/lib/pagina-auth";
import { podeEscrever } from "@/lib/permissoes";
import { FuncionarioForm } from "@/components/cadastros/funcionario-form";

export default async function PaginaNovoFuncionario() {
  const { perfil } = await acessoModulo("cadastrosGerais");
  if (!podeEscrever(perfil, "cadastrosGerais")) redirect("/cadastros/funcionarios");

  return (
    <div className="flex flex-col gap-1">
      <h2 className="text-lg font-semibold">Novo funcionário</h2>
      <p className="text-sm text-muted-foreground mb-4">Cadastro de funcionário</p>
      <FuncionarioForm />
    </div>
  );
}
