import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { supabase } from "@/lib/supabase";
import { ApiAuthError } from "@/lib/api-auth";
import type { Perfil } from "@/lib/permissoes";
import {
  cadastrosVisiveis,
  ehChaveMenu,
  type ChaveMenu,
  type TipoCadastro,
} from "@/lib/modulos-menu";

// Lado servidor da restrição de módulos por usuário (ver modulos-menu.ts).
// Lido do banco a cada entrada no módulo, e não do JWT, para que a mudança feita
// pelo administrador valha sem a pessoa precisar sair e entrar de novo.

type Acessos = { perfil: Perfil; ocultos: string[]; liberados: string[] };

/** Marcações do usuário logado. Sem sessão ou sem linha, nada escondido nem liberado. */
export async function acessosAtuais(): Promise<Acessos> {
  const session = await auth();
  const perfil = (session?.user?.perfil ?? "") as Perfil;
  const id = session?.user?.id;
  const email = session?.user?.email;
  const vazio = { perfil, ocultos: [], liberados: [] };
  if (!id && !email) return vazio;

  const colunas = "modulosOcultos, modulosLiberados";
  let { data } = id
    ? await supabase.from("Usuario").select(colunas).eq("id", id).maybeSingle()
    : { data: null };
  // Mesmo caso do resolverUsuarioId: id órfão no JWT, recupera pelo e-mail.
  if (!data && email) {
    ({ data } = await supabase.from("Usuario").select(colunas).eq("email", email).maybeSingle());
  }
  if (!data) return vazio;
  return { perfil, ocultos: data.modulosOcultos ?? [], liberados: data.modulosLiberados ?? [] };
}

/** Módulos do menu escondidos do usuário logado. */
export async function modulosOcultosAtuais(): Promise<ChaveMenu[]> {
  return (await acessosAtuais()).ocultos.filter(ehChaveMenu);
}

/** Para o layout de cada módulo: quem teve o módulo escondido volta ao início. */
export async function exigirModuloVisivel(chave: ChaveMenu) {
  const ocultos = await modulosOcultosAtuais();
  if (ocultos.includes(chave)) redirect("/");
}

/** Tipos de cadastro que o usuário logado vê. */
export async function cadastrosAtuais() {
  const { perfil, ocultos, liberados } = await acessosAtuais();
  return cadastrosVisiveis(perfil, ocultos, liberados);
}

/** Para o layout de cada cadastro: sem acesso, volta para Cadastros. */
export async function exigirCadastroVisivel(tipo: TipoCadastro) {
  const visiveis = await cadastrosAtuais();
  if (!visiveis.some((c) => c.tipo === tipo)) redirect("/cadastros");
}

/** Para Server Actions de um cadastro liberado por pessoa (403 sem acesso). */
export async function exigirAcessoCadastro(tipo: TipoCadastro) {
  const visiveis = await cadastrosAtuais();
  if (!visiveis.some((c) => c.tipo === tipo)) {
    throw new ApiAuthError(403, "Você não tem acesso a este cadastro.");
  }
}
