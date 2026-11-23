"use server";

import { revalidatePath } from "next/cache";
import { supabase } from "@/lib/supabase";
import { exigirPapelSuprimentos, mensagemDeErro, parametrosSuprimentos } from "@/lib/suprimentos-auth";
import { notificar, usuariosComPapel } from "@/lib/suprimentos-notificacoes";
import { nomeSeguro } from "@/lib/pos-venda";
import {
  PAPEL_DO_NIVEL,
  ROTULO_NIVEL,
  codigoRequisicao,
  nomeCentroCusto,
  type DecisaoAprovacao,
  type NivelAlcada,
  type StatusRequisicao,
} from "@/lib/suprimentos";
import { moeda } from "@/lib/suprimentos-cotacao";

// Envio para aprovação e decisão dos aprovadores. As regras que travam a
// requisição (status, níveis, pedidos) moram nas funções do banco
// (scripts/sql/015); aqui fica o que é do app: papel de quem chama, upload do
// documento assinado e avisos.

type Resultado = { erro?: string; status?: StatusRequisicao } | undefined;

const BUCKET = "suprimentos";
const TAMANHO_MAXIMO_ANEXO = 10 * 1024 * 1024;

/** Mensagem levantada pela função do banco (raise exception) vem em error.message. */
function erroDoBanco(error: { code?: string; message: string }) {
  return error.code === "P0001" ? error.message : `Falha no banco: ${error.message}`;
}

async function dadosAviso(requisicaoId: string) {
  const { data } = await supabase
    .from("Requisicao")
    .select(
      "id, numero, requisitanteId, compradorId, valorTotal, rodadaAprovacao, obra:Obra(nomeProjeto), centroCusto:CentroCusto(nome)"
    )
    .eq("id", requisicaoId)
    .single();
  return data!;
}

function revalidar() {
  revalidatePath("/suprimentos", "layout");
}

export async function enviarParaAprovacao(requisicaoId: string): Promise<Resultado> {
  try {
    const { usuarioId } = await exigirPapelSuprimentos("comprador");

    const { data, error } = await supabase.rpc("suprimentos_enviar_aprovacao", {
      p_requisicao_id: requisicaoId,
      p_usuario_id: usuarioId,
    });
    if (error) return { erro: erroDoBanco(error) };
    const resultado = data as { nivel: NivelAlcada; status: StatusRequisicao; rodada: number; total: number };

    const r = await dadosAviso(requisicaoId);
    const codigo = codigoRequisicao(r.numero);
    const obra = nomeCentroCusto(r);

    if (resultado.status === "pedido_emitido") {
      await notificar([r.requisitanteId], {
        tipo: "pedido_emitido",
        titulo: `${codigo} — pedido emitido`,
        detalhe: `Compra de ${moeda(Number(r.valorTotal))} fechada pelo comprador (${obra}).`,
        requisicaoId: r.id,
        referencia: `${r.id}:pedidos`,
        geradaPorId: usuarioId,
      });
    } else {
      const papeis =
        resultado.nivel === "diretoria"
          ? [PAPEL_DO_NIVEL.gerencia, PAPEL_DO_NIVEL.diretoria]
          : [PAPEL_DO_NIVEL.gerencia];
      const { count } = await supabase
        .from("Cotacao")
        .select("id", { count: "exact", head: true })
        .eq("requisicaoId", r.id);
      const { minimoCotacoes } = await parametrosSuprimentos();
      const abaixo = (count ?? 0) < minimoCotacoes ? ` Atenção: só ${count} cotação(ões).` : "";

      await notificar(await usuariosComPapel(...papeis), {
        tipo: "aprovacao_pendente",
        titulo: `Aprovar ${codigo} — ${moeda(Number(r.valorTotal))}`,
        detalhe: `${obra} · alçada ${ROTULO_NIVEL[resultado.nivel]}.${abaixo}`,
        requisicaoId: r.id,
        referencia: `${r.id}:${resultado.rodada}`,
        geradaPorId: usuarioId,
      });
    }

    revalidar();
    return { status: resultado.status };
  } catch (erro) {
    return { erro: mensagemDeErro(erro) };
  }
}

export type EstadoDecisao = { erro?: string; ok?: boolean } | undefined;

