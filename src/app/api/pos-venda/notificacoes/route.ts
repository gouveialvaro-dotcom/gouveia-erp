import { NextResponse } from "next/server";
import { z } from "zod";
import { supabase } from "@/lib/supabase";
import { exigirPermissao, respostaErroApi } from "@/lib/api-auth";
import { sincronizarVencidos } from "@/lib/notificacoes-pos-venda";
import type { NotificacaoItem } from "@/lib/pos-venda";

const LIMITE = 30;

export async function GET() {
  try {
    const { usuarioId } = await exigirPermissao("posVenda", "leitura");

    // Aproveita a batida do sino para materializar os vencimentos do dia.
    await sincronizarVencidos(usuarioId);

    const { data } = await supabase
      .from("NotificacaoPosVenda")
      .select("*, autor:Usuario!NotificacaoPosVenda_geradaPorId_fkey(nome)")
      .eq("usuarioId", usuarioId)
      .order("criadoEm", { ascending: false })
      .limit(LIMITE);

    const itens: NotificacaoItem[] = (data ?? []).map((n) => ({
      id: n.id,
      chamadoId: n.chamadoId,
      conversaId: n.conversaId,
      tipo: n.tipo,
      titulo: n.titulo,
      detalhe: n.detalhe,
      lida: n.lidaEm !== null,
      criadoEm: n.criadoEm,
      autor: n.autor?.nome ?? null,
    }));

    return NextResponse.json({
      itens,
      naoLidas: itens.filter((i) => !i.lida).length,
    });
  } catch (erro) {
    return respostaErroApi(erro);
  }
}

const lerSchema = z.object({
  id: z.string().optional(),
  chamadoId: z.string().optional(),
  todas: z.boolean().optional(),
});

export async function POST(request: Request) {
  try {
    const { usuarioId } = await exigirPermissao("posVenda", "leitura");

    const corpo = lerSchema.safeParse(await request.json());
    if (!corpo.success) {
      return NextResponse.json({ erro: "Requisição inválida." }, { status: 400 });
    }

    // O filtro por usuarioId é o que impede marcar como lida a notificação
    // de outra pessoa passando um id qualquer.
    let query = supabase
      .from("NotificacaoPosVenda")
      .update({ lidaEm: new Date().toISOString() })
      .eq("usuarioId", usuarioId)
      .is("lidaEm", null);

    if (corpo.data.id) query = query.eq("id", corpo.data.id);
    else if (corpo.data.chamadoId) query = query.eq("chamadoId", corpo.data.chamadoId);
    else if (!corpo.data.todas) {
      return NextResponse.json({ erro: "Nada a marcar." }, { status: 400 });
    }

    const { error } = await query;
    if (error) {
      return NextResponse.json({ erro: "Falha ao marcar como lida." }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (erro) {
    return respostaErroApi(erro);
  }
}
