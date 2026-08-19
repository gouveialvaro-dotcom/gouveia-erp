import { NextResponse } from "next/server";
import { exigirPermissao, respostaErroApi } from "@/lib/api-auth";
import { carregarDadosProposta } from "@/lib/proposta";
import { construirHtmlProposta } from "@/lib/proposta-html";

// O Word abre HTML nativamente quando servido como application/msword — os
// namespaces "urn:schemas-microsoft-com" fazem com que ele trate o arquivo como
// documento editável (e não como página web importada).
function envelopeWord(corpo: string) {
  return `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">
<head>
<meta charset="utf-8">
<title>Proposta Comercial</title>
<!--[if gte mso 9]><xml><w:WordDocument><w:View>Print</w:View></w:WordDocument></xml><![endif]-->
<style>@page { size: A4; margin: 2cm; }</style>
</head>
<body>${corpo}</body>
</html>`;
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await exigirPermissao("orcamentos", "leitura");

    const { id } = await params;
    const dados = await carregarDadosProposta(id);
    if (!dados) {
      return NextResponse.json({ erro: "Proposta não encontrada." }, { status: 404 });
    }

    const { numero, ano, revisao } = dados.proposta;
    const nomeArquivo = `Proposta-${String(numero).padStart(3, "0")}-${ano}${
      revisao > 0 ? `-rev${String(revisao).padStart(2, "0")}` : ""
    }.doc`;

    return new NextResponse(envelopeWord(construirHtmlProposta(dados)), {
      headers: {
        "Content-Type": "application/msword; charset=utf-8",
        "Content-Disposition": `attachment; filename="${nomeArquivo}"`,
      },
    });
  } catch (erro) {
    return respostaErroApi(erro);
  }
}
