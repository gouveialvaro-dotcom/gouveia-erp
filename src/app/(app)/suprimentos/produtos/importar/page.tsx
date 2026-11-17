import { redirect } from "next/navigation";
import { contextoSuprimentos } from "@/lib/suprimentos-auth";
import { ImportarProdutos } from "@/components/suprimentos/importar-produtos";

export default async function PaginaImportarProdutos() {
  const { tem } = await contextoSuprimentos();
  if (!tem("comprador")) redirect("/suprimentos/produtos");

  return (
    <div className="flex flex-col gap-1">
      <h2 className="text-lg font-semibold">Importar produtos do Conta Azul</h2>
      <p className="text-sm text-muted-foreground mb-4">
        Refeições, alimentos e combustíveis ficam de fora por padrão: são lançados como
        despesa, não passam por requisição.
      </p>
      <ImportarProdutos />
    </div>
  );
}
