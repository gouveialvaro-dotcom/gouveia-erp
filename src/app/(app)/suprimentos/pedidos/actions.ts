"use server";

import { revalidatePath } from "next/cache";
import { supabase } from "@/lib/supabase";
import { exigirPapelSuprimentos, mensagemDeErro } from "@/lib/suprimentos-auth";
import { notificar } from "@/lib/suprimentos-notificacoes";
import { nomeSeguro } from "@/lib/pos-venda";
import type { SituacaoRecebimento, StatusRequisicao } from "@/lib/suprimentos";

// Pedido depois de emitido: o comprador confirma que fechou a compra no
// fornecedor (o pedido passa a "entrega pendente") e a obra registra o que
// chegou, item por item. Recebe o recebedor (almoxarife), o comprador, o admin
// ou o próprio requisitante — a obra ainda não tem almoxarife em todas as frentes.

const BUCKET = "suprimentos";
const FOTOS_MAX = 8;
const TAMANHO_MAXIMO_FOTO = 10 * 1024 * 1024;

function erroDoBanco(error: { code?: string; message: string }) {
  return error.code === "P0001" ? error.message : `Falha no banco: ${error.message}`;
}

export type EstadoConfirmacao = { erro?: string; ok?: boolean } | undefined;

export async function confirmarCompra(_estado: EstadoConfirmacao, formData: FormData): Promise<EstadoConfirmacao> {
  try {
    const { usuarioId } = await exigirPapelSuprimentos("comprador");
    const pedidoId = String(formData.get("pedidoId") ?? "");

    const { error } = await supabase.rpc("suprimentos_confirmar_compra", {
      p_pedido_id: pedidoId,
      p_usuario_id: usuarioId,
    });
    if (error) return { erro: erroDoBanco(error) };

    const { data: pedido } = await supabase
      .from("PedidoCompra")
      .select("id, codigo, requisicao:Requisicao(id, requisitanteId)")
      .eq("id", pedidoId)
      .single();
    if (pedido?.requisicao) {
      await notificar([pedido.requisicao.requisitanteId], {
        tipo: "compra_confirmada",
        titulo: `${pedido.codigo} comprado — aguardando entrega`,
        detalhe: "O comprador confirmou a compra no fornecedor.",
        requisicaoId: pedido.requisicao.id,
        pedidoCompraId: pedido.id,
        referencia: `${pedido.id}:confirmada`,
        geradaPorId: usuarioId,
      });
    }

    revalidatePath("/suprimentos", "layout");
    return { ok: true };
  } catch (erro) {
    return { erro: mensagemDeErro(erro) };
  }
}

export type EstadoRecebimento = { erro?: string; ok?: boolean; situacao?: SituacaoRecebimento } | undefined;

type LinhaRecebida = { item: string; recebida: number; devolvida: number };

