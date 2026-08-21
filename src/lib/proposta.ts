import { supabase } from "@/lib/supabase";

export const ROTULO_MODELO: Record<string, string> = {
  usina_solar: "Usina Solar",
  redes: "Redes",
};

export type TotaisProposta = {
  custoMateriais: number;
  /** Mão de obra lançada nas alocações, antes do ajuste comercial. */
  custoMaoObraBase: number;
  percentualAjusteMaoObra: number;
  valorAjusteMaoObra: number;
  /** Mão de obra já com o ajuste comercial aplicado. */
  custoMaoObra: number;
  custoDireto: number;
  percentualBdi: number;
  valorBdi: number;
  percentualImpostos: number;
  valorImpostos: number;
  /** Preço antes do desconto de negociação. */
  subtotal: number;
  percentualDesconto: number;
  valorDesconto: number;
  valorFinal: number;
  /** Sobra sobre o custo direto depois de impostos e desconto, em % do preço. */
  margemPercent: number;
};

// Composição do preço de venda, na ordem em que a proposta a exibe:
// mão de obra ajustada -> custo direto -> BDI -> impostos -> desconto.
// BDI e impostos são aplicados "por fora", em cascata, e cada parcela vira uma
// linha separada para permitir conferência. Se a regra de negócio mudar (ex.:
// imposto "por dentro", com gross-up), este é o único ponto a alterar.
export function calcularTotais(entrada: {
  custoMateriais: number;
  custoMaoObra: number;
  percentualBdi: number;
  percentualImpostos: number;
  percentualAjusteMaoObra?: number;
  percentualDesconto?: number;
}): TotaisProposta {
  const {
    custoMateriais,
    custoMaoObra: custoMaoObraBase,
    percentualBdi,
    percentualImpostos,
    percentualAjusteMaoObra = 0,
    percentualDesconto = 0,
  } = entrada;

  const valorAjusteMaoObra = custoMaoObraBase * (percentualAjusteMaoObra / 100);
  const custoMaoObra = custoMaoObraBase + valorAjusteMaoObra;

  const custoDireto = custoMateriais + custoMaoObra;
  const valorBdi = custoDireto * (percentualBdi / 100);
  const valorImpostos = (custoDireto + valorBdi) * (percentualImpostos / 100);

  const subtotal = custoDireto + valorBdi + valorImpostos;
  const valorDesconto = subtotal * (percentualDesconto / 100);
  const valorFinal = subtotal - valorDesconto;

  return {
    custoMateriais,
    custoMaoObraBase,
    percentualAjusteMaoObra,
    valorAjusteMaoObra,
    custoMaoObra,
    custoDireto,
    percentualBdi,
    valorBdi,
    percentualImpostos,
    valorImpostos,
    subtotal,
    percentualDesconto,
    valorDesconto,
    valorFinal,
    margemPercent: valorFinal > 0 ? ((valorFinal - valorImpostos - custoDireto) / valorFinal) * 100 : 0,
  };
}

export function formatarNumeroProposta(numero: number, ano: number, revisao: number) {
  const base = `${String(numero).padStart(3, "0")}/${ano}`;
  return revisao > 0 ? `${base} — Rev. ${String(revisao).padStart(2, "0")}` : base;
}

// Reúne tudo que a proposta imprime. Usada tanto pela página de impressão (PDF)
// quanto pela rota que devolve o arquivo Word, para que os dois formatos saiam
// sempre com o mesmo conteúdo.
export async function carregarDadosProposta(propostaId: string) {
  const { data: proposta } = await supabase
    .from("Proposta")
    .select("*, geradoPor:Usuario(nome)")
    .eq("id", propostaId)
    .maybeSingle();

  if (!proposta) return null;

  const [{ data: orcamento }, { data: complementares }, { data: parametros }] = await Promise.all([
    supabase
      .from("Orcamento")
      .select(
        "*, cliente:Cliente(*), itens:OrcamentoItem(*, material:Material(*)), maoObra:OrcamentoMaoObra(*, funcao:Funcao(nome))"
      )
      .eq("id", proposta.orcamentoId)
      .eq("itens.tipo", "material")
      .order("id", { referencedTable: "itens", ascending: true })
      .maybeSingle(),
    supabase
      .from("PropostaDadosComplementares")
      .select("*")
      .eq("orcamentoId", proposta.orcamentoId)
      .maybeSingle(),
    supabase.from("ParametroGeral").select("*").limit(1).maybeSingle(),
  ]);

  if (!orcamento) return null;

  const custoMateriais = orcamento.itens.reduce((acc, item) => acc + item.subtotal, 0);
  const custoMaoObra = orcamento.maoObra.reduce((acc, m) => acc + m.custoCalculado, 0);

  const totais = calcularTotais({
    custoMateriais,
    custoMaoObra,
    percentualBdi: orcamento.bdiPersonalizado ?? parametros?.bdiPadrao ?? 0,
    percentualImpostos: orcamento.impostosPersonalizado ?? parametros?.impostos ?? 0,
    percentualAjusteMaoObra: orcamento.ajusteMaoObraPercent,
    percentualDesconto: orcamento.descontoPercent,
  });

  return { proposta, orcamento, complementares, parametros, totais };
}

export type DadosProposta = NonNullable<Awaited<ReturnType<typeof carregarDadosProposta>>>;
