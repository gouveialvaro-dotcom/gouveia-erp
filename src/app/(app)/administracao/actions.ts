"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { supabase } from "@/lib/supabase";
import { exigirPermissao } from "@/lib/api-auth";
import { podeLer, type Perfil } from "@/lib/permissoes";

const ROTA = "/administracao";

export type EstadoFormUsuario = { erro?: string } | undefined;

const usuarioSchema = z.object({
  perfil: z.enum(["comercial", "engenharia", "obra", "atendimento", "admin"]),
  ativo: z.coerce.boolean(),
  notificaPosVenda: z.coerce.boolean(),
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
    notificaPosVenda: marcado("notificaPosVenda"),
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
      // Quem não enxerga o módulo não pode ficar marcado para receber avisos
      // dele — a caixa some da tela, mas a regra tem de valer no servidor.
      notificaPosVenda:
        dados.data.notificaPosVenda && podeLer(dados.data.perfil as Perfil, "posVenda"),
    })
    .eq("id", usuarioId);

  if (error) return { erro: "Não foi possível salvar o usuário." };

  revalidatePath(ROTA);
}
