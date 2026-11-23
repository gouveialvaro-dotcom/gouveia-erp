import { notFound, redirect } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { contextoSuprimentos } from "@/lib/suprimentos-auth";
import { STATUS_COTACAO_ABERTA } from "@/lib/suprimentos";
import type { FaturamentoOpcoes, FornecedorOpcao } from "@/components/suprimentos/cotacao-form";

// Dados comuns das páginas "nova cotação" e "editar cotação". Server-only.

export async function dadosFormCotacao(requisicaoId: string, cotacaoId: string | null) {
  const contexto = await contextoSuprimentos();
  if (!contexto.tem("comprador")) redirect(`/suprimentos/requisicoes/${requisicaoId}`);

  const { data: r } = await supabase
    .from("Requisicao")
    .select("id, numero, status, obraId, obra:Obra(clienteId)")
    .eq("id", requisicaoId)
    .maybeSingle();
  if (!r) notFound();
  if (!STATUS_COTACAO_ABERTA.includes(r.status)) redirect(`/suprimentos/requisicoes/${r.id}/cotacao`);

  const [
    { data: itens },
    { data: fornecedores },
    { data: cotacoes },
    { data: empresas },
    { data: daObra },
    { data: clientes },
  ] = await Promise.all([
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
    supabase.from("EmpresaGrupo").select("id, razaoSocial, nomeFantasia, ativo").order("razaoSocial"),
    r.obraId
      ? supabase.from("ObraFaturamento").select("empresaId").eq("obraId", r.obraId).maybeSingle()
      : Promise.resolve({ data: null }),
    supabase.from("Cliente").select("id, razaoSocial, cnpj").order("razaoSocial"),
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

  // Empresa padrão: a da cotação, ou a configurada para a obra (requisições antigas).
  const faturamento: FaturamentoOpcoes = {
    empresas: (empresas ?? [])
      .filter((e) => e.ativo || e.id === cotacao?.empresaId)
      .map((e) => ({ id: e.id, nome: e.nomeFantasia ? `${e.nomeFantasia} (${e.razaoSocial})` : e.razaoSocial })),
    empresaPadraoId: daObra?.empresaId ?? null,
    clientes: (clientes ?? []).map((c) => ({ id: c.id, nome: c.cnpj ? `${c.razaoSocial} — ${c.cnpj}` : c.razaoSocial })),
    clientePadraoId: cotacao?.clienteId ?? r.obra?.clienteId ?? null,
  };

  return {
    requisicao: r,
    faturamento,
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
          empresaId: cotacao.empresaId,
          faturadoCliente: cotacao.faturadoCliente,
          autorizacaoNome: cotacao.autorizacaoNome,
          formaPagamento: cotacao.formaPagamento,
          prazoPagamentoDias: cotacao.prazoPagamentoDias,
          parcelas: cotacao.parcelas,
          prazoEntregaDias: cotacao.prazoEntregaDias,
          observacoes: cotacao.observacoes,
          precos: Object.fromEntries(cotacao.precos.map((p) => [p.requisicaoItemId, Number(p.precoUnitario)])),
        }
      : null,
  };
}
