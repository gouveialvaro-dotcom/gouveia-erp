import { supabase } from "@/lib/supabase";
import type { CotacaoMatriz } from "@/components/suprimentos/matriz-cotacao";

// Leitura da cotação de uma requisição no formato que a matriz usa. Server-only.

export async function carregarCotacoes(requisicaoId: string) {
  const [{ data: itensBrutos }, { data: cotacoesBrutas }] = await Promise.all([
    supabase
      .from("RequisicaoItem")
      .select(
        "id, ordem, descricao, quantidade, unidade, especificacao, produtoId, cotacaoItemVencedorId, produto:Produto(descricao, unidade)"
      )
      .eq("requisicaoId", requisicaoId)
      .order("ordem"),
    supabase
      .from("Cotacao")
      .select(
        "*, fornecedor:Fornecedor(razaoSocial, nomeFantasia), precos:CotacaoItem(id, requisicaoItemId, precoUnitario)"
      )
      .eq("requisicaoId", requisicaoId)
      .order("criadoEm"),
  ]);

  const itens = (itensBrutos ?? []).map((i) => ({ ...i, quantidade: Number(i.quantidade) }));

  const cotacoes: CotacaoMatriz[] = (cotacoesBrutas ?? []).map((c) => ({
    id: c.id,
    fornecedor: c.fornecedor?.nomeFantasia || c.fornecedor?.razaoSocial || "Fornecedor",
    valorFrete: Number(c.valorFrete),
    valorDifal: c.incideDifal ? Number(c.valorDifal) : 0,
    precos: Object.fromEntries(
      c.precos.map((p) => [p.requisicaoItemId, { cotacaoItemId: p.id, precoUnitario: Number(p.precoUnitario) }])
    ),
    frete: c.frete,
    coletaPropria: c.coletaPropria,
    ufOrigem: c.ufOrigem,
    incideDifal: c.incideDifal,
    condicaoPagamento: c.condicaoPagamento,
    prazoEntregaDias: c.prazoEntregaDias,
  }));

  const escolhas = Object.fromEntries(itens.map((i) => [i.id, i.cotacaoItemVencedorId]));

  return { itens, cotacoes, cotacoesBrutas: cotacoesBrutas ?? [], escolhas };
}
