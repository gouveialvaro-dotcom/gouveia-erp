import { supabase } from "@/lib/supabase";
import { contextoSuprimentos } from "@/lib/suprimentos-auth";
import { hojeSaoPaulo } from "@/lib/suprimentos";
import { RequisicaoForm } from "@/components/suprimentos/requisicao-form";

export default async function PaginaNovaRequisicao() {
  await contextoSuprimentos();

  // Só os centros ativos do cadastro (Cadastros → Centros de custo).
  const [{ data: centros }, { data: unidades }] = await Promise.all([
    supabase.from("CentroCusto").select("id, nome, codigo").eq("ativo", true).order("nome"),
    // Unidades ativas do cadastro (Cadastros → Unidades de medida).
    supabase.from("UnidadeMedida").select("sigla, nome").eq("ativo", true).order("ordem").order("nome"),
  ]);

  return (
    <div className="flex flex-col gap-1">
      <h2 className="text-lg font-semibold">Nova requisição</h2>
      <p className="text-sm text-muted-foreground mb-4">
        Pedido de material, peça, serviço ou locação para um centro de custo.
      </p>
      <RequisicaoForm hoje={hojeSaoPaulo()} centros={centros ?? []} unidades={unidades ?? []} />
    </div>
  );
}
