import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { exigirPermissao, respostaErroApi } from "@/lib/api-auth";

// O bucket "pos-venda" é privado. Em vez de expor URLs assinadas no HTML — que
// continuariam válidas depois de o usuário perder o acesso — cada download
// passa por aqui, revalida a permissão e só então gera um link de curta vida.
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await exigirPermissao("posVenda", "leitura");
    const { id } = await params;

    const { data: anexo } = await supabase
      .from("AnexoChamado")
      .select("caminho")
      .eq("id", id)
      .maybeSingle();

    if (!anexo) {
      return NextResponse.json({ erro: "Anexo não encontrado." }, { status: 404 });
    }

    const { data, error } = await supabase.storage
      .from("pos-venda")
      .createSignedUrl(anexo.caminho, 60);

    if (error || !data) {
      return NextResponse.json({ erro: "Falha ao abrir o anexo." }, { status: 500 });
    }

    return NextResponse.redirect(data.signedUrl);
  } catch (erro) {
    return respostaErroApi(erro);
  }
}
