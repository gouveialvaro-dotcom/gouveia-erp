import { notFound, redirect } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { acessoModulo } from "@/lib/pagina-auth";
import { podeEscrever } from "@/lib/permissoes";
import { descricaoVeiculo, type TipoVeiculo } from "@/lib/programacao";
import { VeiculoForm } from "@/components/cadastros/veiculo-form";

export default async function PaginaEditarVeiculo({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { perfil } = await acessoModulo("veiculos");
  if (!podeEscrever(perfil, "veiculos")) redirect("/cadastros/veiculos");

  const { id } = await params;
  const { data: veiculo } = await supabase
    .from("Veiculo")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (!veiculo) notFound();

  return (
    <div className="flex flex-col gap-1">
      <h2 className="text-lg font-semibold">Veículo · {descricaoVeiculo(veiculo)}</h2>
      <p className="text-sm text-muted-foreground mb-4">Edição de cadastro</p>
      <VeiculoForm
        veiculo={{
          id: veiculo.id,
          placa: veiculo.placa,
          modelo: veiculo.modelo,
          tipo: veiculo.tipo as TipoVeiculo,
          identificacao: veiculo.identificacao,
          ativo: veiculo.ativo,
        }}
      />
    </div>
  );
}
