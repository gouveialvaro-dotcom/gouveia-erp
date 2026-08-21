"use server";

import { z } from "zod";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { supabase } from "@/lib/supabase";
import { exigirPermissao } from "@/lib/api-auth";
import { podeRemoverMensagem } from "@/lib/chat";

export type EstadoChat = { erro?: string } | undefined;

// Participar da conversa é o que autoriza ler e escrever nela. A permissão de
// módulo ("chat") diz que a pessoa usa o chat; a linha em ParticipanteConversa
// diz de quais conversas. Esconder a conversa na tela não substitui isto.
async function ehParticipante(conversaId: string, usuarioId: string) {
  const { data } = await supabase
    .from("ParticipanteConversa")
    .select("id")
    .eq("conversaId", conversaId)
    .eq("usuarioId", usuarioId)
    .maybeSingle();
  return !!data;
}

const enviarSchema = z.object({
  corpo: z.string().trim().min(1, "Escreva alguma coisa.").max(4000, "Mensagem longa demais."),
});

export async function enviarMensagem(
  conversaId: string,
  _estado: EstadoChat,
  formData: FormData
): Promise<EstadoChat> {
  const { usuarioId } = await exigirPermissao("chat", "escrita");
  if (!(await ehParticipante(conversaId, usuarioId))) {
    return { erro: "Você não participa desta conversa." };
  }

  const dados = enviarSchema.safeParse({ corpo: formData.get("corpo") });
  if (!dados.success) {
    return { erro: dados.error.issues[0]?.message ?? "Mensagem inválida." };
  }

  const { error } = await supabase
    .from("Mensagem")
    .insert({ conversaId, autorId: usuarioId, corpo: dados.data.corpo });

  if (error) return { erro: "Não foi possível enviar a mensagem." };

  // Quem escreve já leu tudo que veio antes.
  await marcarLida(conversaId);
  revalidatePath(`/chat/${conversaId}`);
  return undefined;
}

export async function marcarLida(conversaId: string) {
  const { usuarioId } = await exigirPermissao("chat", "escrita");

  await supabase
    .from("ParticipanteConversa")
    .update({ ultimaLeituraEm: new Date().toISOString() })
    .eq("conversaId", conversaId)
    .eq("usuarioId", usuarioId);
}

// Uma só conversa direta por par de pessoas: abrir a conversa com alguém é
// idempotente, senão cada clique criaria uma thread nova e o histórico se
// espalharia.
export async function abrirConversaDireta(outroUsuarioId: string) {
  const { usuarioId } = await exigirPermissao("chat", "escrita");
  if (outroUsuarioId === usuarioId) redirect("/chat");

  const { data: minhas } = await supabase
    .from("ParticipanteConversa")
    .select("conversaId, conversa:Conversa!inner(tipo)")
    .eq("usuarioId", usuarioId)
    .eq("conversa.tipo", "direta");

  const idsDoOutro = new Set(
    (
      await supabase
        .from("ParticipanteConversa")
        .select("conversaId")
        .eq("usuarioId", outroUsuarioId)
    ).data?.map((p) => p.conversaId) ?? []
  );

  const existente = (minhas ?? []).find((p) => idsDoOutro.has(p.conversaId));
  if (existente) redirect(`/chat/${existente.conversaId}`);

  const { data: criada, error } = await supabase
    .from("Conversa")
    .insert({ tipo: "direta", criadaPorId: usuarioId })
    .select("id")
    .single();

  if (error || !criada) redirect("/chat");

  await supabase.from("ParticipanteConversa").insert([
    { conversaId: criada.id, usuarioId },
    { conversaId: criada.id, usuarioId: outroUsuarioId },
  ]);

  revalidatePath("/chat");
  redirect(`/chat/${criada.id}`);
}

const criarGrupoSchema = z.object({
  titulo: z.string().trim().min(1, "Dê um nome ao grupo."),
  participantes: z.array(z.string()).min(1, "Escolha ao menos uma pessoa."),
});

export async function criarGrupo(
  _estado: EstadoChat,
  formData: FormData
): Promise<EstadoChat> {
  const { usuarioId } = await exigirPermissao("chat", "escrita");

  const dados = criarGrupoSchema.safeParse({
    titulo: formData.get("titulo"),
    participantes: formData.getAll("participantes").map(String).filter(Boolean),
  });
  if (!dados.success) {
    return { erro: dados.error.issues[0]?.message ?? "Dados inválidos." };
  }

  const { data: criada, error } = await supabase
    .from("Conversa")
    .insert({ tipo: "grupo", titulo: dados.data.titulo, criadaPorId: usuarioId })
    .select("id")
    .single();

  if (error || !criada) return { erro: "Não foi possível criar o grupo." };

  // Os ids vêm do formulário: confere contra a lista de usuários ativos antes
  // de gravar, senão dá para pôr qualquer id (ou o "on" do checkbox) na
  // conversa. O criador entra sempre.
  const { data: validos } = await supabase
    .from("Usuario")
    .select("id")
    .eq("ativo", true)
    .in("id", dados.data.participantes);

  const membros = [...new Set([usuarioId, ...(validos ?? []).map((u) => u.id)])];
  await supabase
    .from("ParticipanteConversa")
    .insert(membros.map((id) => ({ conversaId: criada.id, usuarioId: id })));

  revalidatePath("/chat");
  redirect(`/chat/${criada.id}`);
}

// Toda obra tem uma conversa e todo usuário ativo participa dela. A conversa
// nasce no primeiro acesso, e não no cadastro da obra, para que as obras que
// já existiam também ganhem a sua. O mesmo passo faz o backfill de quem entrou
// na empresa depois que a conversa foi criada.
export async function abrirConversaDaObra(obraId: string) {
  const { usuarioId } = await exigirPermissao("chat", "escrita");

  const { data: obra } = await supabase
    .from("Obra")
    .select("id")
    .eq("id", obraId)
    .maybeSingle();
  if (!obra) redirect("/obras");

  let conversaId: string | undefined = (
    await supabase
      .from("Conversa")
      .select("id")
      .eq("obraId", obraId)
      .eq("tipo", "obra")
      .maybeSingle()
  ).data?.id;

  if (!conversaId) {
    const { data: criada } = await supabase
      .from("Conversa")
      .insert({ tipo: "obra", obraId, criadaPorId: usuarioId })
      .select("id")
      .single();
    conversaId = criada?.id;
  }

  if (!conversaId) redirect(`/obras/${obraId}`);

  const [{ data: ativos }, { data: jaDentro }] = await Promise.all([
    supabase.from("Usuario").select("id").eq("ativo", true),
    supabase.from("ParticipanteConversa").select("usuarioId").eq("conversaId", conversaId),
  ]);

  const dentro = new Set((jaDentro ?? []).map((p) => p.usuarioId));
  const faltando = (ativos ?? []).filter((u) => !dentro.has(u.id));

  if (faltando.length > 0) {
    await supabase
      .from("ParticipanteConversa")
      .insert(faltando.map((u) => ({ conversaId: conversaId!, usuarioId: u.id })));
  }

  revalidatePath("/chat");
  redirect(`/chat/${conversaId}`);
}

export async function removerMensagem(conversaId: string, mensagemId: string) {
  const { usuarioId, perfil } = await exigirPermissao("chat", "escrita");
  if (!podeRemoverMensagem(perfil)) return;

  await supabase
    .from("Mensagem")
    .update({ removidaEm: new Date().toISOString(), removidaPorId: usuarioId })
    .eq("id", mensagemId)
    .eq("conversaId", conversaId);

  revalidatePath(`/chat/${conversaId}`);
}
