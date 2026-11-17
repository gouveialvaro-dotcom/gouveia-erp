import { notFound, redirect } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { contextoSuprimentos } from "@/lib/suprimentos-auth";
import { STATUS_COTACAO_ABERTA } from "@/lib/suprimentos";
import type { FornecedorOpcao } from "@/components/suprimentos/cotacao-form";

// Dados comuns das páginas "nova cotação" e "editar cotação". Server-only.

export async function dadosFormCotacao(requisicaoId: string, cotacaoId: string | null) {
  const contexto = await contextoSuprimentos();
  if (!contexto.tem("comprador")) redirect(`/suprimentos/requisicoes/${requisicaoId}`);

  const { data: r } = await supabase
    .from("Requisicao")
    .select("id, numero, status")
    .eq("id", requisicaoId)
    .maybeSingle();
  if (!r) notFound();
  if (!STATUS_COTACAO_ABERTA.includes(r.status)) redirect(`/suprimentos/requisicoes/${r.id}/cotacao`);

  const [{ data: itens }, { data: fornecedores }, { data: cotacoes }] = await Promise.all([
    supabase
      .from("RequisicaoItem")
      .select("id, ordem, descricao, quantidade, unidade")
      .eq("requisicaoId", r.id)
      .order("ordem"),
    supabase
      .from("Fornecedor")
      .select("id, razaoSocial, nomeFantasia, uf, vendedor, ativo")
      .order("razaoSocial"),
    supabase
      .from("Cotacao")
      .select("*, precos:CotacaoItem(requisicaoItemId, precoUnitario)")
      .eq("requisicaoId", r.id),
  ]);

  const cotacao = cotacaoId ? (cotacoes ?? []).find((c) => c.id === cotacaoId) : null;
  if (cotacaoId && !cotacao) notFound();

  // Cada fornecedor cota uma vez por requisição; na edição o próprio continua.
  const jaCotados = new Set((cotacoes ?? []).map((c) => c.fornecedorId));
  const opcoes: FornecedorOpcao[] = (fornecedores ?? [])
    .filter((f) => f.id === cotacao?.fornecedorId || (f.ativo && !jaCotados.has(f.id)))
    .map((f) => ({
      id: f.id,
      nome: f.nomeFantasia ? `${f.nomeFantasia} (${f.razaoSocial})` : f.razaoSocial,
      uf: f.uf,
      vendedor: f.vendedor,
    }))
    .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));

  return {
    requisicao: r,
    itens: (itens ?? []).map((i) => ({ ...i, quantidade: Number(i.quantidade) })),
    fornecedores: opcoes,
    cotacao: cotacao
      ? {
          id: cotacao.id,
          fornecedorId: cotacao.fornecedorId,
          vendedor: cotacao.vendedor,
          incideDifal: cotacao.incideDifal,
          aliquotaDifal: cotacao.aliquotaDifal === null ? null : Number(cotacao.aliquotaDifal),
          valorDifal: Number(cotacao.valorDifal),
          frete: cotacao.frete,
          coletaPropria: cotacao.coletaPropria,
          valorFrete: Number(cotacao.valorFrete),
          condicaoPagamento: cotacao.condicaoPagamento,
          prazoEntregaDias: cotacao.prazoEntregaDias,
          observacoes: cotacao.observacoes,
          precos: Object.fromEntries(cotacao.precos.map((p) => [p.requisicaoItemId, Number(p.precoUnitario)])),
        }
      : null,
  };
}
