"use server";

import { z } from "zod";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { supabase } from "@/lib/supabase";
import { exigirPapelSuprimentos, mensagemDeErro } from "@/lib/suprimentos-auth";
import { cnpjValido, normalizarCnpj, UFS } from "@/lib/suprimentos";

export type EstadoFormFornecedor = { erro?: string } | undefined;

const opcional = (valor: FormDataEntryValue | null) => String(valor ?? "").trim() || undefined;

const fornecedorSchema = z.object({
  razaoSocial: z.string().trim().min(1, "Informe a razão social ou o nome."),
  nomeFantasia: z.string().optional(),
  cnpj: z.string().optional(),
  uf: z.enum(UFS, { message: "Selecione a UF do fornecedor." }),
  cidade: z.string().optional(),
  vendedor: z.string().optional(),
  telefone: z.string().optional(),
  email: z.string().email("E-mail inválido.").optional(),
  observacoes: z.string().optional(),
  ativo: z.boolean(),
});

export async function salvarFornecedor(
  fornecedorId: string | null,
  _estado: EstadoFormFornecedor,
  formData: FormData
): Promise<EstadoFormFornecedor> {
  try {
    const { usuarioId } = await exigirPapelSuprimentos("comprador");

    const dados = fornecedorSchema.safeParse({
      razaoSocial: formData.get("razaoSocial"),
      nomeFantasia: opcional(formData.get("nomeFantasia")),
      cnpj: opcional(formData.get("cnpj")),
      uf: opcional(formData.get("uf")),
      cidade: opcional(formData.get("cidade")),
      vendedor: opcional(formData.get("vendedor")),
      telefone: opcional(formData.get("telefone")),
      email: opcional(formData.get("email")),
      observacoes: opcional(formData.get("observacoes")),
      ativo: formData.get("ativo") === "on" || formData.get("ativo") === "true",
    });
    if (!dados.success) return { erro: dados.error.issues[0]?.message ?? "Dados inválidos." };
    if (dados.data.cnpj && !cnpjValido(dados.data.cnpj)) return { erro: "CNPJ inválido." };

    const registro = {
      razaoSocial: dados.data.razaoSocial,
      nomeFantasia: dados.data.nomeFantasia ?? null,
      cnpj: dados.data.cnpj ? normalizarCnpj(dados.data.cnpj) : null,
      uf: dados.data.uf,
      cidade: dados.data.cidade ?? null,
      vendedor: dados.data.vendedor ?? null,
      telefone: dados.data.telefone ?? null,
      email: dados.data.email ?? null,
      observacoes: dados.data.observacoes ?? null,
      ativo: dados.data.ativo,
    };

    const { error } = fornecedorId
      ? await supabase.from("Fornecedor").update(registro).eq("id", fornecedorId)
      : await supabase.from("Fornecedor").insert({ ...registro, criadoPorId: usuarioId });

    if (error) {
      if (error.code === "23505") return { erro: "Já existe um fornecedor com este CNPJ." };
      return { erro: error.message };
    }
  } catch (erro) {
    return { erro: mensagemDeErro(erro) };
  }

  revalidatePath("/suprimentos/fornecedores");
  redirect("/suprimentos/fornecedores");
}
