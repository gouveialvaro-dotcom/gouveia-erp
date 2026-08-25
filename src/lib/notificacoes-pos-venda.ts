// Distribuição das notificações do pós-venda. Só roda no servidor: usa o
// client de service role (ver src/lib/supabase.ts).

import { supabase } from "@/lib/supabase";
import { hojeIso } from "@/lib/pos-venda";
import { MINUTOS_UTEIS_SEM_DONO, minutosUteisEntre } from "@/lib/pos-venda-whatsapp";
import { podeEscrever, type Perfil } from "@/lib/permissoes";
import type { Database } from "@/lib/database.types";

type TipoNotificacao = Database["public"]["Enums"]["TipoNotificacaoPosVenda"];

const CHAVE_DEDUPE = "usuarioId,chamadoId,conversaId,tipo,referencia";

// Ter acesso ao módulo não faz ninguém ser notificado: o destinatário é
// escolhido usuário a usuário em /administracao.
async function destinatarios(exceto?: string | null) {
  const { data } = await supabase
    .from("Usuario")
    .select("id")
    .eq("ativo", true)
    .eq("notificaPosVenda", true);

  return (data ?? []).map((u) => u.id).filter((id) => id !== exceto);
}

export async function notificarPosVenda({
  chamadoId,
  tipo,
  titulo,
  detalhe,
  referencia,
  autorId,
}: {
  chamadoId: string;
  tipo: TipoNotificacao;
  titulo: string;
  detalhe?: string | null;
  // Torna o aviso único por evento. Repetir a mesma referência é o que impede
  // o mesmo fato de virar duas notificações.
  referencia: string;
  autorId?: string | null;
}) {
  // Quem fez a alteração não é avisado da própria alteração.
  const ids = await destinatarios(autorId);
  if (ids.length === 0) return;

  await supabase.from("NotificacaoPosVenda").upsert(
    ids.map((usuarioId) => ({
      usuarioId,
      chamadoId,
      tipo,
      titulo,
      detalhe: detalhe ?? null,
      referencia,
      geradaPorId: autorId ?? null,
    })),
    { onConflict: CHAVE_DEDUPE, ignoreDuplicates: true }
  );
}

/**
 * Vencimento não tem evento de escrita para disparar o aviso — o chamado
 * simplesmente atravessa a data. Cada destinatário gera os seus ao abrir o
 * app; a chave de deduplicação carrega o prazo que estourou, então prorrogar
 * o prazo e vencer de novo produz um aviso novo.
 */
export async function sincronizarVencidos(usuarioId: string) {
  const { data: usuario } = await supabase
    .from("Usuario")
    .select("ativo, notificaPosVenda")
    .eq("id", usuarioId)
    .maybeSingle();

  if (!usuario?.ativo || !usuario.notificaPosVenda) return;

  const { data: vencidos } = await supabase
    .from("Chamado")
    .select("id, numero, titulo, prazoLimite, cliente:Cliente(razaoSocial)")
    .neq("estagio", "concluido")
    .lt("prazoLimite", hojeIso());

  if (!vencidos?.length) return;

  await supabase.from("NotificacaoPosVenda").upsert(
    vencidos.map((c) => ({
      usuarioId,
      chamadoId: c.id,
      tipo: "chamado_vencido" as const,
      titulo: `Chamado #${c.numero} venceu o prazo`,
      detalhe: `${c.cliente?.razaoSocial ?? "—"} · ${c.titulo}`,
      referencia: c.prazoLimite,
    })),
    { onConflict: CHAVE_DEDUPE, ignoreDuplicates: true }
  );
}

/** Ids dos chamados com aviso não lido — marca o card no Kanban. */
export async function chamadosComNovidade(usuarioId: string) {
  const { data } = await supabase
    .from("NotificacaoPosVenda")
    .select("chamadoId")
    .eq("usuarioId", usuarioId)
    .is("lidaEm", null);

  return new Set((data ?? []).map((n) => n.chamadoId));
}

