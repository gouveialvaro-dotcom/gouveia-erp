import { NextResponse } from "next/server";
import { z } from "zod";
import { supabase } from "@/lib/supabase";
import { exigirPermissao, respostaErroApi } from "@/lib/api-auth";
import type { AvisoSuprimentosItem } from "@/lib/suprimentos";

// Sino do módulo Suprimentos. Mesmo desenho do sino do pós-venda
// (api/pos-venda/notificacoes), com tabela própria.

const LIMITE = 30;

export async function GET() {
  try {
    const { usuarioId } = await exigirPermissao("suprimentos", "leitura");

    const { data } = await supabase
      .from("NotificacaoSuprimentos")
      .select("*, autor:Usuario!NotificacaoSuprimentos_geradaPorId_fkey(nome)")
      .eq("usuarioId", usuarioId)
      .order("criadoEm", { ascending: false })
      .limit(LIMITE);

    const itens: AvisoSuprimentosItem[] = (data ?? []).map((n) => ({
      id: n.id,
      tipo: n.tipo,
      titulo: n.titulo,
      detalhe: n.detalhe,
      requisicaoId: n.requisicaoId,
      pedidoCompraId: n.pedidoCompraId,
      lida: n.lidaEm !== null,
      criadoEm: n.criadoEm,
      autor: n.autor?.nome ?? null,
    }));

    return NextResponse.json({ itens, naoLidas: itens.filter((i) => !i.lida).length });
  } catch (erro) {
    return respostaErroApi(erro);
  }
}

const lerSchema = z.object({ id: z.string().optional(), todas: z.boolean().optional() });

export async function POST(request: Request) {
  try {
    const { usuarioId } = await exigirPermissao("suprimentos", "leitura");

    const corpo = lerSchema.safeParse(await request.json());
    if (!corpo.success || (!corpo.data.id && !corpo.data.todas)) {
      return NextResponse.json({ erro: "Requisição inválida." }, { status: 400 });
    }

    // O filtro por usuarioId impede marcar como lido o aviso de outra pessoa.
    let query = supabase
      .from("NotificacaoSuprimentos")
      .update({ lidaEm: new Date().toISOString() })
      .eq("usuarioId", usuarioId)
      .is("lidaEm", null);
    if (corpo.data.id) query = query.eq("id", corpo.data.id);

    const { error } = await query;
    if (error) return NextResponse.json({ erro: "Falha ao marcar como lido." }, { status: 500 });

    return NextResponse.json({ ok: true });
  } catch (erro) {
    return respostaErroApi(erro);
  }
}
