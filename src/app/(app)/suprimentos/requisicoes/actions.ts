"use server";

import { z } from "zod";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { supabase } from "@/lib/supabase";
import { exigirPapelSuprimentos, mensagemDeErro } from "@/lib/suprimentos-auth";
import { notificar, usuariosComPapel } from "@/lib/suprimentos-notificacoes";
import { buscarProdutos, type ProdutoEncontrado } from "@/lib/suprimentos-catalogo";
import {
  ITENS_POR_REQUISICAO_MAX,
  STATUS_CANCELAVEL_COMPRADOR,
  STATUS_CANCELAVEL_REQUISITANTE,
  codigoRequisicao,
  hojeSaoPaulo,
} from "@/lib/suprimentos";

export type EstadoFormRequisicao = { erro?: string } | undefined;

/** Busca no catálogo para quem monta a requisição: qualquer usuário do módulo. */
export async function buscarProdutosRequisicao(q: string): Promise<ProdutoEncontrado[]> {
  await exigirPapelSuprimentos();
  return buscarProdutos(q);
}

const itemSchema = z.object({
  // Item do catálogo (o padrão) ou texto livre, quando o requisitante marca que
  // não encontrou o produto. O comprador vincula os de texto livre depois.
  produtoId: z.string().min(1).optional(),
  descricao: z.string().trim().min(2, "Descreva cada item.").max(300),
  quantidade: z.coerce.number().positive("A quantidade de cada item precisa ser maior que zero."),
  unidade: z.string().trim().min(1, "Informe a unidade de cada item.").max(10),
  especificacao: z.string().trim().max(1000).optional(),
});

const requisicaoSchema = z.object({
  obraId: z.string().min(1, "Selecione a obra (centro de custo)."),
  prazoDesejado: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Informe o prazo desejado."),
  urgencia: z.enum(["normal", "emergencial"]),
  observacoes: z.string().trim().max(2000).optional(),
  itens: z
    .array(itemSchema)
    .min(1, "Inclua pelo menos um item.")
    .max(ITENS_POR_REQUISICAO_MAX, `No máximo ${ITENS_POR_REQUISICAO_MAX} itens por requisição.`),
});

export async function criarRequisicao(
  _estado: EstadoFormRequisicao,
  formData: FormData
): Promise<EstadoFormRequisicao> {
  let requisicaoId: string;

  try {
    // Qualquer pessoa do módulo abre requisição — não há papel exigido.
    const { usuarioId } = await exigirPapelSuprimentos();

    let itensBrutos: unknown;
    try {
      itensBrutos = JSON.parse(String(formData.get("itens") ?? "[]"));
    } catch {
      return { erro: "Lista de itens inválida." };
    }

    const dados = requisicaoSchema.safeParse({
      obraId: formData.get("obraId"),
      prazoDesejado: formData.get("prazoDesejado"),
      urgencia: formData.get("urgencia"),
      observacoes: String(formData.get("observacoes") ?? "").trim() || undefined,
      itens: itensBrutos,
    });
    if (!dados.success) return { erro: dados.error.issues[0]?.message ?? "Dados inválidos." };

    if (dados.data.prazoDesejado < hojeSaoPaulo()) {
      return { erro: "O prazo desejado não pode ser uma data passada." };
    }

    const { data: obra } = await supabase
      .from("Obra")
      .select("id, nomeProjeto, status")
      .eq("id", dados.data.obraId)
      .maybeSingle();
    if (!obra) return { erro: "Obra não encontrada." };
    if (obra.status === "concluida") return { erro: "Esta obra já está concluída." };

    // Produto escolhido precisa existir e estar ativo. A descrição gravada é a
    // do catálogo, não a que veio do navegador.
    const idsProduto = [...new Set(dados.data.itens.flatMap((i) => (i.produtoId ? [i.produtoId] : [])))];
    const produtos = new Map<string, { descricao: string; unidade: string }>();
    if (idsProduto.length) {
      const { data: encontrados } = await supabase
        .from("Produto")
        .select("id, descricao, unidade")
        .in("id", idsProduto)
        .eq("ativo", true);
      for (const p of encontrados ?? []) produtos.set(p.id, p);
      if (produtos.size !== idsProduto.length) {
        return { erro: "Um dos produtos escolhidos não está mais no catálogo. Escolha de novo." };
      }
    }

    const { data: requisicao, error } = await supabase
      .from("Requisicao")
      .insert({
        requisitanteId: usuarioId,
        obraId: obra.id,
        prazoDesejado: dados.data.prazoDesejado,
        urgencia: dados.data.urgencia,
        observacoes: dados.data.observacoes ?? null,
        dataSolicitacao: hojeSaoPaulo(),
      })
      .select("id, numero")
      .single();
    if (error || !requisicao) return { erro: error?.message ?? "Falha ao criar a requisição." };

    const { error: erroItens } = await supabase.from("RequisicaoItem").insert(
      dados.data.itens.map((item, indice) => {
        const produto = item.produtoId ? produtos.get(item.produtoId) : undefined;
        return {
          requisicaoId: requisicao.id,
          ordem: indice + 1,
          produtoId: item.produtoId ?? null,
          descricao: (produto?.descricao ?? item.descricao).replace(/\s+/g, " "),
          quantidade: item.quantidade,
          // A unidade vem preenchida com a do catálogo, mas o requisitante pode
          // trocar (ex.: catálogo em M e o pedido em ROLO).
          unidade: item.unidade.toUpperCase(),
          especificacao: item.especificacao || null,
        };
      })
    );
    if (erroItens) {
      // Sem itens a requisição não existe: desfaz o cabeçalho em vez de deixar
      // uma requisição vazia na fila do comprador.
      await supabase.from("Requisicao").delete().eq("id", requisicao.id);
      return { erro: erroItens.message };
    }

    const emergencial = dados.data.urgencia === "emergencial";
    await notificar(await usuariosComPapel("comprador"), {
      tipo: "nova_requisicao",
      titulo: `${emergencial ? "EMERGENCIAL · " : ""}${codigoRequisicao(requisicao.numero)} — ${obra.nomeProjeto ?? "obra"}`,
      detalhe: `${dados.data.itens.length} ${dados.data.itens.length === 1 ? "item" : "itens"} para cotar.`,
      requisicaoId: requisicao.id,
      referencia: requisicao.id,
      geradaPorId: usuarioId,
    });

    requisicaoId = requisicao.id;
  } catch (erro) {
    return { erro: mensagemDeErro(erro) };
  }

  revalidatePath("/suprimentos", "layout");
  redirect(`/suprimentos/requisicoes/${requisicaoId}`);
}

