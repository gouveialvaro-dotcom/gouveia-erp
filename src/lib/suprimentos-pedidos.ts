import { supabase } from "@/lib/supabase";
import { somarDiasIso } from "@/lib/suprimentos";

// Leitura de um pedido de compra, comum ao detalhe e à versão de impressão.
// Server-only. Os valores vêm do retrato gravado na emissão (PedidoCompraItem),
// não da cotação: o pedido impresso não muda se alguém mexer depois.

export async function carregarPedido(id: string) {
  const { data: p } = await supabase
    .from("PedidoCompra")
    .select(
      `*,
       fornecedor:Fornecedor(razaoSocial, nomeFantasia, cnpj, uf, cidade, telefone, email),
       empresa:EmpresaGrupo(razaoSocial, nomeFantasia, cnpj, uf),
       cliente:Cliente(razaoSocial, cnpj),
       cotacao:Cotacao(vendedor, observacoes),
       emitidoPor:Usuario!PedidoCompra_emitidoPorId_fkey(nome),
       itens:PedidoCompraItem(id, ordem, descricao, especificacao, quantidade, unidade, precoUnitario, precoTotal, quantidadeRecebida, quantidadeDevolvida),
       requisicao:Requisicao(id, numero, requisitanteId, urgencia, prazoDesejado, observacoes,
         obra:Obra(nomeProjeto, cliente:Cliente(razaoSocial, cnpj)),
         centroCusto:CentroCusto(nome),
         requisitante:Usuario!Requisicao_requisitanteId_fkey(nome),
         comprador:Usuario!Requisicao_compradorId_fkey(nome))`
    )
    .eq("id", id)
    .maybeSingle();
  if (!p || !p.requisicao) return null;

  // O prazo do fornecedor conta da compra fechada (ou da emissão, se ainda não foi).
  const baseIso = new Date(p.compraConfirmadaEm ?? p.emitidoEm).toLocaleDateString("sv-SE", {
    timeZone: "America/Sao_Paulo",
  });
  return {
    ...p,
    requisicao: p.requisicao,
    itens: [...p.itens]
      .sort((a, b) => a.ordem - b.ordem)
      .map((i) => ({
        ...i,
        quantidade: Number(i.quantidade),
        precoUnitario: Number(i.precoUnitario),
        precoTotal: Number(i.precoTotal),
        quantidadeRecebida: Number(i.quantidadeRecebida),
        quantidadeDevolvida: Number(i.quantidadeDevolvida),
      })),
    valorItens: Number(p.valorItens),
    valorFrete: Number(p.valorFrete),
    valorDifal: Number(p.valorDifal),
    valorTotal: Number(p.valorTotal),
    previsaoEntrega: p.prazoEntregaDias === null ? null : somarDiasIso(baseIso, p.prazoEntregaDias),
  };
}

export type PedidoCarregado = NonNullable<Awaited<ReturnType<typeof carregarPedido>>>;
