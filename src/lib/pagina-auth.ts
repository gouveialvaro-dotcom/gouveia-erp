import { redirect } from "next/navigation";
import { auth } from "@/auth";
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