const cancelarSchema = z.object({
  requisicaoId: z.string().min(1),
  motivo: z.string().trim().min(3, "Informe o motivo do cancelamento.").max(1000),
});

export type EstadoCancelamento = { erro?: string } | undefined;

export async function cancelarRequisicao(
  _estado: EstadoCancelamento,
  formData: FormData
): Promise<EstadoCancelamento> {
  try {
    const contexto = await exigirPapelSuprimentos();
    const dados = cancelarSchema.safeParse({
      requisicaoId: formData.get("requisicaoId"),
      motivo: formData.get("motivo"),
    });
    if (!dados.success) return { erro: dados.error.issues[0]?.message ?? "Dados inválidos." };

    const { data: requisicao } = await supabase
      .from("Requisicao")
      .select("id, numero, status, requisitanteId, compradorId")
      .eq("id", dados.data.requisicaoId)
      .maybeSingle();
    if (!requisicao) return { erro: "Requisição não encontrada." };

    const ehComprador = contexto.ehAdmin || contexto.papeis.has("comprador");
    const ehRequisitante = requisicao.requisitanteId === contexto.usuarioId;

    // Comprador/admin cancela até o pedido sair; o requisitante, só enquanto
    // ninguém começou a cotar.
    const permitidos = ehComprador
      ? STATUS_CANCELAVEL_COMPRADOR
      : ehRequisitante
        ? STATUS_CANCELAVEL_REQUISITANTE
        : [];
    if (permitidos.length === 0) return { erro: "Você não pode cancelar esta requisição." };
    if (!permitidos.includes(requisicao.status)) {
      return {
        erro: ehComprador
          ? "Depois do pedido emitido a requisição não pode mais ser cancelada."
          : "A cotação já começou. Peça ao comprador para cancelar.",
      };
    }

    // O filtro por status no UPDATE fecha a corrida: se o comprador abriu a
    // cotação entre a leitura acima e esta gravação, nada é alterado.
    const { data: alterada, error } = await supabase
      .from("Requisicao")
      .update({
        status: "cancelada",
        canceladaEm: new Date().toISOString(),
        canceladaPorId: contexto.usuarioId,
        motivoCancelamento: dados.data.motivo,
        atualizadoEm: new Date().toISOString(),
      })
      .eq("id", requisicao.id)
      .in("status", permitidos)
      .select("id");
    if (error) return { erro: error.message };
    if (!alterada?.length) return { erro: "A requisição mudou de situação. Recarregue a página." };

    const codigo = codigoRequisicao(requisicao.numero);
    const avisar = ehRequisitante
      ? requisicao.compradorId
        ? [requisicao.compradorId]
        : await usuariosComPapel("comprador")
      : [requisicao.requisitanteId];
    await notificar(avisar, {
      tipo: "requisicao_cancelada",
      titulo: `${codigo} cancelada`,
      detalhe: dados.data.motivo,
      requisicaoId: requisicao.id,
      referencia: requisicao.id,
      geradaPorId: contexto.usuarioId,
    });

    revalidatePath("/suprimentos", "layout");
    return undefined;
  } catch (erro) {
    return { erro: mensagemDeErro(erro) };
  }
}
