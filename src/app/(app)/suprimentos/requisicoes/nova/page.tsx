import { supabase } from "@/lib/supabase";
import { contextoSuprimentos } from "@/lib/suprimentos-auth";
import { hojeSaoPaulo } from "@/lib/suprimentos";
import { RequisicaoForm } from "@/components/suprimentos/requisicao-form";

export default async function PaginaNovaRequisicao() {
  await contextoSuprimentos();

  // Obra concluída não recebe material novo.
  const { data: obras } = await supabase
    .from("Obra")
    .select("id, nomeProjeto, cliente:Cliente(razaoSocial)")
    .neq("status", "concluida")
    .order("nomeProjeto");

  return (
    <div className="flex flex-col gap-1">
      <h2 className="text-lg font-semibold">Nova requisição</h2>
      <p className="text-sm text-muted-foreground mb-4">
        Pedido de material, peça, serviço ou locação para uma obra.
      </p>
      <RequisicaoForm
        hoje={hojeSaoPaulo()}
        obras={(obras ?? []).map((o) => ({
          id: o.id,
          nome: [o.nomeProjeto ?? "Obra sem nome", o.cliente?.razaoSocial].filter(Boolean).join(" · "),
        }))}
      />
    </div>
  );
}
