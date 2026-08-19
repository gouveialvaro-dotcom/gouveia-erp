import Link from "next/link";
import { notFound } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { acessoModulo } from "@/lib/pagina-auth";
import { podeEscrever } from "@/lib/permissoes";
import { formatarData } from "@/lib/format";
import { OrcamentoForm } from "@/components/orcamentos/orcamento-form";

export default async function PaginaEditarOrcamento({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { perfil } = await acessoModulo("orcamentos");
  const { id } = await params;

  const { data: orcamento } = await supabase
    .from("Orcamento")
    .select("*, cliente:Cliente(id, razaoSocial)")
    .eq("id", id)
    .maybeSingle();

  if (!orcamento) notFound();

  const { data: clientes } = await supabase
    .from("Cliente")
    .select("id, razaoSocial")
    .order("razaoSocial", { ascending: true });

  const podeEditar = podeEscrever(perfil, "orcamentos");

  return (
    <div className="flex flex-col gap-1">
      <Link href="/orcamentos" className="text-sm text-muted-foreground hover:underline w-fit">
        ← Orçamentos
      </Link>
      <h2 className="text-lg font-semibold mt-2">Orçamento · {orcamento.nomeProjeto}</h2>
      <p className="text-sm text-muted-foreground mb-4">
        Criado em {formatarData(orcamento.criadoEm)}
      </p>

      {podeEditar ? (
        <OrcamentoForm
          orcamento={{
            id: orcamento.id,
            nomeProjeto: orcamento.nomeProjeto,
            clienteId: orcamento.clienteId,
            tipoProposta: orcamento.tipoProposta,
            descricao: orcamento.descricao,
            status: orcamento.status,
          }}
          clientes={clientes ?? []}
        />
      ) : (
        <dl className="grid grid-cols-2 gap-3 max-w-2xl text-sm">
          <div><dt className="text-muted-foreground">Cliente</dt><dd>{orcamento.cliente?.razaoSocial ?? "—"}</dd></div>
          <div><dt className="text-muted-foreground">Tipo</dt><dd>{orcamento.tipoProposta === "usina_solar" ? "Usina Solar" : "Redes"}</dd></div>
          <div><dt className="text-muted-foreground">Status</dt><dd>{orcamento.status}</dd></div>
          <div className="col-span-2"><dt className="text-muted-foreground">Descrição</dt><dd>{orcamento.descricao ?? "—"}</dd></div>
        </dl>
      )}
    </div>
  );
}
