import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { exigirPermissao, respostaErroApi } from "@/lib/api-auth";
import { papeisDoUsuario } from "@/lib/suprimentos-auth";

// Autorização do cliente (ordem de compra, print da conversa) anexada a uma
// cotação faturada em nome dele. Só quem trabalha o fluxo ou o admin.
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { usuarioId, perfil } = await exigirPermissao("suprimentos", "leitura");
    const { id } = await params;

    const papeis = await papeisDoUsuario(usuarioId);
    if (perfil !== "admin" && papeis.size === 0) {
      return NextResponse.json({ erro: "Documento não encontrado." }, { status: 404 });
    }

    const { data: cotacao } = await supabase
      .from("Cotacao")
      .select("autorizacaoCaminho")
      .eq("id", id)
      .maybeSingle();
    if (!cotacao?.autorizacaoCaminho) {
      return NextResponse.json({ erro: "Documento não encontrado." }, { status: 404 });
    }

    const { data, error } = await supabase.storage
      .from("suprimentos")
      .createSignedUrl(cotacao.autorizacaoCaminho, 300);
    if (error || !data) return NextResponse.json({ erro: "Falha ao abrir o documento." }, { status: 500 });
    return NextResponse.redirect(data.signedUrl);
  } catch (erro) {
    return respostaErroApi(erro);
  }
}
