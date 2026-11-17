import { redirect } from "next/navigation";
import { contextoSuprimentos } from "@/lib/suprimentos-auth";
import { ImportarFornecedores } from "@/components/suprimentos/importar-fornecedores";

export default async function PaginaImportarFornecedores() {
  const { tem } = await contextoSuprimentos();
  if (!tem("comprador")) redirect("/suprimentos/fornecedores");

  return (
    <div className="flex flex-col gap-1">
      <h2 className="text-lg font-semibold">Importar fornecedores do Conta Azul</h2>
      <p className="text-sm text-muted-foreground mb-4">
        Use a planilha de fornecedores exportada do Conta Azul. Fornecedor que já existe não é
        sobrescrito: só ganha o que estava em branco.
      </p>
      <ImportarFornecedores />
    </div>
  );
}
