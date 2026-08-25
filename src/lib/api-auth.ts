import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { supabase } from "@/lib/supabase";
import { type Modulo, type Perfil, nivelAcesso } from "@/lib/permissoes";

export class ApiAuthError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

// O id do usuário vem do JWT da sessão, que sobrevive a mudanças no banco: se a
// linha de Usuario for removida ou recriada com outro id, o token continua
// carregando um id órfão e toda gravação que referencia o usuário quebra com
// erro de chave estrangeira. Aqui o id é conferido contra o banco e, quando não
// existe mais, recuperado pelo e-mail da sessão antes de desistir.
export async function resolverUsuarioId(id: string | undefined, email: string | null | undefined) {
  if (id) {
    const { data } = await supabase.from("Usuario").select("id").eq("id", id).maybeSingle();
    if (data) return data.id;
  }

  if (email) {
    const { data } = await supabase.from("Usuario").select("id").eq("email", email).maybeSingle();
    if (data) return data.id;
  }

  throw new ApiAuthError(401, "Sua sessão não corresponde a um usuário ativo. Entre novamente.");
}

// Garante sessão válida e nível de acesso mínimo para um módulo.
// Lança ApiAuthError (capturar na rota e responder 401/403) quando não autorizado.
// `usuarioId` é o id já conferido no banco — use-o para gravar qualquer coluna
// que referencie Usuario, nunca `session.user.id` direto.
export async function exigirPermissao(modulo: Modulo, nivelMinimo: "leitura" | "escrita") {
  return exigirAlgumaPermissao([modulo], nivelMinimo);
}

// Mesma garantia, mas basta um dos módulos autorizar. Existe para o dado que é
// compartilhado por dois donos — as unidades geradoras/beneficiárias moram no
// cadastro do cliente (comercial) e são insumo do chamado (atendimento).
export async function exigirAlgumaPermissao(
  modulos: Modulo[],
  nivelMinimo: "leitura" | "escrita"
) {
  const session = await auth();
  if (!session?.user) {
    throw new ApiAuthError(401, "Não autenticado.");
  }

  const perfil = session.user.perfil as Perfil;

  const autorizado = modulos.some((modulo) => {
    const nivel = nivelAcesso(perfil, modulo);
    return nivelMinimo === "leitura" ? nivel !== "nenhum" : nivel === "escrita";
  });

  if (!autorizado) {
    throw new ApiAuthError(403, "Sem permissão para esta ação.");
  }

  const usuarioId = await resolverUsuarioId(session.user.id, session.user.email);

  return { session, perfil, usuarioId };
}

// Algumas ações são só do admin dentro de um módulo em que o atendimento
// também escreve — atribuir conversa a outro atendente, ocultar mensagem,
// silenciar aviso de alguém. A matriz de permissoes.ts não faz essa distinção
// (posVenda é "escrita" tanto para atendimento quanto para admin) e não deve
// fazer: ela descreve acesso a módulo, não hierarquia dentro dele. Por isso a
// checagem de perfil mora aqui, num lugar só, em vez de espalhar comparações
// soltas de string pelas actions.
export async function exigirAdmin(modulo: Modulo) {
  const contexto = await exigirPermissao(modulo, "escrita");

  if (contexto.perfil !== "admin") {
    throw new ApiAuthError(403, "Esta ação é restrita ao administrador.");
  }

  return contexto;
}

export function respostaErroApi(erro: unknown) {
  if (erro instanceof ApiAuthError) {
    return NextResponse.json({ erro: erro.message }, { status: erro.status });
  }
  console.error(erro);
  return NextResponse.json({ erro: "Erro interno." }, { status: 500 });
}
