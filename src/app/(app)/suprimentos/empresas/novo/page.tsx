import { redirect } from "next/navigation";
import { contextoSuprimentos } from "@/lib/suprimentos-auth";
import { EmpresaForm } from "@/components/suprimentos/cadastro-forms";

export default async function PaginaNovaEmpresa() {
  const { ehAdmin } = await contextoSuprimentos();
  if (!ehAdmin) redirect("/suprimentos");

  return (
    <div className="flex flex-col gap-1">
      <h2 className="text-lg font-semibold">Nova empresa do grupo</h2>
      <p className="text-sm text-muted-foreground mb-4">CNPJ que pode ser faturado</p>
      <EmpresaForm />
    </div>
  );
}
