import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { type Modulo, type Perfil, nivelAcesso } from "@/lib/permissoes";

export class ApiAuthError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

// Garante sessão válida e nível de acesso mínimo para um módulo.
// Lança ApiAuthError (capturar na rota e responder 401/403) quando não autorizado.
export async function exigirPermissao(modulo: Modulo, nivelMinimo: "leitura" | "escrita") {
  const session = await auth();
  if (!session?.user) {
    throw new ApiAuthError(401, "Não autenticado.");
  }

  const perfil = session.user.perfil as Perfil;
  const nivel = nivelAcesso(perfil, modulo);

  const autorizado =
    nivelMinimo === "leitura" ? nivel !== "nenhum" : nivel === "escrita";

  if (!autorizado) {
    throw new ApiAuthError(403, "Sem permissão para esta ação.");
  }

  return { session, perfil };
}

export function respostaErroApi(erro: unknown) {
  if (erro instanceof ApiAuthError) {
    return NextResponse.json({ erro: erro.message }, { status: erro.status });
  }
  console.error(erro);
  return NextResponse.json({ erro: "Erro interno." }, { status: 500 });
}
