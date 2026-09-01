"use server";

import { z } from "zod";
import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { supabase } from "@/lib/supabase";
import { exigirPermissao } from "@/lib/api-auth";
import { podeEscrever, type Perfil } from "@/lib/permissoes";
import type { EstadoExclusao } from "@/components/ui/botao-excluir";

const ROTA = "/administracao";

// `ok` existe para o diálogo de novo usuário saber que pode se fechar — a
// action não redireciona, só revalida a lista no lugar.
export type EstadoFormUsuario = { erro?: string; ok?: boolean } | undefined;

// notificaPosVenda saiu daqui: o destinatário do aviso de pós-venda deixou de
// ser escolhido usuário a usuário e passou a ser derivado do próprio chamado —
// o responsável, mais os admins ativos. A coluna continua no banco, inativa
// (ver scripts/sql/010-chamado-responsavel.sql).
const usuarioSchema = z.object({
  perfil: z.enum(["comercial", "engenharia", "obra", "atendimento", "admin"]),
  ativo: z.coerce.boolean(),
  notificaWhatsappSemDono: z.coerce.boolean(),
});

export async function atualizarUsuario(
  usuarioId: string,
  _estado: EstadoFormUsuario,
  formData: FormData
): Promise<EstadoFormUsuario> {
  await exigirPermissao("administracao", "escrita");

  const marcado = (campo: string) =>
    formData.get(campo) === "on" || formData.get(campo) === "true";

  const dados = usuarioSchema.safeParse({
    perfil: formData.get("perfil"),
    ativo: marcado("ativo"),
    notificaWhatsappSemDono: marcado("notificaWhatsappSemDono"),
  });

  if (!dados.success) {
    return { erro: dados.error.issues[0]?.message ?? "Dados inválidos." };
  }

  // Rebaixar ou desativar o último administrador ativo tranca todo mundo para
  // fora da gestão de usuários — sem outro caminho de recuperação na aplicação.
  const perdeAdmin = dados.data.perfil !== "admin" || !dados.data.ativo;
  if (perdeAdmin) {
    const { data: admins } = await supabase
      .from("Usuario")
      .select("id")
      .eq("perfil", "admin")
      .eq("ativo", true);

    const restantes = (admins ?? []).filter((u) => u.id !== usuarioId);
    if (restantes.length === 0) {
      return { erro: "É preciso manter pelo menos um administrador ativo." };
    }
  }

  const { error } = await supabase
    .from("Usuario")
    .update({
      perfil: dados.data.perfil,
      ativo: dados.data.ativo,
      // Só faz sentido para quem responde: o aviso é sobre fila de atendimento.
      notificaWhatsappSemDono:
        dados.data.notificaWhatsappSemDono &&
        podeEscrever(dados.data.perfil as Perfil, "posVenda"),
    })
    .eq("id", usuarioId);

  if (error) return { erro: "Não foi possível salvar o usuário." };

  revalidatePath(ROTA);
}

const novoUsuarioSchema = z.object({
  nome: z.string().trim().min(1, "Informe o nome do usuário."),
  // O e-mail é a credencial de login e a chave usada pelo seed e pela
  // recuperação de sessão (resolverUsuarioId), então entra normalizado:
  // maiúsculas ou espaço sobrando viram um usuário que não consegue entrar.
  email: z.email("Informe um e-mail válido.").trim().toLowerCase(),
  senha: z.string().min(8, "A senha precisa ter pelo menos 8 caracteres."),
  perfil: z.enum(["comercial", "engenharia", "obra", "atendimento", "admin"]),
  ativo: z.coerce.boolean(),
  notificaWhatsappSemDono: z.coerce.boolean(),
});

