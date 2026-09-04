import { redirect } from "next/navigation";
import { acessoModulo } from "@/lib/pagina-auth";
import { podeEscrever } from "@/lib/permissoes";
import { VeiculoForm } from "@/components/cadastros/veiculo-form";

export default async function PaginaNovoVeiculo() {
  const { perfil } = await acessoModulo("veiculos");
  if (!podeEscrever(perfil, "veiculos")) redirect("/cadastros/veiculos");

  return (
    <div className="flex flex-col gap-1">
      <h2 className="text-lg font-semibold">Novo veículo</h2>
      <p className="text-sm text-muted-foreground mb-4">Cadastro de frota</p>
      <VeiculoForm />
    </div>
  );
}
