import { redirect } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { ApiAuthError, exigirPermissao } from "@/lib/api-auth";
import { acessoModulo, usuarioIdAtual } from "@/lib/pagina-auth";
import { podeLer } from "@/lib/permissoes";
import type { PapelSuprimentos } from "@/lib/suprimentos";
import { modulosOcultosAtuais } from "@/lib/modulos-visiveis";

// Quem vê cada aba do módulo. Requisições é de todos: qualquer um pede material,
// e o solicitante comum vê só ela (e as próprias requisições lá dentro). O
// requisitante sem papel ainda registra o recebimento do que pediu, pela página
// da requisição → pedido.
export const PAPEIS_DA_ABA = {
  inicio: ["comprador", "aprovador_gerencia", "aprovador_diretoria"],
  aprovacoes: ["aprovador_gerencia", "aprovador_diretoria"],
  pedidos: ["comprador", "aprovador_gerencia", "aprovador_diretoria"],
  recebimentos: ["recebedor", "comprador"],
  produtos: ["comprador"],
  fornecedores: ["comprador"],
} satisfies Record<string, PapelSuprimentos[]>;

export type AbaSuprimentos = keyof typeof PAPEIS_DA_ABA;

// Autorização DENTRO do módulo Suprimentos.
//
// A matriz de permissoes.ts só diz quem entra no módulo (todo mundo). Quem
// cota, aprova ou recebe sai dos papéis em PapelUsuarioSuprimentos. O admin
// do sistema passa em qualquer checagem de papel: é quem configura os papéis e
// precisa conseguir destravar o fluxo se alguém sair da empresa.

export async function papeisDoUsuario(usuarioId: string) {
  const { data } = await supabase
    .from("PapelUsuarioSuprimentos")
    .select("papel")
    .eq("usuarioId", usuarioId);
  return new Set((data ?? []).map((linha) => linha.papel));
}

function temAlgum(
  papeis: Set<PapelSuprimentos>,
  ehAdmin: boolean,
  exigidos: PapelSuprimentos[]
) {
  return ehAdmin || exigidos.some((papel) => papeis.has(papel));
}

/** Para Server Components de página. Redireciona quem não entra no módulo. */
export async function contextoSuprimentos() {
  const { perfil, nome } = await acessoModulo("suprimentos");
  if (!podeLer(perfil, "suprimentos")) redirect("/");

  const usuarioId = await usuarioIdAtual();
  const papeis = await papeisDoUsuario(usuarioId);
  const ehAdmin = perfil === "admin";

  const tem = (...exigidos: PapelSuprimentos[]) => temAlgum(papeis, ehAdmin, exigidos);

  const veAba = (aba: AbaSuprimentos) => tem(...PAPEIS_DA_ABA[aba]);
  /** Para a página de uma aba: sem o papel, volta para Requisições. */
  const exigirAba = (aba: AbaSuprimentos) => {
    if (!veAba(aba)) redirect("/suprimentos/requisicoes");
  };

  return {
    usuarioId,
    nome,
    veAba,
    exigirAba,
    perfil,
    papeis,
    ehAdmin,
    tem,
    // Quem trabalha o fluxo enxerga todas as requisições; o requisitante
    // comum, só as próprias.
    veTodasRequisicoes: tem("comprador", "aprovador_gerencia", "aprovador_diretoria", "recebedor"),
  };
}

/**
 * Para Server Actions. Sem papéis informados, basta estar logado no módulo
 * (caso da requisição, que qualquer um abre). Lança ApiAuthError (403) quando
 * falta o papel.
 */
export async function exigirPapelSuprimentos(...exigidos: PapelSuprimentos[]) {
  const contexto = await exigirPermissao("suprimentos", "escrita");
  // Módulo escondido desta pessoa na Administração vale também para as ações.
  if ((await modulosOcultosAtuais()).includes("suprimentos")) {
    throw new ApiAuthError(403, "Suprimentos não está liberado para você.");
  }
  const papeis = await papeisDoUsuario(contexto.usuarioId);
  const ehAdmin = contexto.perfil === "admin";

  if (exigidos.length > 0 && !temAlgum(papeis, ehAdmin, exigidos)) {
    throw new ApiAuthError(403, "Sem permissão para esta ação em Suprimentos.");
  }

  return { ...contexto, papeis, ehAdmin };
}

/** Configuração do módulo (papéis, alçadas, empresas): só o admin do sistema. */
export async function exigirAdminSuprimentos() {
  const contexto = await exigirPapelSuprimentos();
  if (!contexto.ehAdmin) {
    throw new ApiAuthError(403, "Esta configuração é restrita ao administrador.");
  }
  return contexto;
}

/** Converte o erro de autorização em mensagem para o formulário. */
export function mensagemDeErro(erro: unknown) {
  if (erro instanceof ApiAuthError) return erro.message;
  console.error(erro);
  return "Erro inesperado. Tente novamente.";
}

export async function parametrosSuprimentos() {
  const { data } = await supabase
    .from("ParametroSuprimentos")
    .select("*")
    .eq("id", "padrao")
    .maybeSingle();
  return {
    limiteComprador: Number(data?.limiteComprador ?? 500),
    limiteGerencia: Number(data?.limiteGerencia ?? 3000),
    minimoCotacoes: data?.minimoCotacoes ?? 3,
  };
}