export async function criarUsuario(
  _estado: EstadoFormUsuario,
  formData: FormData
): Promise<EstadoFormUsuario> {
  await exigirPermissao("administracao", "escrita");

  const marcado = (campo: string) =>
    formData.get(campo) === "on" || formData.get(campo) === "true";

  const dados = novoUsuarioSchema.safeParse({
    nome: formData.get("nome"),
    email: formData.get("email"),
    senha: formData.get("senha"),
    perfil: formData.get("perfil"),
    ativo: marcado("ativo"),
    notificaWhatsappSemDono: marcado("notificaWhatsappSemDono"),
  });

  if (!dados.success) {
    return { erro: dados.error.issues[0]?.message ?? "Dados inválidos." };
  }

  const senhaHash = await bcrypt.hash(dados.data.senha, 10);

  const { error } = await supabase.from("Usuario").insert({
    nome: dados.data.nome,
    email: dados.data.email,
    senhaHash,
    perfil: dados.data.perfil,
    ativo: dados.data.ativo,
    // Só faz sentido para quem responde: o aviso é sobre fila de atendimento.
    notificaWhatsappSemDono:
      dados.data.notificaWhatsappSemDono &&
      podeEscrever(dados.data.perfil as Perfil, "posVenda"),
  });

  if (error) {
    if (error.code === "23505") {
      return { erro: `Já existe um usuário com o e-mail ${dados.data.email}.` };
    }
    return { erro: "Não foi possível criar o usuário." };
  }

  revalidatePath(ROTA);
  return { ok: true };
}

export async function excluirUsuario(
  _estado: EstadoExclusao,
  formData: FormData
): Promise<EstadoExclusao> {
  const { usuarioId: eu } = await exigirPermissao("administracao", "escrita");

  const alvoId = String(formData.get("usuarioId") ?? "");
  if (!alvoId) return { erro: "Usuário não informado." };

  // Excluir a si mesmo derruba a própria sessão no meio da operação e pode
  // ainda ser a saída do último admin — barrado antes de qualquer consulta.
  if (alvoId === eu) {
    return { erro: "Você não pode excluir o seu próprio usuário." };
  }

  const { data: alvo } = await supabase
    .from("Usuario")
    .select("id, nome, perfil, ativo")
    .eq("id", alvoId)
    .maybeSingle();

  if (!alvo) return { erro: "Usuário não encontrado." };

  // Mesmo motivo de atualizarUsuario: sem admin ativo ninguém volta a esta tela.
  if (alvo.perfil === "admin" && alvo.ativo) {
    const { data: admins } = await supabase
      .from("Usuario")
      .select("id")
      .eq("perfil", "admin")
      .eq("ativo", true);

    const restantes = (admins ?? []).filter((u) => u.id !== alvoId);
    if (restantes.length === 0) {
      return { erro: "É preciso manter pelo menos um administrador ativo." };
    }
  }

  const { error } = await supabase.from("Usuario").delete().eq("id", alvoId);

  if (error) {
    // 23503: o banco recusa apagar quem assina orçamento, proposta, chamado,
    // mensagem, oportunidade ou anexo. Apagar em cascata levaria junto o
    // histórico da empresa, então a saída é desativar — o login para de
    // funcionar e o registro antigo continua com autor.
    if (error.code === "23503") {
      return {
        erro:
          "Este usuário já tem registros no sistema (orçamentos, chamados, mensagens...) e não pode ser apagado sem levar esse histórico junto. Desmarque \"Ativo\" para bloquear o acesso dele.",
      };
    }
    return { erro: "Não foi possível excluir o usuário." };
  }

  revalidatePath(ROTA);
}

// --- Senha ---------------------------------------------------------------
// Dois caminhos, de propósito diferentes:
//
//   alterarMinhaSenha    — qualquer pessoa logada, sobre a própria conta,
//                          provando que sabe a senha atual;
//   redefinirSenhaUsuario — administrador sobre a conta de outra pessoa, sem
//                          a senha antiga (é o caso de quem esqueceu), o que
//                          antes só existia rodando `npm run seed`.
//
// Em nenhum dos dois a senha nova volta para a tela: quem redefine combina a
// provisória com a pessoa por fora e ela troca depois pelo primeiro caminho.
export type EstadoSenha = { erro?: string; ok?: boolean } | undefined;

