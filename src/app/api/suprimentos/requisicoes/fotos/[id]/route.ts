import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { exigirPermissao, respostaErroApi } from "@/lib/api-auth";
import { papeisDoUsuario } from "@/lib/suprimentos-auth";

// Foto de um item da requisição. Mesma regra de quem enxerga a requisição:
// quem trabalha o fluxo (algum papel), o admin ou o próprio requisitante.
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { usuarioId, perfil } = await exigirPermissao("suprimentos", "leitura");
    const { id } = await params;

    const { data: foto } = await supabase
      .from("RequisicaoItemFoto")
      .select("caminho, item:RequisicaoItem(requisicao:Requisicao(requisitanteId))")
      .eq("id", id)
      .maybeSingle();
    if (!foto) return NextResponse.json({ erro: "Foto não encontrada." }, { status: 404 });

    const papeis = await papeisDoUsuario(usuarioId);
    const requisitante = foto.item?.requisicao?.requisitanteId;
    if (perfil !== "admin" && papeis.size === 0 && requisitante !== usuarioId) {
      return NextResponse.json({ erro: "Foto não encontrada." }, { status: 404 });
    }

    const { data, error } = await supabase.storage.from("suprimentos").createSignedUrl(foto.caminho, 300);
    if (error || !data) return NextResponse.json({ erro: "Falha ao abrir a foto." }, { status: 500 });
    return NextResponse.redirect(data.signedUrl);
  } catch (erro) {
    return respostaErroApi(erro);
  }
}
