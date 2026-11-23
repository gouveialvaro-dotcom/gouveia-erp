import Link from "next/link";
import { codigoRequisicao } from "@/lib/suprimentos";
import { dadosFormCotacao } from "@/lib/suprimentos-cotacao-form-dados";
import { CotacaoForm } from "@/components/suprimentos/cotacao-form";

export default async function PaginaNovaCotacao({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { requisicao, itens, fornecedores, faturamento } = await dadosFormCotacao(id, null);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h2 className="text-lg font-semibold">
          Nova cotação · <span className="font-mono">{codigoRequisicao(requisicao.numero)}</span>
        </h2>
        <Link
          href={`/suprimentos/requisicoes/${requisicao.id}/cotacao`}
          className="text-xs text-muted-foreground hover:underline"
        >
          ← Cotação
        </Link>
      </div>
      <CotacaoForm
        requisicaoId={requisicao.id}
        cotacao={null}
        fornecedores={fornecedores}
        itens={itens}
        faturamento={faturamento}
      />
    </div>
  );
}
