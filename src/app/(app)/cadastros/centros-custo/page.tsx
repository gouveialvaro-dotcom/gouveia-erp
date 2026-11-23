import { supabase } from "@/lib/supabase";
import { cn } from "@/lib/utils";
import { Separator } from "@/components/ui/separator";
import { CentroCustoLinhaForm, NovoCentroCustoForm } from "@/components/cadastros/centro-custo-form";
import { COLUNAS_CENTRO_CUSTO } from "@/components/cadastros/colunas-centro-custo";

// O acesso é conferido no layout desta pasta (Administração → Módulos).
export default async function PaginaCentrosCusto() {
  const { data } = await supabase
    .from("CentroCusto")
    .select("id, nome, codigo, descricao, ativo, requisicoes:Requisicao(count)")
    .order("ativo", { ascending: false })
    .order("nome");

  const centros = (data ?? []).map((c) => ({
    id: c.id,
    nome: c.nome,
    codigo: c.codigo,
    descricao: c.descricao,
    ativo: c.ativo,
    requisicoes: c.requisicoes[0]?.count ?? 0,
  }));

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted-foreground">
        Destinos das requisições de compra em Suprimentos: obras, sede, frota, manutenção ou o que mais
        precisar. Só os centros ativos aparecem na requisição; desativar não mexe nas requisições já
        feitas.
      </p>

      <div className="rounded-md border bg-card divide-y">
        <div
          className={cn(
            "hidden md:grid gap-3 px-3 py-2 text-xs text-muted-foreground items-end",
            COLUNAS_CENTRO_CUSTO
          )}
        >
          <span>Centro de custo</span>
          <span>Código</span>
          <span>Descrição</span>
          <span className="text-right">Requisições</span>
          <span />
        </div>

        {centros.map((c) => (
          // Remonta a linha quando o servidor devolve valores novos (campos não controlados).
          <CentroCustoLinhaForm key={`${c.id}|${c.nome}|${c.codigo}|${c.descricao}|${c.ativo}`} centro={c} />
        ))}

        {centros.length === 0 && (
          <p className="py-8 text-center text-sm text-muted-foreground">Nenhum centro de custo cadastrado.</p>
        )}
      </div>

      <Separator />
      <h3 className="font-semibold">Novo centro de custo</h3>
      <NovoCentroCustoForm />
    </div>
  );
}
