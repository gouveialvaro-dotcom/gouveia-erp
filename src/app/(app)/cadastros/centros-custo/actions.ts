"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { supabase } from "@/lib/supabase";
import { ApiAuthError, exigirAlgumaPermissao } from "@/lib/api-auth";
import { exigirAcessoCadastro } from "@/lib/modulos-visiveis";

// Centros de custo para onde vão as requisições de compra. Quem edita é quem
// tem o cadastro liberado em Administração → Módulos (e o admin). Desativar
// tira o centro da lista da requisição sem mexer nas requisições antigas.

const ROTA = "/cadastros/centros-custo";

export type EstadoFormCentroCusto = { erro?: string; ok?: boolean } | undefined;

async function exigirAcesso() {
  // Qualquer perfil logado serve de base: o acesso é dado pessoa a pessoa.
  const contexto = await exigirAlgumaPermissao(["conta"], "leitura");
  await exigirAcessoCadastro("centrosCusto");
  return contexto;
}

const centroSchema = z.object({
  nome: z.string().trim().min(1, "Informe o nome do centro de custo.").max(120),
  codigo: z.string().trim().max(30).optional(),
  descricao: z.string().trim().max(500).optional(),
});

function lerFormulario(formData: FormData) {
  return centroSchema.safeParse({
    nome: formData.get("nome"),
    codigo: String(formData.get("codigo") ?? "").trim() || undefined,
    descricao: String(formData.get("descricao") ?? "").trim() || undefined,
  });
}

function mensagemDuplicado(error: { code?: string; message: string }) {
  if (error.code !== "23505") return "Não foi possível salvar o centro de custo.";
  return error.message.includes("codigo")
    ? "Já existe um centro de custo com esse código."
    : "Já existe um centro de custo com esse nome.";
}

function mensagem(erro: unknown) {
  return erro instanceof ApiAuthError ? erro.message : "Não foi possível salvar o centro de custo.";
}

export async function criarCentroCusto(
  _estado: EstadoFormCentroCusto,
  formData: FormData
): Promise<EstadoFormCentroCusto> {
  try {
    const { usuarioId } = await exigirAcesso();
    const dados = lerFormulario(formData);
    if (!dados.success) return { erro: dados.error.issues[0]?.message ?? "Dados inválidos." };

    const { error } = await supabase.from("CentroCusto").insert({
      nome: dados.data.nome,
      codigo: dados.data.codigo ?? null,
      descricao: dados.data.descricao ?? null,
      criadoPorId: usuarioId,
    });
    if (error) return { erro: mensagemDuplicado(error) };

    revalidatePath(ROTA);
    return { ok: true };
  } catch (erro) {
    return { erro: mensagem(erro) };
  }
}

export async function atualizarCentroCusto(
  centroId: string,
  _estado: EstadoFormCentroCusto,
  formData: FormData
): Promise<EstadoFormCentroCusto> {
  try {
    await exigirAcesso();
    const dados = lerFormulario(formData);
    if (!dados.success) return { erro: dados.error.issues[0]?.message ?? "Dados inválidos." };

    const { error } = await supabase
      .from("CentroCusto")
      .update({
        nome: dados.data.nome,
        codigo: dados.data.codigo ?? null,
        descricao: dados.data.descricao ?? null,
      })
      .eq("id", centroId);
    if (error) return { erro: mensagemDuplicado(error) };

    revalidatePath(ROTA);
    return { ok: true };
  } catch (erro) {
    return { erro: mensagem(erro) };
  }
}

export async function alternarCentroCusto(centroId: string, ativo: boolean) {
  await exigirAcesso();
  await supabase.from("CentroCusto").update({ ativo: !ativo }).eq("id", centroId);
  revalidatePath(ROTA);
}

/** Formato que o BotaoExcluir espera de volta (ver components/ui/botao-excluir). */
export type EstadoExclusao = { erro?: string } | undefined;

// Centro já usado em requisição não sai: a requisição aponta para ele e o
// histórico ficaria sem destino. Nesse caso, desativar.
export async function excluirCentroCusto(
  _estado: EstadoExclusao,
  formData: FormData
): Promise<EstadoExclusao> {
  try {
    await exigirAcesso();
    const centroId = String(formData.get("centroId") ?? "");

    const { count } = await supabase
      .from("Requisicao")
      .select("id", { count: "exact", head: true })
      .eq("centroCustoId", centroId);
    if (count && count > 0) {
      return {
        erro: `Não pode ser excluído: ${count} requisição(ões) usam este centro. Use "Desativar" para tirá-lo da lista sem perder o histórico.`,
      };
    }

    const { error } = await supabase.from("CentroCusto").delete().eq("id", centroId);
    if (error) return { erro: "Não foi possível excluir o centro de custo." };

    revalidatePath(ROTA);
  } catch (erro) {
    return { erro: mensagem(erro) };
  }
}
