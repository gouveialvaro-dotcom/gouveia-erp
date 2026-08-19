"use server";

import { z } from "zod";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { supabase } from "@/lib/supabase";
import { exigirPermissao } from "@/lib/api-auth";

const kitSchema = z.object({
  nome: z.string().min(1, "Informe o nome do kit."),
  categoria: z.string().optional(),
});

export type EstadoFormKit = { erro?: string } | undefined;

export async function salvarKit(
  kitId: string | null,
  _estado: EstadoFormKit,
  formData: FormData
): Promise<EstadoFormKit> {
  const { usuarioId } = await exigirPermissao("cadastrosGerais", "escrita");

  const dados = kitSchema.safeParse({
    nome: formData.get("nome"),
    categoria: formData.get("categoria") || undefined,
  });

  if (!dados.success) {
    return { erro: dados.error.issues[0]?.message ?? "Dados inválidos." };
  }

  let id = kitId;
  if (kitId) {
    await supabase.from("Kit").update(dados.data).eq("id", kitId);
  } else {
    const { data: criado } = await supabase
      .from("Kit")
      .insert({ ...dados.data, criadoPorId: usuarioId })
      .select("id")
      .single();
    id = criado?.id ?? null;
  }

  revalidatePath("/cadastros/kits");
  redirect(`/cadastros/kits/${id}`);
}

export async function excluirKit(kitId: string) {
  await exigirPermissao("cadastrosGerais", "escrita");
  const { error } = await supabase.from("Kit").delete().eq("id", kitId);
  if (error) {
    throw new Error("Este kit está em uso em algum orçamento e não pode ser excluído.");
  }
  revalidatePath("/cadastros/kits");
}

export async function adicionarItemKit(kitId: string, formData: FormData) {
  await exigirPermissao("cadastrosGerais", "escrita");

  const materialId = String(formData.get("materialId") ?? "");
  const quantidade = Number(formData.get("quantidade"));

  if (!materialId || !quantidade || quantidade <= 0) {
    throw new Error("Selecione um material e uma quantidade válida.");
  }

  const { data: itemExistente } = await supabase
    .from("KitItem")
    .select("*")
    .eq("kitId", kitId)
    .eq("materialId", materialId)
    .maybeSingle();

  if (itemExistente) {
    await supabase
      .from("KitItem")
      .update({ quantidade: itemExistente.quantidade + quantidade })
      .eq("id", itemExistente.id);
  } else {
    await supabase.from("KitItem").insert({ kitId, materialId, quantidade });
  }

  revalidatePath(`/cadastros/kits/${kitId}`);
}

export async function removerItemKit(kitId: string, itemId: string) {
  await exigirPermissao("cadastrosGerais", "escrita");
  await supabase.from("KitItem").delete().eq("id", itemId);
  revalidatePath(`/cadastros/kits/${kitId}`);
}