export async function decidirAprovacao(_estado: EstadoDecisao, formData: FormData): Promise<EstadoDecisao> {
  let caminhoAnexo: string | null = null;
  try {
    const requisicaoId = String(formData.get("requisicaoId") ?? "");
    const nivel = String(formData.get("nivel") ?? "") as "gerencia" | "diretoria";
    const decisao = String(formData.get("decisao") ?? "") as DecisaoAprovacao;
    const comentario = String(formData.get("comentario") ?? "").trim().slice(0, 2000);

    if (!(nivel in PAPEL_DO_NIVEL)) return { erro: "Nível de aprovação inválido." };
    if (!["aprovada", "devolvida", "recusada"].includes(decisao)) return { erro: "Decisão inválida." };
    if (decisao !== "aprovada" && !comentario) {
      return { erro: "Explique o motivo ao devolver ou recusar." };
    }

    const { usuarioId } = await exigirPapelSuprimentos(PAPEL_DO_NIVEL[nivel]);

    // Documento assinado (opcional): sobe antes, e é apagado se a decisão falhar.
    const arquivo = formData.get("anexo");
    let nomeAnexo: string | null = null;
    if (arquivo instanceof File && arquivo.size > 0) {
      if (arquivo.size > TAMANHO_MAXIMO_ANEXO) return { erro: "O documento passa de 10 MB." };
      caminhoAnexo = `aprovacoes/${requisicaoId}/${crypto.randomUUID()}-${nomeSeguro(arquivo.name)}`;
      const { error } = await supabase.storage
        .from(BUCKET)
        .upload(caminhoAnexo, arquivo, { contentType: arquivo.type || undefined });
      if (error) {
        caminhoAnexo = null;
        return { erro: "Falha ao enviar o documento." };
      }
      nomeAnexo = arquivo.name;
    }

    const { data, error } = await supabase.rpc("suprimentos_decidir_aprovacao", {
      p_requisicao_id: requisicaoId,
      p_usuario_id: usuarioId,
      p_nivel: nivel,
      p_decisao: decisao,
      p_comentario: comentario || null,
      p_anexo_caminho: caminhoAnexo,
      p_anexo_nome: nomeAnexo,
    });
    if (error) {
      if (caminhoAnexo) await supabase.storage.from(BUCKET).remove([caminhoAnexo]);
      return { erro: erroDoBanco(error) };
    }
    const resultado = data as { status: StatusRequisicao };

    const r = await dadosAviso(requisicaoId);
    const codigo = codigoRequisicao(r.numero);
    const comprador = r.compradorId ? [r.compradorId] : await usuariosComPapel("comprador");
    const referencia = `${r.id}:${r.rodadaAprovacao}:${nivel}`;

    if (decisao === "devolvida") {
      await notificar(comprador, {
        tipo: "requisicao_devolvida",
        titulo: `${codigo} devolvida para cotação (${ROTULO_NIVEL[nivel]})`,
        detalhe: comentario,
        requisicaoId: r.id,
        referencia,
        geradaPorId: usuarioId,
      });
    } else if (decisao === "recusada") {
      await notificar([...comprador, r.requisitanteId], {
        tipo: "requisicao_recusada",
        titulo: `${codigo} recusada (${ROTULO_NIVEL[nivel]})`,
        detalhe: comentario,
        requisicaoId: r.id,
        referencia,
        geradaPorId: usuarioId,
      });
    } else if (resultado.status === "pedido_emitido") {
      await notificar([...comprador, r.requisitanteId], {
        tipo: "pedido_emitido",
        titulo: `${codigo} aprovada — pedido emitido`,
        detalhe: `${moeda(Number(r.valorTotal))} · ${nomeCentroCusto(r)}`,
        requisicaoId: r.id,
        referencia: `${r.id}:pedidos`,
        geradaPorId: usuarioId,
      });
    }

    caminhoAnexo = null;
    revalidar();
    return { ok: true };
  } catch (erro) {
    if (caminhoAnexo) await supabase.storage.from(BUCKET).remove([caminhoAnexo]);
    return { erro: mensagemDeErro(erro) };
  }
}

/**
 * Diretoria volta para a cotação uma compra já aprovada, enquanto o comprador
 * não confirmou nenhum pedido no fornecedor. Os pedidos emitidos são apagados.
 */
export async function reabrirCotacao(_estado: EstadoDecisao, formData: FormData): Promise<EstadoDecisao> {
  try {
    const requisicaoId = String(formData.get("requisicaoId") ?? "");
    const motivo = String(formData.get("motivo") ?? "").trim().slice(0, 2000);
    if (!motivo) return { erro: "Explique o motivo de voltar para a cotação." };

    const { usuarioId } = await exigirPapelSuprimentos("aprovador_diretoria");

    const { error } = await supabase.rpc("suprimentos_reabrir_cotacao", {
      p_requisicao_id: requisicaoId,
      p_usuario_id: usuarioId,
      p_motivo: motivo,
    });
    if (error) return { erro: erroDoBanco(error) };

    const r = await dadosAviso(requisicaoId);
    const comprador = r.compradorId ? [r.compradorId] : await usuariosComPapel("comprador");
    await notificar([...comprador, r.requisitanteId], {
      tipo: "cotacao_reaberta",
      titulo: `${codigoRequisicao(r.numero)} voltou para cotação (Diretoria)`,
      detalhe: motivo,
      requisicaoId: r.id,
      referencia: `${r.id}:${r.rodadaAprovacao}:reaberta`,
      geradaPorId: usuarioId,
    });

    revalidar();
    return { ok: true };
  } catch (erro) {
    return { erro: mensagemDeErro(erro) };
  }
}
