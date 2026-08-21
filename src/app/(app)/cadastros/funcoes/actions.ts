"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { supabase } from "@/lib/supabase";
import { exigirPermissao } from "@/lib/api-auth";

const funcaoSchema = z.object({
  nome: z.string().min(1, "Informe o nome da função."),
  salarioMensal: z.coerce.number().positive("Salário deve ser maior que zero."),
  encargosPercent: z.coerce.number().min(0, "Encargos não pode ser negativo."),
});

export type EstadoFormFuncao = { erro?: string } | undefined;

function ler(formData: FormData) {
  return funcaoSchema.safeParse({
    nome: formData.get("nome"),
    salarioMensal: formData.get("salarioMensal"),
    encargosPercent: formData.get("encargosPercent"),
  });
}

// Nome repetido derrubaria a página com o erro cru do índice único. O nome é a
// chave de negócio do catálogo (o importador da planilha casa por ele), então
// a colisão precisa voltar como mensagem legível.
function mensagemErro(codigo: string | undefined, nome: string) {
  if (codigo === "23505") return `Já existe uma função chamada "${nome}".`;
  return "Não foi possível salvar a função.";
}

export async function criarFuncao(
  _estado: EstadoFormFuncao,
  formData: FormData
): Promise<EstadoFormFuncao> {
  const { usuarioId } = await exigirPermissao("cadastrosGerais", "escrita");

  const dados = ler(formData);
  if (!dados.success) return { erro: dados.error.issues[0]?.message ?? "Dados inválidos." };

  const { error } = await supabase
    .from("Funcao")
    .insert({ ...dados.data, criadoPorId: usuarioId });

  if (error) return { erro: mensagemErro(error.code, dados.data.nome) };

  revalidatePath("/cadastros/funcoes");
}

export async function atualizarFuncao(funcaoId: string, formData: FormData) {
  await exigirPermissao("cadastrosGerais", "escrita");

  const dados = ler(formData);
  if (!dados.success) return;

  await supabase
    .from("Funcao")
    .update({ ...dados.data, atualizadoEm: new Date().toISOString() })
    .eq("id", funcaoId);

  revalidatePath("/cadastros/funcoes");
  revalidatePath("/cadastros/funcionarios");
}

export async function alternarFuncao(funcaoId: string, ativoAtual: boolean) {
  await exigirPermissao("cadastrosGerais", "escrita");

  await supabase
    .from("Funcao")
    .update({ ativo: !ativoAtual, atualizadoEm: new Date().toISOString() })
    .eq("id", funcaoId);

  revalidatePath("/cadastros/funcoes");
}
