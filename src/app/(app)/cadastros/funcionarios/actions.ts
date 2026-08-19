"use server";

import { z } from "zod";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { supabase } from "@/lib/supabase";
import { exigirPermissao } from "@/lib/api-auth";

const funcionarioSchema = z.object({
  nome: z.string().min(1, "Informe o nome."),
  cargo: z.string().min(1, "Informe o cargo/função."),
  salarioMensal: z.coerce.number().positive("Salário deve ser maior que zero."),
  encargosPercent: z.coerce.number().min(0, "Encargos não pode ser negativo."),
  ativo: z.coerce.boolean(),
});

export type EstadoFormFuncionario = { erro?: string } | undefined;

export async function salvarFuncionario(
  funcionarioId: string | null,
  _estado: EstadoFormFuncionario,
  formData: FormData
): Promise<EstadoFormFuncionario> {
  const { session } = await exigirPermissao("cadastrosGerais", "escrita");

  const dados = funcionarioSchema.safeParse({
    nome: formData.get("nome"),
    cargo: formData.get("cargo"),
    salarioMensal: formData.get("salarioMensal"),
    encargosPercent: formData.get("encargosPercent"),
    ativo: formData.get("ativo") === "on" || formData.get("ativo") === "true",
  });

  if (!dados.success) {
    return { erro: dados.error.issues[0]?.message ?? "Dados inválidos." };
  }

  if (funcionarioId) {
    await supabase.from("Funcionario").update(dados.data).eq("id", funcionarioId);
  } else {
    await supabase.from("Funcionario").insert({ ...dados.data, criadoPorId: session.user.id });
  }

  revalidatePath("/cadastros/funcionarios");
  redirect("/cadastros/funcionarios");
}
