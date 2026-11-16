import { notFound, redirect } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { contextoSuprimentos } from "@/lib/suprimentos-auth";
import { FornecedorForm } from "@/components/suprimentos/cadastro-forms";

export default async function PaginaEditarFornecedor({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { tem } = await contextoSuprimentos();
  if (!tem("comprador")) redirect("/suprimentos/fornecedores");

  const { id } = await params;
  const { data: fornecedor } = await supabase
    .from("Fornecedor")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (!fornecedor) notFound();

  return (
    <div className="flex flex-col gap-1">
      <h2 className="text-lg font-semibold">{fornecedor.razaoSocial}</h2>
      <p className="text-sm text-muted-foreground mb-4">Edição de fornecedor</p>
      <FornecedorForm fornecedor={fornecedor} />
    </div>
  );
}
