"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { supabase } from "@/lib/supabase";
import { exigirAdminSuprimentos, mensagemDeErro } from "@/lib/suprimentos-auth";
import { PAPEIS, type PapelSuprimentos } from "@/lib/suprimentos";

export type EstadoConfiguracao = { erro?: string; ok?: string } | undefined;

/**
 * Grava a matriz usuário × papel inteira. Os checkboxes chegam como
 * "papel:<usuarioId>:<papel>"; o que não veio marcado é removido.
 */
export async function salvarPapeis(
  _estado: EstadoConfiguracao,
  formData: FormData
): Promise<EstadoConfiguracao> {
  try {
    const { usuarioId } = await exigirAdminSuprimentos();

    const desejados = new Set<string>();
    for (const [chave, valor] of formData.entries()) {
      if (valor === "off" || valor === "false") continue;
      const [prefixo, alvo, papel] = chave.split(":");
      if (prefixo === "papel" && alvo && PAPEIS.includes(papel as PapelSuprimentos)) {
        desejados.add(`${alvo}:${papel}`);
      }
    }

    const { data: atuais, error: erroLeitura } = await supabase
      .from("PapelUsuarioSuprimentos")
      .select("id, usuarioId, papel");
    if (erroLeitura) return { erro: erroLeitura.message };

    const existentes = new Map((atuais ?? []).map((l) => [`${l.usuarioId}:${l.papel}`, l.id]));

    const remover = [...existentes].filter(([chave]) => !desejados.has(chave)).map(([, id]) => id);
    const inserir = [...desejados]
      .filter((chave) => !existentes.has(chave))
      .map((chave) => {
        const [alvo, papel] = chave.split(":");
        return { usuarioId: alvo, papel: papel as PapelSuprimentos, criadoPorId: usuarioId };
      });

    if (remover.length) {
      const { error } = await supabase.from("PapelUsuarioSuprimentos").delete().in("id", remover);
      if (error) return { erro: error.message };
    }
    if (inserir.length) {
      const { error } = await supabase.from("PapelUsuarioSuprimentos").insert(inserir);
      if (error) return { erro: error.message };
    }

    revalidatePath("/suprimentos", "layout");
    return { ok: "Papéis salvos." };
  } catch (erro) {
    return { erro: mensagemDeErro(erro) };
  }
}

const alcadasSchema = z
  .object({
    limiteComprador: z.coerce.number().min(0, "O limite do comprador não pode ser negativo."),
    limiteGerencia: z.coerce.number().positive("Informe o limite da gerência."),
    minimoCotacoes: z.coerce.number().int().min(1, "O mínimo de cotações é pelo menos 1."),
  })
  .refine((d) => d.limiteGerencia > d.limiteComprador, {
    message: "O limite da gerência precisa ser maior que o do comprador.",
  });

export async function salvarAlcadas(
  _estado: EstadoConfiguracao,
  formData: FormData
): Promise<EstadoConfiguracao> {
  try {
    const { usuarioId } = await exigirAdminSuprimentos();

    const dados = alcadasSchema.safeParse({
      limiteComprador: String(formData.get("limiteComprador") ?? "").replace(",", "."),
      limiteGerencia: String(formData.get("limiteGerencia") ?? "").replace(",", "."),
      minimoCotacoes: formData.get("minimoCotacoes"),
    });
    if (!dados.success) return { erro: dados.error.issues[0]?.message ?? "Dados inválidos." };

    const { error } = await supabase
      .from("ParametroSuprimentos")
      .upsert({
        id: "padrao",
        ...dados.data,
        atualizadoEm: new Date().toISOString(),
        atualizadoPorId: usuarioId,
      });
    if (error) return { erro: error.message };

    revalidatePath("/suprimentos", "layout");
    return { ok: "Alçadas salvas." };
  } catch (erro) {
    return { erro: mensagemDeErro(erro) };
  }
}
