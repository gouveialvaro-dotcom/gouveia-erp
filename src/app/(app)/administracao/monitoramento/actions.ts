"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { exigirPermissao } from "@/lib/api-auth";
import { supabase } from "@/lib/supabase";
import type { EstadoExclusao } from "@/components/ui/botao-excluir";
import {
  dataRefBrasil,
  impedimentoDeVinculo,
  JANELAS,
  type JanelaColetaUsina,
} from "@/lib/monitoramento";
import {
  coletarJanela,
  janelaDoHorario,
  type ResultadoColeta,
} from "@/lib/monitoramento-coleta";
import {
  acusaFalha,
  diagnosticar,
  estaComunicando,
  listarUsinas,
  type Diagnostico,
} from "@/lib/isolarcloud";

const ROTA = "/administracao/monitoramento";

export type EstadoFormUsina = { erro?: string; ok?: boolean } | undefined;

// --- Busca das plantas no iSolarCloud -------------------------------------

export type PlantaEncontrada = {
  psId: string;
  nome: string;
  potenciaKwp: number | null;
  /** Já está reportando agora, segundo a própria API. */
  comunicando: boolean;
  /** Acusa alarme ou falha no momento da busca. */
  emFalha: boolean;
  energiaDiaKwh: number | null;
  /** Já vinculada a um cliente aqui dentro. */
  vinculada: boolean;
  /** Nome do cliente, quando já vinculada. */
  clienteVinculado: string | null;
};

export type EstadoBusca =
  | { erro: string; plantas?: undefined }
  | { erro?: undefined; plantas: PlantaEncontrada[] }
  | undefined;

/**
 * Lista as plantas da conta no iSolarCloud e marca as que já têm vínculo.
 *
 * As não vinculadas ficam separadas na tela de propósito: é a lista do que
 * ainda não foi tratado. Sem essa separação, uma usina nova entrando na conta
 * da Sungrow passaria despercebida no meio das já cadastradas — e usina que
 * ninguém vinculou é usina que ninguém monitora.
 */
export async function buscarPlantasNoIsolar(): Promise<EstadoBusca> {
  await exigirPermissao("administracao", "escrita");

  const resposta = await listarUsinas();
  if (!resposta.ok) return { erro: resposta.erro };

  const { data: cadastradas } = await supabase
    .from("UsinaMonitorada")
    .select("psId, cliente:Cliente(razaoSocial)");

  const porPsId = new Map(
    (cadastradas ?? []).map((u) => [u.psId, u.cliente?.razaoSocial ?? "cliente removido"])
  );

  return {
    plantas: resposta.dados.map((planta) => ({
      psId: planta.psId,
      nome: planta.nome,
      potenciaKwp: planta.potenciaKwp,
      comunicando: estaComunicando(planta),
      emFalha: acusaFalha(planta),
      energiaDiaKwh: planta.energiaDiaKwh,
      vinculada: porPsId.has(planta.psId),
      clienteVinculado: porPsId.get(planta.psId) ?? null,
    })),
  };
}

/** Teste de ponta a ponta da integração, com o erro cru da API. */
export async function testarConexaoIsolar(): Promise<Diagnostico> {
  await exigirPermissao("administracao", "escrita");
  return diagnosticar();
}

const esquemaVinculo = z.object({
  // Identificador da planta no iSolarCloud (ps_id). Normalmente vem preenchido
  // pela busca; a digitação à mão continua valendo para o caso de a integração
  // estar fora do ar e alguém precisar cadastrar assim mesmo.
  //
  // SÓ DÍGITOS. As 150 plantas da conta têm ps_id numérico, e o erro real que
  // motivou esta trava foi alguém digitar o NOME da planta aqui: o cadastro
  // aceitou, e a usina só não aparecia no painel — a coleta a listava como
  // "ausente na conta" três vezes por dia, sem ninguém entender por quê.
  psId: z
    .string()
    .trim()
    .min(1, "Informe o identificador da planta (ps_id).")
    .regex(
      /^\d+$/,
      "O ps_id é numérico (ex.: 1093717) — o que você digitou parece ser o nome da planta. " +
        "Use o botão “Buscar usinas no iSolarCloud” para preenchê-lo certo."
    ),
  nomeIsolar: z.string().trim().min(1, "Informe o nome da planta."),
  apelido: z.string().trim().optional(),
  clienteId: z.string().trim().min(1, "Escolha o cliente."),
  unidadeConsumidoraId: z.string().trim().min(1, "Escolha a unidade geradora."),
  potenciaIsolarKwp: z.coerce.number().positive().optional(),
});

