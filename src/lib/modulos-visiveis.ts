import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { supabase } from "@/lib/supabase";
import { ehChaveMenu, type ChaveMenu } from "@/lib/modulos-menu";

// Lado servidor da restrição de módulos por usuário (ver modulos-menu.ts).
// Lido do banco a cada entrada no módulo, e não do JWT, para que a mudança feita
// pelo administrador valha sem a pessoa precisar sair e entrar de novo.

/** Chaves escondidas do usuário logado. Sem sessão ou sem linha, nada escondido. */
export async function modulosOcultosAtuais(): Promise<ChaveMenu[]> {
  const session = await auth();
  const id = session?.user?.id;
  const email = session?.user?.email;
  if (!id && !email) return [];

  let consulta = supabase.from("Usuario").select("modulosOcultos");
  consulta = id ? consulta.eq("id", id) : consulta.eq("email", email as string);
  let { data } = await consulta.maybeSingle();
  // Mesmo caso do resolverUsuarioId: id órfão no JWT, recupera pelo e-mail.
  if (!data && id && email) {
    ({ data } = await supabase.from("Usuario").select("modulosOcultos").eq("email", email).maybeSingle());
  }
  return (data?.modulosOcultos ?? []).filter(ehChaveMenu);
}

/** Para o layout de cada módulo: quem teve o módulo escondido volta ao início. */
export async function exigirModuloVisivel(chave: ChaveMenu) {
  const ocultos = await modulosOcultosAtuais();
  if (ocultos.includes(chave)) redirect("/");
}
