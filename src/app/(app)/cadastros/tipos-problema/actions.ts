"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { supabase } from "@/lib/supabase";
import { exigirPermissao } from "@/lib/api-auth";

const ROTA = "/cadastros/tipos-problema";

export type EstadoFormTipoProblema = { erro?: string } | undefined;

const tipoSchema = z.object({
  nome: z.string().min(1, "Informe o nome do tipo de problema."),
  descricao: z.string().optional(),
  prazoDias: z.coerce.number().int().positive("O prazo deve ser de pelo menos 1 dia."),
  diasAlerta: z.coerce.number().int().nonnegative(),
  dependeConcessionaria: z.coerce.boolean(),
  ordem: z.coerce.number().int().nonnegative().optional(),
});

function lerFormulario(formData: FormData) {
  return tipoSchema.safeParse({
    nome: formData.get("nome"),
    descricao: formData.get("descricao") || undefined,
    prazoDias: formData.get("prazoDias"),
    diasAlerta: formData.get("diasAlerta"),
    dependeConcessionaria:
      formData.get("dependeConcessionaria") === "on" ||
      formData.get("dependeConcessionaria") === "true",
    ordem: formData.get("ordem") || undefined,
  });
}

export async function criarTipoProblema(
  _estado: EstadoFormTipoProblema,
  formData: FormData
): Promise<EstadoFormTipoProblema> {
  await exigirPermissao("posVenda", "escrita");

  const dados = lerFormulario(formData);
  if (!dados.success) {
    return { erro: dados.error.issues[0]?.message ?? "Dados inválidos." };
  }
  if (dados.data.diasAlerta >= dados.data.prazoDias) {
    return { erro: "O alerta precisa disparar antes do prazo terminar." };
  }

  const { error } = await supabase.from("TipoProblemaPosVenda").insert({
    nome: dados.data.nome,
    descricao: dados.data.descricao ?? null,
    prazoDias: dados.data.prazoDias,
    diasAlerta: dados.data.diasAlerta,
    dependeConcessionaria: dados.data.dependeConcessionaria,
    ordem: dados.data.ordem ?? 0,
  });

  if (error) return { erro: "Já existe um tipo de problema com esse nome." };

  revalidatePath(ROTA);
}

// Alterar o prazo aqui vale só para chamados abertos daqui em diante: o
// prazoLimite dos existentes já foi gravado e não é reescrito, para não mudar
// retroativamente o SLA de um atendimento em andamento.
export async function atualizarTipoProblema(tipoId: string, formData: FormData) {
  await exigirPermissao("posVenda", "escrita");

  const dados = lerFormulario(formData);
  if (!dados.success || dados.data.diasAlerta >= dados.data.prazoDias) return;

  await supabase
    .from("TipoProblemaPosVenda")
    .update({
      nome: dados.data.nome,
      prazoDias: dados.data.prazoDias,
      diasAlerta: dados.data.diasAlerta,
      dependeConcessionaria: dados.data.dependeConcessionaria,
    })
    .eq("id", tipoId);

  revalidatePath(ROTA);
}

export async function alternarTipoProblema(tipoId: string, ativo: boolean) {
  await exigirPermissao("posVenda", "escrita");
  await supabase.from("TipoProblemaPosVenda").update({ ativo: !ativo }).eq("id", tipoId);
  revalidatePath(ROTA);
}
