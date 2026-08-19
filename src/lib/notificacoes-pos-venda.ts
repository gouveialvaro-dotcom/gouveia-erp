// Distribuição das notificações do pós-venda. Só roda no servidor: usa o
// client de service role (ver src/lib/supabase.ts).

import { supabase } from "@/lib/supabase";
import { hojeIso } from "@/lib/pos-venda";
import type { Database } from "@/lib/database.types";

type TipoNotificacao = Database["public"]["Enums"]["TipoNotificacaoPosVenda"];

const CHAVE_DEDUPE = "usuarioId,chamadoId,tipo,referencia";

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
