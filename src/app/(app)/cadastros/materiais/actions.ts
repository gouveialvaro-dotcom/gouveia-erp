"use server";

import { z } from "zod";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { supabase } from "@/lib/supabase";
import { exigirPermissao } from "@/lib/api-auth";

const materialSchema = z.object({
  codigo: z.string().min(1, "Informe o código."),
  descricao: z.string().min(1, "Informe a descrição."),
  categoria: z.string().min(1, "Informe a categoria."),
  unidade: z.string().min(1, "Informe a unidade de medida."),
  custoUnitario: z.coerce.number().positive("Custo unitário deve ser maior que zero."),
  fornecedor: z.string().optional(),
});

export type EstadoFormMaterial = { erro?: string } | undefined;

export async function salvarMaterial(
  materialId: string | null,
  _estado: EstadoFormMaterial,
  formData: FormData
): Promise<EstadoFormMaterial> {
  const { usuarioId } = await exigirPermissao("cadastrosGerais", "escrita");

  const dados = materialSchema.safeParse({
    codigo: formData.get("codigo"),
    descricao: formData.get("descricao"),
    categoria: formData.get("categoria"),
    unidade: formData.get("unidade"),
    custoUnitario: formData.get("custoUnitario"),
    fornecedor: formData.get("fornecedor") || undefined,
  });

  if (!dados.success) {
    return { erro: dados.error.issues[0]?.message ?? "Dados inválidos." };
  }

  if (materialId) {
    const { error } = await supabase.from("Material").update(dados.data).eq("id", materialId);
    if (error) return { erro: "Já existe um material cadastrado com esse código." };
  } else {
    const { error } = await supabase
      .from("Material")
      .insert({ ...dados.data, criadoPorId: usuarioId });
    if (error) return { erro: "Já existe um material cadastrado com esse código." };
  }

  revalidatePath("/cadastros/materiais");
  redirect("/cadastros/materiais");
}

export async function excluirMaterial(materialId: string) {
  await exigirPermissao("cadastrosGerais", "escrita");
  const { error } = await supabase.from("Material").delete().eq("id", materialId);
  if (error) {
    throw new Error("Este material está em uso em algum kit ou orçamento e não pode ser excluído.");
  }
  revalidatePath("/cadastros/materiais");
}
