import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { resolverUsuarioId } from "@/lib/api-auth";
import { type Modulo, type Perfil, nivelAcesso } from "@/lib/permissoes";

// Para uso em Server Components de página: garante sessão válida e retorna
// perfil/usuário. Redireciona para /login se não autenticado.
export async function sessaoAtual() {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }
  return {
    userId: session.user.id,
    nome: session.user.name ?? session.user.email ?? "",
    perfil: session.user.perfil as Perfil,
  };
}

export async function acessoModulo(modulo: Modulo) {
  const { perfil, ...resto } = await sessaoAtual();
  return { ...resto, perfil, nivel: nivelAcesso(perfil, modulo) };
}

// O id da sessão vem do JWT e pode estar órfão (ver resolverUsuarioId em
// api-auth.ts). As Server Actions já gravam com o id conferido no banco;
// páginas que consultam dados por usuário precisam do mesmo id, senão
// escrevem numa identidade e leem de outra.
export async function usuarioIdAtual() {
  const session = await auth();
  return resolverUsuarioId(session?.user?.id, session?.user?.email);
}