/**
 * Vincula uma planta do iSolarCloud a um cliente e à sua unidade geradora.
 *
 * Exige escrita em ADMINISTRAÇÃO, e não em monitoramento: é este vínculo que
 * faz o alerta chegar em alguém, e errar nele é alertar sobre a usina do
 * cliente errado. Quem trata alerta no dia a dia não precisa poder criá-lo.
 */
export async function vincularUsina(
  _estado: EstadoFormUsina,
  formData: FormData
): Promise<EstadoFormUsina> {
  const { usuarioId } = await exigirPermissao("administracao", "escrita");

  const potencia = String(formData.get("potenciaIsolarKwp") ?? "").trim();
  const dados = esquemaVinculo.safeParse({
    psId: formData.get("psId"),
    nomeIsolar: formData.get("nomeIsolar"),
    apelido: String(formData.get("apelido") ?? "").trim() || undefined,
    clienteId: formData.get("clienteId"),
    unidadeConsumidoraId: formData.get("unidadeConsumidoraId"),
    potenciaIsolarKwp: potencia || undefined,
  });

  if (!dados.success) {
    return { erro: dados.error.issues[0]?.message ?? "Dados inválidos." };
  }

  const [{ data: cliente }, { data: unidade }] = await Promise.all([
    supabase
      .from("Cliente")
      .select("id, razaoSocial, ramo, manutencaoInicio, manutencaoFim")
      .eq("id", dados.data.clienteId)
      .maybeSingle(),
    supabase
      .from("UnidadeConsumidora")
      .select("id, clienteId, tipo, ativo")
      .eq("id", dados.data.unidadeConsumidoraId)
      .maybeSingle(),
  ]);

  if (!cliente) return { erro: "Cliente não encontrado." };
  if (!unidade) return { erro: "Unidade consumidora não encontrada." };

  // A MESMA função que a tela usa para avisar antes de enviar. Esconder a opção
  // na tela não é a garantia — a checagem de verdade é esta.
  const impedimento = impedimentoDeVinculo(cliente, unidade);
  if (impedimento) return { erro: impedimento };

  const { error } = await supabase.from("UsinaMonitorada").insert({
    psId: dados.data.psId,
    nomeIsolar: dados.data.nomeIsolar,
    apelido: dados.data.apelido ?? null,
    clienteId: dados.data.clienteId,
    unidadeConsumidoraId: dados.data.unidadeConsumidoraId,
    potenciaIsolarKwp: dados.data.potenciaIsolarKwp ?? null,
    criadoPorId: usuarioId,
  });

  if (error) {
    // 23505 = unique_violation. São dois índices únicos aqui, e a mensagem
    // precisa dizer qual: "já cadastrada" sem dizer o quê manda o admin
    // procurar no lugar errado.
    if (error.code === "23505") {
      return {
        erro: error.message.includes("uc_key")
          ? "Esta unidade geradora já tem usina monitorada."
          : "Esta planta do iSolarCloud já está cadastrada.",
      };
    }
    return { erro: error.message };
  }

  revalidatePath(ROTA);
  revalidatePath("/monitoramento");
  return { ok: true };
}

const esquemaUsina = z.object({ usinaId: z.string().min(1) });

/** Desativação manual — a automática, por plano vencido, é da rotina de coleta. */
export async function desativarUsina(formData: FormData) {
  await exigirPermissao("administracao", "escrita");
  const { usinaId } = esquemaUsina.parse({ usinaId: formData.get("usinaId") });

  await supabase
    .from("UsinaMonitorada")
    .update({
      ativo: false,
      motivoInativacao: "manual",
      inativadaEm: dataRefBrasil(),
    })
    .eq("id", usinaId);

  revalidatePath(ROTA);
  revalidatePath("/monitoramento");
}

