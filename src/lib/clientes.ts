// Regras do cadastro de clientes. Vive fora de actions.ts porque um arquivo
// "use server" só pode exportar funções async.

import type { Database } from "@/lib/database.types";
import { formatarData } from "@/lib/format";
import { hojeIso } from "@/lib/pos-venda";

export type RamoCliente = Database["public"]["Enums"]["RamoCliente"];

// Os dois ramos pedem cadastros diferentes: energia solar tem unidades
// geradoras/beneficiárias e contrato de manutenção; redes/subestações é um
// cadastro simples de dados de contato.
export const RAMOS: RamoCliente[] = ["energia_solar", "redes_subestacoes"];

export const ROTULO_RAMO: Record<RamoCliente, string> = {
  energia_solar: "Energia solar",
  redes_subestacoes: "Redes / Subestações",
};

// A URL fala "solar"/"redes"; o banco fala "energia_solar"/"redes_subestacoes".
const RAMO_POR_SLUG: Record<string, RamoCliente> = {
  solar: "energia_solar",
  redes: "redes_subestacoes",
};

export const SLUG_POR_RAMO: Record<RamoCliente, string> = {
  energia_solar: "solar",
  redes_subestacoes: "redes",
};

export function ramoDoSlug(slug: string): RamoCliente | null {
  return RAMO_POR_SLUG[slug] ?? null;
}

export function listaDoRamo(ramo: RamoCliente) {
  return `/cadastros/clientes/${SLUG_POR_RAMO[ramo]}`;
}

// --- Plano de manutenção --------------------------------------------------
// Só existe para energia solar: é o contrato que autoriza o pós-venda a
// receber solicitação do cliente. Fora da vigência o chamado não abre.

export type PlanoManutencao = {
  manutencaoInicio: string | null;
  manutencaoFim: string | null;
};

export type SituacaoManutencao = "sem_plano" | "a_iniciar" | "ativo" | "encerrado";

export const ROTULO_SITUACAO_MANUTENCAO: Record<
  SituacaoManutencao,
  { texto: string; variant: "default" | "secondary" | "outline" | "destructive" }
> = {
  sem_plano: { texto: "Sem plano de manutenção", variant: "outline" },
  a_iniciar: { texto: "Manutenção a iniciar", variant: "secondary" },
  ativo: { texto: "Manutenção ativa", variant: "default" },
  encerrado: { texto: "Manutenção encerrada", variant: "destructive" },
};

/**
 * Situação do contrato numa data. Datas são comparadas como strings
 * "YYYY-MM-DD", que ordenam lexicograficamente — o mesmo motivo pelo qual o
 * SLA do pós-venda não passa por Date() (ver lib/pos-venda).
 */
export function situacaoManutencao(
  plano: PlanoManutencao,
  data = hojeIso()
): SituacaoManutencao {
  const inicio = plano.manutencaoInicio?.slice(0, 10);
  const fim = plano.manutencaoFim?.slice(0, 10);
  if (!inicio || !fim) return "sem_plano";
  if (data < inicio) return "a_iniciar";
  if (data > fim) return "encerrado";
  return "ativo";
}

export function manutencaoAtivaEm(plano: PlanoManutencao, data = hojeIso()) {
  return situacaoManutencao(plano, data) === "ativo";
}

export function vigenciaManutencao(plano: PlanoManutencao) {
  if (!plano.manutencaoInicio || !plano.manutencaoFim) return null;
  return `${formatarData(plano.manutencaoInicio)} a ${formatarData(plano.manutencaoFim)}`;
}

/**
 * Texto do aviso quando o chamado não pode ser aberto. Retorna null quando o
 * plano está ativo na data — mesma função na tela (aviso antes de enviar) e na
 * server action (bloqueio de fato).
 */
export function impedimentoDeAbertura(
  cliente: PlanoManutencao & { ramo: RamoCliente; razaoSocial?: string },
  data = hojeIso()
): string | null {
  if (cliente.ramo !== "energia_solar") {
    return "Chamado não pode ser aberto: o pós-venda atende apenas clientes de energia solar.";
  }

  const situacao = situacaoManutencao(cliente, data);
  if (situacao === "ativo") return null;

  if (situacao === "sem_plano") {
    return (
      "Chamado não pode ser aberto: o plano de manutenção não está ativo — o cliente não tem " +
      "período de manutenção cadastrado. Informe a vigência no cadastro do cliente."
    );
  }

  const motivo = situacao === "a_iniciar" ? "ainda não começou" : "já se encerrou";
  return (
    `Chamado não pode ser aberto: o plano de manutenção não está ativo em ${formatarData(data)}` +
    ` — a vigência (${vigenciaManutencao(cliente)}) ${motivo}.`
  );
}
