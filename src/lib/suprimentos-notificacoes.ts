import { supabase } from "@/lib/supabase";
import type { Database } from "@/lib/database.types";
import type { PapelSuprimentos } from "@/lib/suprimentos";

// Avisos do módulo Suprimentos (sino próprio na barra superior). Server-only.
//
// Gravar aviso nunca derruba a ação que o originou: a requisição criada vale
// mesmo que o aviso falhe — por isso os erros aqui são logados e engolidos.

type TipoNotificacao = Database["public"]["Enums"]["TipoNotificacaoSuprimentos"];

export type AvisoSuprimentos = {
  tipo: TipoNotificacao;
  titulo: string;
  detalhe?: string | null;
  requisicaoId?: string | null;
  pedidoCompraId?: string | null;
  /** Chave de deduplicação: o mesmo evento não avisa a mesma pessoa duas vezes. */
  referencia: string;
  geradaPorId?: string | null;
};

/**
 * Usuários ativos com algum dos papéis. Sem ninguém no papel, cai para os
 * administradores ativos: um aviso que não chega em ninguém é uma compra parada.
 */
export async function usuariosComPapel(...papeis: PapelSuprimentos[]) {
  // A FK vai nomeada: a tabela tem duas ligações com Usuario (usuarioId e
  // criadoPorId) e, sem o nome, o PostgREST recusa o embed por ambiguidade.
  const { data, error } = await supabase
    .from("PapelUsuarioSuprimentos")
    .select("usuarioId, usuario:Usuario!PapelUsuarioSuprimentos_usuarioId_fkey!inner(ativo)")
    .in("papel", papeis)
    .eq("usuario.ativo", true);
  if (error) console.error("Falha ao buscar papéis de Suprimentos:", error.message);

  const ids = [...new Set((data ?? []).map((l) => l.usuarioId))];
  if (ids.length > 0) return ids;

  const { data: admins } = await supabase
    .from("Usuario")
    .select("id")
    .eq("perfil", "admin")
    .eq("ativo", true);
  return (admins ?? []).map((a) => a.id);
}

export async function notificar(usuarioIds: string[], aviso: AvisoSuprimentos) {
  // Quem gerou o evento não precisa ser avisado do que acabou de fazer.
  const destino = [...new Set(usuarioIds)].filter((id) => id !== aviso.geradaPorId);
  if (destino.length === 0) return;

  const { error } = await supabase.from("NotificacaoSuprimentos").upsert(
    destino.map((usuarioId) => ({
      usuarioId,
      tipo: aviso.tipo,
      titulo: aviso.titulo,
      detalhe: aviso.detalhe ?? null,
      requisicaoId: aviso.requisicaoId ?? null,
      pedidoCompraId: aviso.pedidoCompraId ?? null,
      referencia: aviso.referencia,
      geradaPorId: aviso.geradaPorId ?? null,
    })),
    { onConflict: "usuarioId,tipo,referencia", ignoreDuplicates: true }
  );
  if (error) console.error("Falha ao gravar aviso de Suprimentos:", error.message);
}
