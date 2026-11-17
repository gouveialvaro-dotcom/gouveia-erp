import Link from "next/link";
import { codigoRequisicao } from "@/lib/suprimentos";
import { dadosFormCotacao } from "@/lib/suprimentos-cotacao-form-dados";
import { CotacaoForm } from "@/components/suprimentos/cotacao-form";

export default async function PaginaEditarCotacao({
  params,
}: {
  params: Promise<{ id: string; cotacaoId: string }>;
}) {
  const { id, cotacaoId } = await params;
  const { requisicao, itens, fornecedores, cotacao } = await dadosFormCotacao(id, cotacaoId);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h2 className="text-lg font-semibold">
          Editar cotação · <span className="font-mono">{codigoRequisicao(requisicao.numero)}</span>
        </h2>
        <Link
          href={`/suprimentos/requisicoes/${requisicao.id}/cotacao`}
          className="text-xs text-muted-foreground hover:underline"
        >
          ← Cotação
        </Link>
      </div>
      <CotacaoForm requisicaoId={requisicao.id} cotacao={cotacao} fornecedores={fornecedores} itens={itens} />
    </div>
  );
}
