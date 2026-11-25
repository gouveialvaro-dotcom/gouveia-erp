"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { supabase } from "@/lib/supabase";
import { ApiAuthError, exigirAlgumaPermissao } from "@/lib/api-auth";
import { exigirAcessoCadastro } from "@/lib/modulos-visiveis";

// Unidades de medida oferecidas na requisição de compra. Quem edita é quem tem
// o cadastro liberado em Administração → Módulos (e o admin). A sigla é o que
// fica gravado no item; depois de usada, não muda, para o histórico não ficar
// com uma unidade que não existe mais.

const ROTA = "/cadastros/unidades-medida";

export type EstadoFormUnidade = { erro?: string; ok?: boolean } | undefined;

async function exigirAcesso() {
  const contexto = await exigirAlgumaPermissao(["conta"], "leitura");
  await exigirAcessoCadastro("unidades");
  return contexto;
}

const unidadeSchema = z.object({
  sigla: z
    .string()
    .trim()
    .min(1, "Informe a sigla.")
    .max(10, "Sigla de até 10 caracteres.")
    .transform((s) => s.toUpperCase())
    .refine((s) => /^[A-Z0-9²³]+$/.test(s), "Use só letras e números na sigla (ex.: L, M2, CX)."),
  nome: z.string().trim().min(1, "Informe o nome da unidade.").max(60),
  ordem: z.coerce.number().int().min(0).max(9999),
});

function lerFormulario(formData: FormData) {
  return unidadeSchema.safeParse({
    sigla: formData.get("sigla"),
    nome: formData.get("nome"),
    ordem: String(formData.get("ordem") ?? "").trim() || "100",
  });
}

function mensagem(erro: unknown) {
  return erro instanceof ApiAuthError ? erro.message : "Não foi possível salvar a unidade.";
}

async function emUso(sigla: string) {
  const { count } = await supabase
    .from("RequisicaoItem")
    .select("id", { count: "exact", head: true })
    .eq("unidade", sigla);
  return count ?? 0;
}

export async function criarUnidade(_estado: EstadoFormUnidade, formData: FormData): Promise<EstadoFormUnidade> {
  try {
    const { usuarioId } = await exigirAcesso();
    const dados = lerFormulario(formData);
    if (!dados.success) return { erro: dados.error.issues[0]?.message ?? "Dados inválidos." };

    const { error } = await supabase.from("UnidadeMedida").insert({ ...dados.data, criadoPorId: usuarioId });
    if (error) {
      return { erro: error.code === "23505" ? "Já existe uma unidade com essa sigla." : "Não foi possível salvar a unidade." };
    }

    revalidatePath(ROTA);
    return { ok: true };
  } catch (erro) {
    return { erro: mensagem(erro) };
  }
}

export async function atualizarUnidade(
  unidadeId: string,
  _estado: EstadoFormUnidade,
  formData: FormData
): Promise<EstadoFormUnidade> {
  try {
    await exigirAcesso();
    const dados = lerFormulario(formData);
    if (!dados.success) return { erro: dados.error.issues[0]?.message ?? "Dados inválidos." };

    const { data: atual } = await supabase.from("UnidadeMedida").select("sigla").eq("id", unidadeId).maybeSingle();
    if (!atual) return { erro: "Unidade não encontrada." };
    if (atual.sigla !== dados.data.sigla && (await emUso(atual.sigla)) > 0) {
      return { erro: "A sigla já foi usada em requisições e não pode mudar. Crie uma unidade nova." };
    }

    const { error } = await supabase.from("UnidadeMedida").update(dados.data).eq("id", unidadeId);
    if (error) {
      return { erro: error.code === "23505" ? "Já existe uma unidade com essa sigla." : "Não foi possível salvar a unidade." };
    }

    revalidatePath(ROTA);
    return { ok: true };
  } catch (erro) {
    return { erro: mensagem(erro) };
  }
}

export async function alternarUnidade(unidadeId: string, ativo: boolean) {
  await exigirAcesso();
  await supabase.from("UnidadeMedida").update({ ativo: !ativo }).eq("id", unidadeId);
  revalidatePath(ROTA);
}

/** Formato que o BotaoExcluir espera de volta (ver components/ui/botao-excluir). */
export type EstadoExclusao = { erro?: string } | undefined;

export async function excluirUnidade(_estado: EstadoExclusao, formData: FormData): Promise<EstadoExclusao> {
  try {
    await exigirAcesso();
    const unidadeId = String(formData.get("unidadeId") ?? "");
    const { data: atual } = await supabase.from("UnidadeMedida").select("sigla").eq("id", unidadeId).maybeSingle();
    if (!atual) return { erro: "Unidade não encontrada." };

    const usos = await emUso(atual.sigla);
    if (usos > 0) {
      return {
        erro: `Não pode ser excluída: ${usos} item(ns) de requisição usam "${atual.sigla}". Use "Desativar" para tirá-la da lista.`,
      };
    }

    const { error } = await supabase.from("UnidadeMedida").delete().eq("id", unidadeId);
    if (error) return { erro: "Não foi possível excluir a unidade." };

    revalidatePath(ROTA);
  } catch (erro) {
    return { erro: mensagem(erro) };
  }
}
