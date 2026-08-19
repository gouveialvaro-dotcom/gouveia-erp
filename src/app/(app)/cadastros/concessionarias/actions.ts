"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { supabase } from "@/lib/supabase";
import { exigirPermissao } from "@/lib/api-auth";

const ROTA = "/cadastros/concessionarias";

export type EstadoFormConcessionaria = { erro?: string } | undefined;

const concessionariaSchema = z.object({
  nome: z.string().min(1, "Informe o nome da concessionária."),
  sigla: z.string().optional(),
  uf: z.string().max(2).optional(),
});

export async function criarConcessionaria(
  _estado: EstadoFormConcessionaria,
  formData: FormData
): Promise<EstadoFormConcessionaria> {
  await exigirPermissao("posVenda", "escrita");

  const dados = concessionariaSchema.safeParse({
    nome: formData.get("nome"),
    sigla: formData.get("sigla") || undefined,
    uf: formData.get("uf") || undefined,
  });

  if (!dados.success) {
    return { erro: dados.error.issues[0]?.message ?? "Dados inválidos." };
  }

  const { error } = await supabase.from("Concessionaria").insert({
    nome: dados.data.nome,
    sigla: dados.data.sigla ?? null,
    uf: dados.data.uf ?? null,
  });

  if (error) return { erro: "Já existe uma concessionária com esse nome." };

  revalidatePath(ROTA);
}

// Concessionária não é removida: as UCs cadastradas apontam para ela e o
// histórico de chamados perderia a origem. Desativar tira das listas novas.
export async function alternarConcessionaria(id: string, ativo: boolean) {
  await exigirPermissao("posVenda", "escrita");
  await supabase.from("Concessionaria").update({ ativo: !ativo }).eq("id", id);
  revalidatePath(ROTA);
}