/**
 * Reativação é sempre manual, inclusive depois de renovação de contrato:
 * reativar sozinho a partir de uma data digitada por engano faria a Gouveia
 * acompanhar usina que não está mais sob contrato.
 */
export async function reativarUsina(formData: FormData) {
  await exigirPermissao("administracao", "escrita");
  const { usinaId } = esquemaUsina.parse({ usinaId: formData.get("usinaId") });

  const { data: usina } = await supabase
    .from("UsinaMonitorada")
    .select("id, clienteId, unidadeConsumidoraId")
    .eq("id", usinaId)
    .maybeSingle();

  if (!usina) return;

  const [{ data: cliente }, { data: unidade }] = await Promise.all([
    supabase
      .from("Cliente")
      .select("id, razaoSocial, ramo, manutencaoInicio, manutencaoFim")
      .eq("id", usina.clienteId)
      .maybeSingle(),
    supabase
      .from("UnidadeConsumidora")
      .select("id, clienteId, tipo, ativo")
      .eq("id", usina.unidadeConsumidoraId)
      .maybeSingle(),
  ]);

  // Reativar usina de cliente sem plano ativo devolveria ao painel uma usina
  // que não deveria estar sendo monitorada — e ela sairia de novo na coleta
  // seguinte, num vai e vem que ninguém entende.
  if (!cliente || !unidade || impedimentoDeVinculo(cliente, unidade)) return;

  await supabase
    .from("UsinaMonitorada")
    .update({ ativo: true, motivoInativacao: null, inativadaEm: null })
    .eq("id", usinaId);

  revalidatePath(ROTA);
  revalidatePath("/monitoramento");
}

// --- Coleta manual --------------------------------------------------------

/**
 * Dispara uma janela de coleta na hora, a partir da tela.
 *
 * Existe porque o cron roda três vezes ao dia e ninguém vai esperar até as 18h
 * para saber se o vínculo que acabou de fazer está trazendo número. Não é
 * atalho para o agendamento: é a mesma função que o cron chama, e o upsert por
 * (usina, dataRef, janela) faz as duas convergirem para a mesma linha.
 */
export async function coletarAgora(formData: FormData): Promise<ResultadoColeta> {
  await exigirPermissao("administracao", "escrita");

  const pedida = String(formData.get("janela") ?? "");
  const janela = (JANELAS as string[]).includes(pedida)
    ? (pedida as JanelaColetaUsina)
    : janelaDoHorario();

  const resultado = await coletarJanela(janela);

  revalidatePath(ROTA);
  revalidatePath("/monitoramento");
  return resultado;
}

/**
 * Apaga o vínculo — só enquanto ele não tem histórico.
 *
 * Existe para desfazer erro de cadastro (ps_id trocado, cliente errado), e não
 * para tirar usina do monitoramento: para isso é desativar, que preserva
 * leitura, falha e alerta. Com leitura gravada, apagar levaria junto o
 * histórico de manutenção do cliente, que é argumento em renovação de contrato
 * — por isso a trava é no servidor, e não um aviso na tela.
 */
export async function excluirUsina(
  _estado: EstadoExclusao,
  formData: FormData
): Promise<EstadoExclusao> {
  await exigirPermissao("administracao", "escrita");
  const { usinaId } = esquemaUsina.parse({ usinaId: formData.get("usinaId") });

  const { count } = await supabase
    .from("LeituraUsina")
    .select("id", { count: "exact", head: true })
    .eq("usinaMonitoradaId", usinaId);

  if ((count ?? 0) > 0) {
    return {
      erro:
        "Esta usina já tem leitura gravada e não pode ser apagada — o histórico é do cliente. " +
        "Use Desativar, que tira do painel e preserva tudo.",
    };
  }

  await supabase.from("UsinaMonitorada").delete().eq("id", usinaId);

  revalidatePath(ROTA);
  revalidatePath("/monitoramento");
  return {};
}
