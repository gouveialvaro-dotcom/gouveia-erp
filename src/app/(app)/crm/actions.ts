"use server";

import { z } from "zod";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { supabase } from "@/lib/supabase";
import { exigirPermissao } from "@/lib/api-auth";
import { ORDEM_ESTAGIO_FLUXO } from "@/lib/crm";

export type EstadoFormOportunidade = { erro?: string } | undefined;

const criarOportunidadeSchema = z.object({
  orcamentoId: z.string().min(1, "Selecione o orçamento."),
  responsavelId: z.string().min(1, "Selecione o responsável."),
  valorEstimado: z.coerce.number().nonnegative().optional(),
  proximaAcaoData: z.string().optional(),
});

export async function criarOportunidade(
  _estado: EstadoFormOportunidade,
  formData: FormData
): Promise<EstadoFormOportunidade> {
  await exigirPermissao("crm", "escrita");

  const dados = criarOportunidadeSchema.safeParse({
    orcamentoId: formData.get("orcamentoId"),
    responsavelId: formData.get("responsavelId"),
    valorEstimado: formData.get("valorEstimado") || undefined,
    proximaAcaoData: formData.get("proximaAcaoData") || undefined,
  });

  if (!dados.success) {
    return { erro: dados.error.issues[0]?.message ?? "Dados inválidos." };
  }

  const { data: orcamento } = await supabase
    .from("Orcamento")
    .select("clienteId")
    .eq("id", dados.data.orcamentoId)
    .maybeSingle();

  if (!orcamento) {
    return { erro: "Orçamento não encontrado." };
  }

  const { data: criada, error } = await supabase
    .from("Oportunidade")
    .insert({
      orcamentoId: dados.data.orcamentoId,
      clienteId: orcamento.clienteId,
      responsavelId: dados.data.responsavelId,
      valorEstimado: dados.data.valorEstimado ?? null,
      proximaAcaoData: dados.data.proximaAcaoData ?? null,
    })
    .select("id")
    .single();

  if (error || !criada) return { erro: "Não foi possível criar a oportunidade." };

  revalidatePath("/crm");
  redirect(`/crm/${criada.id}`);
}

const atualizarOportunidadeSchema = z.object({
  estagio: z.enum([
    "lead",
    "levantamento_escopo",
    "orcamento_elaboracao",
    "proposta_enviada",
    "negociacao",
    "aprovada",
    "perdida",
  ]),
  responsavelId: z.string().min(1, "Selecione o responsável."),
  valorEstimado: z.coerce.number().nonnegative().optional(),
  proximaAcaoData: z.string().optional(),
  motivoPerda: z.string().optional(),
});

export async function atualizarOportunidade(
  oportunidadeId: string,
  _estado: EstadoFormOportunidade,
  formData: FormData
): Promise<EstadoFormOportunidade> {
  await exigirPermissao("crm", "escrita");

  const dados = atualizarOportunidadeSchema.safeParse({
    estagio: formData.get("estagio"),
    responsavelId: formData.get("responsavelId"),
    valorEstimado: formData.get("valorEstimado") || undefined,
    proximaAcaoData: formData.get("proximaAcaoData") || undefined,
    motivoPerda: formData.get("motivoPerda") || undefined,
  });

  if (!dados.success) {
    return { erro: dados.error.issues[0]?.message ?? "Dados inválidos." };
  }

  const { error } = await supabase
    .from("Oportunidade")
    .update({
      estagio: dados.data.estagio,
      responsavelId: dados.data.responsavelId,
      valorEstimado: dados.data.valorEstimado ?? null,
      proximaAcaoData: dados.data.proximaAcaoData ?? null,
      motivoPerda: dados.data.estagio === "perdida" ? (dados.data.motivoPerda ?? null) : null,
    })
    .eq("id", oportunidadeId);

  if (error) return { erro: "Não foi possível salvar a oportunidade." };

  revalidatePath("/crm");
  revalidatePath(`/crm/${oportunidadeId}`);
  redirect(`/crm/${oportunidadeId}`);
}

export async function avancarEstagio(oportunidadeId: string, estagioAtual: string) {
  await exigirPermissao("crm", "escrita");
  const indice = ORDEM_ESTAGIO_FLUXO.indexOf(estagioAtual as (typeof ORDEM_ESTAGIO_FLUXO)[number]);
  if (indice < 0 || indice >= ORDEM_ESTAGIO_FLUXO.length - 1) return;
  await supabase
    .from("Oportunidade")
    .update({ estagio: ORDEM_ESTAGIO_FLUXO[indice + 1] })
    .eq("id", oportunidadeId);
  revalidatePath("/crm");
}

export async function voltarEstagio(oportunidadeId: string, estagioAtual: string) {
  await exigirPermissao("crm", "escrita");
  const indice = ORDEM_ESTAGIO_FLUXO.indexOf(estagioAtual as (typeof ORDEM_ESTAGIO_FLUXO)[number]);
  if (indice <= 0) return;
  await supabase
    .from("Oportunidade")
    .update({ estagio: ORDEM_ESTAGIO_FLUXO[indice - 1] })
    .eq("id", oportunidadeId);
  revalidatePath("/crm");
}

const interacaoSchema = z.object({
  tipo: z.enum(["ligacao", "email", "reuniao", "visita"]),
  data: z.string().min(1, "Informe a data."),
  descricao: z.string().min(1, "Descreva a interação."),
});

export async function adicionarInteracao(oportunidadeId: string, formData: FormData) {
  const { session } = await exigirPermissao("crm", "escrita");

  const dados = interacaoSchema.safeParse({
    tipo: formData.get("tipo"),
    data: formData.get("data"),
    descricao: formData.get("descricao"),
  });
  if (!dados.success) return;

  await supabase
    .from("Interacao")
    .insert({ ...dados.data, oportunidadeId, responsavelId: session.user.id });

  revalidatePath(`/crm/${oportunidadeId}`);
}

export async function removerInteracao(oportunidadeId: string, interacaoId: string) {
  await exigirPermissao("crm", "escrita");
  await supabase.from("Interacao").delete().eq("id", interacaoId);
  revalidatePath(`/crm/${oportunidadeId}`);
}

const anexoSchema = z.object({
  nomeArquivo: z.string().min(1, "Informe o nome do arquivo."),
  url: z.string().regex(/^https?:\/\//, "Informe uma URL válida (http/https)."),
  tipo: z.string().optional(),
});

export async function adicionarAnexo(oportunidadeId: string, formData: FormData) {
  const { session } = await exigirPermissao("crm", "escrita");

  const dados = anexoSchema.safeParse({
    nomeArquivo: formData.get("nomeArquivo"),
    url: formData.get("url"),
    tipo: formData.get("tipo") || undefined,
  });
  if (!dados.success) return;

  await supabase
    .from("Anexo")
    .insert({ ...dados.data, oportunidadeId, enviadoPorId: session.user.id });

  revalidatePath(`/crm/${oportunidadeId}`);
}

export async function removerAnexo(oportunidadeId: string, anexoId: string) {
  await exigirPermissao("crm", "escrita");
  await supabase.from("Anexo").delete().eq("id", anexoId);
  revalidatePath(`/crm/${oportunidadeId}`);
}
