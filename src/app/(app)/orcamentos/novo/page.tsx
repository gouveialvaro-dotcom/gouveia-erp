import Link from "next/link";
import { redirect } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { acessoModulo } from "@/lib/pagina-auth";
import { podeEscrever } from "@/lib/permissoes";
import { OrcamentoForm } from "@/components/orcamentos/orcamento-form";

export default async function PaginaNovoOrcamento() {
  const { perfil } = await acessoModulo("orcamentos");
  if (!podeEscrever(perfil, "orcamentos")) redirect("/orcamentos");

  const { data } = await supabase
    .from("Cliente")
    .select("id, razaoSocial")
    .order("razaoSocial", { ascending: true });

  return (
    <div className="flex flex-col gap-1">
      <Link href="/orcamentos" className="text-sm text-muted-foreground hover:underline w-fit">
        ← Orçamentos
      </Link>
      <h2 className="text-lg font-semibold mt-2">Novo orçamento</h2>
      <p className="text-sm text-muted-foreground mb-4">Cadastro de orçamento</p>
      <OrcamentoForm clientes={data ?? []} />
    </div>
  );
}
