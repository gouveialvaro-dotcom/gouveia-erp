import { redirect } from "next/navigation";
import { contextoSuprimentos } from "@/lib/suprimentos-auth";
import { FornecedorForm } from "@/components/suprimentos/cadastro-forms";

export default async function PaginaNovoFornecedor() {
  const { tem } = await contextoSuprimentos();
  if (!tem("comprador")) redirect("/suprimentos/fornecedores");

  return (
    <div className="flex flex-col gap-1">
      <h2 className="text-lg font-semibold">Novo fornecedor</h2>
      <p className="text-sm text-muted-foreground mb-4">Cadastro de fornecedor</p>
      <FornecedorForm />
    </div>
  );
}
