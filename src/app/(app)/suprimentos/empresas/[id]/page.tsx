import { notFound, redirect } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { contextoSuprimentos } from "@/lib/suprimentos-auth";
import { EmpresaForm } from "@/components/suprimentos/cadastro-forms";

export default async function PaginaEditarEmpresa({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { ehAdmin } = await contextoSuprimentos();
  if (!ehAdmin) redirect("/suprimentos");

  const { id } = await params;
  const { data: empresa } = await supabase
    .from("EmpresaGrupo")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (!empresa) notFound();

  return (
    <div className="flex flex-col gap-1">
      <h2 className="text-lg font-semibold">{empresa.razaoSocial}</h2>
      <p className="text-sm text-muted-foreground mb-4">Edição de cadastro</p>
      <EmpresaForm
        empresa={{
          id: empresa.id,
          razaoSocial: empresa.razaoSocial,
          nomeFantasia: empresa.nomeFantasia,
          cnpj: empresa.cnpj,
          uf: empresa.uf,
          ativo: empresa.ativo,
        }}
      />
    </div>
  );
}
