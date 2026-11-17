import { notFound, redirect } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { contextoSuprimentos } from "@/lib/suprimentos-auth";
import { ProdutoForm } from "@/components/suprimentos/cadastro-forms";

export default async function PaginaEditarProduto({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { tem } = await contextoSuprimentos();
  if (!tem("comprador")) redirect("/suprimentos/produtos");

  const { id } = await params;
  const { data: produto } = await supabase
    .from("Produto")
    .select("*, codigos:ProdutoCodigoExterno(origem, codigo, ean)")
    .eq("id", id)
    .maybeSingle();
  if (!produto) notFound();

  return (
    <div className="flex flex-col gap-1">
      <h2 className="text-lg font-semibold">
        Produto nº {produto.numero} · {produto.descricao}
      </h2>
      <p className="text-sm text-muted-foreground mb-4">Edição de cadastro</p>
      <ProdutoForm
        produto={{
          id: produto.id,
          descricao: produto.descricao,
          unidade: produto.unidade,
          categoria: produto.categoria,
          tipo: produto.tipo,
          observacoes: produto.observacoes,
          ativo: produto.ativo,
          revisar: produto.revisar,
        }}
      />

      {produto.codigos.length > 0 && (
        <div className="mt-8 max-w-2xl">
          <h3 className="text-sm font-semibold mb-2">Códigos no Conta Azul</h3>
          <ul className="rounded-md border bg-card divide-y text-sm">
            {produto.codigos.map((c) => (
              <li key={`${c.origem}-${c.codigo}`} className="flex justify-between gap-4 px-3 py-2">
                <span className="text-muted-foreground">{c.origem}</span>
                <span className="font-mono">
                  {c.codigo}
                  {c.ean ? ` · EAN ${c.ean}` : ""}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
