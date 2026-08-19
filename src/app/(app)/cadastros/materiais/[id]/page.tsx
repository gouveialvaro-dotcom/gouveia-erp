import { notFound, redirect } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { acessoModulo } from "@/lib/pagina-auth";
import { podeEscrever } from "@/lib/permissoes";
import { MaterialForm } from "@/components/cadastros/material-form";
import { Button } from "@/components/ui/button";
import { excluirMaterial } from "../actions";

export default async function PaginaEditarMaterial({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { perfil } = await acessoModulo("cadastrosGerais");
  if (!podeEscrever(perfil, "cadastrosGerais")) redirect("/cadastros/materiais");

  const { id } = await params;
  const { data: material } = await supabase.from("Material").select("*").eq("id", id).maybeSingle();
  if (!material) notFound();

  return (
    <div className="flex flex-col gap-1">
      <h2 className="text-lg font-semibold">Material · {material.codigo}</h2>
      <p className="text-sm text-muted-foreground mb-4">Edição de cadastro</p>
      <MaterialForm
        material={{ ...material, custoUnitario: material.custoUnitario.toString() }}
      />
      <form
        action={async () => {
          "use server";
          await excluirMaterial(material.id);
          redirect("/cadastros/materiais");
        }}
        className="mt-2"
      >
        <Button type="submit" variant="ghost" className="text-destructive hover:text-destructive">
          Excluir material
        </Button>
      </form>
    </div>
  );
}
