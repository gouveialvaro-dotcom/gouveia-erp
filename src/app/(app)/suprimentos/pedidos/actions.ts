"use server";

import { revalidatePath } from "next/cache";
import { supabase } from "@/lib/supabase";
import { exigirPapelSuprimentos, mensagemDeErro } from "@/lib/suprimentos-auth";
import { notificar } from "@/lib/suprimentos-notificacoes";
import { nomeSeguro } from "@/lib/pos-venda";
import type { SituacaoRecebimento, StatusRequisicao } from "@/lib/suprimentos";

// Recebimento na obra. Por enquanto registra o recebedor (almoxarife), o
// comprador, o admin ou o próprio requisitante do pedido — a obra ainda não
// tem almoxarifes com login em todas as frentes.

export type EstadoRecebimento = { erro?: string; ok?: boolean } | undefined;

const BUCKET = "suprimentos";
const FOTOS_MAX = 8;
const TAMANHO_MAXIMO_FOTO = 10 * 1024 * 1024;

export async function registrarRecebimento(
  _estado: EstadoRecebimento,
  formData: FormData
): Promise<EstadoRecebimento> {
  const enviados: string[] = [];
  try {
    const contexto = await exigirPapelSuprimentos();
    const pedidoId = String(formData.get("pedidoId") ?? "");
    const situacao = String(formData.get("situacao") ?? "") as SituacaoRecebimento;
    const observacao = String(formData.get("observacao") ?? "").trim().slice(0, 2000);
    const nomeRecebedor = String(formData.get("nomeRecebedor") ?? "").trim().slice(0, 120);
    const documento = String(formData.get("documentoRecebedor") ?? "").trim().slice(0, 40);

    if (situacao !== "conforme" && situacao !== "inconforme") return { erro: "Marque conforme ou inconforme." };
    if (situacao === "inconforme" && !observacao) {
      return { erro: "Descreva o problema (falta, avaria, item errado...)." };
    }
    if (!nomeRecebedor) return { erro: "Informe quem recebeu o material." };

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

    const { data, error } = await supabase.rpc("suprimentos_registrar_recebimento", {
      p_pedido_id: pedido.id,
      p_usuario_id: contexto.usuarioId,
      p_situacao: situacao,
      p_observacao: observacao || null,
      p_nome_recebedor: nomeRecebedor,
      p_documento_recebedor: documento || null,
    });
    if (error) {
      if (enviados.length) await supabase.storage.from(BUCKET).remove(enviados);
      return { erro: error.code === "P0001" ? error.message : `Falha no banco: ${error.message}` };
    }
    const resultado = data as { recebimentoId: string; statusRequisicao: StatusRequisicao };

    if (fotosGravadas.length) {
      const { error: erroFotos } = await supabase
        .from("RecebimentoFoto")
        .insert(fotosGravadas.map((f) => ({ ...f, recebimentoId: resultado.recebimentoId })));
      if (erroFotos) console.error("Falha ao registrar fotos do recebimento:", erroFotos.message);
    }
    enviados.length = 0;

    const avisar = [pedido.requisicao.requisitanteId, pedido.requisicao.compradorId].filter(
      (id): id is string => Boolean(id)
    );
    await notificar(avisar, {
      tipo: "recebimento_registrado",
      titulo: `${pedido.codigo} recebido ${situacao === "conforme" ? "conforme" : "INCONFORME"}`,
      detalhe:
        (situacao === "inconforme" ? observacao : `Recebido por ${nomeRecebedor}.`) +
        (resultado.statusRequisicao === "concluida" ? " Requisição concluída." : ""),
      requisicaoId: pedido.requisicao.id,
      pedidoCompraId: pedido.id,
      referencia: resultado.recebimentoId,
      geradaPorId: contexto.usuarioId,
    });

    revalidatePath("/suprimentos", "layout");
    return { ok: true };
  } catch (erro) {
    if (enviados.length) await supabase.storage.from(BUCKET).remove(enviados);
    return { erro: mensagemDeErro(erro) };
  }
}
