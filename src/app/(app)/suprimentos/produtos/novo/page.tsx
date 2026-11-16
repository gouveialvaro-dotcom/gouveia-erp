import { redirect } from "next/navigation";
import { contextoSuprimentos } from "@/lib/suprimentos-auth";
import { ProdutoForm } from "@/components/suprimentos/cadastro-forms";

export default async function PaginaNovoProduto() {
  const { tem } = await contextoSuprimentos();
  if (!tem("comprador")) redirect("/suprimentos/produtos");

  return (
    <div className="flex flex-col gap-1">
      <h2 className="text-lg font-semibold">Novo produto</h2>
      <p className="text-sm text-muted-foreground mb-4">Catálogo de Suprimentos</p>
      <ProdutoForm />
    </div>
  );
}
