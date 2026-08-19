"use server";

import { z } from "zod";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { supabase } from "@/lib/supabase";
import { exigirPermissao } from "@/lib/api-auth";

const descricaoSchema = z.object({
  nome: z.string().min(1, "Informe o nome do modelo."),
  tipoProposta: z.enum(["usina_solar", "redes"]),
  texto: z.string().min(1, "Informe o texto padrão."),
});

export type EstadoFormDescricao = { erro?: string } | undefined;

export async function salvarDescricaoPadrao(
  descricaoId: string | null,
  _estado: EstadoFormDescricao,
  formData: FormData
): Promise<EstadoFormDescricao> {
  const { usuarioId } = await exigirPermissao("cadastrosGerais", "escrita");

  const dados = descricaoSchema.safeParse({
    nome: formData.get("nome"),
    tipoProposta: formData.get("tipoProposta"),
    texto: formData.get("texto"),
  });

  if (!dados.success) {
    return { erro: dados.error.issues[0]?.message ?? "Dados inválidos." };
  }

  if (descricaoId) {
    await supabase.from("DescricaoPadrao").update(dados.data).eq("id", descricaoId);
  } else {
    await supabase.from("DescricaoPadrao").insert({ ...dados.data, criadoPorId: usuarioId });
  }

  revalidatePath("/cadastros/descricoes");
  redirect("/cadastros/descricoes");
}

export async function excluirDescricaoPadrao(id: string) {
  await exigirPermissao("cadastrosGerais", "escrita");
  await supabase.from("DescricaoPadrao").delete().eq("id", id);
  revalidatePath("/cadastros/descricoes");
}