/**
 * Avisa sobre conversa de WhatsApp pendente e sem dono há mais de duas horas
 * úteis.
 *
 * Duas diferenças deliberadas em relação ao resto do módulo:
 *
 * 1. O destinatário NÃO é o flag notificaPosVenda, e sim todo mundo com escrita
 *    em posVenda. Fila parada é problema do time, não de um responsável
 *    nomeado — se dependesse de alguém marcado para receber, o caso de ninguém
 *    ter assumido seria justamente o caso em que ninguém é avisado. O admin
 *    desliga por usuário em notificaWhatsappSemDono, para o canal não virar um
 *    aviso que ninguém consegue silenciar.
 *
 * 2. O aviso não tem chamado. Por isso NotificacaoPosVenda.chamadoId virou
 *    nulável e ganhou conversaId (migração 008).
 *
 * Como no vencimento de chamado, não existe evento de escrita quando o tempo
 * estoura — a conversa só atravessa o limite. A verificação roda quando cada
 * destinatário abre o app. A referência carrega o instante da última mensagem,
 * então uma mensagem nova do cliente produz um aviso novo, e a mesma espera não
 * repete aviso.
 */
export async function sincronizarConversasSemDono(usuarioId: string) {
  const { data: usuario } = await supabase
    .from("Usuario")
    .select("ativo, perfil, notificaWhatsappSemDono")
    .eq("id", usuarioId)
    .maybeSingle();

  if (!usuario?.ativo || !usuario.notificaWhatsappSemDono) return;
  if (!podeEscrever(usuario.perfil as Perfil, "posVenda")) return;

  const { data: parametros } = await supabase
    .from("ParametroGeral")
    .select("horaInicioComercial, horaFimComercial, diasSemanaComercial")
    .limit(1)
    .maybeSingle();

  if (!parametros) return;

  const { data: paradas } = await supabase
    .from("ConversaWhatsapp")
    .select("id, telefoneExibicao, ultimaMensagemEm, cliente:Cliente(razaoSocial)")
    .eq("pendente", true)
    .is("donoId", null)
    .is("arquivadaEm", null)
    .not("ultimaMensagemEm", "is", null);

  if (!paradas?.length) return;

  const agora = new Date();
  const estouradas = paradas.filter(
    (c) =>
      minutosUteisEntre(new Date(c.ultimaMensagemEm!), agora, parametros) >=
      MINUTOS_UTEIS_SEM_DONO
  );

  if (!estouradas.length) return;

  await supabase.from("NotificacaoPosVenda").upsert(
    estouradas.map((c) => ({
      usuarioId,
      chamadoId: null,
      conversaId: c.id,
      tipo: "conversa_sem_dono" as const,
      titulo: "Conversa sem dono há mais de 2h",
      detalhe: `${c.cliente?.razaoSocial ?? c.telefoneExibicao} aguarda resposta`,
      referencia: c.ultimaMensagemEm!,
    })),
    { onConflict: CHAVE_DEDUPE, ignoreDuplicates: true }
  );
}

/** Aviso dirigido a um usuário sobre uma conversa — sem chamado envolvido. */
export async function notificarConversa({
  usuarioId,
  conversaId,
  tipo,
  titulo,
  detalhe,
  referencia,
  autorId,
}: {
  usuarioId: string;
  conversaId: string;
  tipo: TipoNotificacao;
  titulo: string;
  detalhe?: string | null;
  referencia: string;
  autorId?: string | null;
}) {
  // Quem faz a alteração não é avisado da própria alteração — mesma regra do
  // resto do módulo. O admin que atribui a si mesmo não recebe aviso.
  if (autorId && autorId === usuarioId) return;

  await supabase.from("NotificacaoPosVenda").upsert(
    [
      {
        usuarioId,
        chamadoId: null,
        conversaId,
        tipo,
        titulo,
        detalhe: detalhe ?? null,
        referencia,
        geradaPorId: autorId ?? null,
      },
    ],
    { onConflict: CHAVE_DEDUPE, ignoreDuplicates: true }
  );
}
