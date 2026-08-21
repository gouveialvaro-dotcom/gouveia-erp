import Link from "next/link";
import { redirect } from "next/navigation";
import { acessoModulo } from "@/lib/pagina-auth";
import { podeEscrever } from "@/lib/permissoes";
import { carregarFuncoes } from "@/lib/funcoes";
import { FuncionarioForm } from "@/components/cadastros/funcionario-form";

export default async function PaginaNovoFuncionario() {
  const { perfil } = await acessoModulo("cadastrosGerais");
  if (!podeEscrever(perfil, "cadastrosGerais")) redirect("/cadastros/funcionarios");

  const { funcoes, diasUteisMes } = await carregarFuncoes({ somenteAtivas: true });

  return (
    <div className="flex flex-col gap-1">
      <h2 className="text-lg font-semibold">Novo funcionário</h2>
      <p className="text-sm text-muted-foreground mb-4">Cadastro de funcionário</p>
      {funcoes.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Nenhuma função ativa cadastrada. O salário e os encargos de um funcionário vêm do
          catálogo de funções —{" "}
          <Link href="/cadastros/funcoes" className="underline">
            cadastre uma função
          </Link>{" "}
          antes de continuar.
        </p>
      ) : (
        <FuncionarioForm funcoes={funcoes} diasUteisMes={diasUteisMes} />
      )}
    </div>
  );
}
