import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { exigirPermissao, respostaErroApi } from "@/lib/api-auth";

// O bucket "whatsapp" é privado. Mesmo desenho da rota de anexos do chamado: em
// vez de colocar URL assinada no HTML — que continuaria válida depois de a
// pessoa perder o acesso — cada abertura passa por aqui, revalida a permissão e
// só então gera um link de vida curta.
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await exigirPermissao("posVenda", "leitura");
    const { id } = await params;

    const { data: mensagem } = await supabase
      .from("MensagemWhatsapp")
      .select("caminhoStorage")
      .eq("id", id)
      .maybeSingle();

    if (!mensagem?.caminhoStorage) {
      return NextResponse.json({ erro: "Mídia não encontrada." }, { status: 404 });
    }

    const { data, error } = await supabase.storage
      .from("whatsapp")
      .createSignedUrl(mensagem.caminhoStorage, 60);

    if (error || !data) {
      return NextResponse.json({ erro: "Falha ao abrir a mídia." }, { status: 500 });
    }

    return NextResponse.redirect(data.signedUrl);
  } catch (erro) {
    return respostaErroApi(erro);
  }
}
