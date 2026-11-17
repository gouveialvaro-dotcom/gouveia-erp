import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { exigirPermissao, respostaErroApi } from "@/lib/api-auth";
import { papeisDoUsuario } from "@/lib/suprimentos-auth";

// Documento assinado de uma aprovação. Mesmo padrão do pós-venda: o bucket é
// privado e cada download revalida quem pede antes de gerar um link curto.
// Vê quem enxerga a requisição: quem trabalha o fluxo, o admin e o requisitante.
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { usuarioId, perfil } = await exigirPermissao("suprimentos", "leitura");
    const { id } = await params;

    const { data: aprovacao } = await supabase
      .from("Aprovacao")
      .select("anexoCaminho, requisicao:Requisicao(requisitanteId)")
      .eq("id", id)
      .maybeSingle();
    if (!aprovacao?.anexoCaminho) {
      return NextResponse.json({ erro: "Documento não encontrado." }, { status: 404 });
    }

    const papeis = await papeisDoUsuario(usuarioId);
    const podeVer =
      perfil === "admin" || papeis.size > 0 || aprovacao.requisicao?.requisitanteId === usuarioId;
    if (!podeVer) return NextResponse.json({ erro: "Documento não encontrado." }, { status: 404 });

    const { data, error } = await supabase.storage
      .from("suprimentos")
      .createSignedUrl(aprovacao.anexoCaminho, 60);
    if (error || !data) {
      return NextResponse.json({ erro: "Falha ao abrir o documento." }, { status: 500 });
    }
    return NextResponse.redirect(data.signedUrl);
  } catch (erro) {
    return respostaErroApi(erro);
  }
}
