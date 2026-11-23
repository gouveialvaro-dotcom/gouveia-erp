import type { Database } from "@/lib/database.types";

// Constantes, rótulos e regras puras do módulo Suprimentos. Nada aqui fala com o
// banco — pode ser importado tanto por Server quanto por Client Component.

type Enums = Database["public"]["Enums"];

export type PapelSuprimentos = Enums["PapelSuprimentos"];
export type TipoProduto = Enums["TipoProdutoSuprimentos"];
export type UrgenciaRequisicao = Enums["UrgenciaRequisicao"];
export type StatusRequisicao = Enums["StatusRequisicao"];
export type ModalidadeFrete = Enums["ModalidadeFrete"];
export type NivelAlcada = Enums["NivelAlcada"];
export type DecisaoAprovacao = Enums["DecisaoAprovacao"];
export type StatusEntregaPedido = Enums["StatusEntregaPedido"];
export type SituacaoRecebimento = Enums["SituacaoRecebimento"];
export type FormaPagamento = Enums["FormaPagamento"];

export const ROTULO_PAPEL: Record<PapelSuprimentos, string> = {
  comprador: "Comprador",
  aprovador_gerencia: "Aprovador · Gerência",
  aprovador_diretoria: "Aprovador · Diretoria",
  recebedor: "Recebedor (almoxarife)",
};

export const DESCRICAO_PAPEL: Record<PapelSuprimentos, string> = {
  comprador: "Cota, escolhe fornecedores, aprova até o limite dele e emite pedidos.",
  aprovador_gerencia: "Aprova compras acima do limite do comprador e as faturadas para o cliente.",
  aprovador_diretoria:
    "Dá a segunda aprovação acima do limite da gerência, pode aprovar no lugar da gerência e voltar uma compra aprovada para a cotação.",
  recebedor: "Almoxarife: registra na obra o que chegou, por item.",
};

export const PAPEIS: PapelSuprimentos[] = [
  "comprador",
  "aprovador_gerencia",
  "aprovador_diretoria",
  "recebedor",
];

export const ROTULO_TIPO_PRODUTO: Record<TipoProduto, string> = {
  material: "Material",
  servico: "Serviço",
  locacao: "Locação",
};

export const ROTULO_URGENCIA: Record<UrgenciaRequisicao, string> = {
  normal: "Normal",
  emergencial: "Emergencial",
};

export const ROTULO_STATUS_REQUISICAO: Record<StatusRequisicao, string> = {
  pendente: "Pendente",
  em_cotacao: "Em cotação",
  aguardando_aprovacao: "Aguardando aprovação",
  aprovada: "Aprovada",
  recusada: "Recusada",
  pedido_emitido: "Pedido emitido",
  concluida: "Concluída",
  cancelada: "Cancelada",
};

export const ROTULO_FRETE: Record<ModalidadeFrete, string> = {
  cif: "CIF (entrega inclusa)",
  fob: "FOB / coleta",
};

export const ROTULO_NIVEL: Record<NivelAlcada, string> = {
  comprador: "Comprador",
  gerencia: "Gerência",
  diretoria: "Diretoria",
};

export const ROTULO_DECISAO: Record<DecisaoAprovacao, string> = {
  aprovada: "Aprovada",
  devolvida: "Devolvida para cotação",
  recusada: "Recusada",
};

export const ROTULO_STATUS_ENTREGA: Record<StatusEntregaPedido, string> = {
  pendente: "Entrega pendente",
  recebido_parcial: "Recebido parcial",
  recebido_conforme: "Recebido conforme",
  recebido_inconforme: "Recebido com ocorrência",
};

/** Pedido emitido que o comprador ainda não fechou no fornecedor. */
export const ROTULO_AGUARDANDO_COMPRA = "Aguardando confirmação da compra";

export const ROTULO_SITUACAO_RECEBIMENTO: Record<SituacaoRecebimento, string> = {
  conforme: "Conforme",
  parcial: "Parcial",
  inconforme: "Inconforme",
};

export const ROTULO_FORMA_PAGAMENTO: Record<FormaPagamento, string> = {
  boleto: "Boleto",
  pix: "Pix",
  transferencia: "Transferência",
  cartao_credito: "Cartão de crédito",
  cartao_debito: "Cartão de débito",
  dinheiro: "Dinheiro",
  cheque: "Cheque",
};

export const FORMAS_PAGAMENTO = Object.keys(ROTULO_FORMA_PAGAMENTO) as FormaPagamento[];

/** Texto da condição de pagamento, montado dos campos (vai para o pedido impresso). */
export function textoCondicaoPagamento(c: {
  formaPagamento: FormaPagamento | null;
  prazoPagamentoDias: number | null;
  parcelas: number | null;
}) {
  if (!c.formaPagamento) return "";
  const partes = [ROTULO_FORMA_PAGAMENTO[c.formaPagamento]];
  const parcelas = c.parcelas ?? 1;
  const prazo = c.prazoPagamentoDias ?? 0;
  if (parcelas > 1) partes.push(`${parcelas}x`);
  partes.push(prazo === 0 ? (parcelas > 1 ? "1ª à vista" : "à vista") : `${parcelas > 1 ? "1ª em " : ""}${prazo} dias`);
  return partes.join(" · ");
}

