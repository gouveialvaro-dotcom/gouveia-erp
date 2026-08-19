import { redirect } from "next/navigation";
import { acessoModulo } from "@/lib/pagina-auth";
import { podeEscrever } from "@/lib/permissoes";
import { DescricaoForm } from "@/components/cadastros/descricao-form";

export default async function PaginaNovaDescricaoPadrao() {
  const { perfil } = await acessoModulo("cadastrosGerais");
  if (!podeEscrever(perfil, "cadastrosGerais")) redirect("/cadastros/descricoes");

  return (
    <div className="flex flex-col gap-1">
      <h2 className="text-lg font-semibold">Nova descrição padrão</h2>
      <p className="text-sm text-muted-foreground mb-4">
        Sugerida automaticamente ao criar um orçamento do tipo selecionado, e editável em cada proposta.
      </p>
      <DescricaoForm />
    </div>
  );
}
