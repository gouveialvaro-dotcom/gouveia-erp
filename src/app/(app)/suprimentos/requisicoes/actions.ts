"use server";

import { z } from "zod";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { supabase } from "@/lib/supabase";
import { exigirPapelSuprimentos, mensagemDeErro } from "@/lib/suprimentos-auth";
import { notificar, usuariosComPapel } from "@/lib/suprimentos-notificacoes";
import { buscarProdutos, type ProdutoEncontrado } from "@/lib/suprimentos-catalogo";
import { nomeSeguro } from "@/lib/pos-venda";
import {
  ITENS_POR_REQUISICAO_MAX,
  STATUS_CANCELAVEL_COMPRADOR,
  STATUS_CANCELAVEL_REQUISITANTE,
  codigoRequisicao,
  hojeSaoPaulo,
} from "@/lib/suprimentos";

const BUCKET = "suprimentos";
const FOTOS_POR_ITEM = 3;
const TAMANHO_MAXIMO_FOTO = 10 * 1024 * 1024;

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
  // Id de um centro de custo do cadastro (Cadastros → Centros de custo).
  centroCusto: z.string().trim().min(1, "Selecione o centro de custo."),
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
      centroCusto: formData.get("centroCusto"),
      prazoDesejado: formData.get("prazoDesejado"),
      urgencia: formData.get("urgencia"),
      observacoes: String(formData.get("observacoes") ?? "").trim() || undefined,
      itens: itensBrutos,
    });
    if (!dados.success) return { erro: dados.error.issues[0]?.message ?? "Dados inválidos." };

    if (dados.data.prazoDesejado < hojeSaoPaulo()) {
      return { erro: "O prazo desejado não pode ser uma data passada." };
    }

    // Centro de custo cadastrado e ativo. Requisições antigas apontavam para a
    // obra (obraId); as novas, só para o centro de custo.
    const { data: centro } = await supabase
      .from("CentroCusto")
      .select("id, nome, ativo")
      .eq("id", dados.data.centroCusto)
      .maybeSingle();
    if (!centro?.ativo) return { erro: "Centro de custo não encontrado ou desativado." };
    const centroCustoId = centro.id;
    const nomeCentro = centro.nome;

    // Unidade do cadastro (ativa); só a do próprio produto do catálogo foge dela.
    const { data: unidadesAtivas } = await supabase.from("UnidadeMedida").select("sigla").eq("ativo", true);
    const unidadesValidas = new Set((unidadesAtivas ?? []).map((u) => u.sigla));

    // Fotos de cada item (campo "foto-<índice do item>").
    const fotosPorItem = dados.data.itens.map((_, indice) =>
      formData.getAll(`foto-${indice}`).filter((f): f is File => f instanceof File && f.size > 0)
    );
    for (const [indice, fotos] of fotosPorItem.entries()) {
      if (fotos.length > FOTOS_POR_ITEM) return { erro: `No máximo ${FOTOS_POR_ITEM} fotos por item.` };
      for (const foto of fotos) {
        if (!foto.type.startsWith("image/")) return { erro: `A foto do item ${indice + 1} não é uma imagem.` };
        if (foto.size > TAMANHO_MAXIMO_FOTO) return { erro: `Uma foto do item ${indice + 1} passa de 10 MB.` };
      }
    }

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
    for (const [indice, item] of dados.data.itens.entries()) {
      const unidade = item.unidade.toUpperCase();
      const doProduto = item.produtoId ? produtos.get(item.produtoId)?.unidade.toUpperCase() : undefined;
      if (!unidadesValidas.has(unidade) && unidade !== doProduto) {
        return { erro: `Escolha a unidade do item ${indice + 1} na lista.` };
      }
    }

    const { data: requisicao, error } = await supabase
      .from("Requisicao")
      .insert({
        requisitanteId: usuarioId,
        centroCustoId,
        prazoDesejado: dados.data.prazoDesejado,
        urgencia: dados.data.urgencia,
        observacoes: dados.data.observacoes ?? null,
        dataSolicitacao: hojeSaoPaulo(),
      })
      .select("id, numero")
      .single();
    if (error || !requisicao) return { erro: error?.message ?? "Falha ao criar a requisição." };

    const { data: itensCriados, error: erroItens } = await supabase.from("RequisicaoItem").insert(
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
    ).select("id, ordem");
    if (erroItens || !itensCriados) {
      // Sem itens a requisição não existe: desfaz o cabeçalho em vez de deixar
      // uma requisição vazia na fila do comprador.
      await supabase.from("Requisicao").delete().eq("id", requisicao.id);
      return { erro: erroItens?.message ?? "Falha ao gravar os itens." };
    }

    // Fotos: sobem depois dos itens (o caminho leva a requisição). Se alguma
    // falhar, a requisição inteira é desfeita, para não ficar pela metade.
    const enviadas: string[] = [];
    const registros: { requisicaoItemId: string; caminho: string; nome: string; mime: string; tamanho: number }[] = [];
    for (const [indice, fotos] of fotosPorItem.entries()) {
      const itemId = itensCriados.find((i) => i.ordem === indice + 1)?.id;
      if (!itemId) continue;
      for (const foto of fotos) {
        const caminho = `requisicoes/${requisicao.id}/${crypto.randomUUID()}-${nomeSeguro(foto.name)}`;
        const { error } = await supabase.storage.from(BUCKET).upload(caminho, foto, { contentType: foto.type });
        if (error) {
          if (enviadas.length) await supabase.storage.from(BUCKET).remove(enviadas);
          await supabase.from("Requisicao").delete().eq("id", requisicao.id);
          return { erro: "Falha ao enviar as fotos. Tente de novo." };
        }
        enviadas.push(caminho);
        registros.push({ requisicaoItemId: itemId, caminho, nome: foto.name, mime: foto.type, tamanho: foto.size });
      }
    }
    if (registros.length) {
      const { error } = await supabase.from("RequisicaoItemFoto").insert(registros);
      if (error) {
        await supabase.storage.from(BUCKET).remove(enviadas);
        await supabase.from("Requisicao").delete().eq("id", requisicao.id);
        return { erro: error.message };
      }
    }

    const emergencial = dados.data.urgencia === "emergencial";
    await notificar(await usuariosComPapel("comprador"), {
      tipo: "nova_requisicao",
      titulo: `${emergencial ? "EMERGENCIAL · " : ""}${codigoRequisicao(requisicao.numero)} — ${nomeCentro}`,
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