export const UFS = [
  "AC", "AL", "AM", "AP", "BA", "CE", "DF", "ES", "GO", "MA", "MG", "MS", "MT", "PA",
  "PB", "PE", "PI", "PR", "RJ", "RN", "RO", "RR", "RS", "SC", "SE", "SP", "TO",
] as const;

/** UF da Gouveia. Fornecedor de fora dela acende o alerta de DIFAL na cotação. */
export const UF_EMPRESA = "RN";

/**
 * Unidades da requisição: lista fechada, para não haver "SACO", "SC" e "sc"
 * para a mesma coisa nos relatórios. M³ entra porque o catálogo já usa
 * (areia, brita).
 */
export const UNIDADES_REQUISICAO: { valor: string; rotulo: string }[] = [
  { valor: "UN", rotulo: "Unidade" },
  { valor: "SC", rotulo: "Saco" },
  { valor: "M", rotulo: "Metro" },
  { valor: "M2", rotulo: "Metro quadrado (m²)" },
  { valor: "M3", rotulo: "Metro cúbico (m³)" },
  { valor: "KG", rotulo: "Quilo (kg)" },
  { valor: "T", rotulo: "Tonelada" },
];

export const UNIDADES_SUGERIDAS = [
  "UN", "PC", "CX", "PCT", "KG", "G", "T", "M", "M2", "M3", "L", "ML",
  "SC", "BARRA", "ROLO", "GL", "JG", "PAR", "KIT", "H", "DIA", "MES", "SERV",
];

export function codigoRequisicao(numero: number) {
  return `REQ-${String(numero).padStart(4, "0")}`;
}

/**
 * Hoje no fuso de Natal, em "YYYY-MM-DD". Fixo e não o do ambiente: o servidor
 * da Vercel roda em UTC, e às 22h de Natal já seria "amanhã" lá.
 */
export function hojeSaoPaulo() {
  return new Date().toLocaleDateString("sv-SE", { timeZone: "America/Sao_Paulo" });
}

export function somarDiasIso(dataIso: string, dias: number) {
  const [ano, mes, dia] = dataIso.slice(0, 10).split("-").map(Number);
  return new Date(Date.UTC(ano, mes - 1, dia + dias)).toISOString().slice(0, 10);
}

/** Prazo sugerido no formulário: ~2 dias na compra normal, hoje na emergencial. */
export const DIAS_PRAZO_PADRAO: Record<UrgenciaRequisicao, number> = {
  normal: 2,
  emergencial: 0,
};

/** Status em que o requisitante ainda pode cancelar sozinho (ninguém cotou). */
export const STATUS_CANCELAVEL_REQUISITANTE: StatusRequisicao[] = ["pendente"];

/** Status em que o comprador/admin pode cancelar: qualquer um antes do pedido. */
export const STATUS_CANCELAVEL_COMPRADOR: StatusRequisicao[] = [
  "pendente",
  "em_cotacao",
  "aguardando_aprovacao",
  "aprovada",
];

/**
 * Status em que o comprador mexe na cotação. Depois de enviada para aprovação
 * ela congela; uma devolução do aprovador volta a requisição para em_cotacao.
 */
export const STATUS_COTACAO_ABERTA: StatusRequisicao[] = ["pendente", "em_cotacao"];

/** Requisições "em andamento" (ainda pedem ação de alguém). */
export const STATUS_EM_ANDAMENTO: StatusRequisicao[] = [
  "pendente",
  "em_cotacao",
  "aguardando_aprovacao",
  "aprovada",
  "pedido_emitido",
];

/** Teto de itens por requisição: acima disso é lista de obra, não pedido. */
export const ITENS_POR_REQUISICAO_MAX = 100;

/**
 * Chave de duplicidade do catálogo: maiúsculas, sem acento, espaços colapsados.
 * A MESMA função roda no cadastro manual e na importação — é o que impede
 * "Cimento  Poty 50kg" e "CIMENTO POTY 50KG" de virarem dois produtos.
 */
export function chaveDescricao(descricao: string) {
  return descricao
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toUpperCase()
    .replace(/\s+/g, " ")
    .trim();
}

export function normalizarCnpj(cnpj: string) {
  return cnpj.replace(/\D/g, "");
}

export function formatarCnpj(cnpj: string | null | undefined) {
  const d = normalizarCnpj(cnpj ?? "");
  // Fornecedor pessoa física guarda o CPF no mesmo campo.
  if (d.length === 11) return d.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, "$1.$2.$3-$4");
  if (d.length !== 14) return cnpj ?? "";
  return d.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5");
}

