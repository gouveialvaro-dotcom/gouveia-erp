import Link from "next/link";
import { redirect } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { acessoModulo } from "@/lib/pagina-auth";
import { podeEscrever } from "@/lib/permissoes";
import { OportunidadeCriarForm } from "@/components/crm/oportunidade-criar-form";

export default async function PaginaNovaOportunidade() {
  const { perfil, userId } = await acessoModulo("crm");
  if (!podeEscrever(perfil, "crm")) redirect("/crm");

  const { data: orcamentos } = await supabase
    .from("Orcamento")
    .select("id, nomeProjeto, cliente:Cliente(razaoSocial)")
    .order("criadoEm", { ascending: false });

  const { data: oportunidadesExistentes } = await supabase
    .from("Oportunidade")
    .select("orcamentoId");

  const orcamentoIdsComOportunidade = new Set(
    (oportunidadesExistentes ?? []).map((o) => o.orcamentoId)
  );
  const orcamentosDisponiveis = (orcamentos ?? []).filter(
    (o) => !orcamentoIdsComOportunidade.has(o.id)
  );

  const { data: usuarios } = await supabase
    .from("Usuario")
    .select("id, nome")
    .eq("ativo", true)
    .order("nome", { ascending: true });

  return (
    <div className="flex flex-col gap-1">
      <Link href="/crm" className="text-sm text-muted-foreground hover:underline w-fit">
        ← CRM / Propostas
      </Link>
      <h2 className="text-lg font-semibold mt-2">Nova oportunidade</h2>
      <p className="text-sm text-muted-foreground mb-4">
        Vincule um orçamento já cadastrado para iniciar o acompanhamento no funil.
      </p>
      <OportunidadeCriarForm
        orcamentos={orcamentosDisponiveis.map((o) => ({
          id: o.id,
          nomeProjeto: o.nomeProjeto,
          clienteNome: o.cliente?.razaoSocial ?? "—",
        }))}
        usuarios={usuarios ?? []}
        responsavelPadraoId={userId}
      />
    </div>
  );
}