export async function registrarRecebimento(
  _estado: EstadoRecebimento,
  formData: FormData
): Promise<EstadoRecebimento> {
  const enviados: string[] = [];
  try {
    const contexto = await exigirPapelSuprimentos();
    const pedidoId = String(formData.get("pedidoId") ?? "");
    const observacao = String(formData.get("observacao") ?? "").trim().slice(0, 2000);
    const avaria = formData.get("avaria") === "on";
    const encerrar = formData.get("encerrar") === "on";

    let linhas: LinhaRecebida[];
    try {
      const brutas = JSON.parse(String(formData.get("itens") ?? "[]")) as unknown[];
      linhas = brutas.map((l) => {
        const x = l as Record<string, unknown>;
        return { item: String(x.item ?? ""), recebida: Number(x.recebida) || 0, devolvida: Number(x.devolvida) || 0 };
      });
    } catch {
      return { erro: "Lista de itens inválida." };
    }
    if (linhas.some((l) => !Number.isFinite(l.recebida) || !Number.isFinite(l.devolvida))) {
      return { erro: "Quantidade inválida." };
    }

    const { data: pedido } = await supabase
      .from("PedidoCompra")
      .select("id, codigo, requisicao:Requisicao(id, requisitanteId, compradorId)")
      .eq("id", pedidoId)
      .maybeSingle();
    if (!pedido?.requisicao) return { erro: "Pedido não encontrado." };

    const pode =
      contexto.ehAdmin ||
      contexto.papeis.has("recebedor") ||
      contexto.papeis.has("comprador") ||
      pedido.requisicao.requisitanteId === contexto.usuarioId;
    if (!pode) return { erro: "Você não pode registrar o recebimento deste pedido." };

    const fotos = formData
      .getAll("fotos")
      .filter((f): f is File => f instanceof File && f.size > 0);
    if (fotos.length > FOTOS_MAX) return { erro: `No máximo ${FOTOS_MAX} fotos por recebimento.` };
    for (const foto of fotos) {
      if (!foto.type.startsWith("image/")) return { erro: `"${foto.name}" não é uma imagem.` };
      if (foto.size > TAMANHO_MAXIMO_FOTO) return { erro: `"${foto.name}" passa de 10 MB.` };
    }
    // Foto é obrigatória só quando há problema: avaria ou devolução.
    const comProblema = avaria || linhas.some((l) => l.devolvida > 0);
    if (comProblema && fotos.length === 0) {
      return { erro: "Tire pelo menos uma foto da avaria ou do material devolvido." };
    }

    // Fotos sobem antes; se o registro falhar, são apagadas.
    const fotosGravadas: { caminho: string; nome: string; mime: string; tamanho: number }[] = [];
    for (const foto of fotos) {
      const caminho = `recebimentos/${pedido.id}/${crypto.randomUUID()}-${nomeSeguro(foto.name)}`;
      const { error } = await supabase.storage.from(BUCKET).upload(caminho, foto, { contentType: foto.type });
      if (error) {
        if (enviados.length) await supabase.storage.from(BUCKET).remove(enviados);
        return { erro: "Falha ao enviar as fotos. Tente de novo." };
      }
      enviados.push(caminho);
      fotosGravadas.push({ caminho, nome: foto.name, mime: foto.type, tamanho: foto.size });
    }

    const { data, error } = await supabase.rpc("suprimentos_registrar_recebimento_itens", {
      p_pedido_id: pedido.id,
      p_usuario_id: contexto.usuarioId,
      p_itens: linhas,
      p_avaria: avaria,
      p_observacao: observacao || null,
      p_encerrar: encerrar,
    });
    if (error) {
      if (enviados.length) await supabase.storage.from(BUCKET).remove(enviados);
      return { erro: erroDoBanco(error) };
    }
    const resultado = data as {
      recebimentoId: string;
      situacao: SituacaoRecebimento;
      statusRequisicao: StatusRequisicao;
    };

    if (fotosGravadas.length) {
      const { error: erroFotos } = await supabase
        .from("RecebimentoFoto")
        .insert(fotosGravadas.map((f) => ({ ...f, recebimentoId: resultado.recebimentoId })));
      if (erroFotos) console.error("Falha ao registrar fotos do recebimento:", erroFotos.message);
    }
    enviados.length = 0;

    const avisar = [pedido.requisicao.requisitanteId, pedido.requisicao.compradorId].filter(
      (id): id is string => Boolean(id) && id !== contexto.usuarioId
    );
    const titulo =
      resultado.situacao === "conforme"
        ? `${pedido.codigo} recebido conforme`
        : resultado.situacao === "parcial"
          ? `${pedido.codigo} recebido parcialmente`
          : `${pedido.codigo} recebido INCONFORME`;
    await notificar(avisar, {
      tipo: "recebimento_registrado",
      titulo,
      detalhe:
        (observacao || `Recebido por ${contexto.session.user?.name ?? "usuário"}.`) +
        (resultado.statusRequisicao === "concluida" ? " Requisição concluída." : ""),
      requisicaoId: pedido.requisicao.id,
      pedidoCompraId: pedido.id,
      referencia: resultado.recebimentoId,
      geradaPorId: contexto.usuarioId,
    });

    revalidatePath("/suprimentos", "layout");
    return { ok: true, situacao: resultado.situacao };
  } catch (erro) {
    if (enviados.length) await supabase.storage.from(BUCKET).remove(enviados);
    return { erro: mensagemDeErro(erro) };
  }
}
