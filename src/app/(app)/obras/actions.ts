"use server";

import { z } from "zod";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { supabase } from "@/lib/supabase";
import { exigirPermissao } from "@/lib/api-auth";

const criarObraSchema = z.object({
  custoOrcado: z.coerce.number().nonnegative("Informe o custo orçado."),
  dataInicio: z.string().optional(),
});

export async function criarObra(oportunidadeId: string, formData: FormData) {
  await exigirPermissao("obras", "escrita");

  const dados = criarObraSchema.safeParse({
    custoOrcado: formData.get("custoOrcado"),
    dataInicio: formData.get("dataInicio") || undefined,
  });
  if (!dados.success) return;

  const { data: oportunidade } = await supabase
    .from("Oportunidade")
    .select("id, estagio")
    .eq("id", oportunidadeId)
    .maybeSingle();

  if (!oportunidade || oportunidade.estagio !== "aprovada") return;

  const { data: criada } = await supabase
    .from("Obra")
    .insert({
      oportunidadeId,
      custoOrcado: dados.data.custoOrcado,
      dataInicio: dados.data.dataInicio ?? null,
    })
    .select("id")
    .single();

  if (!criada) return;

  revalidatePath("/obras");
  redirect(`/obras/${criada.id}`);
}

export type EstadoFormObra = { erro?: string } | undefined;

const atualizarObraSchema = z.object({
  status: z.enum(["em_andamento", "concluida", "atrasada"]),
  avancoFisicoPercent: z.coerce.number().min(0, "Mínimo 0%.").max(100, "Máximo 100%."),
  custoOrcado: z.coerce.number().nonnegative("Informe o custo orçado."),
  custoRealizado: z.coerce.number().nonnegative("Informe o custo realizado."),
  dataInicio: z.string().optional(),
  dataPrevistaConclusao: z.string().optional(),
});

export async function atualizarObra(
  obraId: string,
  _estado: EstadoFormObra,
  formData: FormData
): Promise<EstadoFormObra> {
  const { usuarioId } = await exigirPermissao("obras", "escrita");

  const dados = atualizarObraSchema.safeParse({
    status: formData.get("status"),
    avancoFisicoPercent: formData.get("avancoFisicoPercent"),
    custoOrcado: formData.get("custoOrcado"),
    custoRealizado: formData.get("custoRealizado"),
    dataInicio: formData.get("dataInicio") || undefined,
    dataPrevistaConclusao: formData.get("dataPrevistaConclusao") || undefined,
  });

  if (!dados.success) {
    return { erro: dados.error.issues[0]?.message ?? "Dados inválidos." };
  }

  const { error } = await supabase
    .from("Obra")
    .update({
      status: dados.data.status,
      avancoFisicoPercent: dados.data.avancoFisicoPercent,
      custoOrcado: dados.data.custoOrcado,
      custoRealizado: dados.data.custoRealizado,
      dataInicio: dados.data.dataInicio ?? null,
      dataPrevistaConclusao: dados.data.dataPrevistaConclusao ?? null,
      atualizadoPorId: usuarioId,
    })
    .eq("id", obraId);

  if (error) return { erro: "Não foi possível salvar a obra." };

  revalidatePath("/obras");
  revalidatePath(`/obras/${obraId}`);
  redirect(`/obras/${obraId}`);
}
