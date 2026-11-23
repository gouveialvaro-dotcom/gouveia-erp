import { supabase } from "@/lib/supabase";
import { contextoSuprimentos } from "@/lib/suprimentos-auth";
import { hojeSaoPaulo } from "@/lib/suprimentos";
import { RequisicaoForm, type OpcaoCentroCusto } from "@/components/suprimentos/requisicao-form";

export default async function PaginaNovaRequisicao() {
  await contextoSuprimentos();

  // Obra concluída não recebe material novo.
  const [{ data: obras }, { data: centros }] = await Promise.all([
    supabase
      .from("Obra")
      .select("id, nomeProjeto, cliente:Cliente(razaoSocial)")
      .neq("status", "concluida")
      .order("nomeProjeto"),
    supabase.from("CentroCusto").select("id, nome").eq("ativo", true).order("nome"),
  ]);

  const opcoes: OpcaoCentroCusto[] = [
    ...(obras ?? []).map((o) => ({
      valor: `obra:${o.id}`,
      nome: [o.nomeProjeto ?? "Obra sem nome", o.cliente?.razaoSocial].filter(Boolean).join(" · "),
      grupo: "obra" as const,
    })),
    ...(centros ?? []).map((c) => ({ valor: `centro:${c.id}`, nome: c.nome, grupo: "centro" as const })),
  ];

  return (
    <div className="flex flex-col gap-1">
      <h2 className="text-lg font-semibold">Nova requisição</h2>
      <p className="text-sm text-muted-foreground mb-4">
        Pedido de material, peça, serviço ou locação para uma obra ou outro centro de custo.
      </p>
      <RequisicaoForm hoje={hojeSaoPaulo()} centros={opcoes} />
    </div>
  );
}
