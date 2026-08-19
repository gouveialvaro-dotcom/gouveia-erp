import { redirect } from "next/navigation";
import { acessoModulo } from "@/lib/pagina-auth";
import { podeEscrever } from "@/lib/permissoes";
import { MaterialForm } from "@/components/cadastros/material-form";

export default async function PaginaNovoMaterial() {
  const { perfil } = await acessoModulo("cadastrosGerais");
  if (!podeEscrever(perfil, "cadastrosGerais")) redirect("/cadastros/materiais");

  return (
    <div className="flex flex-col gap-1">
      <h2 className="text-lg font-semibold">Novo material</h2>
      <p className="text-sm text-muted-foreground mb-4">Cadastro de material</p>
      <MaterialForm />
    </div>
  );
}
