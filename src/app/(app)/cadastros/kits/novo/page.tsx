import { redirect } from "next/navigation";
import { acessoModulo } from "@/lib/pagina-auth";
import { podeEscrever } from "@/lib/permissoes";
import { KitForm } from "@/components/cadastros/kit-form";

export default async function PaginaNovoKit() {
  const { perfil } = await acessoModulo("cadastrosGerais");
  if (!podeEscrever(perfil, "cadastrosGerais")) redirect("/cadastros/kits");

  return (
    <div className="flex flex-col gap-1">
      <h2 className="text-lg font-semibold">Novo kit</h2>
      <p className="text-sm text-muted-foreground mb-4">
        Defina o nome e a categoria; os itens são adicionados na próxima tela.
      </p>
      <KitForm />
    </div>
  );
}
