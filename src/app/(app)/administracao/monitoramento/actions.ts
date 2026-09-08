"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { exigirPermissao } from "@/lib/api-auth";
import { supabase } from "@/lib/supabase";
import { dataRefBrasil, impedimentoDeVinculo } from "@/lib/monitoramento";
import { diagnosticar, listarUsinas, type Diagnostico } from "@/lib/isolarcloud";

const ROTA = "/administracao/monitoramento";

export type EstadoFormUsina = { erro?: string; ok?: boolean } | undefined;

// --- Busca das plantas no iSolarCloud -------------------------------------

export type PlantaEncontrada = {
  psId: string;
  nome: string;
  potenciaKwp: number | null;
  situacao: string | null;
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
      situacao: planta.situacao,
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
  // Identificador da planta no iSolarCloud (ps_id). Digitado à mão por
  // enquanto: o botão "Buscar usinas no iSolarCloud" depende do cliente HTTP,
  // que espera a confirmação do modo de autenticação da aplicação no portal.
  psId: z.string().trim().min(1, "Informe o identificador da planta (ps_id)."),
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