/** "CPF" para 11 dígitos, "CNPJ" para o resto. */
export function rotuloDocumento(documento: string | null | undefined) {
  return normalizarCnpj(documento ?? "").length === 11 ? "CPF" : "CNPJ";
}

/** Validação dos dígitos verificadores do CPF. */
export function cpfValido(cpf: string) {
  const d = normalizarCnpj(cpf);
  if (d.length !== 11 || /^(\d)\1+$/.test(d)) return false;
  const digito = (base: string) => {
    let soma = 0;
    for (let i = 0; i < base.length; i++) soma += Number(base[i]) * (base.length + 1 - i);
    const resto = (soma * 10) % 11;
    return resto === 10 ? 0 : resto;
  };
  const d1 = digito(d.slice(0, 9));
  const d2 = digito(d.slice(0, 9) + d1);
  return d.endsWith(`${d1}${d2}`);
}

/** CNPJ ou CPF válido (o fornecedor pode ser pessoa física). */
export function documentoValido(documento: string) {
  return cnpjValido(documento) || cpfValido(documento);
}

/** Validação dos dígitos verificadores do CNPJ. */
export function cnpjValido(cnpj: string) {
  const d = normalizarCnpj(cnpj);
  if (d.length !== 14 || /^(\d)\1+$/.test(d)) return false;
  const digito = (base: string) => {
    let soma = 0;
    let peso = base.length - 7;
    for (const n of base) {
      soma += Number(n) * peso--;
      if (peso < 2) peso = 9;
    }
    const resto = soma % 11;
    return resto < 2 ? 0 : 11 - resto;
  };
  const d1 = digito(d.slice(0, 12));
  const d2 = digito(d.slice(0, 12) + d1);
  return d.endsWith(`${d1}${d2}`);
}

/**
 * Nível de aprovação exigido por um valor total. Os limites vêm de
 * ParametroSuprimentos; a mesma regra roda no banco (função de envio para
 * aprovação) — esta cópia serve só para a tela antecipar o que vai acontecer.
 */
export function nivelExigido(
  valorTotal: number,
  limites: { limiteComprador: number; limiteGerencia: number }
): NivelAlcada {
  if (valorTotal <= limites.limiteComprador) return "comprador";
  if (valorTotal <= limites.limiteGerencia) return "gerencia";
  return "diretoria";
}

/**
 * Níveis que precisam aprovar uma compra (acima da gerência, os dois). Na
 * alçada da gerência, a diretoria também pode decidir (no lugar dela).
 */
export function niveisExigidos(nivel: NivelAlcada | null | undefined): NivelAlcada[] {
  if (nivel === "gerencia") return ["gerencia"];
  if (nivel === "diretoria") return ["gerencia", "diretoria"];
  return [];
}

/**
 * Em quais níveis ainda dá para decidir nesta rodada. Na alçada da gerência
 * basta uma decisão, da gerência ou da diretoria; na da diretoria, cada nível
 * decide uma vez (e por pessoas diferentes — conferido no banco).
 */
export function niveisEmAberto(
  nivelAlcada: NivelAlcada | null | undefined,
  decididos: NivelAlcada[]
): ("gerencia" | "diretoria")[] {
  if (nivelAlcada === "gerencia") return decididos.length > 0 ? [] : ["gerencia", "diretoria"];
  if (nivelAlcada === "diretoria") {
    return (["gerencia", "diretoria"] as const).filter((n) => !decididos.includes(n));
  }
  return [];
}

/** Nome do centro de custo de uma requisição: a obra ou o centro cadastrado. */
export function nomeCentroCusto(r: {
  obra?: { nomeProjeto: string | null } | null;
  centroCusto?: { nome: string } | null;
}) {
  if (r.centroCusto) return r.centroCusto.nome;
  return r.obra?.nomeProjeto ?? "Obra sem nome";
}

/** Papel que decide em cada nível de aprovação. */
export const PAPEL_DO_NIVEL: Record<"gerencia" | "diretoria", PapelSuprimentos> = {
  gerencia: "aprovador_gerencia",
  diretoria: "aprovador_diretoria",
};

/** Aviso do sino de Suprimentos, como a API devolve para a barra superior. */
export type AvisoSuprimentosItem = {
  id: string;
  tipo: string;
  titulo: string;
  detalhe: string | null;
  requisicaoId: string | null;
  pedidoCompraId: string | null;
  lida: boolean;
  criadoEm: string;
  autor: string | null;
};

export const ROTULO_AVISO: Record<string, string> = {
  nova_requisicao: "Nova requisição",
  aprovacao_pendente: "Aprovação pendente",
  requisicao_devolvida: "Devolvida",
  requisicao_recusada: "Recusada",
  requisicao_cancelada: "Cancelada",
  pedido_emitido: "Pedido emitido",
  recebimento_registrado: "Recebimento",
  compra_confirmada: "Compra confirmada",
  cotacao_reaberta: "Voltou para cotação",
};
