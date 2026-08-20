import { redirect } from "next/navigation";
import { acessoModulo } from "@/lib/pagina-auth";
import { podeEscrever } from "@/lib/permissoes";
import { ROTULO_RAMO, listaDoRamo, ramoDoSlug } from "@/lib/clientes";
import { ClienteForm } from "@/components/cadastros/cliente-form";

export default async function PaginaNovoCliente({
  searchParams,
}: {
  searchParams: Promise<{ ramo?: string }>;
}) {
  const { perfil } = await acessoModulo("clientes");
  const { ramo: slug } = await searchParams;
  const ramo = ramoDoSlug(slug ?? "solar");

  if (!ramo) redirect("/cadastros/clientes/solar");
  if (!podeEscrever(perfil, "clientes")) redirect(listaDoRamo(ramo));

  return (
    <div className="flex flex-col gap-1">
      <h2 className="text-lg font-semibold">Novo cliente · {ROTULO_RAMO[ramo]}</h2>
      <p className="text-sm text-muted-foreground mb-4">
        {ramo === "energia_solar"
          ? "Depois de salvar, cadastre as unidades geradoras e beneficiárias na tela do cliente."
          : "Cadastro de cliente de redes/subestações."}
      </p>
      <ClienteForm ramo={ramo} />
    </div>
  );
}
