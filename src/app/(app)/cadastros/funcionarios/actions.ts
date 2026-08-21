"use server";

import { z } from "zod";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { supabase } from "@/lib/supabase";
import { exigirPermissao } from "@/lib/api-auth";

const funcionarioSchema = z.object({
  nome: z.string().min(1, "Informe o nome."),
  funcaoId: z.string().min(1, "Escolha uma função."),
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
  const { usuarioId } = await exigirPermissao("cadastrosGerais", "escrita");

  const dados = funcionarioSchema.safeParse({
    nome: formData.get("nome"),
    funcaoId: formData.get("funcaoId"),
    salarioMensal: formData.get("salarioMensal"),
    encargosPercent: formData.get("encargosPercent"),
    ativo: formData.get("ativo") === "on" || formData.get("ativo") === "true",
  });

  if (!dados.success) {
    return { erro: dados.error.issues[0]?.message ?? "Dados inválidos." };
  }

  // `cargo` vem do catálogo, não do formulário: o nome da função é buscado
  // aqui em vez de aceitar um rótulo enviado pelo cliente, que poderia não
  // corresponder à função escolhida.
  const { data: funcao } = await supabase
    .from("Funcao")
    .select("nome")
    .eq("id", dados.data.funcaoId)
    .maybeSingle();

  if (!funcao) return { erro: "Função não encontrada." };

  const registro = { ...dados.data, cargo: funcao.nome };

  if (funcionarioId) {
    await supabase
      .from("Funcionario")
      .update({ ...registro, atualizadoEm: new Date().toISOString() })
      .eq("id", funcionarioId);
  } else {
    await supabase.from("Funcionario").insert({ ...registro, criadoPorId: usuarioId });
  }

  revalidatePath("/cadastros/funcionarios");
  redirect("/cadastros/funcionarios");
}
