import { notFound, redirect } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { acessoModulo } from "@/lib/pagina-auth";
import { podeEscrever } from "@/lib/permissoes";
import { DescricaoForm } from "@/components/cadastros/descricao-form";

export default async function PaginaEditarDescricaoPadrao({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { perfil } = await acessoModulo("cadastrosGerais");
  if (!podeEscrever(perfil, "cadastrosGerais")) redirect("/cadastros/descricoes");

  const { id } = await params;
  const { data: descricao } = await supabase.from("DescricaoPadrao").select("*").eq("id", id).maybeSingle();
  if (!descricao) notFound();

  return (
    <div className="flex flex-col gap-1">
      <h2 className="text-lg font-semibold">Descrição padrão · {descricao.nome}</h2>
      <p className="text-sm text-muted-foreground mb-4">Edição de cadastro</p>
      <DescricaoForm descricao={descricao} />
    </div>
  );
}
