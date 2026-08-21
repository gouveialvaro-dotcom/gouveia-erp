import Link from "next/link";
import { redirect } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { acessoModulo } from "@/lib/pagina-auth";
import { podeEscrever } from "@/lib/permissoes";
import { ObraAvulsaForm } from "@/components/obras/obra-avulsa-form";

export default async function PaginaNovaObra() {
  const { perfil } = await acessoModulo("obras");
  if (!podeEscrever(perfil, "obras")) redirect("/obras");

  const { data: clientes } = await supabase
    .from("Cliente")
    .select("id, razaoSocial")
    .order("razaoSocial", { ascending: true });

  return (
    <div className="flex flex-col gap-1">
      <Link href="/obras" className="text-sm text-muted-foreground hover:underline w-fit">
        ← Obras
      </Link>
      <h2 className="text-lg font-semibold mt-2">Nova obra</h2>
      <p className="text-sm text-muted-foreground mb-4">
        Para obra que não veio do funil comercial. Ela fica de fora dos dashboards, que
        acompanham só o que passou por orçamento e oportunidade.
      </p>
      <ObraAvulsaForm clientes={clientes ?? []} />
    </div>
  );
}
