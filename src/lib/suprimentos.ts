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

export const ROTULO_PAPEL: Record<PapelSuprimentos, string> = {
  comprador: "Comprador",
  aprovador_gerencia: "Aprovador · Gerência",
  aprovador_diretoria: "Aprovador · Diretoria",
  recebedor: "Recebedor (almoxarife)",
};

export const DESCRICAO_PAPEL: Record<PapelSuprimentos, string> = {
  comprador: "Cota, escolhe fornecedores, aprova até o limite dele e emite pedidos.",
  aprovador_gerencia: "Aprova compras acima do limite do comprador.",
  aprovador_diretoria: "Dá a segunda aprovação nas compras acima do limite da gerência.",
  recebedor: "Registra na obra se o material chegou conforme ou não.",
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
  recebido_conforme: "Recebido conforme",
  recebido_inconforme: "Recebido inconforme",
};

export const UFS = [
  "AC", "AL", "AM", "AP", "BA", "CE", "DF", "ES", "GO", "MA", "MG", "MS", "MT", "PA",
  "PB", "PE", "PI", "PR", "RJ", "RN", "RO", "RR", "RS", "SC", "SE", "SP", "TO",
] as const;

/** UF da Gouveia. Fornecedor de fora dela acende o alerta de DIFAL na cotação. */
export const UF_EMPRESA = "RN";

export const UNIDADES_SUGERIDAS = [
  "UN", "PC", "CX", "PCT", "KG", "G", "T", "M", "M2", "M3", "L", "ML",
  "SC", "BARRA", "ROLO", "GL", "JG", "PAR", "KIT", "H", "DIA", "MES", "SERV",
];

export function codigoRequisicao(numero: number) {
  return `REQ-${String(numero).padStart(4, "0")}`;
}

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
  if (d.length !== 14) return cnpj ?? "";
  return d.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5");
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
