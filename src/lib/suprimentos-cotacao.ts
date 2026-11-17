// Contas da cotação: comparativo, menor preço e total da escolha. Puro — roda na
// tela (para o comprador ver o efeito antes de salvar) e no servidor. A função
// de envio para aprovação no banco refaz a mesma conta; as duas arredondam cada
// linha (quantidade × preço) para centavos antes de somar.

export type CotacaoParaCalculo = {
  id: string;
  fornecedor: string;
  valorFrete: number;
  valorDifal: number;
  /** requisicaoItemId → preço cotado. Item ausente = fornecedor não cotou. */
  precos: Record<string, { cotacaoItemId: string; precoUnitario: number }>;
};

export type ItemParaCalculo = {
  id: string;
  quantidade: number;
};

export const centavos = (valor: number) => Math.round(valor * 100) / 100;

export function totalLinha(quantidade: number, precoUnitario: number) {
  return centavos(quantidade * precoUnitario);
}

/** Subtotal dos itens que o fornecedor cotou, e se ele cotou todos. */
export function subtotalCotacao(cotacao: CotacaoParaCalculo, itens: ItemParaCalculo[]) {
  let valor = 0;
  let cotados = 0;
  for (const item of itens) {
    const preco = cotacao.precos[item.id];
    if (!preco) continue;
    cotados++;
    valor += totalLinha(item.quantidade, preco.precoUnitario);
  }
  return {
    valorItens: centavos(valor),
    completa: cotados === itens.length,
    total: centavos(valor + cotacao.valorFrete + cotacao.valorDifal),
  };
}

/** Por item, as cotações com o menor preço unitário (empate destaca todas). */
export function menoresPrecos(itens: ItemParaCalculo[], cotacoes: CotacaoParaCalculo[]) {
  const resultado = new Map<string, Set<string>>();
  for (const item of itens) {
    let menor = Infinity;
    let ids = new Set<string>();
    for (const c of cotacoes) {
      const preco = c.precos[item.id]?.precoUnitario;
      if (preco === undefined) continue;
      if (preco < menor) {
        menor = preco;
        ids = new Set([c.id]);
      } else if (preco === menor) ids.add(c.id);
    }
    resultado.set(item.id, ids);
  }
  return resultado;
}

/**
 * Total da compra escolhida. Cada fornecedor que levar pelo menos um item entra
 * com o frete e o DIFAL inteiros da cotação dele — dividir a compra pode baratear
 * os itens e encarecer o frete, e a alçada olha o valor que sai do caixa.
 */
export function resumoEscolha(
  itens: ItemParaCalculo[],
  cotacoes: CotacaoParaCalculo[],
  /** requisicaoItemId → cotacaoItemId escolhido */
  escolhas: Record<string, string | null | undefined>
) {
  const porCotacao = new Map<string, { valorItens: number; itens: number }>();
  let semVencedor = 0;

  for (const item of itens) {
    const escolhido = escolhas[item.id];
    const cotacao = escolhido
      ? cotacoes.find((c) => c.precos[item.id]?.cotacaoItemId === escolhido)
      : undefined;
    if (!cotacao) {
      semVencedor++;
      continue;
    }
    const atual = porCotacao.get(cotacao.id) ?? { valorItens: 0, itens: 0 };
    atual.valorItens += totalLinha(item.quantidade, cotacao.precos[item.id].precoUnitario);
    atual.itens++;
    porCotacao.set(cotacao.id, atual);
  }

  const fornecedores = cotacoes
    .filter((c) => porCotacao.has(c.id))
    .map((c) => {
      const parcial = porCotacao.get(c.id)!;
      const valorItens = centavos(parcial.valorItens);
      return {
        cotacaoId: c.id,
        fornecedor: c.fornecedor,
        itens: parcial.itens,
        valorItens,
        valorFrete: c.valorFrete,
        valorDifal: c.valorDifal,
        total: centavos(valorItens + c.valorFrete + c.valorDifal),
      };
    });

  return {
    fornecedores,
    semVencedor,
    total: centavos(fornecedores.reduce((soma, f) => soma + f.total, 0)),
  };
}

/** Escolha "menor preço por item" (no empate fica a primeira cotação). */
export function escolhaMenorPreco(itens: ItemParaCalculo[], cotacoes: CotacaoParaCalculo[]) {
  const menores = menoresPrecos(itens, cotacoes);
  const escolhas: Record<string, string | null> = {};
  for (const item of itens) {
    const cotacaoId = [...(menores.get(item.id) ?? [])][0];
    const cotacao = cotacoes.find((c) => c.id === cotacaoId);
    escolhas[item.id] = cotacao?.precos[item.id]?.cotacaoItemId ?? null;
  }
  return escolhas;
}

/** Escolha "tudo de um fornecedor" (itens que ele não cotou ficam sem vencedor). */
export function escolhaUnica(itens: ItemParaCalculo[], cotacao: CotacaoParaCalculo) {
  const escolhas: Record<string, string | null> = {};
  for (const item of itens) escolhas[item.id] = cotacao.precos[item.id]?.cotacaoItemId ?? null;
  return escolhas;
}

/** Lê número digitado no padrão brasileiro: "1.234,56", "12,5" ou "12.5". */
export function numeroBr(texto: string | null | undefined): number | null {
  const limpo = String(texto ?? "").trim().replace(/\s|R\$/g, "");
  if (!limpo) return null;
  const normalizado = limpo.includes(",") ? limpo.replace(/\./g, "").replace(",", ".") : limpo;
  const numero = Number(normalizado);
  return Number.isFinite(numero) ? numero : NaN;
}

export function moeda(valor: number) {
  return valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

/** Preço unitário com até 4 casas (o banco guarda 4), sem zeros sobrando. */
export function precoUnitarioBr(valor: number) {
  return valor.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
    maximumFractionDigits: 4,
  });
}