const minhaSenhaSchema = z
  .object({
    senhaAtual: z.string().min(1, "Informe a senha atual."),
    novaSenha: z.string().min(8, "A nova senha precisa ter pelo menos 8 caracteres."),
    confirmacao: z.string().min(1, "Repita a nova senha."),
  })
  .refine((d) => d.novaSenha === d.confirmacao, {
    message: "A confirmação não confere com a nova senha.",
    path: ["confirmacao"],
  })
  .refine((d) => d.novaSenha !== d.senhaAtual, {
    message: "A nova senha precisa ser diferente da atual.",
    path: ["novaSenha"],
  });

export async function alterarMinhaSenha(
  _estado: EstadoSenha,
  formData: FormData
): Promise<EstadoSenha> {
  // "conta", e não "administracao": esta action é o único ponto de
  // /administracao que os demais perfis alcançam.
  const { usuarioId } = await exigirPermissao("conta", "escrita");

  const dados = minhaSenhaSchema.safeParse({
    senhaAtual: formData.get("senhaAtual"),
    novaSenha: formData.get("novaSenha"),
    confirmacao: formData.get("confirmacao"),
  });

  if (!dados.success) {
    return { erro: dados.error.issues[0]?.message ?? "Dados inválidos." };
  }

  // O id vem de exigirPermissao (conferido no banco), nunca do formulário:
  // é o que impede alguém de mandar o id de outra pessoa no envio.
  const { data: usuario } = await supabase
    .from("Usuario")
    .select("senhaHash")
    .eq("id", usuarioId)
    .maybeSingle();

  if (!usuario) return { erro: "Usuário não encontrado." };

  const confere = await bcrypt.compare(dados.data.senhaAtual, usuario.senhaHash);
  if (!confere) return { erro: "A senha atual não confere." };

  const senhaHash = await bcrypt.hash(dados.data.novaSenha, 10);

  const { error } = await supabase
    .from("Usuario")
    .update({ senhaHash })
    .eq("id", usuarioId);

  if (error) return { erro: "Não foi possível alterar a senha." };

  return { ok: true };
}

const redefinirSenhaSchema = z
  .object({
    novaSenha: z.string().min(8, "A nova senha precisa ter pelo menos 8 caracteres."),
    confirmacao: z.string().min(1, "Repita a nova senha."),
  })
  .refine((d) => d.novaSenha === d.confirmacao, {
    message: "A confirmação não confere com a nova senha.",
    path: ["confirmacao"],
  });

export async function redefinirSenhaUsuario(
  usuarioId: string,
  _estado: EstadoSenha,
  formData: FormData
): Promise<EstadoSenha> {
  const { usuarioId: eu } = await exigirPermissao("administracao", "escrita");

  // A própria senha se troca pelo cartão "Minha senha", que exige a atual.
  // Aceitar o atalho aqui seria abrir mão dessa prova sem ganhar nada: quem
  // está logado já tem a tela na frente.
  if (usuarioId === eu) {
    return { erro: 'Para trocar a sua própria senha, use o cartão "Minha senha".' };
  }

  const dados = redefinirSenhaSchema.safeParse({
    novaSenha: formData.get("novaSenha"),
    confirmacao: formData.get("confirmacao"),
  });

  if (!dados.success) {
    return { erro: dados.error.issues[0]?.message ?? "Dados inválidos." };
  }

  const { data: alvo } = await supabase
    .from("Usuario")
    .select("id")
    .eq("id", usuarioId)
    .maybeSingle();

  if (!alvo) return { erro: "Usuário não encontrado." };

  const senhaHash = await bcrypt.hash(dados.data.novaSenha, 10);

  const { error } = await supabase
    .from("Usuario")
    .update({ senhaHash })
    .eq("id", usuarioId);

  if (error) return { erro: "Não foi possível redefinir a senha." };

  return { ok: true };
}
