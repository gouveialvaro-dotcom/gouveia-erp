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
  ordem: z.coerce.number().int().nonnegative().optional(),
});

function lerFormulario(formData: FormData) {
  return tipoSchema.safeParse({
    nome: formData.get("nome"),
    descricao: formData.get("descricao") || undefined,
    prazoDias: formData.get("prazoDias"),
    diasAlerta: formData.get("diasAlerta"),
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
    })
    .eq("id", tipoId);

  revalidatePath(ROTA);
}

export async function alternarTipoProblema(tipoId: string, ativo: boolean) {
  await exigirPermissao("posVenda", "escrita");
  await supabase.from("TipoProblemaPosVenda").update({ ativo: !ativo }).eq("id", tipoId);
  revalidatePath(ROTA);
}

/** Formato que o BotaoExcluir espera de volta (ver components/ui/botao-excluir). */
export type EstadoExclusao = { erro?: string } | undefined;

// Excluir some com o tipo de vez; desativar só o tira da lista de escolha.
// Tipo já usado em chamado não pode sair: o chamado aponta para ele (a FK é
// RESTRICT) e o histórico ficaria sem o nome do problema atendido.
export async function excluirTipoProblema(
  _estado: EstadoExclusao,
  formData: FormData
): Promise<EstadoExclusao> {
  await exigirPermissao("posVenda", "escrita");

  const tipoId = String(formData.get("tipoId") ?? "");

  const { count } = await supabase
    .from("Chamado")
    .select("id", { count: "exact", head: true })
    .eq("tipoProblemaId", tipoId);

  if (count && count > 0) {
    return {
      erro: `Não pode ser excluído: ${count} chamado(s) usam este tipo. Use "Desativar" para tirá-lo da lista sem perder o histórico.`,
    };
  }

  const { error } = await supabase.from("TipoProblemaPosVenda").delete().eq("id", tipoId);
  if (error) return { erro: "Não foi possível excluir o tipo de problema." };

  revalidatePath(ROTA);
}
