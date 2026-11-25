import { supabase } from "@/lib/supabase";
import { cn } from "@/lib/utils";
import { Separator } from "@/components/ui/separator";
import { NovaUnidadeForm, UnidadeLinhaForm } from "@/components/cadastros/unidade-medida-form";
import { COLUNAS_UNIDADE } from "@/components/cadastros/colunas-unidade";

// O acesso é conferido no layout desta pasta (Administração → Módulos).
export default async function PaginaUnidadesMedida() {
  const { data } = await supabase
    .from("UnidadeMedida")
    .select("id, sigla, nome, ordem, ativo")
    .order("ativo", { ascending: false })
    .order("ordem")
    .order("nome");

  // Quantos itens de requisição usam cada sigla (poucas unidades: uma contagem cada).
  const unidades = await Promise.all(
    (data ?? []).map(async (u) => {
      const { count } = await supabase
        .from("RequisicaoItem")
        .select("id", { count: "exact", head: true })
        .eq("unidade", u.sigla);
      return { ...u, usos: count ?? 0 };
    })
  );

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted-foreground">
        Unidades oferecidas na requisição de compra, na ordem do campo &quot;Ordem&quot;. A sigla é o que fica
        gravado no item; depois de usada em uma requisição, ela não muda. Desativar tira a unidade da lista
        sem mexer nas requisições já feitas.
      </p>

      <div className="rounded-md border bg-card divide-y">
        <div
          className={cn("hidden md:grid gap-3 px-3 py-2 text-xs text-muted-foreground items-end", COLUNAS_UNIDADE)}
        >
          <span>Sigla</span>
          <span>Nome</span>
          <span>Ordem</span>
          <span className="text-right">Itens</span>
          <span />
        </div>

        {unidades.map((u) => (
          // Remonta a linha quando o servidor devolve valores novos (campos não controlados).
          <UnidadeLinhaForm key={`${u.id}|${u.sigla}|${u.nome}|${u.ordem}|${u.ativo}`} unidade={u} />
        ))}

        {unidades.length === 0 && (
          <p className="py-8 text-center text-sm text-muted-foreground">Nenhuma unidade cadastrada.</p>
        )}
      </div>

      <Separator />
      <h3 className="font-semibold">Nova unidade</h3>
      <NovaUnidadeForm />
    </div>
  );
}
