"use server";

import { z } from "zod";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { supabase } from "@/lib/supabase";
import { exigirAdminSuprimentos, mensagemDeErro } from "@/lib/suprimentos-auth";
import { cnpjValido, normalizarCnpj, UFS } from "@/lib/suprimentos";

export type EstadoFormEmpresa = { erro?: string; ok?: string } | undefined;

const empresaSchema = z.object({
  razaoSocial: z.string().trim().min(1, "Informe a razão social."),
  nomeFantasia: z.string().trim().optional(),
  cnpj: z.string().trim().min(1, "Informe o CNPJ."),
  uf: z.enum(UFS).optional(),
  ativo: z.boolean(),
});

export async function salvarEmpresa(
  empresaId: string | null,
  _estado: EstadoFormEmpresa,
  formData: FormData
): Promise<EstadoFormEmpresa> {
  try {
    const { usuarioId } = await exigirAdminSuprimentos();

    const dados = empresaSchema.safeParse({
      razaoSocial: formData.get("razaoSocial"),
      nomeFantasia: String(formData.get("nomeFantasia") ?? "").trim() || undefined,
      cnpj: formData.get("cnpj"),
      uf: String(formData.get("uf") ?? "") || undefined,
      ativo: formData.get("ativo") === "on" || formData.get("ativo") === "true",
    });
    if (!dados.success) return { erro: dados.error.issues[0]?.message ?? "Dados inválidos." };
    if (!cnpjValido(dados.data.cnpj)) return { erro: "CNPJ inválido." };

    const registro = {
      razaoSocial: dados.data.razaoSocial,
      nomeFantasia: dados.data.nomeFantasia ?? null,
      cnpj: normalizarCnpj(dados.data.cnpj),
      uf: dados.data.uf ?? null,
      ativo: dados.data.ativo,
    };

    const { error } = empresaId
      ? await supabase.from("EmpresaGrupo").update(registro).eq("id", empresaId)
      : await supabase.from("EmpresaGrupo").insert({ ...registro, criadoPorId: usuarioId });

    if (error) {
      if (error.code === "23505") return { erro: "Já existe uma empresa com este CNPJ." };
      return { erro: error.message };
    }
  } catch (erro) {
    return { erro: mensagemDeErro(erro) };
  }

  revalidatePath("/suprimentos/empresas");
  redirect("/suprimentos/empresas");
}

/**
 * Grava qual empresa paga as compras de cada obra. Os campos chegam como
 * "obra:<obraId>" = empresaId (vazio = sem empresa definida).
 */
export async function salvarFaturamentoObras(
  _estado: EstadoFormEmpresa,
  formData: FormData
): Promise<EstadoFormEmpresa> {
  try {
    const { usuarioId } = await exigirAdminSuprimentos();

    const definir: { obraId: string; empresaId: string }[] = [];
    const limpar: string[] = [];
    for (const [chave, valor] of formData.entries()) {
      if (!chave.startsWith("obra:")) continue;
      const obraId = chave.slice("obra:".length);
      const empresaId = String(valor);
      if (empresaId) definir.push({ obraId, empresaId });
      else limpar.push(obraId);
    }

    if (definir.length) {
      const agora = new Date().toISOString();
      const { error } = await supabase.from("ObraFaturamento").upsert(
        definir.map((d) => ({ ...d, atualizadoEm: agora, atualizadoPorId: usuarioId })),
        { onConflict: "obraId" }
      );
      if (error) return { erro: error.message };
    }
    if (limpar.length) {
      const { error } = await supabase.from("ObraFaturamento").delete().in("obraId", limpar);
      if (error) return { erro: error.message };
    }

    revalidatePath("/suprimentos/empresas");
    return { ok: "Faturamento por obra salvo." };
  } catch (erro) {
    return { erro: mensagemDeErro(erro) };
  }
}
